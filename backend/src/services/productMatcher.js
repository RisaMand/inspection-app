/**
 * Resolves which `products` row an inspection capture belongs to, creating
 * one if none exists yet. This is the module that makes the PS's "repository
 * of scanned products" requirement real -- previously nothing in the backend
 * ever wrote to `products` at all.
 *
 * Match strategy, in order:
 *   1. Exact barcode match -- real, reliable, built now. Implemented as a
 *      single atomic upsert (INSERT ... ON CONFLICT), not a separate
 *      check-then-insert, because the same barcode can legitimately appear
 *      twice in one sync batch (two photos of the same product in one visit)
 *      and a check-then-insert would race against itself.
 *   2. Fuzzy brand/product-name text match -- SHELL, intentionally not
 *      implemented. OCR-derived text isn't reliable enough yet for fuzzy
 *      matching to be trustworthy: a wrong match would silently attach a
 *      capture's violation history to the wrong product, which is worse than
 *      just creating a duplicate. Always returns null until this is
 *      deliberately built (Person 3/4's field-extraction accuracy is the
 *      real gate on this, not a backend decision).
 *   3. No match found -- create a brand-new product row, even with zero
 *      identifying data. Mirrors the offline-first principle already applied
 *      to `barcode_value`/`product_name` nullability: a real capture should
 *      never become unstorable for lack of a barcode or name.
 *
 * `client` is whatever the caller is already using (a pool or an in-flight
 * transaction client) -- this module never opens its own connection or
 * transaction, so it composes cleanly with sync.controller.js's existing
 * per-request transaction.
 */

async function findByBarcode(client, barcodeValue) {
  const result = await client.query(
    'SELECT * FROM products WHERE barcode_value = $1',
    [barcodeValue]
  );
  return result.rows[0] || null;
}

// SHELL -- see module doc above. Do not implement a naive substring/ILIKE
// match here; a silent wrong match is worse than a duplicate product row.
async function findByFuzzyText(_client, _identifiers) {
  return null;
}

async function upsertByBarcode(client, { barcodeValue, productName, brandName, manufacturerName, declaredQuantity }) {
  const result = await client.query(`
    INSERT INTO products (barcode_value, product_name, brand_name, manufacturer_name, declared_quantity)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (barcode_value) WHERE barcode_value IS NOT NULL
    DO UPDATE SET updated_at = NOW()
    RETURNING *
  `, [
    barcodeValue,
    productName || null,
    brandName || null,
    manufacturerName || null,
    declaredQuantity || null
  ]);
  return result.rows[0];
}

async function createProduct(client, { barcodeValue, productName, brandName, manufacturerName, declaredQuantity }) {
  const result = await client.query(`
    INSERT INTO products (barcode_value, product_name, brand_name, manufacturer_name, declared_quantity)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    barcodeValue || null,
    productName || null,
    brandName || null,
    manufacturerName || null,
    declaredQuantity || null
  ]);
  return result.rows[0];
}

/**
 * @param {import('pg').PoolClient|import('pg').Pool} client
 * @param {{barcodeValue?: string|null, productName?: string|null, brandName?: string|null, manufacturerName?: string|null, declaredQuantity?: string|null}} identifiers
 * @returns {Promise<object>} the resolved (existing or newly created) products row
 */
async function resolveProduct(client, identifiers) {
  const { barcodeValue } = identifiers;

  if (barcodeValue) {
    return upsertByBarcode(client, identifiers);
  }

  const fuzzyMatch = await findByFuzzyText(client, identifiers);
  if (fuzzyMatch) return fuzzyMatch;

  return createProduct(client, identifiers);
}

module.exports = {
  resolveProduct,
  findByBarcode,
  findByFuzzyText,
  upsertByBarcode,
  createProduct
};
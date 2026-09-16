const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const productMatcher = require('../../src/services/productMatcher');

var inspectorToken;
var ruleConfigVersion = 'LMR-2011-v1';

beforeAll(async () => {
  var res = await request(app).post('/api/v1/auth/login').send({ email: 'inspector@compliance.local', password: 'password123' });
  inspectorToken = res.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

describe('productMatcher — direct unit coverage', () => {

  it('findByBarcode returns null for an unknown barcode', async () => {
    const result = await productMatcher.findByBarcode(pool, 'NOPE-DOES-NOT-EXIST');
    expect(result).toBeNull();
  });

  it('findByBarcode finds a product inserted directly by barcode', async () => {
    // Inserted via a plain INSERT (not upsertByBarcode) deliberately --
    // see the note at the bottom of this file for why.
    await pool.query(
      "INSERT INTO products (barcode_value, product_name) VALUES ($1, $2)",
      ['UNIT-TEST-BC-1', 'Direct Insert Product']
    );
    const result = await productMatcher.findByBarcode(pool, 'UNIT-TEST-BC-1');
    expect(result).not.toBeNull();
    expect(result.product_name).toEqual('Direct Insert Product');
  });

  it('createProduct creates a row with zero identifying data', async () => {
    const product = await productMatcher.createProduct(pool, {});
    expect(product.id).toBeDefined();
    expect(product.barcode_value).toBeNull();
    expect(product.product_name).toBeNull();
  });

  it('createProduct stores whatever partial data is given', async () => {
    const product = await productMatcher.createProduct(pool, {
      productName: 'Partial Data Product',
      brandName: 'SomeBrand'
      // no barcode, no manufacturer, no quantity -- all real, valid states
    });
    expect(product.product_name).toEqual('Partial Data Product');
    expect(product.brand_name).toEqual('SomeBrand');
    expect(product.barcode_value).toBeNull();
  });

  it('findByFuzzyText is an honest no-op shell -- always returns null, never a false match', async () => {
    // This documents the contract: whoever implements real fuzzy matching
    // later must preserve "no match -> null", and this test should start
    // failing the moment someone makes it return something, which is the
    // point -- it forces a deliberate decision to update this test rather
    // than silently changing matching behavior.
    const result = await productMatcher.findByFuzzyText(pool, {
      productName: 'Direct Insert Product', // matches an existing row above on name
      brandName: 'SomeBrand'
    });
    expect(result).toBeNull();
  });

  it('resolveProduct with no barcode always creates a new product (never fuzzy-matches)', async () => {
    const first = await productMatcher.resolveProduct(pool, { productName: 'Repeatable Name' });
    const second = await productMatcher.resolveProduct(pool, { productName: 'Repeatable Name' });
    // Same identifying text, but no barcode -- the fuzzy shell returning
    // null means these MUST be two different product rows, not the same
    // one matched twice. This is expected/current behavior, not a bug --
    // see productMatcher.js's module doc for why fuzzy matching isn't
    // implemented yet.
    expect(first.id).not.toEqual(second.id);
  });

});

describe('Sync -> product linkage (no-barcode path, real end-to-end)', () => {

  it('a synced CREATE with no barcode still gets linked to a real products row', async () => {
    const clientInspectionId = crypto.randomUUID();
    const res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId,
          operation: 'CREATE',
          clientUpdatedAt: '2026-01-01T00:00:00.000Z',
          ruleConfigVersion,
          payload: { productName: 'No Barcode Sync Product', brandName: 'SyncBrand' }
        }]
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('SYNCED');

    const inspectionRow = await pool.query(
      'SELECT product_id FROM inspections WHERE client_inspection_id = $1',
      [clientInspectionId]
    );
    expect(inspectionRow.rows[0].product_id).not.toBeNull();

    const productRow = await pool.query(
      'SELECT product_name, brand_name FROM products WHERE id = $1',
      [inspectionRow.rows[0].product_id]
    );
    expect(productRow.rows[0].product_name).toEqual('No Barcode Sync Product');
  });

  it('a synced CREATE with zero product data still gets linked to a real (empty) products row', async () => {
    const clientInspectionId = crypto.randomUUID();
    const res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId,
          operation: 'CREATE',
          clientUpdatedAt: '2026-01-01T00:00:00.000Z',
          ruleConfigVersion,
          payload: {}
        }]
      });

    expect(res.statusCode).toEqual(200);

    const inspectionRow = await pool.query(
      'SELECT product_id FROM inspections WHERE client_inspection_id = $1',
      [clientInspectionId]
    );
    expect(inspectionRow.rows[0].product_id).not.toBeNull();
  });

});

describe('Param validation (A5)', () => {
  it('GET /products/:id/history with a malformed id returns clean 400, not a raw 500', async () => {
    const res = await request(app)
      .get('/api/v1/products/not-a-real-uuid/history')
      .set('Authorization', `Bearer ${inspectorToken}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toEqual('VALIDATION_ERROR');
  });
});

// -----------------------------------------------------------------------
// NOT COVERED HERE, ON PURPOSE:
//
// productMatcher.upsertByBarcode (and therefore resolveProduct/the sync
// CREATE and UPDATE branches whenever a real barcodeValue is present) uses
//   ON CONFLICT (barcode_value) WHERE barcode_value IS NOT NULL DO UPDATE ...
// which is the correct, necessary form against a partial unique index in
// real Postgres -- but pg-mem's SQL parser does not support the WHERE-
// qualified ON CONFLICT clause at all (confirmed directly: it throws a
// parse error, not a constraint error, regardless of whether the barcode
// actually conflicts). This is a pg-mem limitation, not a bug in the
// production code.
//
// This path was instead verified live against real Supabase Postgres:
// logged in as a real inspector, POSTed a real sync CREATE with
// barcodeValue set, and confirmed in the live DB that the created
// inspection's product_id matched the created product's id exactly, and
// separately confirmed two different barcodes both insert successfully
// while a duplicate barcode is correctly rejected.
//
// If pg-mem ever adds support for this syntax, the right fix is to add
// direct tests here for upsertByBarcode (same-barcode-twice-in-one-call
// returns the same row; different barcodes create different rows) rather
// than working around the gap by weakening the production query.
// -----------------------------------------------------------------------
// src/lib/api/translateItemForSync.js
// FE<->BE arc, Section 2.1 (field-name translation) + 2.2 (MRP numeric
// parse). Pure function: takes the shape useSession.js already builds
// (item + extractedFields from fieldExtractor.js, session, imageReferences
// already-uploaded paths) and returns exactly one `items[]` entry matching
// backend/src/validators/sync.validator.js's createItemSchema/updateItemSchema
// `payload` shape, verbatim field-for-field.
//
// 2.3 (manufacturer/packer/importer/marketed-by role split) has since
// landed in fieldExtractor.js -- packerName/Address, importerName/Address,
// and marketedByName/Address below now resolve to real values whenever the
// label declares that role, reading PACKER_ADDRESS/PACKER,
// IMPORTER_ADDRESS/IMPORTER, MARKETED_BY_ADDRESS/MARKETED_BY exactly as
// fieldExtractor.js now writes them.

/**
 * Parses a raw MRP string (e.g. "Rs. 45.00", "₹45/-", "MRP: 45.50 (incl. of
 * all taxes)") into a plain number for the backend's `mrp: number` field.
 * Backend wants a float; the cleaned field value (currency symbol, tax
 * phrasing intact, label already stripped) is kept separately for
 * mrpRawText, so nothing is lost -- this only strips symbols to get a
 * parseable numeric substring.
 * @param {string | null | undefined} raw
 * @returns {number | null}
 */
export function parseMrpValue(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw);
  const match = str.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0].replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

// Reads a field's display value the same way fieldExtractor.js's own
// attachCanonicalAliases helper does (value ?? text, both already present
// on every field object it produces) -- never invents a value.
function fieldValue(extracted, fieldName) {
  const f = extracted?.[fieldName];
  if (!f) return null;
  return f.value ?? f.text ?? null;
}

/**
 * Builds the `payload` object for one sync item, per
 * createItemSchema/updateItemSchema in backend/src/validators/sync.validator.js.
 * Every key the backend contract declares is present on the returned
 * object, explicitly, even when its value is null -- no key is ever
 * omitted because its source doesn't exist on the FE yet.
 *
 * @param {object} item - one entry from session.items (useSession.js shape)
 * @param {object} item.checkResult - output of evaluateVerdict(), carries .extractedFields
 * @param {string[]} [imageReferences] - already-uploaded Supabase Storage paths (from photoUpload.js), NOT item.photos (those are local data URLs, never sent to this endpoint)
 * @param {string | null} [sessionServerId] - session.serverId, threaded in by the caller (2.4)
 * @param {string} ruleConfigVersion - active rule-set version tag, e.g. Ruleconfig.json's own version field
 * @returns {object} payload matching the backend's schema exactly
 */
export function translateItemPayload(item, { imageReferences = [], sessionServerId = null, ruleConfigVersion } = {}) {
  const extracted = item?.checkResult?.extractedFields || {};

  const mrpText = fieldValue(extracted, 'MRP');

  const payload = {
    // COMMODITY_NAME has a real extraction path (label aliases, plus a
    // prominent-product-title fallback for unlabeled packaging) -- it's
    // the closest thing the CV/RE pipeline currently produces to a product
    // name. brandName has no source at all yet (no brand-vs-commodity-name
    // distinction exists): explicit null, not a duplicate of productName.
    productName: fieldValue(extracted, 'COMMODITY_NAME'),
    brandName: null,

    // Section 2.3's four LMR-2011 responsible-party roles.
    manufacturerName: fieldValue(extracted, 'MANUFACTURER'),
    manufacturerAddress: fieldValue(extracted, 'MANUFACTURER_ADDRESS'),
    packerName: fieldValue(extracted, 'PACKER'),
    packerAddress: fieldValue(extracted, 'PACKER_ADDRESS'),
    importerName: fieldValue(extracted, 'IMPORTER'),
    importerAddress: fieldValue(extracted, 'IMPORTER_ADDRESS'),
    marketedByName: fieldValue(extracted, 'MARKETED_BY'),
    marketedByAddress: fieldValue(extracted, 'MARKETED_BY_ADDRESS'),

    declaredQuantity: fieldValue(extracted, 'NET_QUANTITY'),
    mrp: parseMrpValue(mrpText),
    // fieldValue() already returns the label-stripped value (currency
    // symbol and tax phrasing intact, e.g. "Rs. 50.00 (Incl. of all
    // taxes)") -- NOT extracted.MRP.source_text, which still carries the
    // raw "MRP:" label prefix and would leak the label itself into the
    // stored raw text.
    mrpRawText: mrpText,
    packedDate: fieldValue(extracted, 'MANUFACTURE_DATE'),
    expiryDate: fieldValue(extracted, 'EXPIRY_DATE'),
    customerCareDetails: fieldValue(extracted, 'CONSUMER_CARE'),

    // 1.5: barcode scanning doesn't exist on the FE yet -- null, same
    // reasoning as productName/brandName above.
    barcodeValue: null,

    imageReferences,

    // Full OCR payload, kept as-is for server-side audit/debugging --
    // backend accepts z.any() here, nothing to shape.
    ocrPayload: {
      ocrText: item?.ocrText ?? null,
      ocrRawText: item?.ocrRawText ?? null,
      confidence: item?.confidence ?? null,
    },
    extractedFields: extracted,

    status: 'COMPLETED',

    sessionId: sessionServerId,

    complianceStatus: item?.checkResult?.verdict === 'ERROR' ? 'FAILED' : 'EVALUATED',
    complianceResult: item?.checkResult
      ? {
          verdict: item.checkResult.verdict,
          totalRules: item.checkResult.totalRules ?? 0,
          passedRules: item.checkResult.passedRules ?? 0,
          failedRules: item.checkResult.failedRules ?? 0,
          skippedRules: item.checkResult.skippedRules ?? 0,
          failures: item.checkResult.failures ?? [],
        }
      : undefined,
  };

  return {
    clientInspectionId: item.id,
    operation: 'CREATE',
    clientUpdatedAt: item.createdAt || new Date().toISOString(),
    ruleConfigVersion,
    payload,
  };
}

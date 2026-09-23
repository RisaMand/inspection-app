// translateItemForSync.test.js -- verifies the FE-BE translation layer
// (Section 2.1/2.2) produces payloads matching
// backend/src/validators/sync.validator.js's createItemSchema field-for-
// field, including that every contract field is present (possibly null)
// even when its FE source doesn't exist yet.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMrpValue, translateItemPayload } from './translateItemForSync.js';

describe('parseMrpValue', () => {
  it('parses a plain numeric MRP', () => {
    assert.equal(parseMrpValue('45'), 45);
  });

  it('strips currency symbols and tax phrasing', () => {
    assert.equal(parseMrpValue('MRP: Rs. 45.00 (incl. of all taxes)'), 45);
  });

  it('parses a rupee-symbol-prefixed value with no space', () => {
    assert.equal(parseMrpValue('₹45/-'), 45);
  });

  it('handles a comma decimal separator', () => {
    assert.equal(parseMrpValue('45,50'), 45.5);
  });

  it('returns null for missing input', () => {
    assert.equal(parseMrpValue(null), null);
    assert.equal(parseMrpValue(undefined), null);
  });

  it('returns null when no digits are present', () => {
    assert.equal(parseMrpValue('not a price'), null);
  });
});

describe('translateItemPayload', () => {
  const baseItem = {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    createdAt: '2026-09-21T10:00:00.000Z',
    ocrText: 'MRP: Rs. 45.00',
    ocrRawText: 'raw ocr text',
    confidence: 0.9,
    checkResult: {
      verdict: 'NON_COMPLIANT',
      totalRules: 5,
      passedRules: 3,
      failedRules: 2,
      skippedRules: 0,
      failures: [
        { rule_id: 'MRP_FORMAT', reason: 'test', severity: 'substantive', clause_citation: 'Rule 6', confidence: 0.9 },
      ],
      extractedFields: {
        MRP: { value: '45.00', text: '45.00', source_text: 'MRP: Rs. 45.00 (incl. of all taxes)' },
        NET_QUANTITY: { value: '100 g', text: '100 g' },
        MANUFACTURER: { value: 'Acme Foods Pvt Ltd', text: 'Acme Foods Pvt Ltd' },
        MANUFACTURER_ADDRESS: { value: '123 Industrial Rd, Pune', text: '123 Industrial Rd, Pune' },
        MANUFACTURE_DATE: { value: '01/2026', text: '01/2026' },
        EXPIRY_DATE: { value: '01/2027', text: '01/2027' },
        CONSUMER_CARE: { value: 'care@acme.com', text: 'care@acme.com' },
      },
    },
  };

  it('produces every contract field the backend expects, present even when null', () => {
    const result = translateItemPayload(baseItem, {
      imageReferences: ['insp-1/photo-1.jpg'],
      sessionServerId: 'session-server-id-1',
      ruleConfigVersion: '1.0.0',
    });

    const expectedKeys = [
      'productName', 'brandName', 'manufacturerName', 'manufacturerAddress',
      'packerName', 'packerAddress', 'importerName', 'importerAddress',
      'marketedByName', 'marketedByAddress', 'declaredQuantity', 'mrp',
      'packedDate', 'expiryDate', 'customerCareDetails', 'barcodeValue',
      'imageReferences', 'ocrPayload', 'extractedFields', 'status',
      'mrpRawText', 'sessionId', 'complianceStatus', 'complianceResult',
    ];
    for (const key of expectedKeys) {
      assert.ok(key in result.payload, `payload is missing contract field: ${key}`);
    }
  });

  it('translates renamed fields correctly (2.1)', () => {
    const result = translateItemPayload(baseItem, { ruleConfigVersion: '1.0.0' });
    assert.equal(result.payload.declaredQuantity, '100 g');
    assert.equal(result.payload.packedDate, '01/2026');
    assert.equal(result.payload.expiryDate, '01/2027');
    assert.equal(result.payload.customerCareDetails, 'care@acme.com');
    assert.equal(result.payload.manufacturerAddress, '123 Industrial Rd, Pune');
    assert.equal(result.payload.manufacturerName, 'Acme Foods Pvt Ltd');
  });

  it('parses MRP to a number and preserves the raw text separately (2.2)', () => {
    const result = translateItemPayload(baseItem, { ruleConfigVersion: '1.0.0' });
    assert.equal(result.payload.mrp, 45);
    assert.equal(result.payload.mrpRawText, 'MRP: Rs. 45.00 (incl. of all taxes)');
  });

  it('sends null, not undefined or a dropped key, for fields with no FE source yet', () => {
    const result = translateItemPayload(baseItem, { ruleConfigVersion: '1.0.0' });
    assert.equal(result.payload.productName, null);
    assert.equal(result.payload.brandName, null);
    assert.equal(result.payload.barcodeValue, null);
    assert.equal(result.payload.packerName, null);
    assert.equal(result.payload.importerName, null);
    assert.equal(result.payload.marketedByName, null);
  });

  it('threads sessionServerId into payload.sessionId (2.4)', () => {
    const withSession = translateItemPayload(baseItem, { sessionServerId: 'srv-123', ruleConfigVersion: '1.0.0' });
    assert.equal(withSession.payload.sessionId, 'srv-123');

    const withoutSession = translateItemPayload(baseItem, { ruleConfigVersion: '1.0.0' });
    assert.equal(withoutSession.payload.sessionId, null);
  });

  it('uses already-uploaded image paths, not raw local photos', () => {
    const result = translateItemPayload(baseItem, {
      imageReferences: ['insp-1/photo-1.jpg', 'insp-1/photo-2.jpg'],
      ruleConfigVersion: '1.0.0',
    });
    assert.deepEqual(result.payload.imageReferences, ['insp-1/photo-1.jpg', 'insp-1/photo-2.jpg']);
  });

  it('defaults imageReferences to an empty array, never omits the key', () => {
    const result = translateItemPayload(baseItem, { ruleConfigVersion: '1.0.0' });
    assert.deepEqual(result.payload.imageReferences, []);
  });

  it('sets complianceStatus to FAILED when checkResult verdict is ERROR', () => {
    const errored = { ...baseItem, checkResult: { verdict: 'ERROR', error: 'boom', extractedFields: {} } };
    const result = translateItemPayload(errored, { ruleConfigVersion: '1.0.0' });
    assert.equal(result.payload.complianceStatus, 'FAILED');
  });

  it('sets top-level sync envelope fields correctly', () => {
    const result = translateItemPayload(baseItem, { ruleConfigVersion: '1.0.0' });
    assert.equal(result.clientInspectionId, baseItem.id);
    assert.equal(result.operation, 'CREATE');
    assert.equal(result.clientUpdatedAt, baseItem.createdAt);
    assert.equal(result.ruleConfigVersion, '1.0.0');
  });

  it('handles a checkResult with no extractedFields at all without throwing', () => {
    const bare = { id: baseItem.id, createdAt: baseItem.createdAt, checkResult: { verdict: 'COMPLIANT' } };
    assert.doesNotThrow(() => translateItemPayload(bare, { ruleConfigVersion: '1.0.0' }));
  });
});

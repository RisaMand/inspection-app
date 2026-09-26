// translateReportForDisplay.test.js -- verifies the getReportData -> {item,
// session} translator (Section 2.8, ReportViewer) against the real backend
// report contract shape (inspection.controller.js's getReportData).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translateReportForDisplay } from './translateReportForDisplay.js';

describe('translateReportForDisplay', () => {
  const baseReport = {
    inspectionId: 'server-id-1',
    clientInspectionId: 'client-id-1',
    status: 'COMPLETED',
    inspector: { id: 'insp-1', name: 'Priya Sharma', email: 'priya@compliance.local' },
    visit: { visitNumber: 'V-2026-0042', shopNumber: 'SHOP-17', gpsLat: 19.07609, gpsLng: 72.877426 },
    capturedData: { productName: 'Test Product' },
    extractedFields: {
      MRP: { value: '45.00', text: '45.00' },
      MANUFACTURER: { value: 'Acme Foods', text: 'Acme Foods' },
    },
    imageReferences: ['https://signed-url-1.example/photo1.jpg', 'https://signed-url-2.example/photo2.jpg'],
    ruleConfigVersion: '1.0.0',
    complianceResult: {
      verdict: 'NON_COMPLIANT',
      totalRules: 5,
      passedRules: 3,
      failedRules: 2,
      skippedRules: 0,
      failures: [{ rule_id: 'MRP_FORMAT', reason: 'bad format', severity: 'substantive', clause_citation: 'Rule 6' }],
    },
    ruleEngineStatus: 'EVALUATED',
    ocrPayload: { ocrText: 'MRP: Rs 45.00', ocrRawText: 'raw text', confidence: 0.9 },
    timestamps: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
  };

  it('uses clientInspectionId for item.id, matching the local record id it originally synced from', () => {
    const { item } = translateReportForDisplay(baseReport);
    assert.equal(item.id, 'client-id-1');
  });

  it('falls back to inspectionId when clientInspectionId is missing', () => {
    const { item } = translateReportForDisplay({ ...baseReport, clientInspectionId: undefined });
    assert.equal(item.id, 'server-id-1');
  });

  it('attaches extractedFields onto checkResult, same nesting useSession.js uses locally', () => {
    const { item } = translateReportForDisplay(baseReport);
    assert.equal(item.checkResult.extractedFields.MRP.value, '45.00');
    assert.equal(item.checkResult.extractedFields.MANUFACTURER.value, 'Acme Foods');
  });

  it('passes complianceResult fields through unchanged onto checkResult', () => {
    const { item } = translateReportForDisplay(baseReport);
    assert.equal(item.checkResult.verdict, 'NON_COMPLIANT');
    assert.equal(item.checkResult.totalRules, 5);
    assert.equal(item.checkResult.passedRules, 3);
    assert.equal(item.checkResult.failedRules, 2);
    assert.equal(item.checkResult.skippedRules, 0);
    assert.deepEqual(item.checkResult.failures, baseReport.complianceResult.failures);
  });

  it('sets checkResult to null when complianceResult is null (not yet evaluated)', () => {
    const { item } = translateReportForDisplay({ ...baseReport, complianceResult: null });
    assert.equal(item.checkResult, null);
  });

  it('maps imageReferences (signed URLs) to item.photos', () => {
    const { item } = translateReportForDisplay(baseReport);
    assert.deepEqual(item.photos, baseReport.imageReferences);
  });

  it('defaults photos to an empty array, never undefined', () => {
    const { item } = translateReportForDisplay({ ...baseReport, imageReferences: undefined });
    assert.deepEqual(item.photos, []);
  });

  it('maps ocrPayload fields to item.ocrText/ocrRawText', () => {
    const { item } = translateReportForDisplay(baseReport);
    assert.equal(item.ocrText, 'MRP: Rs 45.00');
    assert.equal(item.ocrRawText, 'raw text');
  });

  it('sends null (not undefined) for ocr fields when ocrPayload itself is missing', () => {
    const { item } = translateReportForDisplay({ ...baseReport, ocrPayload: undefined });
    assert.equal(item.ocrText, null);
    assert.equal(item.ocrRawText, null);
  });

  it('maps visit context onto session', () => {
    const { session } = translateReportForDisplay(baseReport);
    assert.equal(session.visitNumber, 'V-2026-0042');
    assert.equal(session.shopNumber, 'SHOP-17');
    assert.equal(session.gpsLat, 19.07609);
    assert.equal(session.gpsLng, 72.877426);
  });

  it('handles a null visit object (no session_id) without throwing, everything comes back null', () => {
    const { session } = translateReportForDisplay({ ...baseReport, visit: null });
    assert.equal(session.visitNumber, null);
    assert.equal(session.shopNumber, null);
    assert.equal(session.gpsLat, null);
    assert.equal(session.gpsLng, null);
  });

  it('uses the real server-resolved inspector name, no id lookup needed', () => {
    const { session } = translateReportForDisplay(baseReport);
    assert.equal(session.inspectorName, 'Priya Sharma');
  });

  it('falls back to "Unknown Inspector" when inspector is missing', () => {
    const { session } = translateReportForDisplay({ ...baseReport, inspector: undefined });
    assert.equal(session.inspectorName, 'Unknown Inspector');
  });

  it('uses timestamps.createdAt for capturedAt', () => {
    const { session } = translateReportForDisplay(baseReport);
    assert.equal(session.capturedAt, '2026-01-01T00:00:00.000Z');
  });
});

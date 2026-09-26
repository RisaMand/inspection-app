// src/lib/api/translateReportForDisplay.js
// Section 2.8 (ReportViewer): the reverse of translateItemForSync.js.
// ComplianceReportBody.jsx and ReportViewer.jsx were built against the
// local IndexedDB {item, session} shape (mockDashboardData.js's
// getInspectionById mimicked that shape exactly). The real backend's
// GET /inspections/:id/report-data returns a differently-shaped report
// contract (inspector/visit/capturedData/complianceResult objects) --
// this is the single place that translation happens, so it can't drift
// between call sites the way the old mock-vs-real split invited.

/**
 * @param {object} report - the raw `data` object from GET /inspections/:id/report-data
 * @returns {{item: object, session: object}} shape ComplianceReportBody/ReportViewer expect
 */
export function translateReportForDisplay(report) {
  const item = {
    id: report.clientInspectionId || report.inspectionId,
    // complianceResult is stored server-side exactly as
    // translateItemForSync.js's payload.complianceResult shaped it
    // (verdict/totalRules/passedRules/failedRules/skippedRules/failures) --
    // no reshaping needed, only attaching extractedFields onto it, same as
    // useSession.js does locally (checkResult.extractedFields = extractedFields).
    checkResult: report.complianceResult
      ? { ...report.complianceResult, extractedFields: report.extractedFields || {} }
      : null,
    // imageReferences are already real, viewable, freshly-signed URLs by
    // the time this report reaches the client (createSignedDownloadUrls
    // runs server-side, per-request) -- not local data-URLs, but the same
    // <img src> contract ComplianceReportBody already expects.
    photos: report.imageReferences || [],
    ocrText: report.ocrPayload?.ocrText ?? null,
    ocrRawText: report.ocrPayload?.ocrRawText ?? null,
  };

  const session = {
    visitNumber: report.visit?.visitNumber ?? null,
    shopNumber: report.visit?.shopNumber ?? null,
    gpsLat: report.visit?.gpsLat ?? null,
    gpsLng: report.visit?.gpsLng ?? null,
    // The real inspector name is already resolved server-side (a real
    // JOIN, not a MOCK_INSPECTORS lookup) -- no id-to-name lookup needed
    // on the client at all anymore.
    inspectorName: report.inspector?.name ?? 'Unknown Inspector',
    // getReportData has no session.start_time (only inspection-level
    // created_at/updated_at) -- capturedAt is an honest label for what's
    // actually available, not a stand-in for "visit started".
    capturedAt: report.timestamps?.createdAt ?? null,
  };

  return { item, session };
}

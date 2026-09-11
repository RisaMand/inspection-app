// src/components/ComplianceReportBody.jsx
//
// Extracted from ItemResult.jsx (Phase 4, Step 4.2) so the same read-only
// report body can be reused by the official dashboard's ReportViewer, which
// needs no inspector-only action buttons (Scan Another Item, Draft Seizure
// Memo). ItemResult.jsx keeps its own header/action buttons and renders this
// in place of what used to be inline JSX.
//
// `session` is accepted per the Phase 4 plan's spec but is NOT currently
// used inside this component — visitNumber/shopNumber/startedAt are
// rendered by ItemResult's own header section, which was not part of the
// extracted block. Kept in the signature for ReportViewer's convenience and
// in case future report-body content needs it.
export default function ComplianceReportBody({ item, session }) {
  const { checkResult, photos, ocrText, ocrRawText } = item;

  // Display-only: rule-engine keys (MANUFACTURER_ADDRESS) become
  // human-readable labels; internal flags like isImported are skipped.
  function fieldLabel(key) {
    if (key === 'MRP') return 'MRP';
    if (key === 'UNIT_SALE_PRICE') return 'Unit Sale Price';
    const words = key.toLowerCase().replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  const fieldEntries = checkResult?.extractedFields
    ? Object.entries(checkResult.extractedFields).filter(
        ([key, val]) =>
          key !== 'isImported' &&
          val &&
          typeof val === 'object' &&
          (typeof val.value === 'string'
            ? val.value.trim().length > 0
            : typeof val.text === 'string' && val.text.trim().length > 0)
      )
    : [];

  const verdict = checkResult?.verdict || 'PENDING';
  const verdictColors = {
    COMPLIANT: { border: '#2d7a2d', bg: '#102410', text: '#5cd65c' },
    COMPLIANT_WITH_WARNINGS: { border: '#b38600', bg: '#2b2307', text: '#ffd13b' },
    NON_COMPLIANT: { border: '#b32424', bg: '#331111', text: '#ff6666' },
    PASS: { border: '#2d7a2d', bg: '#102410', text: '#5cd65c' },
    REVIEW: { border: '#b38600', bg: '#2b2307', text: '#ffd13b' },
    ERROR: { border: '#b32424', bg: '#331111', text: '#ff6666' },
    PENDING: { border: '#555', bg: '#222', text: '#aaa' },
  };
  const activeColor = verdictColors[verdict] || verdictColors.PENDING;

  return (
    <>
      <div
        style={{
          border: `2px solid ${activeColor.border}`,
          background: activeColor.bg,
          color: activeColor.text,
          padding: '1rem',
          borderRadius: '6px',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ margin: 0, color: 'inherit' }}>Verdict: {verdict.replace(/_/g, ' ')}</h2>
        {checkResult && (
          <p style={{ margin: '0.5rem 0 0 0', color: '#fff' }}>
            Passed: {checkResult.passedRules} | Failed: {checkResult.failedRules} | Skipped: {checkResult.skippedRules}
          </p>
        )}
      </div>

      {checkResult?.failures?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>Violations Detected ({checkResult.failures.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {checkResult.failures.map((f, idx) => (
              <div
                key={idx}
                style={{
                  background: '#201010',
                  border: '1px solid #702020',
                  padding: '0.75rem',
                  borderRadius: '4px',
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#ff7777' }}>
                  [{f.rule_id}]
                </div>
                <div style={{ fontSize: '0.9rem', color: '#ccc', marginTop: '0.25rem' }}>
                  {f.reason}
                </div>
                {f.clause_citation && (
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                    Citation: {f.clause_citation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {fieldEntries.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>Extracted Fields</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {fieldEntries.map(([key, val]) => (
              <div
                key={key}
                style={{
                  background: '#181818',
                  color: '#e5e5e5',
                  border: '1px solid #333',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                }}
              >
                <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  {fieldLabel(key)}
                </div>
                <div style={{ marginTop: '0.15rem', whiteSpace: 'pre-line' }}>
                  {val.value || val.text}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Evidence Photos</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {photos.map((photo, i) => (
            <img
              key={i}
              src={photo}
              alt={`evidence ${i + 1}`}
              style={{ width: 80, height: 80, objectFit: 'cover' }}
            />
          ))}
        </div>
      </section>

      {ocrText && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>Label Text</h3>
          <pre
            style={{
              background: '#111',
              color: '#eee',
              padding: '0.75rem',
              borderRadius: '4px',
              fontSize: '0.8rem',
              overflowX: 'auto',
              maxHeight: 180,
              whiteSpace: 'pre-wrap',
            }}
          >
            {ocrText}
          </pre>
          {ocrRawText && ocrRawText !== ocrText && (
            <details style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
              <summary style={{ cursor: 'pointer' }}>Raw OCR output (unprocessed)</summary>
              <pre
                style={{
                  background: '#0a0a0a',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  maxHeight: 180,
                  whiteSpace: 'pre-wrap',
                  marginTop: '0.5rem',
                }}
              >
                {ocrRawText}
              </pre>
            </details>
          )}
        </section>
      )}
    </>
  );
}
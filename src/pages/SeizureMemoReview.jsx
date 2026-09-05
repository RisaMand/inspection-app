import { useState } from 'react';

export default function SeizureMemoReview({ session }) {
  const [status, setStatus] = useState('draft');

  if (!session) {
    return (
      <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
        <h1>Seizure Memo</h1>
        <p>No active session found. Complete an inspection before generating a memo.</p>
      </div>
    );
  }

  const { visitNumber, shopNumber, gps, startedAt, items = [] } = session;

  // Identify items with violations
  const nonCompliantItems = items.filter(
    (item) => item.checkResult && item.checkResult.failures?.length > 0
  );

  return (
    <div style={{ padding: '2rem', maxWidth: 650, margin: '0 auto' }}>
      <h1>Seizure Memo</h1>

      <div
        style={{
          border: status === 'draft' ? '2px solid #b34700' : '2px solid #2d7a2d',
          background: status === 'draft' ? '#402010' : '#102410',
          color: '#fff',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1.5rem',
        }}
      >
        <strong>
          {status === 'draft'
            ? 'DRAFT — Pending Inspector Confirmation'
            : 'CONFIRMED — Print-Ready'}
        </strong>
      </div>

      <section style={{ marginBottom: '1.5rem' }}>
        <p><strong>Visit / Shop:</strong> Visit #{visitNumber} (Shop #{shopNumber})</p>
        <p>
          <strong>GPS / Timestamp:</strong>{' '}
          {gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Location not available'} |{' '}
          {new Date(startedAt).toLocaleString()}
        </p>
        <p>
          <strong>Total Non-Compliant Items:</strong> {nonCompliantItems.length}
        </p>
      </section>

      {nonCompliantItems.length === 0 ? (
        <p style={{ color: '#888' }}>
          No non-compliant items recorded in this session. Seizure memo is clean.
        </p>
      ) : (
        nonCompliantItems.map((item, idx) => {
          const mfgText =
            item.checkResult?.extractedFields?.MANUFACTURER_ADDRESS?.text ||
            'Manufacturer details missing/not detected';

          return (
            <div
              key={item.id}
              style={{
                border: '1px solid #552020',
                background: '#1a0d0d',
                color: '#f3f4f6',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ color: '#fff', marginTop: 0 }}>Non-Compliant Item #{idx + 1}</h3>
              <p>
                <strong>Manufacturer / Responsible Party:</strong> {mfgText}
              </p>

              <div style={{ marginTop: '0.5rem' }}>
                <strong>Rule Clause(s) Violated:</strong>
                <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem', color: '#ffaaaa' }}>
                  {item.checkResult.failures.map((f, fi) => (
                    <li key={fi}>
                      <strong>{f.clause_citation || f.rule_id}:</strong> {f.description} ({f.reason})
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <strong>Evidence Photos:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {item.photos.map((photo, pi) => (
                    <img
                      key={pi}
                      src={photo}
                      alt={`Evidence ${pi + 1}`}
                      style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: '1.5rem' }}>
        {status === 'draft' ? (
          <button onClick={() => setStatus('confirmed')}>
            Confirm Memo (mark print-ready)
          </button>
        ) : (
          <button onClick={() => setStatus('draft')}>
            Revert to Draft
          </button>
        )}
      </div>
    </div>
  );
}
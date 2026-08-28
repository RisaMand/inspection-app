import { useState } from 'react';

export default function SeizureMemoReview() {
  const [status, setStatus] = useState('draft'); // 'draft' | 'confirmed'

  return (
    <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
      <h1>Seizure Memo</h1>

      {status === 'draft' ? (
        <div
          style={{
            border: '2px solid #b34700',
            background: '#402010',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <strong>DRAFT — Pending Inspector Confirmation</strong>
        </div>
      ) : (
        <div
          style={{
            border: '2px solid #2d7a2d',
            background: '#102410',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <strong>CONFIRMED — Print-Ready</strong>
        </div>
      )}

      <section style={{ marginBottom: '1rem' }}>
        <p><strong>Manufacturer/Packer Name & Address:</strong> [Pending — Person 4/CV field extraction not yet integrated]</p>
        <p><strong>Rule Clause(s) Violated:</strong> [Pending — Person 4 clause_citation not yet integrated]</p>
        <p><strong>GPS/Timestamp of Inspection:</strong> [Pending — session GPS/timestamp binding not yet wired to memo]</p>
        <p><strong>Evidence Photo:</strong> [Pending — item photo binding not yet wired to memo]</p>
      </section>

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
  );
}
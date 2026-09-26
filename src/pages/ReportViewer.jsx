import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ComplianceReportBody from '../components/ComplianceReportBody';
import { api } from '../lib/api/client';
import { translateReportForDisplay } from '../lib/api/translateReportForDisplay.js';

export default function ReportViewer({ token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(() => ({ loading: true, error: null, item: null, session: null, forId: null }));

  useEffect(() => {
    let cancelled = false;

    api.getReportData(token, id)
      .then((report) => {
        if (cancelled) return;
        const { item, session } = translateReportForDisplay(report);
        setState({ loading: false, error: null, item, session, forId: id });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, error: err.message || 'Failed to load report', item: null, session: null, forId: id });
      });

    return () => { cancelled = true; };
  }, [token, id]);

  // If the route's :id has moved on to a different report but this
  // effect's fetch for it hasn't resolved yet, treat it as loading rather
  // than flashing the previous report's content -- without needing a
  // synchronous setState() at the top of the effect just to reset state.
  const isLoading = state.forId !== id;

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
        <h1>Report</h1>
        <p>Loading report…</p>
      </div>
    );
  }

  if (state.error || !state.item) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
        <h1>Report</h1>
        <p>{state.error || 'No report found for this ID.'}</p>
        <button onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  const { item, session } = state;
  const { visitNumber, shopNumber, capturedAt, inspectorName } = session;

  return (
    <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
        ← Back
      </button>

      <h1>Inspection Report</h1>

      <section style={{ marginBottom: '1rem' }}>
        <p><strong>Visit Number:</strong> {visitNumber ?? '—'}</p>
        <p><strong>Shop Number:</strong> {shopNumber ?? '—'}</p>
        <p><strong>Inspector:</strong> {inspectorName}</p>
        <p><strong>Captured At:</strong> {capturedAt ? new Date(capturedAt).toLocaleString() : '—'}</p>
        <p><strong>Item ID:</strong> {item.id}</p>
      </section>

      <ComplianceReportBody item={item} session={session} />
    </div>
  );
}

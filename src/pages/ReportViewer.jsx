import { useNavigate, useParams } from 'react-router-dom';
import ComplianceReportBody from '../components/ComplianceReportBody';
import { getInspectionById, MOCK_INSPECTORS } from '../dashboard/mockDashboardData';

export default function ReportViewer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const result = getInspectionById(id);

  if (!result) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
        <h1>Report</h1>
        <p>No report found for this ID.</p>
        <button onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  const { item, session } = result;
  const { visitNumber, shopNumber, startedAt, createdBy } = session;
  const inspectorName = MOCK_INSPECTORS.find((i) => i.id === createdBy)?.name ?? 'Unknown Inspector';

  return (
    <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
        ← Back
      </button>

      <h1>Inspection Report</h1>

      <section style={{ marginBottom: '1rem' }}>
        <p><strong>Visit Number:</strong> {visitNumber}</p>
        <p><strong>Shop Number:</strong> {shopNumber}</p>
        <p><strong>Inspector:</strong> {inspectorName}</p>
        <p><strong>Visit Started:</strong> {new Date(startedAt).toLocaleString()}</p>
        <p><strong>Item ID:</strong> {item.id}</p>
      </section>

      <ComplianceReportBody item={item} session={session} />
    </div>
  );
}
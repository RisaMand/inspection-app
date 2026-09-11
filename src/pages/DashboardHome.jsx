import { getDashboardSummary } from '../dashboard/mockDashboardData';

const cardStyle = {
  background: '#181818',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '1rem',
  minWidth: 140,
};

const cardLabelStyle = {
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
};

const cardValueStyle = {
  fontSize: '1.8rem',
  fontWeight: 'bold',
  marginTop: '0.25rem',
};

function SummaryCard({ label, value, color }) {
  return (
    <div style={cardStyle}>
      <div style={cardLabelStyle}>{label}</div>
      <div style={{ ...cardValueStyle, color: color || '#e5e5e5' }}>{value}</div>
    </div>
  );
}

export default function DashboardHome() {
  const summary = getDashboardSummary();

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1>Dashboard</h1>

      <section style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <SummaryCard label="Total Sessions" value={summary.totalSessions} />
        <SummaryCard label="Items Inspected" value={summary.totalItemsInspected} />
        <SummaryCard label="Compliant" value={summary.compliant} color="#5cd65c" />
        <SummaryCard label="With Warnings" value={summary.compliantWithWarnings} color="#ffd13b" />
        <SummaryCard label="Non-Compliant" value={summary.nonCompliant} color="#ff6666" />
        <SummaryCard label="Errored" value={summary.errored} color="#ff6666" />
        <SummaryCard label="Shops Visited" value={summary.distinctShopsVisited} />
        <SummaryCard label="Active Inspectors" value={summary.activeInspectors} />
      </section>
    </div>
  );
}
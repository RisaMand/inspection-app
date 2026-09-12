import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getOfficerActivity } from '../dashboard/mockDashboardData';

const panelStyle = {
  background: '#181818',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '1rem',
  marginBottom: '1.5rem',
};

const chartTitleStyle = {
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  marginBottom: '0.75rem',
};

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr',
  gap: '0.5rem',
  padding: '0.6rem 0.5rem',
  borderBottom: '1px solid #2a2a2a',
  alignItems: 'center',
};

export default function OfficerActivity() {
  const officers = getOfficerActivity();

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1>Officer Activity</h1>

      <section style={panelStyle}>
        <div style={chartTitleStyle}>Violations Found, by Officer and Tier</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={officers}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="inspectorName" stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333' }} />
            <Legend />
            <Bar dataKey="substantiveCount" name="Substantive" stackId="tier" fill="#ff6666" />
            <Bar dataKey="cosmeticCount" name="Cosmetic" stackId="tier" fill="#ffd13b" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={panelStyle}>
        <div style={{ ...rowStyle, color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
          <span>Inspector</span>
          <span>Visits</span>
          <span>Items Inspected</span>
          <span>Substantive</span>
          <span>Cosmetic</span>
          <span>Errored</span>
        </div>
        {officers.map((o) => (
          <div key={o.inspectorId} style={{ ...rowStyle, color: '#e5e5e5' }}>
            <span>{o.inspectorName}</span>
            <span>{o.sessionsCount}</span>
            <span>{o.itemsInspected}</span>
            <span style={{ color: '#ff6666' }}>{o.substantiveCount}</span>
            <span style={{ color: '#ffd13b' }}>{o.cosmeticCount}</span>
            <span style={{ color: o.erroredCount > 0 ? '#ff6666' : '#666' }}>{o.erroredCount}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
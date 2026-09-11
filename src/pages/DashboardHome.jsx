import { useState } from 'react';
import {
  PieChart, Pie, Cell, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { getDashboardSummary, getViolationsByTier, getTrendingViolationTypes } from '../dashboard/mockDashboardData';

const TIER_COLORS = { substantive: '#ff6666', cosmetic: '#ffd13b' };

const chartPanelStyle = {
  background: '#181818',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '1rem',
  flex: '1 1 320px',
  minWidth: 300,
};

const chartTitleStyle = {
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  marginBottom: '0.75rem',
};

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

function TierBreakdownChart() {
  const tierData = getViolationsByTier();
  const total = tierData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div style={chartPanelStyle}>
      <div style={chartTitleStyle}>Violations by Tier</div>
      {total === 0 ? (
        <p style={{ color: '#666' }}>No violations recorded.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={tierData}
              dataKey="count"
              nameKey="tier"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ tier, count }) => `${tier}: ${count}`}
            >
              {tierData.map((entry) => (
                <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || '#888'} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333' }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const WINDOW_OPTIONS = [7, 30, 90];

function TrendChart() {
  const [windowDays, setWindowDays] = useState(30);
  const { byDay } = getTrendingViolationTypes(windowDays);

  return (
    <div style={chartPanelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={chartTitleStyle}>Inspections Over Time</div>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          style={{ background: '#111', color: '#e5e5e5', border: '1px solid #333', borderRadius: '4px', padding: '0.2rem 0.4rem' }}
        >
          {WINDOW_OPTIONS.map((d) => (
            <option key={d} value={d}>Last {d} days</option>
          ))}
        </select>
      </div>
      {byDay.length === 0 ? (
        <p style={{ color: '#666' }}>No inspections in this window.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333' }} />
            <Legend />
            <Line type="monotone" dataKey="totalInspections" name="Total Inspections" stroke="#5cd65c" strokeWidth={2} />
            <Line type="monotone" dataKey="nonCompliant" name="Non-Compliant" stroke="#ff6666" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
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

      <section style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <TierBreakdownChart />
        <TrendChart />
      </section>
    </div>
  );
}
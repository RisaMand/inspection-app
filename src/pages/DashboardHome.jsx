import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import jsPDF from 'jspdf';
import { api } from '../lib/api/client';

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

function TierBreakdownChart({ byTier }) {
  const total = byTier.reduce((sum, d) => sum + d.count, 0);

  return (
    <div style={chartPanelStyle}>
      <div style={chartTitleStyle}>Violations by Tier</div>
      {total === 0 ? (
        <p style={{ color: '#666' }}>No violations recorded.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={byTier}
              dataKey="count"
              nameKey="tier"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ tier, count }) => `${tier}: ${count}`}
            >
              {byTier.map((entry) => (
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

function windowStartISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function TrendChart({ token }) {
  const [windowDays, setWindowDays] = useState(30);
  const [state, setState] = useState(() => ({ byDay: [], forWindow: null }));

  useEffect(() => {
    let cancelled = false;
    api.getDashboardSummary(token, { from: windowStartISO(windowDays) })
      .then((summary) => {
        if (!cancelled) setState({ byDay: summary.byDay || [], forWindow: windowDays });
      })
      .catch(() => {
        if (!cancelled) setState({ byDay: [], forWindow: windowDays });
      });
    return () => { cancelled = true; };
  }, [token, windowDays]);

  const loading = state.forWindow !== windowDays;
  const byDay = state.byDay;

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
      {loading ? (
        <p style={{ color: '#666' }}>Loading…</p>
      ) : byDay.length === 0 ? (
        <p style={{ color: '#666' }}>No inspections in this window.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333' }} />
            <Legend />
            <Line type="monotone" dataKey="total" name="Total Inspections" stroke="#5cd65c" strokeWidth={2} />
            <Line type="monotone" dataKey="nonCompliant" name="Non-Compliant" stroke="#ff6666" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function DashboardHome({ token }) {
  const [summary, setSummary] = useState(null);
  const [byTier, setByTier] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getDashboardSummary(token), api.getViolations(token)])
      .then(([summaryData, violationsData]) => {
        if (cancelled) return;
        setSummary(summaryData);
        setByTier(violationsData.byTier || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load dashboard');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  // Section 2.8: the mock's full-export embedded every item's photos
  // directly. The real per-row list endpoint (GET /dashboard/inspections)
  // only has raw Supabase Storage PATHS on image_references, not signed
  // URLs -- only getReportData signs those, one inspection at a time.
  // Signing every photo of every inspection in a full export would mean
  // one getReportData call per row, which doesn't scale for "export
  // everything". So this export includes full violation text/verdict data
  // for every inspection, but not embedded photos -- a real, stated
  // limitation, not a silently dropped feature. Individual per-item PDFs
  // (ReportViewer's own view) still have real photos, since that path
  // already signs URLs per-request.
  async function exportAllPDF() {
    setExporting(true);
    try {
      const allRows = [];
      let page = 1;
      const limit = 100;
      let totalPages = 1;
      do {
        const { data, meta } = await api.getFilteredInspections(token, { page, limit });
        allRows.push(...data);
        totalPages = meta?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      const doc = new jsPDF();
      let y = 15;

      doc.setFontSize(16);
      doc.text('Full Inspection Report — All Sessions', 10, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`${allRows.length} item(s) total (photos: see individual report for each item)`, 10, y);
      y += 12;

      for (const row of allRows) {
        if (y > 260) {
          doc.addPage();
          y = 15;
        }

        const verdict = row.compliance_result?.verdict || row.status;
        doc.setFontSize(12);
        doc.text(`Visit ${row.visit_number || '—'} — Shop ${row.shop_number || '—'}`, 10, y);
        y += 6;
        doc.setFontSize(10);
        doc.text(`Product: ${row.product_name || '—'}`, 10, y);
        y += 6;
        doc.text(`Date: ${new Date(row.updated_at).toLocaleDateString()}  |  Verdict: ${verdict}`, 10, y);
        y += 7;

        const failures = row.compliance_result?.failures || [];
        if (failures.length > 0) {
          failures.forEach((f) => {
            if (y > 275) {
              doc.addPage();
              y = 15;
            }
            doc.text(` • [${f.clause_citation || f.rule_id}]: ${f.reason}`, 15, y);
            y += 5;
          });
        } else {
          doc.text('No violations detected.', 15, y);
          y += 5;
        }

        y += 8;
      }

      doc.save(`full-inspection-report-${Date.now()}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading dashboard…</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem' }}>Failed to load dashboard: {error}</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <button onClick={exportAllPDF} disabled={exporting} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', height: 'fit-content' }}>
          {exporting ? 'Exporting…' : `Export Full Report (${summary.totalInspections})`}
        </button>
      </div>

      <section style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <SummaryCard label="Total Sessions" value={summary.totalSessions} />
        <SummaryCard label="Items Inspected" value={summary.totalInspections} />
        <SummaryCard label="Compliant" value={summary.compliant} color="#5cd65c" />
        <SummaryCard label="With Warnings" value={summary.compliantWithWarnings} color="#ffd13b" />
        <SummaryCard label="Non-Compliant" value={summary.nonCompliant} color="#ff6666" />
        <SummaryCard label="Errored" value={summary.errored} color="#ff6666" />
        <SummaryCard label="Shops Visited" value={summary.distinctShopsVisited} />
        <SummaryCard label="Active Inspectors" value={summary.activeInspectors} />
      </section>

      <section style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <TierBreakdownChart byTier={byTier} />
        <TrendChart token={token} />
      </section>
    </div>
  );
}

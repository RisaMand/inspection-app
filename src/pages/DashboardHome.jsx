import { useState } from 'react';
import {
  PieChart, Pie, Cell, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import jsPDF from 'jspdf';
import { getDashboardSummary, getViolationsByTier, getTrendingViolationTypes, getFilteredSessionsForExport, toRow } from '../dashboard/mockDashboardData';

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

function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

// Same SVG-to-JPEG normalization as FilterDrilldown's export — mock photos
// are SVG placeholders, jsPDF.addImage needs real raster bytes.
function normalizeToJpeg(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

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

  async function exportAllPDF() {
    const pairs = getFilteredSessionsForExport({}); // no filters = everything
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text('Full Inspection Report — All Sessions', 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`${pairs.length} item(s) total`, 10, y);
    y += 12;

    for (const { item, session } of pairs) {
      if (y > 240) {
        doc.addPage();
        y = 15;
      }

      const row = toRow(item, session);
      doc.setFontSize(12);
      doc.text(`Visit ${row.visitNumber} — Shop ${row.shopNumber}`, 10, y);
      y += 6;
      doc.setFontSize(10);
      doc.text(`Inspector: ${row.inspectorName}  |  Product: ${row.productName}`, 10, y);
      y += 6;
      doc.text(`Date: ${new Date(row.createdAt).toLocaleDateString()}  |  Verdict: ${row.verdict}`, 10, y);
      y += 7;

      if (item.checkResult?.failures?.length > 0) {
        item.checkResult.failures.forEach((f) => {
          doc.text(` • [${f.clause_citation || f.rule_id}]: ${f.reason}`, 15, y);
          y += 5;
        });
      } else {
        doc.text('No violations detected.', 15, y);
        y += 5;
      }

      let x = 10;
      const rawPhotos = item.photos || [];
      const normalizedPhotos = await Promise.all(
        rawPhotos.map((p) => normalizeToJpeg(p).catch(() => null))
      );
      const photoDims = await Promise.all(rawPhotos.map(getImageDimensions));
      normalizedPhotos.forEach((jpeg, i) => {
        if (!jpeg) return;
        if (x > 150) {
          x = 10;
          y += 35;
        }
        const { width: natW, height: natH } = photoDims[i];
        const maxBox = 30;
        const scale = Math.min(maxBox / natW, maxBox / natH);
        try {
          doc.addImage(jpeg, 'JPEG', x, y, natW * scale, natH * scale);
        } catch (e) {
          // skip a photo that fails to embed rather than break the whole export
        }
        x += 35;
      });

      y += 40;
    }

    doc.save(`full-inspection-report-${Date.now()}.pdf`);
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <button onClick={exportAllPDF} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', height: 'fit-content' }}>
          Export Full Report ({summary.totalItemsInspected})
        </button>
      </div>

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
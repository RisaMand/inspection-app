import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import { getFilteredSessions, getFilteredSessionsForExport, MOCK_INSPECTORS, toRow } from '../dashboard/mockDashboardData';

const VERDICT_COLORS = {
  COMPLIANT: '#5cd65c',
  COMPLIANT_WITH_WARNINGS: '#ffd13b',
  NON_COMPLIANT: '#ff6666',
  ERROR: '#ff6666',
};

const panelStyle = {
  background: '#181818',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '1rem',
};

const labelStyle = {
  display: 'block',
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  marginBottom: '0.3rem',
};

const inputStyle = {
  background: '#111',
  color: '#e5e5e5',
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '0.4rem 0.5rem',
  width: '100%',
};

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1fr 1fr',
  gap: '0.5rem',
  padding: '0.6rem 0.5rem',
  borderBottom: '1px solid #2a2a2a',
  alignItems: 'center',
};

const EMPTY_FILTERS = { dateFrom: '', dateTo: '', inspectorId: '', shop: '', severity: '' };

function buildActiveFilters(filters) {
  return {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    inspectorId: filters.inspectorId || undefined,
    shop: filters.shop || undefined,
    severity: filters.severity || undefined,
  };
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

// Mock item photos are SVG placeholders (fine for on-screen <img>), but
// jsPDF.addImage only accepts real raster bytes (JPEG/PNG). Draw whatever
// format comes in onto an offscreen canvas and re-encode as JPEG — same
// technique already used for real captured photos (see the "Normalize all
// uploaded photos to JPEG via canvas re-encode" commit), extended here to
// also cover SVG, which real camera captures never produce but this mock
// data does.
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

export default function FilterDrilldown() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const results = useMemo(() => getFilteredSessions(buildActiveFilters(filters)), [filters]);

  function update(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  async function exportFilteredPDF() {
    const pairs = getFilteredSessionsForExport(buildActiveFilters(filters));
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text('Filtered Inspection Report', 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`${pairs.length} item(s) matching current filters`, 10, y);
    y += 12;

    if (pairs.length === 0) {
      doc.text('No items match the current filters.', 10, y);
    }

    for (const { item, session } of pairs) {
      if (y > 240) {
        doc.addPage();
        y = 15;
      }

      const row = toRow(item, session);
      const verdict = row.verdict;
      doc.setFontSize(12);
      doc.text(`Visit ${row.visitNumber} — Shop ${row.shopNumber}`, 10, y);
      y += 6;
      doc.setFontSize(10);
      doc.text(`Inspector: ${row.inspectorName}  |  Product: ${row.productName}`, 10, y);
      y += 6;
      doc.text(`Date: ${new Date(row.createdAt).toLocaleDateString()}  |  Verdict: ${verdict}`, 10, y);
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
        if (!jpeg) return; // this one photo failed to normalize, skip only it
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

    doc.save(`filtered-inspection-report-${Date.now()}.pdf`);
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1>Filter / Drill-down</h1>

      <section style={{ ...panelStyle, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ minWidth: 160 }}>
            <label style={labelStyle}>From</label>
            <input type="date" style={inputStyle} value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={labelStyle}>To</label>
            <input type="date" style={inputStyle} value={filters.dateTo} onChange={(e) => update('dateTo', e.target.value)} />
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={labelStyle}>Inspector</label>
            <select style={inputStyle} value={filters.inspectorId} onChange={(e) => update('inspectorId', e.target.value)}>
              <option value="">All inspectors</option>
              {MOCK_INSPECTORS.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={labelStyle}>Shop / Region</label>
            <input type="text" placeholder="e.g. SHOP-04" style={inputStyle} value={filters.shop} onChange={(e) => update('shop', e.target.value)} />
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={labelStyle}>Severity Tier</label>
            <select style={inputStyle} value={filters.severity} onChange={(e) => update('severity', e.target.value)}>
              <option value="">All tiers</option>
              <option value="substantive">Substantive</option>
              <option value="cosmetic">Cosmetic</option>
              <option value="compliant">Compliant</option>
              <option value="errored">Errored</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={clearFilters} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
            Clear Filters
          </button>
          <button
            onClick={exportFilteredPDF}
            disabled={results.length === 0}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', opacity: results.length === 0 ? 0.5 : 1 }}
          >
            Export Filtered PDF ({results.length})
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ ...rowStyle, color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
          <span>Visit</span>
          <span>Shop</span>
          <span>Inspector</span>
          <span>Product</span>
          <span>Verdict</span>
          <span>Date</span>
        </div>

        {results.length === 0 ? (
          <p style={{ color: '#666', padding: '1rem 0.5rem' }}>No results match these filters.</p>
        ) : (
          results.map((row) => (
            <Link key={row.itemId} to={`/dashboard/report/${row.itemId}`} style={{ ...rowStyle, color: '#e5e5e5', textDecoration: 'none' }}>
              <span>{row.visitNumber || '—'}</span>
              <span>{row.shopNumber || '—'}</span>
              <span>{row.inspectorName}</span>
              <span>{row.productName}</span>
              <span style={{ color: VERDICT_COLORS[row.verdict] || '#e5e5e5', fontWeight: 'bold' }}>{row.verdict}</span>
              <span>{new Date(row.createdAt).toLocaleDateString()}</span>
            </Link>
          ))
        )}

        <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
      </section>
    </div>
  );
}
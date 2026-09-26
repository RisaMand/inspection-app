import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import { api } from '../lib/api/client';

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

const EMPTY_FILTERS = { from: '', to: '', inspectorId: '', shop: '', severity: '' };

function buildActiveFilters(filters) {
  return {
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    // end-of-day for an inclusive "to" date picked from a plain <input type="date">
    to: filters.to ? new Date(filters.to + 'T23:59:59.999Z').toISOString() : undefined,
    inspectorId: filters.inspectorId || undefined,
    shop: filters.shop || undefined,
    severity: filters.severity || undefined,
  };
}

export default function FilterDrilldown({ token }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [inspectors, setInspectors] = useState([]);
  const [state, setState] = useState(() => ({ results: [], forKey: null }));
  const [exporting, setExporting] = useState(false);

  const inspectorNameById = useMemo(
    () => new Map(inspectors.map((i) => [i.id, i.full_name])),
    [inspectors]
  );

  const filtersKey = JSON.stringify(buildActiveFilters(filters));

  useEffect(() => {
    api.getInspectors(token).then(setInspectors).catch(() => setInspectors([]));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    api.getFilteredInspections(token, { ...JSON.parse(filtersKey), limit: 100 })
      .then(({ data }) => {
        if (!cancelled) setState({ results: data, forKey: filtersKey });
      })
      .catch(() => {
        if (!cancelled) setState({ results: [], forKey: filtersKey });
      });
    return () => { cancelled = true; };
  }, [token, filtersKey]);

  const loading = state.forKey !== filtersKey;
  const results = state.results;

  function update(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  // Section 2.8: like DashboardHome's export, this doesn't embed photos --
  // the list endpoint's image_references are raw unsigned storage paths,
  // and signing every photo of every matching row isn't worth an N-call
  // fan-out just for a bulk PDF. Full violation text/verdict data is
  // still complete; individual reports (via ReportViewer) still have real photos.
  async function exportFilteredPDF() {
    setExporting(true);
    try {
      const doc = new jsPDF();
      let y = 15;

      doc.setFontSize(16);
      doc.text('Filtered Inspection Report', 10, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`${results.length} item(s) matching current filters`, 10, y);
      y += 12;

      if (results.length === 0) {
        doc.text('No items match the current filters.', 10, y);
      }

      for (const row of results) {
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

      doc.save(`filtered-inspection-report-${Date.now()}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1>Filter / Drill-down</h1>

      <section style={{ ...panelStyle, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ minWidth: 160 }}>
            <label style={labelStyle}>From</label>
            <input type="date" style={inputStyle} value={filters.from} onChange={(e) => update('from', e.target.value)} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={labelStyle}>To</label>
            <input type="date" style={inputStyle} value={filters.to} onChange={(e) => update('to', e.target.value)} />
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={labelStyle}>Inspector</label>
            <select style={inputStyle} value={filters.inspectorId} onChange={(e) => update('inspectorId', e.target.value)}>
              <option value="">All inspectors</option>
              {inspectors.map((i) => (
                <option key={i.id} value={i.id}>{i.full_name}</option>
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
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={clearFilters} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
            Clear Filters
          </button>
          <button
            onClick={exportFilteredPDF}
            disabled={results.length === 0 || exporting}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', opacity: results.length === 0 ? 0.5 : 1 }}
          >
            {exporting ? 'Exporting…' : `Export Filtered PDF (${results.length})`}
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

        {loading ? (
          <p style={{ color: '#666', padding: '1rem 0.5rem' }}>Loading…</p>
        ) : results.length === 0 ? (
          <p style={{ color: '#666', padding: '1rem 0.5rem' }}>No results match these filters.</p>
        ) : (
          results.map((row) => {
            const verdict = row.compliance_result?.verdict || row.status;
            return (
              <Link key={row.id} to={`/dashboard/report/${row.id}`} style={{ ...rowStyle, color: '#e5e5e5', textDecoration: 'none' }}>
                <span>{row.visit_number || '—'}</span>
                <span>{row.shop_number || '—'}</span>
                <span>{inspectorNameById.get(row.inspector_id) || '—'}</span>
                <span>{row.product_name || '—'}</span>
                <span style={{ color: VERDICT_COLORS[verdict] || '#e5e5e5', fontWeight: 'bold' }}>{verdict}</span>
                <span>{new Date(row.updated_at).toLocaleDateString()}</span>
              </Link>
            );
          })
        )}

        <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
      </section>
    </div>
  );
}

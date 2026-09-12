import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getFilteredSessions, MOCK_INSPECTORS } from '../dashboard/mockDashboardData';

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

export default function FilterDrilldown() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const results = useMemo(() => {
    const active = {
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      inspectorId: filters.inspectorId || undefined,
      shop: filters.shop || undefined,
      severity: filters.severity || undefined,
    };
    return getFilteredSessions(active);
  }, [filters]);

  function update(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
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
        <button onClick={clearFilters} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
          Clear Filters
        </button>
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
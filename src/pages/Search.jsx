import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { searchDashboard } from '../dashboard/mockDashboardData';

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

const inputStyle = {
  background: '#111',
  color: '#e5e5e5',
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '0.6rem 0.75rem',
  width: '100%',
  fontSize: '1rem',
};

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1fr 1fr',
  gap: '0.5rem',
  padding: '0.6rem 0.5rem',
  borderBottom: '1px solid #2a2a2a',
  alignItems: 'center',
};

export default function Search() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchDashboard(query), [query]);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1>Search</h1>

      <section style={{ ...panelStyle, marginBottom: '1.5rem' }}>
        <input
          type="text"
          autoFocus
          placeholder="Search by visit number, shop, inspector, or product…"
          style={inputStyle}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
          Unrestricted — searches every session and item across every inspector, not just your own.
        </p>
      </section>

      {!hasQuery ? (
        <p style={{ color: '#666' }}>Start typing to search.</p>
      ) : (
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
            <p style={{ color: '#666', padding: '1rem 0.5rem' }}>No matches for "{query}".</p>
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
      )}
    </div>
  );
}
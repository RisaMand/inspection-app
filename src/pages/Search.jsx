import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

const inputStyle = {
  background: '#111',
  color: '#e5e5e5',
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '0.6rem 0.75rem',
  width: '100%',
  fontSize: '1rem',
};

const sectionTitleStyle = {
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  margin: '1.25rem 0 0.5rem',
};

const inspectionRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1fr 1fr',
  gap: '0.5rem',
  padding: '0.6rem 0.5rem',
  borderBottom: '1px solid #2a2a2a',
  alignItems: 'center',
};

const simpleRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '0.5rem',
  padding: '0.6rem 0.5rem',
  borderBottom: '1px solid #2a2a2a',
  alignItems: 'center',
};

// Section 2.8: the real /dashboard/search returns 3 separate categories
// (inspections/products/users), not the mock's single flat list of items --
// a product catalog entry and a user account are genuinely different kinds
// of result from an inspection record, so they get their own sections
// rather than being forced into one table's columns.
export default function Search({ token }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ inspections: [], products: [], users: [] });
  const [loading, setLoading] = useState(false);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    if (!hasQuery) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api.searchDashboard(token, query.trim())
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setResults({ inspections: [], products: [], users: [] });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250); // debounce -- avoid firing a real request on every keystroke
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token, query, hasQuery]);

  const totalResults = results.inspections.length + results.products.length + results.users.length;

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1>Search</h1>

      <section style={{ ...panelStyle, marginBottom: '1.5rem' }}>
        <input
          type="text"
          autoFocus
          placeholder="Search by product, brand, barcode, inspector name, or email…"
          style={inputStyle}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
          Unrestricted — searches every inspection, product, and user account, not just your own.
        </p>
      </section>

      {!hasQuery ? (
        <p style={{ color: '#666' }}>Start typing to search.</p>
      ) : loading ? (
        <p style={{ color: '#666' }}>Searching…</p>
      ) : (
        <>
          <section style={panelStyle}>
            <div style={sectionTitleStyle}>Inspections ({results.inspections.length})</div>
            {results.inspections.length === 0 ? (
              <p style={{ color: '#666', padding: '0.5rem' }}>No matching inspections.</p>
            ) : (
              <>
                <div style={{ ...inspectionRowStyle, color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
                  <span>Visit</span>
                  <span>Shop</span>
                  <span>Inspector</span>
                  <span>Product</span>
                  <span>Verdict</span>
                  <span>Date</span>
                </div>
                {results.inspections.map((row) => (
                  <Link key={row.id} to={`/dashboard/report/${row.id}`} style={{ ...inspectionRowStyle, color: '#e5e5e5', textDecoration: 'none' }}>
                    <span>{row.visit_number || '—'}</span>
                    <span>{row.shop_number || '—'}</span>
                    <span>{row.inspector_name || '—'}</span>
                    <span>{row.product_name || '—'}</span>
                    <span style={{ color: VERDICT_COLORS[row.verdict] || '#e5e5e5', fontWeight: 'bold' }}>{row.verdict || row.status}</span>
                    <span>{new Date(row.updated_at).toLocaleDateString()}</span>
                  </Link>
                ))}
              </>
            )}
          </section>

          <section style={{ ...panelStyle, marginTop: '1rem' }}>
            <div style={sectionTitleStyle}>Products ({results.products.length})</div>
            {results.products.length === 0 ? (
              <p style={{ color: '#666', padding: '0.5rem' }}>No matching products.</p>
            ) : (
              <>
                <div style={{ ...simpleRowStyle, color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
                  <span>Product</span>
                  <span>Brand</span>
                  <span>Barcode</span>
                </div>
                {results.products.map((p) => (
                  <div key={p.id} style={{ ...simpleRowStyle, color: '#e5e5e5' }}>
                    <span>{p.product_name || '—'}</span>
                    <span>{p.brand_name || '—'}</span>
                    <span>{p.barcode_value || '—'}</span>
                  </div>
                ))}
              </>
            )}
          </section>

          <section style={{ ...panelStyle, marginTop: '1rem' }}>
            <div style={sectionTitleStyle}>Users ({results.users.length})</div>
            {results.users.length === 0 ? (
              <p style={{ color: '#666', padding: '0.5rem' }}>No matching users.</p>
            ) : (
              <>
                <div style={{ ...simpleRowStyle, color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                </div>
                {results.users.map((u) => (
                  <div key={u.id} style={{ ...simpleRowStyle, color: '#e5e5e5' }}>
                    <span>{u.full_name}</span>
                    <span>{u.email}</span>
                    <span>{u.role}</span>
                  </div>
                ))}
              </>
            )}
          </section>

          <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.75rem' }}>
            {totalResults} total result{totalResults === 1 ? '' : 's'}
          </p>
        </>
      )}
    </div>
  );
}

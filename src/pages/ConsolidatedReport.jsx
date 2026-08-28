export default function ConsolidatedReport({ session }) {
  if (!session) {
    return (
      <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
        <h1>Consolidated Visit Report</h1>
        <p>No active session. Start a session to generate a report.</p>
      </div>
    );
  }

  const { visitNumber, shopNumber, gps, startedAt, items } = session;

  return (
    <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
      <h1>Consolidated Visit Report</h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <p><strong>Visit Number:</strong> {visitNumber}</p>
        <p><strong>Shop Number:</strong> {shopNumber}</p>
        <p>
          <strong>GPS:</strong>{' '}
          {gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Not captured'}
        </p>
        <p><strong>Started:</strong> {new Date(startedAt).toLocaleString()}</p>
        <p><strong>Items scanned:</strong> {items.length}</p>
      </section>

      <section>
        <h2>Items</h2>
        {items.length === 0 ? (
          <p>No items scanned yet in this session.</p>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <h3>Item {index + 1}</h3>
              <p><strong>Photos:</strong> {item.photos.length}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {item.photos.map((photo, i) => (
                  <img
                    key={i}
                    src={photo}
                    alt={`item ${index + 1} photo ${i + 1}`}
                    style={{ width: 60, height: 60, objectFit: 'cover' }}
                  />
                ))}
              </div>
              <p>
                <strong>Compliance status:</strong>{' '}
                {item.checkResult
                  ? 'Reviewed'
                  : 'Compliance check pending (Rule Engine not yet integrated)'}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
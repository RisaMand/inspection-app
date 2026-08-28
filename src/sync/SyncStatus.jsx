export default function SyncStatus({ pendingCount = 0 }) {
  return (
    <div
      style={{
        padding: '0.5rem 0.75rem',
        border: '1px solid #ccc',
        borderRadius: '4px',
        display: 'inline-block',
        fontSize: '0.9rem',
      }}
    >
      {pendingCount > 0
        ? `${pendingCount} pending sync`
        : 'All changes synced'}
    </div>
  );
}
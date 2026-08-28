import jsPDF from 'jspdf';

export default function ItemResult({ session }) {
  if (!session || session.items.length === 0) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
        <h1>Item Report</h1>
        <p>No scanned items available yet.</p>
      </div>
    );
  }

  // PLACEHOLDER SELECTION: shows the most recently captured item.
  // Real per-item routing (/item-result/:id) is deferred to the end-of-role
  // UX/navigation pass — this stand-in lets the report/PDF logic itself be
  // fully real and reusable now, swapped for real routing later without
  // touching the report content or PDF generation below.
  const item = session.items[session.items.length - 1];
  const { visitNumber, shopNumber, startedAt } = session;

  function exportItemPDF() {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text('Item Compliance Report', 10, y);
    y += 10;

    doc.setFontSize(11);
    doc.text(`Visit Number: ${visitNumber}`, 10, y); y += 7;
    doc.text(`Shop Number: ${shopNumber}`, 10, y); y += 7;
    doc.text(`Visit Started: ${new Date(startedAt).toLocaleString()}`, 10, y); y += 7;
    doc.text(`Item ID: ${item.id}`, 10, y); y += 12;

    doc.setFontSize(13);
    doc.text('Compliance Result', 10, y);
    y += 8;

    doc.setFontSize(10);
    if (item.checkResult) {
      doc.text('Reviewed — see violations below.', 10, y);
      // Real violation rendering (grouped by tier, clause citations) goes
      // here once Person 4's check-result shape is integrated.
    } else {
      doc.text('Compliance check pending (Rule Engine not yet integrated).', 10, y);
    }
    y += 12;

    doc.setFontSize(13);
    doc.text('Evidence Photos', 10, y);
    y += 8;

    let x = 10;
    item.photos.forEach((photo) => {
      if (x > 150) {
        x = 10;
        y += 35;
      }
      try {
        doc.addImage(photo, 'JPEG', x, y, 30, 30);
      } catch (e) {
        // skip image on failure rather than break export
      }
      x += 35;
    });

    doc.save(`item-${item.id}-report.pdf`);
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
      <h1>Item Report</h1>
      <button onClick={exportItemPDF} style={{ marginBottom: '1rem' }}>
        Export PDF
      </button>

      <section style={{ marginBottom: '1rem' }}>
        <p><strong>Visit Number:</strong> {visitNumber}</p>
        <p><strong>Shop Number:</strong> {shopNumber}</p>
        <p><strong>Visit Started:</strong> {new Date(startedAt).toLocaleString()}</p>
        <p><strong>Item ID:</strong> {item.id}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h2>Compliance Result</h2>
        <p>
          {item.checkResult
            ? 'Reviewed — see violations below.'
            : 'Compliance check pending (Rule Engine not yet integrated).'}
        </p>
      </section>

      <section>
        <h2>Evidence Photos</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {item.photos.map((photo, i) => (
            <img
              key={i}
              src={photo}
              alt={`evidence ${i + 1}`}
              style={{ width: 80, height: 80, objectFit: 'cover' }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
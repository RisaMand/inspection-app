import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
export default function ConsolidatedReport({ session, endSession }) {
  const navigate = useNavigate();
  if (!session) {
    return (
      <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
        <h1>Consolidated Visit Report</h1>
        <p>No active session. Start a session to generate a report.</p>
      </div>
    );
  }

  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  function exportPDF() {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text('Consolidated Visit Report', 10, y);
    y += 10;

    doc.setFontSize(11);
    doc.text(`Visit Number: ${visitNumber}`, 10, y); y += 7;
    doc.text(`Shop Number: ${shopNumber}`, 10, y); y += 7;
    doc.text(
      `GPS: ${gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Not captured'}`,
      10, y
    ); y += 7;
    doc.text(`Started: ${new Date(startedAt).toLocaleString()}`, 10, y); y += 7;
    doc.text(`Items scanned: ${items.length}`, 10, y); y += 12;

    if (items.length === 0) {
      doc.text('No items scanned yet in this session.', 10, y);
    } else {
      items.forEach((item, index) => {
        if (y > 250) {
          doc.addPage();
          y = 15;
        }

        doc.setFontSize(13);
        doc.text(`Item ${index + 1}`, 10, y);
        y += 8;

        doc.setFontSize(10);
        doc.text(
          `Compliance status: ${item.checkResult ? 'Reviewed' : 'Compliance check pending (Rule Engine not yet integrated)'
          }`,
          10, y
        );
        y += 6;

        // Embed photo thumbnails, up to 3 per row, 30x30mm each
        let x = 10;
        item.photos.forEach((photo, i) => {
          if (x > 150) {
            x = 10;
            y += 35;
          }
          try {
            doc.addImage(photo, 'JPEG', x, y, 30, 30);
          } catch (e) {
            // If a given image fails to embed, skip it rather than break the whole export
          }
          x += 35;
        });
        y += 40;
      });
    }

    doc.save(`visit-${visitNumber}-report.pdf`);
  }

  async function exportDOCX() {
    const children = [
      new Paragraph({
        text: 'Consolidated Visit Report',
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Visit Number: ', bold: true }),
          new TextRun(visitNumber),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Shop Number: ', bold: true }),
          new TextRun(shopNumber),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'GPS: ', bold: true }),
          new TextRun(
            gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Not captured'
          ),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Started: ', bold: true }),
          new TextRun(new Date(startedAt).toLocaleString()),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Items scanned: ', bold: true }),
          new TextRun(String(items.length)),
        ],
      }),
    ];

    if (items.length === 0) {
      children.push(new Paragraph('No items scanned yet in this session.'));
    }

    items.forEach((item, index) => {
      children.push(
        new Paragraph({ text: '' }),
        new Paragraph({
          text: `Item ${index + 1}`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Item ID: ', bold: true }),
            new TextRun(item.id),
          ],
        }),
        new Paragraph(
          item.checkResult
            ? 'Reviewed — see violations below.'
            : 'Compliance check pending (Rule Engine not yet integrated).'
        ),
        new Paragraph({
          text: 'Evidence Photos',
          heading: HeadingLevel.HEADING_3,
        })
      );

      item.photos.forEach((photo, photoIndex) => {
        const imageType = photo.startsWith('data:image/png') ? 'png' : 'jpg';

        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Evidence photo ${photoIndex + 1}`,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new ImageRun({
                data: dataUrlToUint8Array(photo),
                type: imageType,
                transformation: {
                  width: 320,
                  height: 180,
                },
              }),
            ],
          })
        );
      });
    });

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');

    link.href = url;
    link.download = `visit-${visitNumber}-report.docx`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function handleEndSession() {
    endSession();
    navigate('/session');
  }

  const { visitNumber, shopNumber, gps, startedAt, items } = session;

  return (
    <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
      <h1>Consolidated Visit Report</h1>

      <button onClick={exportPDF} style={{ marginBottom: '1rem' }}>
        Export PDF
      </button>
      <button onClick={exportDOCX} style={{ marginBottom: '1rem', marginLeft: '0.75rem' }}>
        Export DOCX
      </button>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/capture')}>
          Scan Another Item
        </button>
        <button onClick={handleEndSession}>
          End Inspection Session
        </button>
      </div>

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
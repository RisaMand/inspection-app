import jsPDF from 'jspdf';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

export default function ItemResult({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  if (!session || session.items.length === 0) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
        <h1>Item Report</h1>
        <p>No scanned items available yet.</p>
      </div>
    );
  }

  const item = session.items.find((sessionItem) => sessionItem.id === id);

  if (!item) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
        <h1>Item Report</h1>
        <p>The requested item could not be found in this session.</p>
      </div>
    );
  }
  const { visitNumber, shopNumber, startedAt } = session;

  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

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

  async function exportItemDOCX() {
    const children = [
      new Paragraph({
        text: 'Item Compliance Report',
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
          new TextRun({ text: 'Visit Started: ', bold: true }),
          new TextRun(new Date(startedAt).toLocaleString()),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Item ID: ', bold: true }),
          new TextRun(item.id),
        ],
      }),
      new Paragraph({ text: '' }),
      new Paragraph({
        text: 'Compliance Result',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph(
        item.checkResult
          ? 'Reviewed — see violations below.'
          : 'Compliance check pending (Rule Engine not yet integrated).'
      ),
      new Paragraph({ text: '' }),
      new Paragraph({
        text: 'Evidence Photos',
        heading: HeadingLevel.HEADING_2,
      }),
    ];

    item.photos.forEach((photo, index) => {
      const imageType = photo.startsWith('data:image/png') ? 'png' : 'jpg';

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Evidence photo ${index + 1}`, bold: true }),
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

    const doc = new Document({
  sections: [{ children }],
});

const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `item-${item.id}-report.docx`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
      <h1>Item Report</h1>
      <button onClick={exportItemPDF} style={{ marginBottom: '1rem' }}>
        Export PDF
      </button>
      <button onClick={exportItemDOCX} style={{ marginBottom: '1rem', marginLeft: '0.75rem' }}>
        Export DOCX
      </button>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/capture')}>
          Scan Another Item
        </button>
        <button onClick={() => navigate('/consolidated-report')}>
          View Consolidated Visit Report
        </button>
      </div>

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
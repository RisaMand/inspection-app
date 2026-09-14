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
import ComplianceReportBody from '../components/ComplianceReportBody';

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
  const { checkResult } = item;
  const verdict = checkResult?.verdict || 'PENDING';

  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  function getImageDimensions(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 1, height: 1 }); // square fallback if a photo somehow fails to load
      img.src = dataUrl;
    });
  }

  async function exportItemPDF() {
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
      y += 6;
      // Real violation rendering (grouped by tier, clause citations) goes
      // here once Person 4's check-result shape is integrated.
      doc.text(`Verdict: ${verdict}`, 10, y);
      y += 8;

      if (checkResult?.failures?.length > 0) {
        doc.setFontSize(11);
        doc.text('Violations Detected:', 10, y);
        y += 6;
        checkResult.failures.forEach((f) => {
          doc.setFontSize(9);
          doc.text(`• [${f.rule_id}]: ${f.reason}`, 15, y);
          y += 6;
        });
      }
    }
    y += 12;

    doc.setFontSize(13);
    doc.text('Evidence Photos', 10, y);
    y += 8;

    let x = 10;
    const photoDims = await Promise.all(item.photos.map(getImageDimensions));
    item.photos.forEach((photo, i) => {
      if (x > 150) {
        x = 10;
        y += 35;
      }
      const { width: natW, height: natH } = photoDims[i];
      const maxBox = 30;
      const scale = Math.min(maxBox / natW, maxBox / natH);
      const w = natW * scale;
      const h = natH * scale;
      try {
        doc.addImage(photo, 'JPEG', x, y, w, h);
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
      new Paragraph({
        text: item.checkResult
          ? 'Reviewed — see violations below.'
          : 'Compliance check pending (Rule Engine not yet integrated).',
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Verdict: ', bold: true }),
          new TextRun(verdict),
        ],
      }),
    ];

    if (checkResult?.failures?.length > 0) {
      children.push(
        new Paragraph({
          text: 'Violations Detected',
          heading: HeadingLevel.HEADING_2,
        })
      );
      checkResult.failures.forEach((f) => {
        children.push(
          new Paragraph({
            text: `[${f.rule_id}]: ${f.reason}`,
          })
        );
      });
    }

    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        text: 'Evidence Photos',
        heading: HeadingLevel.HEADING_2,
      })
    );

    const docxPhotoDims = await Promise.all(item.photos.map(getImageDimensions));
    item.photos.forEach((photo, index) => {
      const imageType = photo.startsWith('data:image/png') ? 'png' : 'jpg';
      const { width: natW, height: natH } = docxPhotoDims[index];
      const maxW = 320;
      const maxH = 180;
      const scale = Math.min(maxW / natW, maxH / natH);
      const w = natW * scale;
      const h = natH * scale;

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
                width: w,
                height: h,
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
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={exportItemPDF}>
          Export PDF
        </button>
        <button onClick={exportItemDOCX}>
          Export DOCX
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/capture')}>
          Scan Another Item
        </button>
        <button onClick={() => navigate('/consolidated-report')}>
          View Consolidated Visit Report
        </button>
        {verdict === 'NON_COMPLIANT' && (
          <button
            onClick={() => navigate('/seizure-memo', { state: { itemId: item.id } })}>
            Draft Seizure Memo
          </button>
        )}
      </div>

      <section style={{ marginBottom: '1rem' }}>
        <p><strong>Visit Number:</strong> {visitNumber}</p>
        <p><strong>Shop Number:</strong> {shopNumber}</p>
        <p><strong>Visit Started:</strong> {new Date(startedAt).toLocaleString()}</p>
        <p><strong>Item ID:</strong> {item.id}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h2>Compliance Result</h2>
      </section>

      <ComplianceReportBody item={item} session={session} />
    </div>
  );
}
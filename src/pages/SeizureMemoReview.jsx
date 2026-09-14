import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

export default function SeizureMemoReview({ session }) {
  const [status, setStatus] = useState('draft');
  const location = useLocation();
  const navigate = useNavigate();

  if (!session) {
    return (
      <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
        <h1>Seizure Memo</h1>
        <p>No active session found. Complete an inspection before generating a memo.</p>
      </div>
    );
  }

  const { visitNumber, shopNumber, gps, startedAt, items = [] } = session;

  // Identify items with violations
  const nonCompliantItems = items.filter(
    (item) => item.checkResult && item.checkResult.failures?.length > 0
  );

  // Prefer the item the memo was drafted from (passed via navigation state
  // from ItemResult's "Draft Seizure Memo" button); fall back to the first
  // non-compliant item in the session, since the memo can cover several.
  const backTargetItemId = location.state?.itemId;

  function handleBack() {
    if (backTargetItemId) {
      navigate(`/item-result/${backTargetItemId}`);
    } else {
      navigate('/consolidated-report');
    }
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

  function getImageDimensions(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 1, height: 1 }); // square fallback if a photo somehow fails to load
      img.src = dataUrl;
    });
  }

  function getMfgText(item) {
    const extracted = item.checkResult?.extractedFields;
    return (
      extracted?.MANUFACTURER_ADDRESS?.full_text ||
      (extracted?.MANUFACTURER?.text && extracted?.MANUFACTURER_ADDRESS?.text
        ? `${extracted.MANUFACTURER.text}, ${extracted.MANUFACTURER_ADDRESS.text}`
        : extracted?.MANUFACTURER?.text ||
        extracted?.MANUFACTURER_ADDRESS?.value ||
        extracted?.MANUFACTURER_ADDRESS?.text) ||
      'Manufacturer details missing/not detected'
    );
  }

  async function exportSeizureMemoPDF() {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text('Seizure Memo', 10, y);
    y += 10;

    doc.setFontSize(11);
    doc.text(`Visit / Shop: Visit #${visitNumber} (Shop #${shopNumber})`, 10, y); y += 7;
    doc.text(
      `GPS: ${gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Location not available'}`,
      10, y
    ); y += 7;
    doc.text(`Timestamp: ${new Date(startedAt).toLocaleString()}`, 10, y); y += 7;
    doc.text(`Total Non-Compliant Items: ${nonCompliantItems.length}`, 10, y); y += 12;

    if (nonCompliantItems.length === 0) {
      doc.text('No non-compliant items recorded in this session. Seizure memo is clean.', 10, y);
    } else {
      const itemPhotoDims = await Promise.all(
        nonCompliantItems.map((item) => Promise.all(item.photos.map(getImageDimensions)))
      );

      nonCompliantItems.forEach((item, index) => {
        if (y > 250) {
          doc.addPage();
          y = 15;
        }

        doc.setFontSize(13);
        doc.text(`Non-Compliant Item #${index + 1}`, 10, y);
        y += 8;

        doc.setFontSize(10);
        doc.text(`Manufacturer / Responsible Party: ${getMfgText(item)}`, 10, y);
        y += 7;

        doc.text('Rule Clause(s) Violated:', 10, y);
        y += 5;
        item.checkResult.failures.forEach((f) => {
          doc.text(` • [${f.clause_citation || f.rule_id}]: ${f.description} (${f.reason})`, 15, y);
          y += 5;
        });

        // Embed evidence photo thumbnails, up to 3 per row, scaled to fit a 30x30mm box
        let x = 10;
        item.photos.forEach((photo, i) => {
          if (x > 150) {
            x = 10;
            y += 35;
          }
          const { width: natW, height: natH } = itemPhotoDims[index][i];
          const maxBox = 30;
          const scale = Math.min(maxBox / natW, maxBox / natH);
          const w = natW * scale;
          const h = natH * scale;
          try {
            doc.addImage(photo, 'JPEG', x, y, w, h);
          } catch (e) {
            // If a given image fails to embed, skip it rather than break the whole export
          }
          x += 35;
        });
        y += 40;
      });
    }

    doc.save(`seizure-memo-visit-${visitNumber}-report.pdf`);
  }

  async function exportSeizureMemoDOCX() {
    const children = [
      new Paragraph({
        text: 'Seizure Memo',
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Visit / Shop: ', bold: true }),
          new TextRun(`Visit #${visitNumber} (Shop #${shopNumber})`),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'GPS: ', bold: true }),
          new TextRun(
            gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Location not available'
          ),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Timestamp: ', bold: true }),
          new TextRun(new Date(startedAt).toLocaleString()),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Total Non-Compliant Items: ', bold: true }),
          new TextRun(String(nonCompliantItems.length)),
        ],
      }),
    ];

    if (nonCompliantItems.length === 0) {
      children.push(
        new Paragraph({ text: '' }),
        new Paragraph('No non-compliant items recorded in this session. Seizure memo is clean.')
      );
    } else {
      const docxPhotoDims = await Promise.all(
        nonCompliantItems.map((item) => Promise.all(item.photos.map(getImageDimensions)))
      );

      nonCompliantItems.forEach((item, index) => {
        children.push(
          new Paragraph({ text: '' }),
          new Paragraph({
            text: `Non-Compliant Item #${index + 1}`,
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Manufacturer / Responsible Party: ', bold: true }),
              new TextRun(getMfgText(item)),
            ],
          }),
          new Paragraph({
            text: 'Rule Clause(s) Violated',
            heading: HeadingLevel.HEADING_3,
          })
        );

        item.checkResult.failures.forEach((f) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `[${f.clause_citation || f.rule_id}]: `, bold: true }),
                new TextRun(`${f.description} (${f.reason})`),
              ],
            })
          );
        });

        children.push(
          new Paragraph({
            text: 'Evidence Photos',
            heading: HeadingLevel.HEADING_3,
          })
        );

        item.photos.forEach((photo, photoIndex) => {
          const imageType = photo.startsWith('data:image/png') ? 'png' : 'jpg';
          const { width: natW, height: natH } = docxPhotoDims[index][photoIndex];
          const maxW = 320;
          const maxH = 180;
          const scale = Math.min(maxW / natW, maxH / natH);
          const w = natW * scale;
          const h = natH * scale;

          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Evidence photo ${photoIndex + 1}`, bold: true }),
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
      });
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `seizure-memo-visit-${visitNumber}-report.docx`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 650, margin: '0 auto' }}>
      <button onClick={handleBack} style={{ marginBottom: '1rem' }}>
        ← Back to Item Report
      </button>
      <h1>Seizure Memo</h1>

      <div
        style={{
          border: status === 'draft' ? '2px solid #b34700' : '2px solid #2d7a2d',
          background: status === 'draft' ? '#402010' : '#102410',
          color: '#fff',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1.5rem',
        }}
      >
        <strong>
          {status === 'draft'
            ? 'DRAFT — Pending Inspector Confirmation'
            : 'CONFIRMED — Print-Ready'}
        </strong>
      </div>

      {status === 'confirmed' && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={exportSeizureMemoPDF}>
            Export PDF
          </button>
          <button onClick={exportSeizureMemoDOCX}>
            Export DOCX
          </button>
        </div>
      )}

      <section style={{ marginBottom: '1.5rem' }}>
        <p><strong>Visit / Shop:</strong> Visit #{visitNumber} (Shop #{shopNumber})</p>
        <p>
          <strong>GPS / Timestamp:</strong>{' '}
          {gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Location not available'} |{' '}
          {new Date(startedAt).toLocaleString()}
        </p>
        <p>
          <strong>Total Non-Compliant Items:</strong> {nonCompliantItems.length}
        </p>
      </section>

      {nonCompliantItems.length === 0 ? (
        <p style={{ color: '#888' }}>
          No non-compliant items recorded in this session. Seizure memo is clean.
        </p>
      ) : (
        nonCompliantItems.map((item, idx) => {
          const mfgText = getMfgText(item);

          return (
            <div
              key={item.id}
              style={{
                border: '1px solid #552020',
                background: '#1a0d0d',
                color: '#f3f4f6',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ color: '#fff', marginTop: 0 }}>Non-Compliant Item #{idx + 1}</h3>
              <p>
                <strong>Manufacturer / Responsible Party:</strong> {mfgText}
              </p>

              <div style={{ marginTop: '0.5rem' }}>
                <strong>Rule Clause(s) Violated:</strong>
                <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem', color: '#ffaaaa' }}>
                  {item.checkResult.failures.map((f, fi) => (
                    <li key={fi}>
                      <strong>{f.clause_citation || f.rule_id}:</strong> {f.description} ({f.reason})
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <strong>Evidence Photos:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {item.photos.map((photo, pi) => (
                    <img
                      key={pi}
                      src={photo}
                      alt={`Evidence ${pi + 1}`}
                      style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: '1.5rem' }}>
        {status === 'draft' ? (
          <button onClick={() => setStatus('confirmed')}>
            Confirm Memo (mark print-ready)
          </button>
        ) : (
          <button onClick={() => setStatus('draft')}>
            Revert to Draft
          </button>
        )}
      </div>
    </div>
  );
}
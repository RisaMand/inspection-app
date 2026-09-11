import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRegionText, attachRegionBoxes, zoneForBox, fieldsArrayToExtracted, mapFieldsToRules } from './mapFieldsToRules.js';

describe('classifyRegionText', () => {
  it('maps an MRP line to the MRP field', () => {
    assert.deepEqual(classifyRegionText('MRP Rs 120 (Incl. of all taxes)'), {
      fieldGuess: 'MRP',
      text: 'MRP Rs 120 (Incl. of all taxes)',
    });
  });

  it('maps a bilingual manufacture-date line via its English half', () => {
    assert.deepEqual(classifyRegionText('Mfd. Date/ निर्माण तिथि'), {
      fieldGuess: 'MANUFACTURE_DATE',
      text: 'Mfd. Date/ निर्माण तिथि',
    });
  });

  it('maps a care-contact line to CONSUMER_CARE', () => {
    assert.deepEqual(classifyRegionText('Customer Care: 071-350900'), {
      fieldGuess: 'CONSUMER_CARE',
      text: 'Customer Care: 071-350900',
    });
  });

  it('maps unit sale price lines to UNIT_SALE_PRICE', () => {
    assert.deepEqual(classifyRegionText('Unit Sale Price: ₹ 1.20 / g'), {
      fieldGuess: 'UNIT_SALE_PRICE',
      text: 'Unit Sale Price: ₹ 1.20 / g',
    });
  });

  it('maps batch number lines to BATCH_NUMBER', () => {
    assert.deepEqual(classifyRegionText('Batch No: BN-2026-99'), {
      fieldGuess: 'BATCH_NUMBER',
      text: 'Batch No: BN-2026-99',
    });
  });

  it('maps standard quantity lines to STANDARD_QUANTITY', () => {
    assert.deepEqual(classifyRegionText('Standard Pack 500g'), {
      fieldGuess: 'STANDARD_QUANTITY',
      text: 'Standard Pack 500g',
    });
  });

  it('rejects brand/graphic text with no field keyword as junk', () => {
    assert.deepEqual(classifyRegionText('SNEHA FARMS'), { fieldGuess: null, reason: 'no-keyword' });
    assert.deepEqual(classifyRegionText('Tender & Tasty'), { fieldGuess: null, reason: 'no-keyword' });
  });

  it('rejects barcode digits with no field keyword as junk', () => {
    assert.deepEqual(classifyRegionText('8 906064 511396'), { fieldGuess: null, reason: 'no-keyword' });
  });

  it('marks empty or whitespace OCR output as empty, not junk', () => {
    assert.deepEqual(classifyRegionText('   '), { fieldGuess: null, reason: 'empty' });
    assert.deepEqual(classifyRegionText(''), { fieldGuess: null, reason: 'empty' });
  });
});

describe('zoneForBox', () => {
  const size = { width: 300, height: 300 };

  it('names the top third header', () => {
    assert.equal(zoneForBox({ x: 10, y: 10, w: 100, h: 20 }, size), 'header');
  });

  it('names the middle third body', () => {
    assert.equal(zoneForBox({ x: 10, y: 140, w: 100, h: 20 }, size), 'body');
  });

  it('names the bottom third footer', () => {
    assert.equal(zoneForBox({ x: 10, y: 250, w: 100, h: 20 }, size), 'footer');
  });

  it('returns unknown when image dimensions are missing', () => {
    assert.equal(zoneForBox({ x: 10, y: 10, w: 100, h: 20 }, null), 'unknown');
    assert.equal(zoneForBox({ x: 10, y: 10, w: 100, h: 20 }, { width: 0, height: 0 }), 'unknown');
  });
});

describe('attachRegionBoxes', () => {
  const box = { x: 666, y: 419, w: 205, h: 74 };
  const size = { width: 1000, height: 666 }; // image1 dimensions

  it('emits the full Contract A′ shape for a resolved region', () => {
    assert.deepEqual(
      attachRegionBoxes(
        [{ box, text: 'MANUFACTURED & MARKETED BY: SNEHA FARMS', confidence: 81 }],
        size
      ),
      [{
        fieldGuess: 'MANUFACTURER_ADDRESS',
        text: 'MANUFACTURED & MARKETED BY: SNEHA FARMS',
        confidence: 81,
        boundingBox: box,
        region: 'footer',
      }]
    );
  });

  it('passes null confidence through instead of inventing zero', () => {
    const [entry] = attachRegionBoxes([{ box, text: 'MRP Rs 120' }], size);
    assert.equal(entry.confidence, null);
    assert.equal(entry.fieldGuess, 'MRP');
  });

  it('drops no-keyword junk regions so their boxes never reach fields[]', () => {
    assert.deepEqual(attachRegionBoxes([{ box, text: 'SUPER COOL FROZEN CHICKEN' }], size), []);
  });

  it('drops empty regions so their boxes never reach fields[]', () => {
    assert.deepEqual(attachRegionBoxes([{ box, text: '   ' }], size), []);
  });

  it('keeps only resolved regions from a mixed batch, boxes intact', () => {
    const brand = { x: 0, y: 0, w: 10, h: 10 };
    const mrpBox = { x: 669, y: 534, w: 275, h: 69 };
    assert.deepEqual(
      attachRegionBoxes(
        [
          { box: brand, text: 'Tender & Tasty' },
          { box: mrpBox, text: 'MRP Rs 120 (Incl. of all taxes)', confidence: 70 },
          { box, text: '' },
        ],
        size
      ),
      [{
        fieldGuess: 'MRP',
        text: 'MRP Rs 120 (Incl. of all taxes)',
        confidence: 70,
        boundingBox: mrpBox,
        region: 'footer',
      }]
    );
  });
});

describe('fieldsArrayToExtracted', () => {
  const mrpBox = { x: 669, y: 534, w: 275, h: 69 };
  const mfrBox = { x: 666, y: 419, w: 205, h: 74 };
  const noop = () => {};

  it('converts the array into a dict keyed by field name', () => {
    assert.deepEqual(
      fieldsArrayToExtracted(
        [
          { fieldGuess: 'MRP', text: 'MRP Rs 120', confidence: 70, boundingBox: mrpBox, region: 'footer' },
          { fieldGuess: 'MANUFACTURER_ADDRESS', text: 'Mfd by SNEHA', confidence: 81, boundingBox: mfrBox, region: 'footer' },
        ],
        { onDuplicate: noop }
      ),
      {
        MRP: { text: 'MRP Rs 120', confidence: 0.7, region: 'footer', boundingBox: mrpBox, fontSizeMm: null },
        MANUFACTURER_ADDRESS: { text: 'Mfd by SNEHA', confidence: 0.81, region: 'footer', boundingBox: mfrBox, fontSizeMm: null },
      }
    );
  });

  it('keeps the highest-confidence entry on duplicate fields and reports it', () => {
    const calls = [];
    const out = fieldsArrayToExtracted(
      [
        { fieldGuess: 'MRP', text: 'MRP Rs 120', confidence: 70, boundingBox: mrpBox, region: 'footer' },
        { fieldGuess: 'MRP', text: 'MRP Rs 125', confidence: 90, boundingBox: mrpBox, region: 'footer' },
      ],
      { onDuplicate: (msg) => calls.push(msg) }
    );
    assert.equal(out.MRP.text, 'MRP Rs 125');
    assert.equal(out.MRP.confidence, 0.9);
    assert.equal(calls.length, 1);
  });

  it('keeps null confidence as null instead of converting to zero', () => {
    const out = fieldsArrayToExtracted(
      [{ fieldGuess: 'MRP', text: 'MRP Rs 120', confidence: null, boundingBox: mrpBox, region: 'footer' }],
      { onDuplicate: noop }
    );
    assert.equal(out.MRP.confidence, null);
  });

  it('skips malformed and null entries instead of crashing, and coerces text', () => {
    const out = fieldsArrayToExtracted(
      [
        null,
        undefined,
        'not-an-entry',
        { fieldGuess: null, text: 'junk', confidence: 50, boundingBox: mrpBox, region: 'footer' },
        { fieldGuess: 'MRP', text: 120, confidence: 70, boundingBox: mrpBox, region: 'footer' },
        { fieldGuess: 'MRP', text: 'no box here', confidence: 70, region: 'footer' },
      ],
      { onDuplicate: noop }
    );
    assert.deepEqual(Object.keys(out), ['MRP']);
    assert.equal(out.MRP.text, '120');
  });

  it('returns an empty dict for empty or missing input', () => {
    assert.deepEqual(fieldsArrayToExtracted([], { onDuplicate: noop }), {});
    assert.deepEqual(fieldsArrayToExtracted(null, { onDuplicate: noop }), {});
  });
});

describe('mapFieldsToRules integration', () => {
  it('extracts structured fields from user regression OCR text', () => {
    const ocrText = [
      'Manufactured By: By:',
      'ABC Food Products Pvt. Ltd',
      '123, Industrial Area, Mumbai, India',
      'Customer Care: 1800-123-4567',
    ].join('\n');

    const fields = mapFieldsToRules(ocrText, 95);

    assert.equal(fields.manufacturer, 'ABC Food Products Pvt. Ltd');
    assert.equal(fields.manufactured_by, 'ABC Food Products Pvt. Ltd');
    assert.equal(fields.manufacturer_address, '123, Industrial Area, Mumbai, India');
    assert.equal(fields.customer_care, '1800-123-4567');
    assert.notEqual(fields.manufacturer_address, 'Manufactured By: By:');

    assert.equal(fields.MANUFACTURER_ADDRESS.text, '123, Industrial Area, Mumbai, India');
    assert.equal(fields.MANUFACTURER.text, 'ABC Food Products Pvt. Ltd');
    assert.equal(fields.CONSUMER_CARE.text, '1800-123-4567');
    assert.equal(fields.isImported, false);
  });

  it('handles bilingual Hindi packaging and next-line values', () => {
    const ocrText = [
      'निर्माता: By:',
      'पतंजलि आयुर्वेद लिमिटेड',
      'हरिद्वार, उत्तराखंड - 249401',
      'ग्राहक सेवा: 1800-180-4187',
      'शुद्ध वजन:',
      '1 किग्रा',
      'अधिकतम खुदरा मूल्य: ₹250',
    ].join('\n');

    const fields = mapFieldsToRules(ocrText, 90, true);

    assert.equal(fields.manufacturer, 'पतंजलि आयुर्वेद लिमिटेड');
    assert.equal(fields.manufacturer_address, 'हरिद्वार, उत्तराखंड - 249401');
    assert.equal(fields.customer_care, '1800-180-4187');
    assert.equal(fields.net_quantity, '1 किग्रा');
    assert.equal(fields.mrp, '₹250');
    assert.equal(fields.isImported, true);
  });
});


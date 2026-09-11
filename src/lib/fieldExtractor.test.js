import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFields, detectLabel, stripLabelAndNoise, isValidFieldValue } from './fieldExtractor.js';

describe('fieldExtractor unit functions', () => {
  it('detects labels and distinguishes specific patterns', () => {
    const mfdByMatch = detectLabel('Mfd by: ABC Foods');
    assert.equal(mfdByMatch?.field, 'MANUFACTURER_ADDRESS');
    assert.equal(mfdByMatch?.matchedAlias, 'mfd by');

    const mfdDateMatch = detectLabel('Mfd Date: 08/2026');
    assert.equal(mfdDateMatch?.field, 'MANUFACTURE_DATE');
    assert.equal(mfdDateMatch?.matchedAlias, 'mfd date');
  });

  it('strips label and repeated stutter tokens (e.g. By: By:)', () => {
    const match = detectLabel('Manufactured By: By:');
    assert.ok(match);
    const { rawLabel, remainder } = stripLabelAndNoise('Manufactured By: By:', match);
    assert.equal(rawLabel, 'Manufactured By: By:');
    assert.equal(remainder, '');
  });

  it('strips stutter when value follows on same line', () => {
    const match = detectLabel('Manufactured By: By: ABC Food Products');
    assert.ok(match);
    const { remainder } = stripLabelAndNoise('Manufactured By: By: ABC Food Products', match);
    assert.equal(remainder, 'ABC Food Products');
  });

  it('validates substantive field values and rejects label synonyms', () => {
    assert.equal(isValidFieldValue('123, Industrial Area', 'manufactured by'), true);
    assert.equal(isValidFieldValue('manufactured by', 'manufactured by'), false);
    assert.equal(isValidFieldValue('By:', 'by'), false);
    assert.equal(isValidFieldValue('', ''), false);
    assert.equal(isValidFieldValue(':-', ''), false);
  });
});

describe('fieldExtractor integration & regression cases', () => {
  it('handles exact user regression case with duplicated label fragments and multiline address', () => {
    const ocrText = [
      'Manufactured By: By:',
      'ABC Food Products Pvt. Ltd',
      '123, Industrial Area, Mumbai, India',
      'Customer Care: 1800-123-4567',
    ].join('\n');

    const result = extractFields(ocrText, { wholeImageConfidence: 95 });

    // Assert exact regression points
    assert.equal(result.manufacturer, 'ABC Food Products Pvt. Ltd');
    assert.equal(result.manufactured_by, 'ABC Food Products Pvt. Ltd');
    assert.equal(result.manufacturer_address, '123, Industrial Area, Mumbai, India');
    assert.equal(result.customer_care, '1800-123-4567');
    assert.notEqual(result.manufacturer_address, 'Manufactured By: By:');

    // Verify structured field object schemas
    assert.equal(result.MANUFACTURER_ADDRESS.field, 'MANUFACTURER_ADDRESS');
    assert.equal(result.MANUFACTURER_ADDRESS.value, '123, Industrial Area, Mumbai, India');
    assert.equal(result.MANUFACTURER_ADDRESS.text, '123, Industrial Area, Mumbai, India');
    assert.equal(result.MANUFACTURER_ADDRESS.raw_label, 'Manufactured By: By:');
    assert.equal(result.MANUFACTURER_ADDRESS.matched_label, 'manufactured by');
    assert.equal(result.MANUFACTURER_ADDRESS.manufacturer, 'ABC Food Products Pvt. Ltd');
    assert.equal(result.MANUFACTURER_ADDRESS.address, '123, Industrial Area, Mumbai, India');
    assert.equal(result.MANUFACTURER_ADDRESS.full_text, 'ABC Food Products Pvt. Ltd, 123, Industrial Area, Mumbai, India');
    assert.equal(result.MANUFACTURER_ADDRESS.confidence, 0.95);

    assert.equal(result.MANUFACTURER.field, 'MANUFACTURER');
    assert.equal(result.MANUFACTURER.value, 'ABC Food Products Pvt. Ltd');
    assert.equal(result.MANUFACTURER.text, 'ABC Food Products Pvt. Ltd');

    assert.equal(result.CONSUMER_CARE.field, 'CONSUMER_CARE');
    assert.equal(result.CONSUMER_CARE.value, '1800-123-4567');
    assert.equal(result.CONSUMER_CARE.text, '1800-123-4567');

    // Verify non-enumerable properties are not present in Object.keys
    const keys = Object.keys(result);
    assert.ok(keys.includes('MANUFACTURER_ADDRESS'));
    assert.ok(keys.includes('MANUFACTURER'));
    assert.ok(keys.includes('CONSUMER_CARE'));
    assert.ok(!keys.includes('manufacturer'));
    assert.ok(!keys.includes('manufactured_by'));
    assert.ok(!keys.includes('manufacturer_address'));
    assert.ok(!keys.includes('customer_care'));
  });

  it('extracts same-line values properly', () => {
    const ocrText = [
      'Manufacturer: ABC Foods',
      'Customer Care: 1800-123-4567',
      'MRP: Rs 120 (Incl. of all taxes)',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacturer, 'ABC Foods');
    assert.equal(result.customer_care, '1800-123-4567');
    assert.equal(result.mrp, 'Rs 120 (Incl. of all taxes)');
  });

  it('extracts next-line values for single-line fields', () => {
    const ocrText = [
      'NET WEIGHT:',
      '250 g',
      'MRP:',
      '₹150',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.net_quantity, '250 g');
    assert.equal(result.mrp, '₹150');
    assert.equal(result.NET_QUANTITY.text, '250 g');
    assert.equal(result.MRP.text, '₹150');
  });

  it('extracts multiline values across 3+ lines for address', () => {
    const ocrText = [
      'Manufactured By:',
      'Pioneer Beverages Pvt. Ltd',
      'Plot 45, Phase II',
      'RIICO Industrial Area, Jaipur, Rajasthan 302022',
      'Batch No: PB-2026-09',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacturer, 'Pioneer Beverages Pvt. Ltd');
    assert.equal(
      result.manufacturer_address,
      'Plot 45, Phase II, RIICO Industrial Area, Jaipur, Rajasthan 302022'
    );
    assert.equal(result.batch_number, 'PB-2026-09');
  });

  it('handles repeated/duplicated label noise across fields', () => {
    const ocrText = [
      'Batch No: No: BN-999',
      'Date of Mfg: Date: 05/2026',
      'Customer Care: Care: 011-23456789',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.batch_number, 'BN-999');
    assert.equal(result.manufacture_date, '05/2026');
    assert.equal(result.customer_care, '011-23456789');
  });

  it('handles OCR punctuation variations', () => {
    const ocrText = [
      'Manufactured By - Sunrise Agro Foods',
      'Mfg By: : Organic Fields Ltd',
      'MRP : ₹ 99.00 /-',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.ok(result.manufacturer.includes('Organic Fields Ltd') || result.manufacturer.includes('Sunrise Agro'));
    assert.ok(result.mrp.includes('99.00'));
  });

  it('avoids collisions between mfd by and mfd date', () => {
    const ocrText = [
      'Mfd by: Heritage Dairy Ltd',
      'Mfd date: 03/2026',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacturer, 'Heritage Dairy Ltd');
    assert.equal(result.manufacture_date, '03/2026');
  });

  it('omits missing values (label only) and never hallucinates', () => {
    const ocrText = [
      'Manufactured By:',
      'MRP: ₹50',
    ].join('\n');

    const result = extractFields(ocrText);
    // Next line is MRP, so MANUFACTURER_ADDRESS has no value lines
    assert.equal(result.MANUFACTURER_ADDRESS, undefined);
    assert.equal(result.manufacturer_address, null);
    assert.equal(result.mrp, '₹50');
  });

  it('supports Hindi bilingual labels and multiline values', () => {
    const ocrText = [
      'निर्माता: By:',
      'पतंजलि आयुर्वेद लिमिटेड',
      'हरिद्वार, उत्तराखंड - 249401',
      'ग्राहक सेवा: 1800-180-4187',
      'शुद्ध वजन:',
      '1 किग्रा',
      'अधिकतम खुदरा मूल्य: ₹250',
    ].join('\n');

    const result = extractFields(ocrText, { wholeImageConfidence: 90 });
    assert.equal(result.manufacturer, 'पतंजलि आयुर्वेद लिमिटेड');
    assert.equal(result.manufacturer_address, 'हरिद्वार, उत्तराखंड - 249401');
    assert.equal(result.customer_care, '1800-180-4187');
    assert.equal(result.net_quantity, '1 किग्रा');
    assert.equal(result.mrp, '₹250');
  });

  it('extracts expiry date with "Exp. Date" label', () => {
    const ocrText = [
      'Mfg. Date: 13 June 2025',
      'Exp. Date: 14 Dec 2025',
      'MRP: ₹120',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacture_date, '13 June 2025');
    assert.equal(result.expiry_date, '14 Dec 2025');
    assert.equal(result.mrp, '₹120');
    assert.equal(result.EXPIRY_DATE.field, 'EXPIRY_DATE');
    assert.equal(result.EXPIRY_DATE.matched_label, 'exp. date');
  });

  it('extracts expiry date with "Best Before" label', () => {
    const ocrText = 'Best Before: 30 Nov 2025';
    const result = extractFields(ocrText);
    assert.equal(result.best_before, '30 Nov 2025');
    assert.equal(result.expiry_date, '30 Nov 2025');
  });

  it('extracts expiry date with "Use By" label', () => {
    const ocrText = 'Use By Date: 2025-12-31';
    const result = extractFields(ocrText);
    assert.equal(result.expiry_date, '2025-12-31');
    assert.equal(result.EXPIRY_DATE.matched_label, 'use by date');
  });

  it('preserves trailing period in abbreviations like Ltd.', () => {
    const ocrText = [
      'Manufactured By:',
      'ABC Food Products Pvt. Ltd.',
      '123, Industrial Area, Mumbai',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacturer, 'ABC Food Products Pvt. Ltd.');
    assert.ok(result.manufacturer.endsWith('Ltd.'), 'trailing period in "Ltd." should be preserved');
  });

  it('strips barcode noise and isolates pure date from "Mfg. Date: 13 June 2025 Ji 90086"', () => {
    const ocrText = 'Mfg. Date: 13 June 2025 Ji 90086';
    const result = extractFields(ocrText);
    assert.equal(result.manufacture_date, '13 June 2025');
    assert.equal(result.MANUFACTURE_DATE.value, '13 June 2025');
  });

  it('extracts manufacture date with OCR misread label "Mtg. Date"', () => {
    const ocrText = [
      'Batch No: AB12345',
      'Mtg. Date: 13 June 2025',
      'Exp. Date: 14 Dec 2025',
      'MRP: ₹120',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacture_date, '13 June 2025');
    assert.equal(result.expiry_date, '14 Dec 2025');
  });

  it('extracts manufacture date when label and date are on separate lines', () => {
    const ocrText = [
      'Batch No: AB12345',
      'Mfg. Date:',
      '13 June 2025',
      'Exp. Date: 14 Dec 2025',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacture_date, '13 June 2025');
  });

  it('disambiguates unlabelled manufacture date when expiry date is known', () => {
    const ocrText = [
      'Batch No: AB12345',
      '13 June 2025',
      'Exp. Date: 14 Dec 2025',
      'MRP: ₹120',
    ].join('\n');

    const result = extractFields(ocrText);
    assert.equal(result.manufacture_date, '13 June 2025');
    assert.equal(result.expiry_date, '14 Dec 2025');
  });
});


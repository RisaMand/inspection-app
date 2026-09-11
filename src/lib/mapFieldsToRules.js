// src/lib/mapFieldsToRules.js — Bridges CV's checkImage() output into RE's checkCompliance() input shape.
import { extractFields } from './fieldExtractor.js';

const FIELD_SYNONYMS = {
  MANUFACTURER_ADDRESS: [
    // English
    'manufactured by',
    'marketed by',
    'mfd by',
    'packed by',

    // Hindi
    'निर्माता',
    'द्वारा निर्मित',
    'विपणनकर्ता',
    'विपणन द्वारा',
    'पैककर्ता',
    'द्वारा पैक'
  ],

  COMMODITY_NAME: [
    // Intentionally empty for now.
    // Product/commodity name remains whole-text OCR
    // best-effort and is not region-classified yet.
  ],

  NET_QUANTITY: [
    // English
    'net qty',
    'net wt',
    'net weight',
    'net volume',
    'net quantity',

    // Hindi
    'शुद्ध मात्रा',
    'शुद्ध वजन',
    'शुद्ध भार',
    'शुद्ध आयतन'
  ],

  MANUFACTURE_DATE: [
    // English
    'Mfg. Date',
    'mfg',
    'mfd',
    'mig',
    'packed on',
    'date of manufacture',

    // Hindi
    'निर्माण तिथि',
    'निर्मित तिथि',
    'निर्माण दिनांक',
    'निर्मित दिनांक',
    'पैकिंग तिथि',
    'पैकिंग दिनांक',
    'पैक किया गया'
  ],

  EXPIRY_DATE: [
    // English
    'expiry date',
    'exp date',
    'exp. date',
    'best before',
    'use by',
    'bb',
    'shelf life',

    // Hindi
    'समाप्ति तिथि',
    'समाप्ति दिनांक',
    'उपयोग की अंतिम तिथि',
  ],

  MRP: [
    // English
    'MRP',
    'mrp',
    'm.r.p',
    'maximum retail price',
    'max retail price',

    // Hindi
    'एमआरपी',
    'एम.आर.पी',
    'अधिकतम खुदरा मूल्य',
    'अधिकतम खुदरा कीमत',
    'अधिकतम विक्रय मूल्य'
  ],

  CONSUMER_CARE: [
    // English
    'Customer Care',
    'customer care',
    'consumer care',
    'for complaints',
    'helpline',

    // Hindi
    'ग्राहक सेवा',
    'ग्राहक सेवा(कस्टमर केयर)',
    'उपभोक्ता सेवा',
    'शिकायत के लिए',
    'शिकायत हेतु',
    'शिकायत',
    'हेल्पलाइन'
  ],

  COUNTRY_OF_ORIGIN: [
    // English
    'country of origin',
    'made in',
    'origin',

    // Hindi
    'मूल देश',
    'उत्पत्ति का देश',
    'मूल स्थान',
    'उत्पत्ति',
    'भारत में निर्मित',
    'भारत में बना'
  ],

  UNIT_SALE_PRICE: [
    // English
    'unit sale price',
    'unit price',
    'usp',
    'u.s.p',
    
    'per g',
    'per kg',
    'per ml',
    'per l',
    'per piece',

    // Hindi
    'इकाई विक्रय मूल्य',
    'यूनिट बिक्री मूल्य',
    'प्रति ग्राम',
    'प्रति किग्रा',
    'प्रति लीटर'
  ],

  STANDARD_QUANTITY: [
    // English
    'standard size',
    'standard pack',
    'std pack',
    'not a standard pack size',
    'non standard size',

    // Hindi
    'मानक पैक',
    'गैर-मानक'
  ],

  BATCH_NUMBER: [
    // English
    'Batch No',
    'batch no',
    'batch number',
    'batch',
    'b.no',
    'b. no',
    'lot no',
    'lot number',
    'lot',

    // Hindi
    'बैच संख्या',  
    'बैच नं',
    'बैच',
    'लॉट नं',
    'लॉट'
  ],
};

/**
 * Classifies one OCR'd region (e.g. a detectTextRegions box) into a rule
 * field, or rejects it. Rejection is explicit and two-tiered: `empty`
 * means Tesseract found no text at all (mascot art, blank backdrop, wood
 * grain), `no-keyword` means text exists but names no regulated field
 * (brand slogans, logos, barcode digits). Both are "not a field" — the
 * distinction tells Phase 2 whether the box was unreadable or readable
 * but irrelevant.
 *
 * @param {string} regionText - Raw OCR text of a single region.
 * @returns {{ fieldGuess: string, text: string } | { fieldGuess: null, reason: 'empty' | 'no-keyword' }}
 */
export function classifyRegionText(regionText) {
  const text = (regionText || '').trim().replace(/\s+/g, ' ');
  if (!text) return { fieldGuess: null, reason: 'empty' };

  const lower = text.toLowerCase();
  for (const [ruleField, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (synonyms.length > 0 && synonyms.some((syn) => lower.includes(syn))) {
      return { fieldGuess: ruleField, text };
    }
  }
  return { fieldGuess: null, reason: 'no-keyword' };
}

/**
 * Names the coarse vertical zone a box sits in, from the box center's
 * fractional height: top third 'header' (brand, title), middle 'body'
 * (declarations, nutrition, ingredients), bottom 'footer' (MRP, dates,
 * care contacts). Deliberately coarse — true panel identity (principal
 * display panel vs information panel) cannot be derived from a box's
 * position alone and would need panel segmentation; this answers only
 * "where on the label" for downstream weighting, not "which panel".
 *
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @param {{ width: number, height: number } | null} imageSize
 * @returns {'header' | 'body' | 'footer' | 'unknown'}
 */
export function zoneForBox(box, imageSize) {
  const height = imageSize?.height;
  if (!box || typeof height !== 'number' || height <= 0) return 'unknown';
  const fraction = (box.y + box.h / 2) / height;
  if (fraction < 1 / 3) return 'header';
  if (fraction < 2 / 3) return 'body';
  return 'footer';
}

/**
 * Builds the boxed-fields array from OCR'd regions: each entry carries the
 * resolved field guess, its text, the region's own OCR confidence (0-100,
 * CV-side convention like runOCR — never the whole-image number, never
 * invented: missing input stays null), the precise bounding box, and the
 * coarse named zone. Regions whose text classified to a null fieldGuess
 * (empty or no-keyword junk — mascot art, logos, table grain, barcode
 * digits) are dropped here, so a null-field region can never contribute
 * a boundingBox to the fields[] array. Only regions like region 19 →
 * MANUFACTURER_ADDRESS appear downstream.
 *
 * @param {Array<{ box: { x: number, y: number, w: number, h: number }, text: string, confidence?: number }>} regions
 * @param {{ width: number, height: number } | null} [imageSize] - Needed for zone naming; region is 'unknown' without it.
 * @returns {Array<{ fieldGuess: string, text: string, confidence: number | null, boundingBox: { x: number, y: number, w: number, h: number }, region: string }>}
 */
export function attachRegionBoxes(regions, imageSize = null) {
  const fields = [];
  for (const { box, text, confidence } of regions || []) {
    const verdict = classifyRegionText(text);
    if (verdict.fieldGuess === null) continue;
    fields.push({
      fieldGuess: verdict.fieldGuess,
      text: verdict.text,
      confidence: typeof confidence === 'number' ? confidence : null,
      boundingBox: { ...box },
      region: zoneForBox(box, imageSize),
    });
  }
  return fields;
}

/**
 * Adapts the boxed-fields array into the rule engine's dict shape:
 * `{ FIELD_NAME: { text, confidence, region, boundingBox, fontSizeMm } }`,
 * which is what `ruleInterpreter.js` looks up via `extractedData[rule.field]`.
 * Not wired into checkImage() yet — converter only.
 *
 * Policies:
 * - Duplicates: highest confidence wins (null counts as lowest); each
 *   dropped duplicate is reported via `onDuplicate` (defaults to
 *   console.warn) so promotion fights stay visible.
 * - Confidence: CV 0-100 → RE 0-1 (`/ 100`); null stays null, never zero.
 * - `fontSizeMm` is always null for now: no DPI/reference object is
 *   measured, and inventing one would dress up a guess. The key exists
 *   because the font-size checker expects it.
 * - Guards: null/non-object entries, null fieldGuesses, and entries with
 *   no usable boundingBox are skipped; text is coerced with String().
 *
 * @param {Array<{ fieldGuess: string, text: string, confidence: number | null, boundingBox: object, region: string }>} fieldsArray
 * @param {{ onDuplicate?: (message: string) => void }} [options]
 * @returns {Record<string, { text: string, confidence: number | null, region: string, boundingBox: object, fontSizeMm: null }>}
 */
export function fieldsArrayToExtracted(fieldsArray, { onDuplicate = (msg) => console.warn(msg) } = {}) {
  const extracted = {};
  const bestScore = {};
  const scoreOf = (confidence) => (typeof confidence === 'number' ? confidence : -1);
  for (const entry of fieldsArray || []) {
    if (!entry || typeof entry !== 'object') continue;
    const { fieldGuess, text, confidence, boundingBox, region } = entry;
    if (typeof fieldGuess !== 'string' || !fieldGuess) continue;
    if (!boundingBox || typeof boundingBox !== 'object') continue;
    if (extracted[fieldGuess]) {
      if (scoreOf(confidence) <= bestScore[fieldGuess]) {
        onDuplicate(`fieldsArrayToExtracted: duplicate ${fieldGuess} dropped (kept higher-confidence entry)`);
        continue;
      }
      onDuplicate(`fieldsArrayToExtracted: duplicate ${fieldGuess} replaced by higher-confidence entry`);
    }
    bestScore[fieldGuess] = scoreOf(confidence);
    extracted[fieldGuess] = {
      text: String(text ?? ''),
      confidence: typeof confidence === 'number' ? confidence / 100 : null,
      region,
      boundingBox: { ...boundingBox },
      fontSizeMm: null,
    };
  }
  return extracted;
}

export function mapFieldsToRules(ocrText, wholeImageConfidence, isImported = false) {
  return extractFields(ocrText, { wholeImageConfidence, isImported });
}
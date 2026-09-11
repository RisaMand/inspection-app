// src/lib/fieldExtractor.js
// Robust generic field extraction engine for OCR text.
// Normalizes lines, separates labels from values, filters OCR noise and stutter,
// collects multiline values, and returns rich structured schema objects.

export const FIELD_DEFINITIONS = [
  {
    field: 'MANUFACTURER_ADDRESS',
    canonical: 'manufacturer_address',
    multiline: true,
    maxLines: 5,
    noiseTokens: ['by', 'address', 'details', 'name', 'at', 'place', 'location', 'स्थान', 'निर्माता', 'पैककर्ता', 'विपणनकर्ता'],
    aliases: [
      // English - ordered by specificity / length
      'manufactured & marketed by',
      'manufactured and marketed by',
      'manufactured & packed by',
      'manufactured and packed by',
      'marketed and distributed by',
      'marketed & distributed by',
      'manufactured in india by',
      'manufactured in india',
      'manufactured in',
      'manufactured by',
      'marketed by',
      'produced by',
      'imported by',
      'packed by',
      'pkd by',
      'pkd. by',
      'mfd. in india by',
      'mfd in india by',
      'mfd. in india',
      'mfd in india',
      'mfd. in',
      'mfd in',
      'mfd by',
      'mfd. by',
      'mfg by',
      'mfg. by',
      'mfg at',
      'mfd at',
      'manufactured at',
      'manufacturer address',
      'manufacturer',
      'mfg address',
      'mfg. address',
      // Place of manufacture aliases
      'place of manufacture',
      'place of manufacturing',
      'place of packing',
      'place of packaging',
      'place of import',
      'place of origin',
      'manufacturing place',
      'manufacturing unit',
      'manufacturing facility',
      'manufacturing location',
      'factory location',
      'plant location',
      'unit location',
      'mfg place',
      'mfg location',
      'place:',
      'place',
      'location:',
      'location',
      'address line 1',
      'address line 2',
      'address line',
      'regd. office',
      'registered office',
      'factory address',
      'unit address',
      'office address',
      'address:',
      'address',
      // Hindi
      'द्वारा निर्मित और विपणन',
      'निर्माता और विपणनकर्ता',
      'द्वारा निर्मित',
      'विपणन द्वारा',
      'द्वारा पैक',
      'निर्माता',
      'विपणनकर्ता',
      'पैककर्ता',
      'निर्माण स्थान',
      'उत्पादन स्थान',
      'पैकिंग स्थान',
      'स्थान:',
      'स्थान',
      'पता:',
      'पता',
    ],
  },
  {
    field: 'CONSUMER_CARE',
    canonical: 'customer_care',
    multiline: true,
    maxLines: 3,
    noiseTokens: ['care', 'cell', 'executive', 'details', 'complaints', 'helpline', 'सेवा', 'हेल्पलाइन'],
    aliases: [
      'consumer care cell',
      'customer care cell',
      'consumer care executive',
      'customer care executive',
      'consumer care details',
      'customer care details',
      'consumer complaints',
      'customer complaints',
      'consumer helpline',
      'customer helpline',
      'customer service',
      'consumer care',
      'customer care',
      'for complaints',
      'toll free no',
      'toll free number',
      'toll free',
      'helpline number',
      'helpline no',
      'helpline',
      'feedback/complaints',
      'consumer feedback',
      'contact details',
      'contact number',
      'contact info',
      'customer support',
      'contact us:',
      'contact us',
      'contact no:',
      'contact no.',
      'contact no',
      'contact:',
      'contact',
      'call us:',
      'call us',
      'tel no:',
      'tel no.',
      'tel no',
      'tel:',
      'tel.',
      'phone no:',
      'phone no.',
      'phone no',
      'phone:',
      'email id:',
      'email id',
      'e-mail id:',
      'e-mail id',
      'email:',
      'email',
      'e-mail:',
      'e-mail',
      'ontact:',
      'ontact',
      // Hindi
      'उपभोक्ता सेवा',
      'ग्राहक सेवा',
      'शिकायत के लिए',
      'शिकायत हेतु',
      'शिकायत',
      'हेल्पलाइन',
      'संपर्क:',
      'संपर्क',
      'फोन:',
      'फोन',
    ],
  },
  {
    field: 'MANUFACTURE_DATE',
    canonical: 'manufacture_date',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['date', 'of', 'mfg', 'pkd', 'तिथि', 'दिनांक'],
    aliases: [
      'date of manufacture:',
      'date of manufacture',
      'date of manufacturing:',
      'date of manufacturing',
      'date of packaging:',
      'date of packaging',
      'date of packing:',
      'date of packing',
      'date of import:',
      'date of import',
      'date of mfg:',
      'date of mfg.',
      'date of mfg',
      'date of mfd:',
      'date of mfd.',
      'date of mfd',
      'date of pkd:',
      'date of pkd',
      'packing date',
      'packaging date',
      'packed date',
      'pkg date',
      'pkg. date',
      'when packed',
      'packed on',
      'pkd on',
      'packed:',
      'packing:',
      'mfg date',
      'mfd date',
      'mfg. date',
      'mfd. date',
      'mfg.date',
      'mfd.date',
      'mfgdate',
      'mfddate',
      'pkd date',
      'pkd. date',
      'pkddate',
      'mfg dt',
      'mfd dt',
      'mfg. dt',
      'mfd. dt',
      'mfg-date',
      'mfd-date',
      'mfg/pkd',
      'mfg / pkd',
      'mfg/mfd',
      'mfg / mfd',
      'mfg:',
      'mfd:',
      'pkd:',
      'pkg:',
      'dom:',
      'dom',
      'd.o.m:',
      'd.o.m',
      'dop:',
      'dop',
      'd.o.p:',
      'd.o.p',
      'm.f.g.',
      'm.f.g',
      // OCR misread variants
      'mtg. date',
      'mtg.date',
      'mtg date',
      'mtg.',
      'mtg',
      'mfe. date',
      'mfe date',
      'mfe.',
      'mfe',
      'mfa. date',
      'mfa date',
      'mfs. date',
      'mfg. dale',
      'mfd. dale',
      'mfg. oate',
      'mfd. oate',
      'mig. date',
      'mig.date',
      'mig date',
      'mfq. date',
      'mfq date',
      'mfg, date',
      'mfd, date',
      'mig.',
      'mfg.',
      'mfd.',
      'mfg',
      'mfd',
      'mig',
      'mfq',
      'pkd',
      // Hindi
      'निर्माण दिनांक',
      'निर्मित दिनांक',
      'पैकिंग दिनांक',
      'पैकिंग की तारीख',
      'निर्माण तिथि',
      'निर्मित तिथि',
      'पैकिंग तिथि',
      'पैक किया गया',
      'महीना और वर्ष',
    ],
  },
  {
    field: 'EXPIRY_DATE',
    canonical: 'expiry_date',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['date', 'of', 'expiry', 'exp', 'best', 'before', 'use', 'तिथि', 'दिनांक'],
    aliases: [
      'best before date',
      'best before',
      'use by date',
      'use by',
      'expiry date',
      'exp. date',
      'exp.date',
      'exp date',
      'expdate',
      'exp-date',
      'date of expiry',
      'date of exp',
      'shelf life',
      'bb date',
      'bb.',
      'exp.',
      'exp',
      'bb',
      // OCR misread variants
      'exp, date',
      'exo. date',
      'exo date',
      'exy. date',
      'exy date',
      // Hindi
      'समाप्ति तिथि',
      'समाप्ति दिनांक',
      'उपयोग की अंतिम तिथि',
      'इस्तेमाल की अंतिम तारीख',
      'उपभोग की अंतिम तिथि',
    ],
  },
  {
    field: 'MRP',
    canonical: 'mrp',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['price', 'retail', 'max', 'मूल्य', 'कीमत'],
    aliases: [
      'maximum retail price',
      'max retail price',
      'max. retail price',
      'retail price',
      'm.r.p.',
      'm.r.p',
      'mrp',
      // Hindi
      'अधिकतम खुदरा मूल्य',
      'अधिकतम खुदरा कीमत',
      'अधिकतम विक्रय मूल्य',
      'एम.आर.पी',
      'एमआरपी',
    ],
  },
  {
    field: 'NET_QUANTITY',
    canonical: 'net_quantity',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['qty', 'wt', 'weight', 'quantity', 'volume', 'मात्रा', 'वजन'],
    aliases: [
      'net quantity:',
      'net quantity',
      'net volume:',
      'net volume',
      'net weight:',
      'net weight',
      'net content:',
      'net content',
      'net contents:',
      'net contents',
      'net qty:',
      'net qty',
      'net wt.:',
      'net wt.',
      'net wt:',
      'net wt',
      'net mass',
      'weight:',
      'quantity:',
      // Hindi
      'शुद्ध मात्रा',
      'शुद्ध वजन',
      'शुद्ध भार',
      'शुद्ध आयतन',
    ],
  },
  {
    field: 'UNIT_SALE_PRICE',
    canonical: 'unit_sale_price',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['price', 'sale', 'unit', 'usp'],
    aliases: [
      'unit sale price',
      'unit price',
      'u.s.p.',
      'u.s.p',
      'usp',
      'per piece',
      'per kg',
      'per ml',
      'per g',
      'per l',
      // Hindi
      'इकाई विक्रय मूल्य',
      'यूनिट बिक्री मूल्य',
      'प्रति ग्राम',
      'प्रति किग्रा',
      'प्रति लीटर',
    ],
  },
  {
    field: 'COUNTRY_OF_ORIGIN',
    canonical: 'country_of_origin',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['country', 'origin', 'made', 'देश', 'स्थान'],
    aliases: [
      'country of origin',
      'country of manufacture',
      'country of assembly',
      'made in',
      'origin',
      // Hindi
      'उत्पत्ति का देश',
      'भारत में निर्मित',
      'भारत में बना',
      'मूल देश',
      'मूल स्थान',
      'उत्पत्ति',
    ],
  },
  {
    field: 'BATCH_NUMBER',
    canonical: 'batch_number',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['number', 'no', 'batch', 'lot', 'नं'],
    aliases: [
      'batch number:',
      'batch number',
      'batch no.:',
      'batch no.',
      'batch no:',
      'batch no',
      'batchno:',
      'batchno',
      'batch-no:',
      'batch-no',
      'lot number:',
      'lot number',
      'lot no.:',
      'lot no.',
      'lot no:',
      'lot no',
      'lotno:',
      'lotno',
      'lot-no:',
      'lot-no',
      'b. no.:',
      'b. no.',
      'b. no:',
      'b. no',
      'b.no.:',
      'b.no.',
      'b.no:',
      'b.no',
      'batch:',
      'batch',
      'lot:',
      'lot',
      // Hindi
      'बैच नं.:',
      'बैच नं.',
      'बैच नं',
      'लॉट नं.:',
      'लॉट नं.',
      'लॉट नं',
      'बैच:',
      'बैच',
      'लॉट:',
      'लॉट',
    ],
  },
  {
    field: 'STANDARD_QUANTITY',
    canonical: 'standard_quantity',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['standard', 'pack', 'size'],
    aliases: [
      'not a standard pack size',
      'non standard size',
      'standard size',
      'standard pack',
      'std pack',
      // Hindi
      'मानक पैक',
      'गैर-मानक',
    ],
  },
  {
    field: 'COMMODITY_NAME',
    canonical: 'commodity_name',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['name', 'product', 'commodity'],
    aliases: [
      'common name of flavour',
      'common name of flavor',
      'common name of product',
      'common name',
      'name of the commodity',
      'name of commodity',
      'name of the product',
      'name of product',
      'commodity name',
      'product name',
      'generic name',
      'commodity:',
      'commodity',
      'product:',
      'product',
      'item:',
      'item',
      // Hindi
      'वस्तु का नाम',
      'उत्पाद का नाम',
    ],
  },
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Precompile pattern matchers sorted by length descending so specific aliases match first
const COMPILED_PATTERNS = [];
for (const def of FIELD_DEFINITIONS) {
  for (const alias of def.aliases) {
    COMPILED_PATTERNS.push({
      field: def.field,
      definition: def,
      alias,
      length: alias.length,
    });
  }
}
COMPILED_PATTERNS.sort((a, b) => b.length - a.length);

/**
 * Checks whether a line matches any known field label.
 * Returns match details or null.
 */
export function detectLabel(lineText) {
  if (!lineText || typeof lineText !== 'string') return null;
  const trimmed = lineText.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  for (const item of COMPILED_PATTERNS) {
    const alias = item.alias.toLowerCase();
    let idx = lower.indexOf(alias);
    if (idx === -1) continue;

    // Verify word boundary before match
    if (idx > 0) {
      const prevChar = lower[idx - 1];
      if (/[\p{L}\p{N}]/u.test(prevChar)) continue;
    }

    // Verify word boundary after match
    const endIdx = idx + alias.length;
    if (endIdx < lower.length) {
      const nextChar = lower[endIdx];
      if (/[\p{L}\p{N}]/u.test(nextChar)) continue;
    }

    return {
      field: item.field,
      definition: item.definition,
      matchedAlias: item.alias,
      matchIndex: idx,
      matchLength: alias.length,
      rawLabelCandidate: trimmed.slice(0, endIdx),
      remainderCandidate: trimmed.slice(endIdx),
    };
  }

  return null;
}

/**
 * Strips matched label and OCR noise/stutters (e.g. repeated "By: By:", "No: No:").
 */
export function stripLabelAndNoise(lineText, labelMatch) {
  const { matchedAlias, matchIndex, matchLength, definition } = labelMatch;
  const original = lineText.trim();

  // Everything after the matched label
  let remainder = original.slice(matchIndex + matchLength);
  let rawLabel = original.slice(0, matchIndex + matchLength);

  // Strip leading punctuation/whitespace from remainder
  const leadingPunctMatch = remainder.match(/^[:\-\s.,;]+/);
  if (leadingPunctMatch) {
    rawLabel += leadingPunctMatch[0];
    remainder = remainder.slice(leadingPunctMatch[0].length);
  }

  // Detect and strip repeated/stutter label tokens (e.g. key ends with "By", remainder starts with "By:")
  const aliasTokens = matchedAlias.toLowerCase().split(/\s+/).filter(Boolean);
  const lastAliasToken = aliasTokens[aliasTokens.length - 1];

  const candidateTokens = new Set([
    'by', 'at', 'no', 'date', 'care', 'cell', 'details', 'name', 'address', 'of',
    ...(definition?.noiseTokens || [])
  ]);
  if (lastAliasToken) candidateTokens.add(lastAliasToken);

  let changed = true;
  while (changed) {
    changed = false;
    for (const token of candidateTokens) {
      if (!token || token.length < 2) continue;
      const escaped = escapeRegex(token);
      const stutterRegex = new RegExp(`^(?:${escaped}[:\\-\\s.,;]*)+`, 'iu');
      const stutterMatch = remainder.match(stutterRegex);
      if (stutterMatch) {
        rawLabel += stutterMatch[0];
        remainder = remainder.slice(stutterMatch[0].length).replace(/^[:\-\s.,;]+/, '');
        changed = true;
      }
    }
  }

  // Strip any remaining leading/trailing punctuation/whitespace
  remainder = remainder.replace(/^[:\-\s.,;]+|[:\-\s,;]+$/g, '').trim();

  return {
    rawLabel: rawLabel.trim(),
    remainder,
  };
}

const COMMON_NOISE_WORDS = new Set([
  'by', 'at', 'no', 'date', 'care', 'cell', 'details', 'name', 'address', 'of',
  'निर्माता', 'पैककर्ता', 'विपणनकर्ता', 'तिथि', 'दिनांक', 'संख्या'
]);

/**
 * Validates whether an extracted string is a substantive value and not
 * an accidental label synonym, noise, or empty speck.
 */
export function isValidFieldValue(val, matchedAlias = '', definition = null) {
  if (!val || typeof val !== 'string') return false;
  const clean = val.replace(/^[:\-\s.,;]+|[:\-\s.,;]+$/g, '').trim();
  if (clean.length === 0) return false;
  // Must have at least one alphanumeric character
  if (!/[\p{L}\p{N}]/u.test(clean)) return false;

  // Single or double isolated digits/punctuations/symbols are OCR artifacts, not values (e.g. "3", "1", "|")
  if (/^[\p{N}\p{P}\p{S}\s]{1,2}$/u.test(clean)) return false;

  // For company name/address, require letters and length >= 3
  if (definition?.field === 'MANUFACTURER_ADDRESS' || definition?.field === 'MANUFACTURER') {
    if (!/\p{L}/u.test(clean) || clean.length < 3) return false;
  }

  // For dates, require either a digit or a month abbreviation/name
  if (definition?.field === 'MANUFACTURE_DATE' || definition?.field === 'EXPIRY_DATE') {
    if (!/\d/.test(clean) && !/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(clean)) return false;
  }

  const lower = clean.toLowerCase();
  if (matchedAlias && lower === matchedAlias.toLowerCase()) return false;

  // If the clean value consists solely of noise words (e.g. "By" or "By By"), it's not a value
  const words = lower.split(/\s+/).filter(Boolean);
  if (
    words.length > 0 &&
    words.every(
      (w) => COMMON_NOISE_WORDS.has(w) || (definition?.noiseTokens || []).includes(w)
    )
  ) {
    return false;
  }

  // Ensure value is not just a label synonym
  for (const item of COMPILED_PATTERNS) {
    if (lower === item.alias.toLowerCase()) return false;
  }

  return true;
}

/**
 * Attaches non-enumerable lowercase canonical aliases to the extracted object
 * so programmatic lookups like extracted.manufacturer_address succeed while
 * UI enumerations via Object.entries/Object.keys stay clean and deduplicated.
 */
function attachCanonicalAliases(extracted) {
  const aliases = {
    manufacturer: () =>
      extracted.MANUFACTURER?.value ||
      extracted.MANUFACTURER_ADDRESS?.manufacturer ||
      null,
    manufactured_by: () =>
      extracted.MANUFACTURER?.value ||
      extracted.MANUFACTURER_ADDRESS?.manufacturer ||
      null,
    manufacturer_address: () =>
      extracted.MANUFACTURER_ADDRESS?.value ||
      extracted.MANUFACTURER_ADDRESS?.text ||
      null,
    place: () =>
      extracted.MANUFACTURER_ADDRESS?.place ||
      extracted.MANUFACTURER_ADDRESS?.address ||
      extracted.MANUFACTURER_ADDRESS?.value ||
      null,
    place_of_manufacture: () =>
      extracted.MANUFACTURER_ADDRESS?.place ||
      extracted.MANUFACTURER_ADDRESS?.address ||
      extracted.MANUFACTURER_ADDRESS?.value ||
      null,
    customer_care: () =>
      extracted.CONSUMER_CARE?.value ||
      extracted.CONSUMER_CARE?.text ||
      null,
    consumer_care: () =>
      extracted.CONSUMER_CARE?.value ||
      extracted.CONSUMER_CARE?.text ||
      null,
    mrp: () =>
      extracted.MRP?.value ||
      extracted.MRP?.text ||
      null,
    net_quantity: () =>
      extracted.NET_QUANTITY?.value ||
      extracted.NET_QUANTITY?.text ||
      null,
    net_weight: () =>
      extracted.NET_QUANTITY?.value ||
      extracted.NET_QUANTITY?.text ||
      null,
    net_qty: () =>
      extracted.NET_QUANTITY?.value ||
      extracted.NET_QUANTITY?.text ||
      null,
    manufacture_date: () =>
      extracted.MANUFACTURE_DATE?.value ||
      extracted.MANUFACTURE_DATE?.text ||
      null,
    mfg_date: () =>
      extracted.MANUFACTURE_DATE?.value ||
      extracted.MANUFACTURE_DATE?.text ||
      null,
    expiry_date: () =>
      extracted.EXPIRY_DATE?.value ||
      extracted.EXPIRY_DATE?.text ||
      null,
    exp_date: () =>
      extracted.EXPIRY_DATE?.value ||
      extracted.EXPIRY_DATE?.text ||
      null,
    best_before: () =>
      extracted.EXPIRY_DATE?.value ||
      extracted.EXPIRY_DATE?.text ||
      null,
    country_of_origin: () =>
      extracted.COUNTRY_OF_ORIGIN?.value ||
      extracted.COUNTRY_OF_ORIGIN?.text ||
      null,
    unit_sale_price: () =>
      extracted.UNIT_SALE_PRICE?.value ||
      extracted.UNIT_SALE_PRICE?.text ||
      null,
    unit_price: () =>
      extracted.UNIT_SALE_PRICE?.value ||
      extracted.UNIT_SALE_PRICE?.text ||
      null,
    usp: () =>
      extracted.UNIT_SALE_PRICE?.value ||
      extracted.UNIT_SALE_PRICE?.text ||
      null,
    batch_number: () =>
      extracted.BATCH_NUMBER?.value ||
      extracted.BATCH_NUMBER?.text ||
      null,
    batch_no: () =>
      extracted.BATCH_NUMBER?.value ||
      extracted.BATCH_NUMBER?.text ||
      null,
    standard_quantity: () =>
      extracted.STANDARD_QUANTITY?.value ||
      extracted.STANDARD_QUANTITY?.text ||
      null,
    commodity_name: () =>
      extracted.COMMODITY_NAME?.value ||
      extracted.COMMODITY_NAME?.text ||
      null,
  };

  for (const [aliasName, getter] of Object.entries(aliases)) {
    Object.defineProperty(extracted, aliasName, {
      get: getter,
      enumerable: false,
      configurable: true,
    });
  }
}

const PRESERVED_TRAIL_TOKENS = new Set([
  'g', 'gm', 'kg', 'ml', 'l', 'oz', 'mg', 'cl', 'cc',
  'no', 'dt', 'st', 'rd', 'th', 'in', 'at', 'to', 'by', 'of', 'co', 'up',
  'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi', 'xii',
]);

export function cleanLineNoise(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/^[|!~§[\]‘'":;,\s<>&»«*#]+|[|!~§[\]‘'":;,\s<>&»«*#]+$/g, '')
    .replace(/^\b\d\s+(?=\d{2,})/, '')
    .replace(/\s+[|]\s*.*$/, '')
    .replace(/\s+[0-9a-zA-Z!~§[\]‘'":;<>»«]{1,2}$/, (match) => {
      const lower = match.trim().toLowerCase();
      if (PRESERVED_TRAIL_TOKENS.has(lower)) return match;
      return '';
    })
    .replace(/^[:\-\s.,;]+|[:\-\s,;]+$/g, '')
    .trim();
}

export const PURE_DATE_RE = /\b(?:\d{4}[\s/.-]+\d{1,2}[\s/.-]+\d{1,2}|\d{1,2}[\s/.-]+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*[\s/.-]+\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*[\s/.-]+\d{2,4}|\d{1,2}[\s/.-]+\d{1,2}[\s/.-]+\d{2,4}|\d{1,2}[\s/.-]+\d{2,4})\b/i;

function cleanDateNoise(str) {
  if (!str) return '';
  const match = str.match(PURE_DATE_RE);
  if (match) {
    return match[0].trim();
  }
  return str
    .replace(/^[|!~§[\]‘'":;,\s<>&»«*#]+|[|!~§[\]‘'":;,\s<>&»«*#]+$/g, '')
    .replace(/\s+[|].*$/, '')
    .replace(/\s+[ji0-9]{5,}.*$/i, '')
    .replace(/([a-zA-Z]+)(\d{4})/g, '$1 $2')
    .replace(/^[:\-\s.,;]+|[:\-\s,;]+$/g, '')
    .trim();
}

/**
 * Extracts structured fields from OCR text according to Legal Metrology requirements.
 *
 * @param {string} ocrText - Raw OCR text output
 * @param {object} [options] - Options
 * @param {number} [options.wholeImageConfidence=0] - Confidence score (0-100 or 0-1)
 * @param {boolean} [options.isImported=false] - Whether product is imported
 * @returns {Record<string, any>} Extracted fields object with non-enumerable aliases
 */
export function extractFields(ocrText, options = {}) {
  const { wholeImageConfidence = 0, isImported = false } = options;
  const confidence = wholeImageConfidence > 1 ? wholeImageConfidence / 100 : (wholeImageConfidence || 0);

  const extracted = {};

  if (!ocrText || typeof ocrText !== 'string' || !ocrText.trim()) {
    extracted.isImported = isImported;
    attachCanonicalAliases(extracted);
    return extracted;
  }

  // Stage 1: Line Normalization & Analysis
  const rawLines = [];
  for (const raw of ocrText.split(/\r?\n/)) {
    let rem = raw;
    const segs = [];
    while (rem.length > 0) {
      const m1 = detectLabel(rem);
      if (!m1) {
        segs.push(rem);
        break;
      }
      const after = m1.matchIndex + m1.matchLength + 1;
      if (after >= rem.length) {
        segs.push(rem);
        break;
      }
      const sub = rem.slice(after);
      const m2 = detectLabel(sub);
      if (m2 && m2.matchIndex > 0) {
        const splitAt = after + m2.matchIndex;
        segs.push(rem.slice(0, splitAt).trim());
        rem = rem.slice(splitAt).trim();
      } else {
        segs.push(rem);
        break;
      }
    }
    rawLines.push(...segs.filter(Boolean));
  }

  const normalizedLines = rawLines.map((raw, idx) => ({
    idx,
    raw,
    text: raw.replace(/[ \t\u00A0]+/g, ' ').trim(),
    isBlank: raw.trim().length === 0,
  }));

  let i = 0;
  while (i < normalizedLines.length) {
    const current = normalizedLines[i];
    if (current.isBlank) {
      i++;
      continue;
    }

    // Stage 2: Label Detection & Noise Filtering
    const labelMatch = detectLabel(current.text);
    if (!labelMatch) {
      i++;
      continue;
    }

    const { field, definition, matchedAlias } = labelMatch;
    const { rawLabel, remainder } = stripLabelAndNoise(current.text, labelMatch);

    // Stage 3: Label/Value Separation & Multiline Collection
    const collectedValues = [];
    const sourceLines = [current.raw];

    if (isValidFieldValue(remainder, matchedAlias, definition)) {
      collectedValues.push(remainder);
    }

    // If multiline field or remainder was empty, check subsequent lines
    let nextIdx = i + 1;
    const canCollectMore = definition.multiline || collectedValues.length === 0;

    if (canCollectMore) {
      const maxToCollect = definition.maxLines || 1;
      let consecutiveBlank = 0;
      while (nextIdx < normalizedLines.length && collectedValues.length < maxToCollect) {
        const nextLine = normalizedLines[nextIdx];
        if (nextLine.isBlank) {
          consecutiveBlank++;
          if (consecutiveBlank > 2) break;
          nextIdx++;
          continue;
        }
        consecutiveBlank = 0;

        // Stop if next line matches any known field label
        const nextLabel = detectLabel(nextLine.text);
        if (nextLabel) {
          break;
        }

        // Substantive continuation line
        const cleanedLine = cleanLineNoise(nextLine.text);
        if (cleanedLine.length > 0 && /[\p{L}\p{N}]/u.test(cleanedLine)) {
          collectedValues.push(cleanedLine);
          sourceLines.push(nextLine.raw);
          nextIdx++;
        } else {
          nextIdx++;
        }
      }
    }

    // Stage 4: Validation & Anti-Hallucination
    if (collectedValues.length > 0) {
      const sourceText = sourceLines.join('\n');

      if (field === 'MANUFACTURER_ADDRESS') {
        let entityName = '';
        let addressText = '';

        const cleanedValid = collectedValues
          .map(cleanLineNoise)
          .filter((v) => v.length >= 3 && /\p{L}/u.test(v));

        const isExplicitPlaceAlias = /place|location|स्थान/i.test(matchedAlias);

        if (cleanedValid.length >= 2) {
          entityName = cleanedValid[0];
          addressText = cleanedValid.slice(1).join(', ');
        } else if (cleanedValid.length === 1) {
          const singleLine = cleanedValid[0];
          const commaIdx = singleLine.indexOf(',');
          if (commaIdx !== -1 && commaIdx > 3 && commaIdx < singleLine.length - 3) {
            entityName = singleLine.slice(0, commaIdx).trim();
            addressText = singleLine.slice(commaIdx + 1).trim();
          } else if (isExplicitPlaceAlias) {
            addressText = singleLine;
          } else {
            entityName = singleLine;
            addressText = singleLine;
          }
        } else if (collectedValues.length > 0) {
          const fallback = cleanLineNoise(collectedValues[0]);
          if (isExplicitPlaceAlias) {
            addressText = fallback;
          } else {
            entityName = fallback;
            addressText = fallback;
          }
        }

        // Preserve previously extracted entity name if this line only has the place/address
        const existingEntity = extracted.MANUFACTURER?.value || extracted.MANUFACTURER_ADDRESS?.manufacturer;
        if (existingEntity && (!entityName || entityName === addressText || isExplicitPlaceAlias)) {
          entityName = existingEntity;
        }

        // Preserve previously extracted address if this line only has the entity name
        const existingAddress = extracted.MANUFACTURER_ADDRESS?.address;
        if (existingAddress && (!addressText || entityName === addressText) && !isExplicitPlaceAlias) {
          addressText = existingAddress;
        }

        const fullText = entityName && addressText && entityName !== addressText
          ? `${entityName}, ${addressText}`
          : (entityName || addressText);

        extracted.MANUFACTURER_ADDRESS = {
          field: 'MANUFACTURER_ADDRESS',
          value: addressText,
          text: addressText,
          raw_label: rawLabel,
          matched_label: matchedAlias,
          source_text: sourceText,
          confidence,
          manufacturer: entityName,
          address: addressText,
          place: addressText,
          full_text: fullText,
        };

        if (entityName) {
          extracted.MANUFACTURER = {
            field: 'MANUFACTURER',
            value: entityName,
            text: entityName,
            raw_label: rawLabel,
            matched_label: matchedAlias,
            source_text: sourceText,
            confidence,
            manufacturer: entityName,
            address: addressText,
            place: addressText,
            full_text: fullText,
          };
        }

        if (isExplicitPlaceAlias || (addressText && addressText !== entityName)) {
          extracted.PLACE_OF_MANUFACTURE = {
            field: 'PLACE_OF_MANUFACTURE',
            value: addressText,
            text: addressText,
            raw_label: rawLabel,
            matched_label: matchedAlias,
            source_text: sourceText,
            confidence,
          };
        }
      } else if (field === 'MANUFACTURE_DATE' || field === 'EXPIRY_DATE') {
        const valText = cleanDateNoise(collectedValues[0] || '');
        extracted[field] = {
          field,
          value: valText,
          text: valText,
          raw_label: rawLabel,
          matched_label: matchedAlias,
          source_text: sourceText,
          confidence,
        };
      } else {
        const valText = collectedValues.map(cleanLineNoise).filter(Boolean).join('\n');
        extracted[field] = {
          field,
          value: valText,
          text: valText,
          raw_label: rawLabel,
          matched_label: matchedAlias,
          source_text: sourceText,
          confidence,
        };
      }
    }

    // Advance index past any consumed subsequent lines
    i = Math.max(i + 1, nextIdx);
  }

  // Stage 6: Prominent product title fallback for COMMODITY_NAME
  if (!extracted.COMMODITY_NAME) {
    for (const item of normalizedLines) {
      if (item.isBlank) continue;
      if (detectLabel(item.text)) break;
      const clean = item.text.replace(/^[:\-\s.,;]+|[:\-\s.,;]+$/g, '').trim();
      const words = clean.split(/\s+/);
      if (
        words.length >= 1 &&
        words.length <= 6 &&
        clean.length >= 3 &&
        clean.length <= 50 &&
        !/\d{3,}/.test(clean) &&
        !/(?:ingredients|nutrition|facts|serving|calories|carbohydrates|protein|fat|sugars|cholesterol|sodium|energy|barcode|table|panel|licence|license|evidence|photos)/i.test(clean) &&
        /^[\p{L}\s.&'-]+$/u.test(clean)
      ) {
        extracted.COMMODITY_NAME = {
          field: 'COMMODITY_NAME',
          value: clean,
          text: clean,
          raw_label: '',
          matched_label: 'product title',
          source_text: item.raw,
          confidence,
        };
        break;
      }
    }
  }

  // Stage 7: Regex fallback for MANUFACTURE_DATE when label detection missed it
  // Catches OCR-garbled labels like "Mig, Bate:", "Mtg. Date", "DOM", or lines
  // where label and date are split across lines or date pattern survives.
  if (!extracted.MANUFACTURE_DATE) {
    const MFG_DATE_RE = /(?:mf[gd]|mig|mtg|mfe|mfa|mfs|mfq|pkd|pkg|dom|dop|d\.o\.m|d\.o\.p|date\s*of\s*(?:mfg|mfd|pkd|manufacture|packing)|packed\s*on|pkd\s*on|packed|packing)\.?\s*,?\s*(?:d(?:a|e)?te?|dt)?\.?\s*[:.]?\s*(\d{1,2}[\s/.-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s/.-]+\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s/.-]+\d{2,4}|\d{1,2}[\s/.-]+\d{1,2}[\s/.-]+\d{2,4}|\d{1,2}[\s/.-]+\d{2,4})?/i;
    for (let idx = 0; idx < normalizedLines.length; idx++) {
      const item = normalizedLines[idx];
      if (item.isBlank) continue;
      const m = item.text.match(MFG_DATE_RE);
      if (m) {
        let rawDateVal = m[1];
        let dateSourceRaw = item.raw;
        // If the label had no date on the same line, lookahead to next 1-2 non-blank lines
        if (!rawDateVal) {
          for (let look = idx + 1; look < Math.min(idx + 3, normalizedLines.length); look++) {
            const nextItem = normalizedLines[look];
            if (nextItem.isBlank) continue;
            if (detectLabel(nextItem.text)) break;
            const nextMatch = nextItem.text.match(PURE_DATE_RE);
            if (nextMatch) {
              rawDateVal = nextMatch[0];
              dateSourceRaw = `${item.raw}\n${nextItem.raw}`;
              break;
            }
          }
        }
        if (rawDateVal) {
          const dateVal = cleanDateNoise(rawDateVal);
          if (dateVal && /\d/.test(dateVal)) {
            extracted.MANUFACTURE_DATE = {
              field: 'MANUFACTURE_DATE',
              value: dateVal,
              text: dateVal,
              raw_label: m[0].slice(0, m[1] ? m[0].indexOf(m[1]) : undefined).trim() || 'Mfg. Date:',
              matched_label: 'regex fallback',
              source_text: dateSourceRaw,
              confidence,
            };
            break;
          }
        }
      }
    }
  }

  // Stage 8: Regex fallback for EXPIRY_DATE
  if (!extracted.EXPIRY_DATE) {
    const EXP_DATE_RE = /(?:exp|exo|exy|best\s*before|use\s*by|bb)\.?\s*,?\s*(?:d(?:a|e)?te?|dt)?\.?\s*[:.]?\s*(\d{1,2}[\s/.-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s/.-]+\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s/.-]+\d{2,4}|\d{1,2}[\s/.-]+\d{1,2}[\s/.-]+\d{2,4})/i;
    for (const item of normalizedLines) {
      if (item.isBlank) continue;
      const m = item.text.match(EXP_DATE_RE);
      if (m && m[1]) {
        const dateVal = cleanDateNoise(m[1]);
        if (dateVal && /\d/.test(dateVal)) {
          extracted.EXPIRY_DATE = {
            field: 'EXPIRY_DATE',
            value: dateVal,
            text: dateVal,
            raw_label: m[0].slice(0, m[0].indexOf(m[1])).trim(),
            matched_label: 'regex fallback',
            source_text: item.raw,
            confidence,
          };
          break;
        }
      }
    }
  }

  // Stage 8b: Date Disambiguation Fallback for MANUFACTURE_DATE
  // If MANUFACTURE_DATE is still missing after Stage 7 and 8, search for any valid
  // date pattern on the label. Under Legal Metrology Rule 6(1)(d), any date on a prepackaged
  // food label that is not the expiry date represents the date of manufacture / packing.
  if (!extracted.MANUFACTURE_DATE) {
    for (const item of normalizedLines) {
      if (item.isBlank) continue;
      // Skip lines that explicitly indicate expiry or best before
      if (/(?:exp|expiry|best\s*before|use\s*by|shelf\s*life)/i.test(item.text)) continue;
      const dateMatch = item.text.match(PURE_DATE_RE);
      if (dateMatch) {
        const candidate = cleanDateNoise(dateMatch[0]);
        // Must not be the already-extracted expiry date
        if (candidate && /\d/.test(candidate) && candidate !== extracted.EXPIRY_DATE?.value) {
          extracted.MANUFACTURE_DATE = {
            field: 'MANUFACTURE_DATE',
            value: candidate,
            text: candidate,
            raw_label: '',
            matched_label: 'date disambiguation fallback',
            source_text: item.raw,
            confidence,
          };
          break;
        }
      }
    }
  }

  // Stage 9: Regex fallback for NET_QUANTITY
  // Catches patterns like "150g", "250 ml", "1.5 L", "500 gm", "Net 150g"
  if (!extracted.NET_QUANTITY) {
    const NET_QTY_RE = /(?:net\s*(?:wt|weight|qty|quantity|vol|volume|content)?\.?\s*[:.]?\s*)?\b(\d+(?:\.\d+)?\s*(?:g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|litre|litres|liter|liters|oz|fl\s*oz|cc|cl|pieces?|pcs?|units?)\b)/i;
    for (const item of normalizedLines) {
      if (item.isBlank) continue;
      // Skip lines that are clearly nutrition info, not net quantity
      if (/(?:serving|calories|total\s*fat|saturated|carbohydrate|sugar|protein|sodium|cholesterol|energy|per\s*serving|amount\s*per)/i.test(item.text)) continue;
      // Skip lines already consumed by other fields
      if (/(?:mrp|m\.r\.p|price|₹|rs\.?)/i.test(item.text)) continue;
      const m = item.text.match(NET_QTY_RE);
      if (m && m[1]) {
        const qtyVal = m[1].trim();
        // Only accept if the line looks like it's about net quantity (has "net" or is standalone)
        const lineWords = item.text.trim().split(/\s+/);
        const hasNetLabel = /net/i.test(item.text);
        const isShortLine = lineWords.length <= 4;
        if (hasNetLabel || isShortLine) {
          extracted.NET_QUANTITY = {
            field: 'NET_QUANTITY',
            value: qtyVal,
            text: qtyVal,
            raw_label: hasNetLabel ? item.text.slice(0, item.text.toLowerCase().indexOf('net')) + 'Net' : '',
            matched_label: 'regex fallback',
            source_text: item.raw,
            confidence,
          };
          break;
        }
      }
    }
  }

  // Stage 10: Address / Place of Manufacture fallback
  // If MANUFACTURER_ADDRESS has no address (or address is identical to entityName),
  // search lines for common geographic/address keywords (e.g. "Industrial Area", "Road", "Mumbai", "India")
  const currentAddress = extracted.MANUFACTURER_ADDRESS?.address;
  const currentEntity = extracted.MANUFACTURER_ADDRESS?.manufacturer;
  if (!currentAddress || currentAddress === currentEntity) {
    const ADDRESS_LINE_RE = /(?:industrial area|industrial estate|plot no|survey no|p\.?o\.?|road|rd\.?|street|st\.?|sector|phase|nagar|colony|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|india|pin\s*[-:]?\s*\d{6}|\b\d{6}\b)/i;
    for (const item of normalizedLines) {
      if (item.isBlank) continue;
      // Skip lines belonging to ingredients, nutrition, dates, contact, MRP
      if (/(?:ingredients|nutrition|facts|serving|calories|fat|sugar|protein|date|exp|mfg|batch|mrp|customer|care|email)/i.test(item.text)) continue;
      if (ADDRESS_LINE_RE.test(item.text)) {
        const cleanAddr = cleanLineNoise(item.text);
        if (cleanAddr.length >= 6) {
          const entity = currentEntity || cleanAddr;
          const full = entity !== cleanAddr ? `${entity}, ${cleanAddr}` : cleanAddr;
          extracted.MANUFACTURER_ADDRESS = {
            field: 'MANUFACTURER_ADDRESS',
            value: cleanAddr,
            text: cleanAddr,
            raw_label: '',
            matched_label: 'address fallback',
            source_text: item.raw,
            confidence,
            manufacturer: entity,
            address: cleanAddr,
            place: cleanAddr,
            full_text: full,
          };
          extracted.PLACE_OF_MANUFACTURE = {
            field: 'PLACE_OF_MANUFACTURE',
            value: cleanAddr,
            text: cleanAddr,
            raw_label: '',
            matched_label: 'address fallback',
            source_text: item.raw,
            confidence,
          };
          break;
        }
      }
    }
  }

  // Stage 11: Regex fallback for MRP
  // Catches lines like "₹120 (Incl. of all taxes)", "Rs. 120", "MRP: ₹120", or OCR misreads like "§ vee. 120 (Incl. of all taxes)"
  if (!extracted.MRP) {
    const MRP_FALLBACK_RE = /(?:(?:mrp|m\.r\.p|price|vee|mro|vrp|₹|rs\.?)\b.*?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:\(?(?:incl|inclusive|of\s*all\s*taxes))|(?:[₹\?]|rs\.?)\s*(\d+(?:\.\d{1,2})?))/i;
    for (const item of normalizedLines) {
      if (item.isBlank) continue;
      if (/(?:total|fat|sugar|protein|carbohydrates|serving|size|calories)/i.test(item.text)) continue;
      const m = item.text.match(MRP_FALLBACK_RE);
      if (m) {
        const num = m[1] || m[2] || m[3];
        if (num && parseFloat(num) > 0) {
          const hasIncl = /incl/i.test(item.text);
          const valStr = `₹${num}${hasIncl ? ' (Incl. of all taxes)' : ''}`;
          extracted.MRP = {
            field: 'MRP',
            value: valStr,
            text: `MRP: ${valStr}`,
            raw_label: 'MRP:',
            matched_label: 'regex fallback',
            source_text: item.raw,
            confidence,
          };
          break;
        }
      }
    }
  }

  // Stage 12: Contact / Email fallback
  if (!extracted.CONSUMER_CARE || !extracted.CONSUMER_CARE.value) {
    const EMAIL_RE = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/;
    const PHONE_RE = /\b(1800[- ]?\d{3}[- ]?\d{3,4}|\d{3,5}[- ]?\d{6,8})\b/;
    for (const item of normalizedLines) {
      if (item.isBlank) continue;
      const em = item.text.match(EMAIL_RE);
      const pm = item.text.match(PHONE_RE);
      if (em || pm) {
        const parts = [pm ? pm[1] : null, em ? em[1] : null].filter(Boolean);
        const contactVal = parts.join('\n');
        extracted.CONSUMER_CARE = {
          field: 'CONSUMER_CARE',
          value: contactVal,
          text: contactVal,
          raw_label: 'Contact:',
          matched_label: 'regex fallback',
          source_text: item.raw,
          confidence,
        };
        break;
      }
    }
  }

  extracted.isImported = isImported;
  attachCanonicalAliases(extracted);
  return extracted;
}

export default extractFields;

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
    noiseTokens: ['by', 'address', 'details', 'name', 'at', 'निर्माता', 'पैककर्ता', 'विपणनकर्ता'],
    aliases: [
      // English - ordered by specificity / length
      'manufactured & marketed by',
      'manufactured and marketed by',
      'manufactured & packed by',
      'manufactured and packed by',
      'marketed and distributed by',
      'marketed & distributed by',
      'manufactured by',
      'marketed by',
      'produced by',
      'imported by',
      'packed by',
      'pkd by',
      'pkd. by',
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
      // Hindi
      'द्वारा निर्मित और विपणन',
      'निर्माता और विपणनकर्ता',
      'द्वारा निर्मित',
      'विपणन द्वारा',
      'द्वारा पैक',
      'निर्माता',
      'विपणनकर्ता',
      'पैककर्ता',
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
      // Hindi
      'उपभोक्ता सेवा',
      'ग्राहक सेवा',
      'शिकायत के लिए',
      'शिकायत हेतु',
      'शिकायत',
      'हेल्पलाइन',
    ],
  },
  {
    field: 'MANUFACTURE_DATE',
    canonical: 'manufacture_date',
    multiline: false,
    maxLines: 1,
    noiseTokens: ['date', 'of', 'mfg', 'pkd', 'तिथि', 'दिनांक'],
    aliases: [
      'date of manufacture',
      'date of packaging',
      'date of packing',
      'date of import',
      'date of mfg',
      'date of pkd',
      'packed on',
      'pkd on',
      'mfg date',
      'mfd date',
      'mfg. date',
      'mfd. date',
      'pkd date',
      'pkd. date',
      'mfg.',
      'mfd.',
      'mfg',
      'mfd',
      'mig',
      'pkd',
      // Hindi
      'निर्माण दिनांक',
      'निर्मित दिनांक',
      'पैकिंग दिनांक',
      'निर्माण तिथि',
      'निर्मित तिथि',
      'पैकिंग तिथि',
      'पैक किया गया',
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
      'exp date',
      'date of expiry',
      'date of exp',
      'shelf life',
      'bb date',
      'bb.',
      'exp.',
      'exp',
      'bb',
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
      'net quantity',
      'net volume',
      'net weight',
      'net content',
      'net contents',
      'net qty',
      'net wt.',
      'net wt',
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
      'batch number',
      'batch no.',
      'batch no',
      'lot number',
      'lot no.',
      'lot no',
      'b. no.',
      'b.no.',
      'b. no',
      'b.no',
      'batch',
      'lot',
      // Hindi
      'बैच नं.',
      'बैच नं',
      'लॉट नं.',
      'लॉट नं',
      'बैच',
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
      'name of commodity',
      'generic name',
      'commodity name',
      'product name',
      'commodity',
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
  const rawLines = ocrText.split(/\r?\n/);
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
      while (nextIdx < normalizedLines.length && collectedValues.length < maxToCollect) {
        const nextLine = normalizedLines[nextIdx];
        if (nextLine.isBlank) {
          // Stop on empty line (section boundary)
          break;
        }

        // Stop if next line matches any known field label
        const nextLabel = detectLabel(nextLine.text);
        if (nextLabel) {
          break;
        }

        // Substantive continuation line
        const cleanedLine = nextLine.text.replace(/^[:\-\s.,;]+|[:\-\s,;]+$/g, '').trim();
        if (cleanedLine.length > 0 && /[\p{L}\p{N}]/u.test(cleanedLine)) {
          collectedValues.push(cleanedLine);
          sourceLines.push(nextLine.raw);
          nextIdx++;
        } else {
          break;
        }
      }
    }

    // Stage 4: Validation & Anti-Hallucination
    if (collectedValues.length > 0) {
      const sourceText = sourceLines.join('\n');

      if (field === 'MANUFACTURER_ADDRESS') {
        let entityName = '';
        let addressText = '';

        if (collectedValues.length >= 2) {
          entityName = collectedValues[0];
          addressText = collectedValues.slice(1).join(', ');
        } else {
          // Single line: check for comma separating entity from location
          const singleLine = collectedValues[0];
          const commaIdx = singleLine.indexOf(',');
          if (commaIdx !== -1 && commaIdx > 3 && commaIdx < singleLine.length - 3) {
            entityName = singleLine.slice(0, commaIdx).trim();
            addressText = singleLine.slice(commaIdx + 1).trim();
          } else {
            entityName = singleLine;
            addressText = singleLine;
          }
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
            full_text: fullText,
          };
        }
      } else {
        const valText = collectedValues.join('\n');
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

  extracted.isImported = isImported;
  attachCanonicalAliases(extracted);
  return extracted;
}

export default extractFields;

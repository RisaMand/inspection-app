// src/lib/mapFieldsToRules.js — NEW FILE, fills Pipeline Step 6a
// Bridges CV's checkImage() output into RE's checkCompliance() input shape.
// Minimal, R1-scoped version: whole-image confidence stands in for
// per-field confidence (correct under Mini Bible's "single full-image
// OCR pass" scope — true per-field confidence needs bounding boxes,
// which are explicitly [SKIP] for R1/R2).

const FIELD_SYNONYMS = {
  MANUFACTURER_ADDRESS: ['manufactured by', 'marketed by', 'mfd by', 'packed by'],
  COMMODITY_NAME: [], // usually the product's own brand/title text — weakest signal, R1 best-effort only
  NET_QUANTITY: ['net qty', 'net wt', 'net weight', 'net volume', 'net quantity'],
  MANUFACTURE_DATE: ['mfg', 'mfd', 'mig', 'packed on', 'date of manufacture'],
  MRP: ['mrp', 'm.r.p', 'maximum retail price', 'max retail price'],
  CONSUMER_CARE: ['customer care', 'consumer care', 'for complaints', 'helpline'],
  COUNTRY_OF_ORIGIN: ['country of origin', 'made in', 'origin'],
};

export function mapFieldsToRules(ocrText, wholeImageConfidence, isImported = false) {
  const lines = (ocrText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const confidence = (wholeImageConfidence || 0) / 100; // RE expects 0-1, CV gives 0-100

  const extracted = {};
  for (const [ruleField, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    const hit = lines.find((line) =>
      synonyms.some((syn) => line.toLowerCase().includes(syn))
    );
    if (hit) {
      extracted[ruleField] = { text: hit, confidence };
    }
    // no match → field simply absent from extracted{}, which presencechecker.js
    // already handles correctly (returns passed:false, "field is missing")
  }

  extracted.isImported = isImported; // R1: no automatic detection: needs an inspector toggle in UI (Phase C)
  return extracted;
}
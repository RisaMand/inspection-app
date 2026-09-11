/**
 * Field-zone localization: from Contract A′ boxed fields to named zones
 * of interest. The generic core serves any regulated field; the MRP
 * wrapper adds the documented input surface Phase 4 (tamper detection)
 * consumes. Nothing is ever invented: an absent field yields nulls, so
 * Phase 4 can distinguish "no MRP found" from "MRP at box B".
 */

/**
 * Bounding union of all boxes, or null for an empty set.
 * @param {Array<{ x: number, y: number, w: number, h: number }>} boxes
 */
export function unionBoxes(boxes) {
  const list = boxes || [];
  if (list.length === 0) return null;
  const x = Math.min(...list.map((b) => b.x));
  const y = Math.min(...list.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...list.map((b) => b.x + b.w)) - x,
    h: Math.max(...list.map((b) => b.y + b.h)) - y,
  };
}

const scoreOf = (confidence) => (typeof confidence === 'number' ? confidence : -1);

/**
 * Locates every resolved entry for one field: the primary (highest
 * confidence; null counts lowest), all candidates ranked, and their
 * union box (null when absent).
 *
 * @param {Array<{ fieldGuess: string, text: string, confidence: number | null, boundingBox: object, region: string }>} fields
 * @param {string} fieldName
 */
export function locateFieldZone(fields, fieldName) {
  const candidates = (fields || [])
    .filter((f) => f && f.fieldGuess === fieldName)
    .sort((a, b) => scoreOf(b.confidence) - scoreOf(a.confidence));
  return {
    field: fieldName,
    primary: candidates.length > 0 ? candidates[0] : null,
    candidates,
    count: candidates.length,
    unionBox: unionBoxes(candidates.map((c) => c.boundingBox)),
  };
}

/**
 * MRP-zone localization with the Phase 4 input surface. `tamperSurface`
 * is what sticker/price-tamper detection reads: the region of interest
 * (primary MRP box), the claimed text, its OCR confidence, and the coarse
 * zone. All null when no MRP resolved — Phase 4 must treat that as
 * "nothing to inspect", never as a box at the origin.
 *
 * @param {Array} fields - Contract A′ fields[] entries.
 */
export function locateMRPZone(fields) {
  const zone = locateFieldZone(fields, 'MRP');
  const { primary } = zone;
  return {
    ...zone,
    tamperSurface: {
      roi: primary ? { ...primary.boundingBox } : null,
      text: primary ? primary.text : null,
      confidence: primary ? primary.confidence : null,
      region: primary ? primary.region : null,
    },
  };
}

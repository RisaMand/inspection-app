/**
 * Matches a generic "Label : Value" line. Key must be at least 2 chars so
 * fragments like "A:B" are ignored. No field names are hardcoded — Person 4's
 * rule engine owns field-specific validation.
 */
const KV_RE = /^([^:]{2,60}?)\s*:\s*(.+)$/;

/** A line needs at least this many letters/digits to survive (kills Tesseract specks). */
const MIN_ALNUM = 2;

/** Lines ending here are complete thoughts and keep their line break. */
const TERMINAL_PUNCT_RE = /[.!?:;]$/;

/**
 * A continuation line shorter than this never fuses with its neighbours.
 * Whole-image SPARSE passes on dense labels emit fragment soup ("C9",
 * "Zz", "[ER]") that must stand alone: joining them manufactures longer
 * garbage ("C9 }", "[Ere Xt ey") out of specks. Genuine wrapped prose
 * continuations on labels run much longer, so they still join.
 */
const MIN_JOIN_LEN = 12;

const countAlnum = (line) => (line.match(/[\p{L}\p{N}]/gu) || []).length;

/**
 * Cleans raw Tesseract OCR text into readable paragraphs and extracts
 * best-effort generic "Label : Value" fields.
 *
 * @param {string} rawText - Raw OCR text (e.g. runOCR().ocrText, may be null).
 * @param {Object} [options] - Configuration options.
 * @param {boolean} [options.joinWrappedLines=true] - Join wrapped lines into paragraphs.
 * @returns {{ cleanedText: string, extractedFields: { [key: string]: string } }}
 */
export function cleanOcrText(rawText, options = {}) {
  const { joinWrappedLines = true } = options;

  if (typeof rawText !== 'string' || rawText.trim() === '') {
    return { cleanedText: '', extractedFields: {} };
  }

  const extractedFields = {};
  const paragraphs = [];

  // Blank-line runs mark paragraph boundaries.
  for (const block of rawText.split(/\n\s*\n/)) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t\u00A0]+/g, ' ').trim())
      .filter((line) => line.length > 0 && countAlnum(line) >= MIN_ALNUM);

    if (lines.length === 0) continue;

    // Generic key-value extraction; lines stay in the full text too.
    for (const line of lines) {
      const m = line.match(KV_RE);
      if (m) {
        const key = m[1].trim();
        const value = m[2].trim();
        if (key && value) {
          // Strip duplicate tokens / stutter from value (e.g. key ends with "By", value starts with "By:")
          const keyWords = key.toLowerCase().split(/\s+/).filter(Boolean);
          const lastWord = keyWords[keyWords.length - 1];
          let cleanVal = value.replace(/^[:\-\s.,;]+|[:\-\s,;]+$/g, '');
          if (lastWord && lastWord.length >= 2) {
            const escaped = lastWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const stutterRegex = new RegExp(`^(?:${escaped}[:\\-\\s.,;]*)+`, 'i');
            cleanVal = cleanVal.replace(stutterRegex, '').replace(/^[:\-\s.,;]+|[:\-\s,;]+$/g, '');
          }
          if (cleanVal && countAlnum(cleanVal) >= 1) {
            extractedFields[key] = cleanVal; // last wins on duplicates
          }
        }
      }
    }

    if (!joinWrappedLines) {
      paragraphs.push(lines.join('\n'));
      continue;
    }

    // Join soft-wrapped lines; keep breaks after complete thoughts and KV lines.
    // Short lines never fuse: they are either complete on their own
    // ("250 g") or OCR specks that must not weld onto neighbours.
    const parts = [];
    let current = [];
    const flush = () => {
      if (current.length > 0) {
        parts.push(current.join(' '));
        current = [];
      }
    };
    for (const line of lines) {
      if (current.length > 0) {
        const prev = current[current.length - 1];
        if (
          TERMINAL_PUNCT_RE.test(prev) ||
          prev.includes(':') ||
          prev.length < MIN_JOIN_LEN ||
          line.length < MIN_JOIN_LEN
        ) {
          flush();
        }
      }
      current.push(line);
      if (TERMINAL_PUNCT_RE.test(line) || line.includes(':')) flush();
    }
    flush();
    paragraphs.push(parts.join('\n'));
  }

  return { cleanedText: paragraphs.join('\n\n'), extractedFields };
}

export default cleanOcrText;

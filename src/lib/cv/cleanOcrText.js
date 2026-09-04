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
        if (key && value) extractedFields[key] = value; // last wins on duplicates
      }
    }

    if (!joinWrappedLines) {
      paragraphs.push(lines.join('\n'));
      continue;
    }

    // Join soft-wrapped lines; keep breaks after complete thoughts and KV lines.
    const parts = [];
    let current = [];
    const flush = () => {
      if (current.length > 0) {
        parts.push(current.join(' '));
        current = [];
      }
    };
    for (const line of lines) {
      current.push(line);
      if (TERMINAL_PUNCT_RE.test(line) || line.includes(':')) flush();
    }
    flush();
    paragraphs.push(parts.join('\n'));
  }

  return { cleanedText: paragraphs.join('\n\n'), extractedFields };
}

export default cleanOcrText;

// MOCK — stands in for Person 3's real CV quality-check function.
// Real signature (per Team Build Bible): a function/API you call with a
// photo that returns { pass: bool, reason: string }.
// Swap this file's internals when Person 3 publishes their real function —
// nothing in Capture.jsx should need to change beyond the import.

export function mockQualityCheck(photoDataUrl) {
  // Fake logic: randomly fail ~30% of captures, for testing the retake UI.
  const pass = Math.random() > 0.3;
  return {
    pass,
    reason: pass ? '' : 'Image appears blurry or low-light. Please retake.',
  };
}
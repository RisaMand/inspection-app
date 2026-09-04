import { qualityCheck, DEFAULT_BLUR_THRESHOLD, waitForOpenCV } from './qualityCheck.js';
import { runOCR, terminateOCRWorker } from './ocr.js';
import { cleanOcrText } from './cleanOcrText.js';

export async function checkImage(photo, options = {}) {
  const qcResult = await qualityCheck(photo, options);

  if (!qcResult.pass) {
    return { qualityCheck: qcResult, ocrText: null, confidence: 0 };
  }

  const ocrResult = await runOCR(photo, options); // v2 behavior: options forwarded through
  return {
    qualityCheck: qcResult,
    ocrText: ocrResult.ocrText,
    confidence: ocrResult.confidence,
  };
}

// Full re-export surface — v1's utility exports restored, v2's addition kept
export { qualityCheck, waitForOpenCV, DEFAULT_BLUR_THRESHOLD } from './qualityCheck.js';
export { runOCR, terminateOCRWorker, PSM } from './ocr.js';
export { cleanOcrText } from './cleanOcrText.js';
export default checkImage;
import { createWorker, PSM } from 'tesseract.js';
import { preprocessForOCR } from './preprocess.js';

/**
 * Page segmentation mode for product labels: scattered text blocks among
 * graphics, often tilted. SPARSE_TEXT finds text in no particular order
 * instead of assuming a clean page layout (which is what fails on busy
 * handheld shots). For straight-on shots of a single text block,
 * pass `{ psm: PSM.SINGLE_BLOCK }` instead.
 */
export const DEFAULT_PSM = PSM.SPARSE_TEXT;

let workerPromise = null;
let workerPSM = null;

/**
 * Lazily initializes and reuses a single Tesseract worker instance,
 * pinned to the requested page segmentation mode.
 * @param {string} psm - PSM value (e.g. PSM.SPARSE_TEXT).
 * @returns {Promise<Tesseract.Worker>}
 */
async function getWorker(psm) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      workerPSM = psm;
      return worker;
    })();
  } else if (workerPSM !== psm) {
    const worker = await workerPromise;
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    workerPSM = psm;
  }
  return workerPromise;
}

/**
 * Runs OCR on the full image using Tesseract.js (English only).
 * The image is preprocessed (upscale small captures, grayscale, contrast,
 * denoise, sharpen, adaptive threshold) before recognition.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | string} imageElementOrCanvas - DOM Image, Canvas, or data URL / path.
 * @param {Object} [options] - Configuration options.
 * @param {string} [options.psm=DEFAULT_PSM] - Page segmentation mode (see PSM export).
 * @param {boolean} [options.preprocess=true] - Set false to recognize the raw image.
 * @param {number} [options.upscaleMinSide] - Passed to preprocessForOCR.
 * @param {number} [options.upscaleFactor] - Passed to preprocessForOCR.
 * @param {number} [options.blockSize] - Passed to preprocessForOCR.
 * @param {number} [options.c] - Passed to preprocessForOCR.
 * @returns {Promise<{ ocrText: string, confidence: number }>}
 */
export async function runOCR(imageElementOrCanvas, options = {}) {
  const { psm = DEFAULT_PSM, preprocess = true, ...preprocessOptions } = options;

  const worker = await getWorker(psm);

  const input = preprocess
    ? await preprocessForOCR(imageElementOrCanvas, preprocessOptions)
    : imageElementOrCanvas;

  const { data } = await worker.recognize(input);

  return {
    ocrText: data.text.trim(),
    confidence: data.confidence, // Overall confidence score (0 - 100)
  };
}

/**
 * Terminates the worker when unmounting or cleaning up the module (optional utility).
 */
export async function terminateOCRWorker() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
    workerPSM = null;
  }
}

export { PSM };
export default runOCR;

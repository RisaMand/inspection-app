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

/**
 * OCR language set: single-pass English + Hindi. The worker is created with
 * exactly this set and it never varies at runtime, so it doubles as the
 * `language` value reported in Contract A′ output.
 */
export const OCR_LANGUAGES = 'eng+hin';

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
      const worker = await createWorker(OCR_LANGUAGES);
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
 * Runs OCR on the full image using Tesseract.js (English + Hindi, single pass).
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
 * @returns {Promise<{ ocrText: string, confidence: number, language: string }>}
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
    language: OCR_LANGUAGES,
  };
}

/**
 * Loads a photo into its intrinsic dimensions. Accepts a DOM Image (must
 * already be loaded or loadable), a Canvas (used directly), or a data
 * URL / path string.
 */
function loadImageSource(photo) {
  if (photo instanceof HTMLCanvasElement) {
    return Promise.resolve({ source: photo, width: photo.width, height: photo.height });
  }
  return new Promise((resolve, reject) => {
    const img = photo instanceof HTMLImageElement ? photo : new Image();
    if (!(photo instanceof HTMLImageElement)) img.src = photo;
    const done = () =>
      resolve({ source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    if (img.complete && (img.naturalWidth || img.width)) done();
    else {
      img.onload = done;
      img.onerror = () => reject(new Error('Failed to load image for region OCR'));
    }
  });
}

/**
 * Recognizes each detected text box independently and returns the
 * `{ box, text, confidence }` regions `attachRegionBoxes()` consumes.
 * Each crop is a single text block, so regions run under SINGLE_BLOCK
 * (the shared worker is re-pinned; the next whole-image pass re-pins
 * back). Crops are upscaled to a minimum 80px line height — the same
 * floor the offline proof runs used.
 *
 * Honest cost note: this is one worker pass per region (typically 20-50
 * on real labels, seconds each on-device). Whole-image word-to-box
 * assignment would be faster and is the known future optimization; the
 * per-region pass is what the tested pipeline proves today.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | string} photo
 * @param {Array<{ x: number, y: number, w: number, h: number }>} boxes
 * @returns {Promise<{ regions: Array<{ box: object, text: string, confidence: number }>, imageSize: { width: number, height: number } }>}
 */
export async function recognizeRegions(photo, boxes, options = {}) {
  const worker = await getWorker(options.regionPsm || PSM.SINGLE_BLOCK);
  const { source, width, height } = await loadImageSource(photo);

  const full = document.createElement('canvas');
  full.width = width;
  full.height = height;
  const fullCtx = full.getContext('2d', { willReadFrequently: true });
  fullCtx.drawImage(source, 0, 0);

  const regions = [];
  for (const box of boxes || []) {
    const x = Math.max(0, Math.round(box.x - 2));
    const y = Math.max(0, Math.round(box.y - 2));
    const w = Math.min(width - x, Math.round(box.w + 4));
    const h = Math.min(height - y, Math.round(box.h + 4));
    if (w <= 0 || h <= 0) continue;
    const scale = Math.max(1, 80 / h);
    const crop = document.createElement('canvas');
    crop.width = Math.round(w * scale);
    crop.height = Math.round(h * scale);
    crop.getContext('2d', { willReadFrequently: true }).drawImage(full, x, y, w, h, 0, 0, crop.width, crop.height);
    const { data } = await worker.recognize(crop);
    regions.push({
      box: { x: box.x, y: box.y, w: box.w, h: box.h },
      text: (data.text || '').trim(),
      confidence: data.confidence,
    });
  }
  return { regions, imageSize: { width, height } };
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

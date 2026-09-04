import cv from '@techstark/opencv-js';
import { waitForOpenCV } from './qualityCheck.js';

/**
 * Below this longest-side length (px), the image is upscaled before OCR.
 * Small text needs pixels — Tesseract reads best around 300 DPI equivalent.
 * Full-size phone captures skip this step entirely.
 */
export const UPSCALE_MIN_SIDE = 1000;
/** Upscale factor applied to small captures. */
export const UPSCALE_FACTOR = 2;

/**
 * Preprocesses an image for OCR: upscale (small images only), grayscale,
 * contrast normalization (CLAHE), denoise, mild sharpening, adaptive threshold.
 * Returns a binary canvas ready for Tesseract. Fast enough to run per capture
 * (tens of ms on typical phone photos; upscale is skipped for large images).
 *
 * @param {HTMLImageElement | HTMLCanvasElement | string} imageElementOrCanvas - DOM Image, Canvas, or element ID.
 * @param {Object} [options] - Tuning options.
 * @param {number} [options.upscaleMinSide=UPSCALE_MIN_SIDE] - Upscale when longest side is below this.
 * @param {number} [options.upscaleFactor=UPSCALE_FACTOR] - Upscale multiplier.
   * @param {number} [options.blockSize] - Adaptive threshold neighborhood (odd, >= 3).
   *   Defaults to scaling with image size (min 31); pass explicitly to override.
 * @param {number} [options.c=10] - Adaptive threshold constant subtracted from the mean.
 * @returns {Promise<HTMLCanvasElement>} Binary (black on white) canvas.
 */

async function toCanvasElement(source) {
  if (source instanceof HTMLCanvasElement) {
    return source;
  }

  return new Promise((resolve, reject) => {
    let img;
    if (source instanceof HTMLImageElement) {
      img = source;
    } else if (typeof source === 'string') {
      const el = document.getElementById(source);
      if (el instanceof HTMLCanvasElement) return resolve(el);
      if (el instanceof HTMLImageElement) {
        img = el;
      } else {
        img = new Image();
        img.src = source;
      }
    } else {
      return reject(new Error('Invalid image source type'));
    }

    const onComplete = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };

    if (img.complete && (img.naturalWidth || img.width)) {
      onComplete();
    } else {
      img.onload = onComplete;
      img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
    }
  });
}

export async function preprocessForOCR(imageElementOrCanvas, options = {}) {
  const {
    upscaleMinSide = UPSCALE_MIN_SIDE,
    upscaleFactor = UPSCALE_FACTOR,
    blockSize,
    c = 10,
  } = options;

  const cvInstance = await waitForOpenCV();

  let src = null;
  let resized = null;
  let gray = null;
  let equalized = null;
  let denoised = null;
  let blurred = null;
  let sharpened = null;
  let binary = null;
  let clahe = null;

  try {
    const inputCanvas = await toCanvasElement(imageElementOrCanvas);
    src = cvInstance.imread(inputCanvas);

    // Neighborhood scales with image size so large headline strokes on
    // high-res captures aren't hollowed out; an explicit blockSize wins.
    const autoBs = Math.max(31, (Math.round(Math.max(src.cols, src.rows) / 40) | 1));
    const bs = blockSize === undefined ? autoBs : Math.max(3, blockSize | 1);

    // 1. Upscale small captures so small print has enough pixels
    let working = src;
    if (Math.max(src.cols, src.rows) < upscaleMinSide) {
      resized = new cvInstance.Mat();
      cvInstance.resize(src, resized, new cvInstance.Size(0, 0), upscaleFactor, upscaleFactor, cvInstance.INTER_CUBIC);
      working = resized;
    }

    // 2. Grayscale
    gray = new cvInstance.Mat();
    cvInstance.cvtColor(working, gray, cvInstance.COLOR_RGBA2GRAY, 0);

    // 3. Normalize uneven lighting (handheld shadows/glare). Skip if the
    // build lacks CLAHE — the rest of the pipeline still applies.
    let contrasted = gray;
    if (typeof cvInstance.CLAHE === 'function') {
      equalized = new cvInstance.Mat();
      clahe = new cvInstance.CLAHE(2.0, new cvInstance.Size(8, 8));
      clahe.apply(gray, equalized);
      contrasted = equalized;
    }

    // 4. Denoise (speckle becomes false dots after thresholding)
    denoised = new cvInstance.Mat();
    cvInstance.medianBlur(contrasted, denoised, 3);

    // 5. Mild sharpen via unsharp mask
    blurred = new cvInstance.Mat();
    cvInstance.GaussianBlur(denoised, blurred, new cvInstance.Size(0, 0), 3, 3, cvInstance.BORDER_DEFAULT);
    sharpened = new cvInstance.Mat();
    cvInstance.addWeighted(denoised, 1.5, blurred, -0.5, 0, sharpened);

    // 6. Binarize for Tesseract (adaptive handles uneven light per region)
    binary = new cvInstance.Mat();
    cvInstance.adaptiveThreshold(
      sharpened, binary, 255,
      cvInstance.ADAPTIVE_THRESH_GAUSSIAN_C, cvInstance.THRESH_BINARY, bs, c,
    );

    const canvas = document.createElement('canvas');
    canvas.width = binary.cols;
    canvas.height = binary.rows;
    cvInstance.imshow(canvas, binary);
    return canvas;
  } finally {
    if (src) src.delete();
    if (resized) resized.delete();
    if (gray) gray.delete();
    if (equalized) equalized.delete();
    if (denoised) denoised.delete();
    if (blurred) blurred.delete();
    if (sharpened) sharpened.delete();
    if (binary) binary.delete();
    if (clahe) clahe.delete();
  }
}

export default preprocessForOCR;

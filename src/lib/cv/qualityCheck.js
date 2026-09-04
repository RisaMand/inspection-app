import cv from '@techstark/opencv-js';

/**
 * Ensures OpenCV.js WebAssembly runtime is loaded and ready.
 * Handles both Promise-based and callback-based initialization.
 * @returns {Promise<typeof cv>}
 */
export const waitForOpenCV = () => {
  return new Promise((resolve) => {
    if (cv.Mat) {
      resolve(cv);
    } else if (cv.onRuntimeInitialized) {
      const prevCallback = cv.onRuntimeInitialized;
      cv.onRuntimeInitialized = () => {
        if (typeof prevCallback === 'function') prevCallback();
        resolve(cv);
      };
    } else if (typeof cv.then === 'function') {
      cv.then(resolve);
    } else {
      cv.onRuntimeInitialized = () => resolve(cv);
    }
  });
};

/**
 * Default blur threshold for Laplacian variance.
 * Scores below this value are typically considered blurry.
 */
export const DEFAULT_BLUR_THRESHOLD = 100.0;

/**
 * Checks the visual quality (blurriness) of an image or canvas element using the Laplacian variance method.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | string} imageElementOrCanvas - DOM Image, Canvas, or element ID.
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.threshold=DEFAULT_BLUR_THRESHOLD] - Variance threshold to determine pass/fail.
 * @returns {Promise<{ pass: boolean, score: number, threshold: number }>}
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
      img.onerror = () => reject(new Error('Failed to load image for quality check'));
    }
  });
}
export async function qualityCheck(imageElementOrCanvas, options = {}) {
  const threshold = options.threshold ?? DEFAULT_BLUR_THRESHOLD;

  // Ensure OpenCV.js is fully initialized
  const cvInstance = await waitForOpenCV();

  let src = null;
  let gray = null;
  let laplacian = null;
  let mean = null;
  let stddev = null;

  try {
    // 1. Read the image / canvas element into a cv.Mat
    const canvas = await toCanvasElement(imageElementOrCanvas);
    src = cvInstance.imread(canvas);

    // 2. Convert to Grayscale
    gray = new cvInstance.Mat();
    cvInstance.cvtColor(src, gray, cvInstance.COLOR_RGBA2GRAY, 0);

    // 3. Compute the Laplacian (using 64-bit float to avoid overflow)
    laplacian = new cvInstance.Mat();
    cvInstance.Laplacian(gray, laplacian, cvInstance.CV_64F, 1, 1, 0, cvInstance.BORDER_DEFAULT);

    // 4. Calculate Mean and Standard Deviation of the Laplacian
    mean = new cvInstance.Mat();
    stddev = new cvInstance.Mat();
    cvInstance.meanStdDev(laplacian, mean, stddev);

    // Standard deviation is stored in double (data64F)
    const std = stddev.data64F[0];
    const variance = std * std;

    return {
      pass: variance >= threshold,
      score: variance,
      threshold,
    };
  } finally {
    // Crucial: Clean up WebAssembly memory allocations to prevent leaks
    if (src) src.delete();
    if (gray) gray.delete();
    if (laplacian) laplacian.delete();
    if (mean) mean.delete();
    if (stddev) stddev.delete();
  }
}

export default qualityCheck;

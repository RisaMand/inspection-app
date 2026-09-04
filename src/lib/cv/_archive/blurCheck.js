import cv from '@techstark/opencv-js';

const BLUR_THRESHOLD = 100.0;

const waitForOpenCV = () => {
  return new Promise((resolve) => {
    if (cv.Mat) {
      resolve(cv);
    } else if (typeof cv.then === 'function') {
      cv.then(resolve);
    } else {
      cv.onRuntimeInitialized = () => resolve(cv);
    }
  });
};

export async function qualityCheck(imageElementOrCanvas) {
  const cvInstance = await waitForOpenCV();

  let src = null;
  let gray = null;
  let laplacian = null;
  let mean = null;
  let stddev = null;

  try {
    src = cvInstance.imread(imageElementOrCanvas);
    gray = new cvInstance.Mat();
    cvInstance.cvtColor(src, gray, cvInstance.COLOR_RGBA2GRAY, 0);

    laplacian = new cvInstance.Mat();
    cvInstance.Laplacian(gray, laplacian, cvInstance.CV_64F, 1, 1, 0, cvInstance.BORDER_DEFAULT);

    mean = new cvInstance.Mat();
    stddev = new cvInstance.Mat();
    cvInstance.meanStdDev(laplacian, mean, stddev);

    const std = stddev.data64F[0];
    const variance = std * std;

    return { pass: variance >= BLUR_THRESHOLD };
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (laplacian) laplacian.delete();
    if (mean) mean.delete();
    if (stddev) stddev.delete();
  }
}

export default qualityCheck;

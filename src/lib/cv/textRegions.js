import { waitForOpenCV, toCanvasElement } from './qualityCheck.js';

/**
 * Merges boxes that substantially overlap (split line fragments, nested
 * duplicates) into their unions. Overlap is measured as intersection over
 * the SMALLER box, so a sliver inside a line still merges while two merely
 * adjacent lines stay apart. Runs to fixpoint so chains collapse fully.
 *
 * @param {Array<{ x: number, y: number, w: number, h: number }>} boxes
 * @param {number} [minOverlap=0.3]
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
export function mergeOverlappingBoxes(boxes, minOverlap = 0.3) {
  const current = boxes.map((b) => ({
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
  }));

  let changed = true;

  while (changed) {
    changed = false;

    for (let i = 0; i < current.length && !changed; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i];
        const c = current[j];

        const ix = Math.max(
          0,
          Math.min(a.x + a.w, c.x + c.w) -
            Math.max(a.x, c.x)
        );

        const iy = Math.max(
          0,
          Math.min(a.y + a.h, c.y + c.h) -
            Math.max(a.y, c.y)
        );

        const inter = ix * iy;

        if (inter === 0) continue;

        if (
          inter / Math.min(a.w * a.h, c.w * c.h) >=
          minOverlap
        ) {
          const x = Math.min(a.x, c.x);
          const y = Math.min(a.y, c.y);

          current[i] = {
            x,
            y,
            w:
              Math.max(a.x + a.w, c.x + c.w) -
              x,
            h:
              Math.max(a.y + a.h, c.y + c.h) -
              y,
          };

          current.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }

  return current;
}


/**
 * Detects text regions on a product label with classical contour analysis.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | string | { data: Uint8Array, width: number, height: number }} source
 * @param {Object} [options]
 * @param {number} [options.minArea]
 * @returns {Promise<Array<{ x: number, y: number, w: number, h: number }>>}
 */
export async function detectTextRegions(source, options = {}) {
  const cv = await waitForOpenCV();

  let src = null;
  let gray = null;
  let blurred = null;
  let gradient = null;
  let binary = null;
  let closed = null;
  let contours = null;
  let hierarchy = null;

  const toMat = async () => {
    if (
      source &&
      typeof source === "object" &&
      typeof source.width === "number" &&
      typeof source.height === "number" &&
      source.data
    ) {
      const channels =
        source.data.length ===
        source.width * source.height * 3
          ? 3
          : 4;

      return cv.matFromArray(
        source.height,
        source.width,
        channels === 3
          ? cv.CV_8UC3
          : cv.CV_8UC4,
        source.data
      );
    }
    // Anything else (canvas, img element, element id, data URL, path)
    // must be resolved to a canvas first: cv.imread() reads a bare string
    // as an element id, so a data URL passed straight in dies with
    // "Please input the valid canvas or img id."
    const canvas = await toCanvasElement(source);
    return cv.imread(canvas);
  };

  try {
    src = await toMat();
    const { minArea = Math.max(300, Math.round((src.cols * src.rows) / 1500)) } = options;

    gray = new cv.Mat();

    const isGray = src.channels() === 1;

    if (isGray) {
      src.copyTo(gray);
    } else if (src.channels() === 3) {
      cv.cvtColor(
        src,
        gray,
        cv.COLOR_RGB2GRAY,
        0
      );
    } else {
      cv.cvtColor(
        src,
        gray,
        cv.COLOR_RGBA2GRAY,
        0
      );
    }

    blurred = new cv.Mat();

    cv.GaussianBlur(
      gray,
      blurred,
      new cv.Size(5, 5),
      0,
      0,
      cv.BORDER_DEFAULT
    );

    // Morphological gradient: flat color fills score
    // approximately zero; text stroke edges light up.
    gradient = new cv.Mat();

    const edgeKernel =
      cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(3, 3)
      );

    cv.morphologyEx(
      blurred,
      gradient,
      cv.MORPH_GRADIENT,
      edgeKernel
    );

    edgeKernel.delete();

    binary = new cv.Mat();

    cv.threshold(
      gradient,
      binary,
      0,
      255,
      cv.THRESH_BINARY + cv.THRESH_OTSU
    );

    // Small kernel: joins glyph fragments into lines
    // without bridging unrelated regions.
    const kernelW = Math.min(
      25,
      Math.max(9, Math.round(src.cols / 60))
    );

    const kernel =
      cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(kernelW, 3)
      );

    closed = new cv.Mat();

    cv.morphologyEx(
      binary,
      closed,
      cv.MORPH_CLOSE,
      kernel
    );

    kernel.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    // LIST rather than EXTERNAL so an outer frame
    // doesn't hide all inner text contours.
    cv.findContours(
      closed,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );

    const boxes = [];

    const imageArea = src.cols * src.rows;

    // Frames and edge artifacts are dropped.
    const edgeMargin = Math.max(
      2,
      Math.round(
        Math.min(src.cols, src.rows) * 0.02
      )
    );

    const touchesEdge = (rect) =>
      rect.x <= edgeMargin ||
      rect.y <= edgeMargin ||
      rect.x + rect.width >=
        src.cols - edgeMargin ||
      rect.y + rect.height >=
        src.rows - edgeMargin;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);

      const rect = cv.boundingRect(contour);

      if (rect.width < 2 || rect.height < 2) {
        continue;
      }

      const area =
        rect.width * rect.height;

      if (area < minArea) continue;

      // A text region should not cover half
      // of the entire image.
      if (area > imageArea * 0.4) {
        continue;
      }

      if (touchesEdge(rect)) {
        continue;
      }

      // Hollow outlines such as label frames have
      // very little contour area inside their box.
      const extent =
        cv.contourArea(contour) / area;

      if (extent < 0.2) {
        continue;
      }

      boxes.push({
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
      });
    }

    const merged =
      mergeOverlappingBoxes(boxes);

    merged.sort((a, b) =>
      a.y === b.y
        ? a.x - b.x
        : a.y - b.y
    );

    return merged;

  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
    if (gradient) gradient.delete();
    if (binary) binary.delete();
    if (closed) closed.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}


/**
 * Attach detected region boxes to resolved OCR field objects.
 *
 * Each resolved field is expected to contain:
 * - fieldGuess
 * - text
 * - confidence
 * - boundingBox
 * - region
 *
 * Unresolved entries are ignored so that only real field
 * detections reach the extracted-data pipeline.
 */
export function attachRegionBoxes(fields, boxes = []) {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields
    .map((field) => {
      if (!field || typeof field !== "object") {
        return null;
      }

      const fieldGuess =
        field.fieldGuess ??
        field.field ??
        null;

      if (!fieldGuess) {
        return null;
      }

      const boundingBox =
        field.boundingBox ??
        field.box ??
        null;

      return {
        fieldGuess,
        text:
          typeof field.text === "string"
            ? field.text
            : String(field.text ?? ""),
        confidence:
          typeof field.confidence === "number"
            ? field.confidence
            : null,
        boundingBox,
        region:
          typeof field.region === "string"
            ? field.region
            : null,
      };
    })
    .filter(Boolean);
}


export default detectTextRegions;
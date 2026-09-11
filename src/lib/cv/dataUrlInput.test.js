// dataUrlInput.test.js — reproduces the file-upload / live-capture input
// shape: Capture.jsx passes data-URL STRINGS to checkImage() (canvas
// toDataURL / normalized upload). Before the fix, detectTextRegions()
// handed that string straight to cv.imread(), which reads strings as
// element ids and throws "Please input the valid canvas or img id."
//
// Minimal DOM shims (test-only): a fake Image that decodes PNG data URLs
// with fast-png (real bytes, real OpenCV) and a fake canvas whose 2d
// context serves real pixels to cv.imread.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decode } from 'file:///C:/Users/divya/OneDrive/Desktop/inspection-app/inspection-app/node_modules/fast-png/lib/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pngBytes = readFileSync(path.join(__dirname, 'test-photos', 'image1.png'));
const DATA_URL = `data:image/png;base64,${pngBytes.toString('base64')}`;

function pngPixelsFromDataUrl(url) {
  const base64 = url.split(',', 2)[1];
  const png = decode(Buffer.from(base64, 'base64'));
  const n = png.width * png.height;
  const data = new Uint8ClampedArray(n * 4);
  const srcCh = png.data.length === n * 3 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    data[i * 4] = png.data[i * srcCh];
    data[i * 4 + 1] = png.data[i * srcCh + 1];
    data[i * 4 + 2] = png.data[i * srcCh + 2];
    data[i * 4 + 3] = srcCh === 4 ? png.data[i * 4 + 3] : 255;
  }
  return { width: png.width, height: png.height, data };
}

class FakeImage {
  set src(value) {
    const pixels = pngPixelsFromDataUrl(value);
    this.naturalWidth = pixels.width;
    this.naturalHeight = pixels.height;
    this.width = pixels.width;
    this.height = pixels.height;
    this.complete = true;
    this._pixels = pixels;
    queueMicrotask(() => this.onload && this.onload());
  }
}

class FakeCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this._pixels = null;
  }
  getContext() {
    return {
      drawImage: (img) => {
        this.width = img.naturalWidth || img.width;
        this.height = img.naturalHeight || img.height;
        this._pixels = img._pixels || img.canvas?._pixels || null;
      },
      getImageData: () => {
        if (!this._pixels) throw new Error('no pixels drawn');
        return { width: this.width, height: this.height, data: this._pixels.data };
      },
    };
  }
}

before(() => {
  globalThis.HTMLImageElement = FakeImage;
  globalThis.HTMLCanvasElement = FakeCanvas;
  globalThis.Image = FakeImage;
  globalThis.document = {
    getElementById: () => null,
    createElement: (tag) => (tag === 'canvas' ? new FakeCanvas() : {}),
  };
});

after(() => {
  delete globalThis.HTMLImageElement;
  delete globalThis.HTMLCanvasElement;
  delete globalThis.Image;
  delete globalThis.document;
});

describe('file-upload input (data-URL string)', () => {
  it('detectTextRegions resolves boxes from a data URL instead of throwing the imread error', async () => {
    const { detectTextRegions } = await import('./textRegions.js');
    const boxes = await detectTextRegions(DATA_URL);
    assert.ok(boxes.length >= 20, `expected many regions, got ${boxes.length}`);
    const mfr = boxes.find((b) => Math.abs(b.x - 666) <= 15 && Math.abs(b.y - 419) <= 15);
    assert.ok(mfr, 'expected the manufacturer block near (666,419)');
  });

  it('qualityCheck resolves a verdict from the same data URL', async () => {
    const { qualityCheck } = await import('./qualityCheck.js');
    const verdict = await qualityCheck(DATA_URL);
    assert.equal(verdict.pass, true);
    assert.ok(verdict.score > 100);
    assert.equal(verdict.threshold, 100);
  });
});

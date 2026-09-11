import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import checkImage, {
  qualityCheck,
  runOCR,
  cleanOcrText,
  detectTextRegions,
  mergeOverlappingBoxes,
  assembleContractA,
  TAMPER_SIGNAL_STUB,
} from './index.js';
import { OCR_LANGUAGES } from './ocr.js';

describe('cv/index module surface', () => {
  it('loads without import errors and exposes the CV pipeline', () => {
    assert.equal(typeof checkImage, 'function');
    assert.equal(typeof qualityCheck, 'function');
    assert.equal(typeof runOCR, 'function');
    assert.equal(typeof cleanOcrText, 'function');
    assert.equal(typeof detectTextRegions, 'function');
    assert.equal(typeof mergeOverlappingBoxes, 'function');
  });
});

describe('assembleContractA', () => {
  const qc = { pass: true, score: 210.5, threshold: 100 };
  const mrpBox = { x: 669, y: 534, w: 275, h: 69 };
  const size = { width: 1000, height: 666 };

  it('assembles the full Contract A′ shape with fields from resolved regions', () => {
    assert.deepEqual(
      assembleContractA({
        qualityCheck: qc,
        ocrText: 'MRP Rs 120',
        ocrRawText: 'MRP Rs 120\n',
        confidence: 74,
        language: 'eng+hin',
        regions: [
          { box: mrpBox, text: 'MRP Rs 120 (Incl. of all taxes)', confidence: 70 },
          { box: { x: 0, y: 0, w: 10, h: 10 }, text: 'Tender & Tasty', confidence: 60 },
        ],
        imageSize: size,
      }),
      {
        qualityCheck: qc,
        ocrText: 'MRP Rs 120',
        ocrRawText: 'MRP Rs 120\n',
        confidence: 74,
        language: 'eng+hin',
        fields: [{
          fieldGuess: 'MRP',
          text: 'MRP Rs 120 (Incl. of all taxes)',
          confidence: 70,
          boundingBox: mrpBox,
          region: 'footer',
        }],
        mrpZone: {
          field: 'MRP',
          primary: {
            fieldGuess: 'MRP',
            text: 'MRP Rs 120 (Incl. of all taxes)',
            confidence: 70,
            boundingBox: mrpBox,
            region: 'footer',
          },
          candidates: [{
            fieldGuess: 'MRP',
            text: 'MRP Rs 120 (Incl. of all taxes)',
            confidence: 70,
            boundingBox: mrpBox,
            region: 'footer',
          }],
          count: 1,
          unionBox: { ...mrpBox },
          tamperSurface: {
            roi: { ...mrpBox },
            text: 'MRP Rs 120 (Incl. of all taxes)',
            confidence: 70,
            region: 'footer',
          },
        },
        tamperSignal: { detected: false, confidence: 0, region: null },
      }
    );
  });

  it('yields empty fields with null text on the quality-fail path shape', () => {
    const out = assembleContractA({
      qualityCheck: { pass: false, score: 12.3, threshold: 100 },
      ocrText: null,
      confidence: 0,
      language: 'eng+hin',
      regions: [],
      imageSize: null,
    });
    assert.deepEqual(out.fields, []);
    assert.equal(out.ocrText, null);
    assert.deepEqual(out.mrpZone, {
      field: 'MRP',
      primary: null,
      candidates: [],
      count: 0,
      unionBox: null,
      tamperSurface: { roi: null, text: null, confidence: null, region: null },
    });
    assert.deepEqual(out.tamperSignal, TAMPER_SIGNAL_STUB);
  });

  it('pins the OCR language set to single-pass English+Hindi', () => {
    assert.equal(OCR_LANGUAGES, 'eng+hin');
  });
});

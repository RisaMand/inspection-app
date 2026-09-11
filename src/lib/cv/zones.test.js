import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { unionBoxes, locateFieldZone, locateMRPZone } from './zones.js';

const mrpA = {
  fieldGuess: 'MRP', text: 'MRP Rs 120', confidence: 70,
  boundingBox: { x: 669, y: 534, w: 275, h: 69 }, region: 'footer',
};
const mrpB = {
  fieldGuess: 'MRP', text: 'MRP Rs 125', confidence: 90,
  boundingBox: { x: 390, y: 749, w: 205, h: 91 }, region: 'body',
};
const mfr = {
  fieldGuess: 'MANUFACTURER_ADDRESS', text: 'Mfd by SNEHA', confidence: 81,
  boundingBox: { x: 666, y: 419, w: 205, h: 74 }, region: 'footer',
};

describe('unionBoxes', () => {
  it('returns the bounding union of all boxes', () => {
    assert.deepEqual(
      unionBoxes([mrpA.boundingBox, mrpB.boundingBox]),
      { x: 390, y: 534, w: 554, h: 306 }
    );
  });

  it('returns null for an empty set instead of inventing a box', () => {
    assert.equal(unionBoxes([]), null);
  });
});

describe('locateFieldZone', () => {
  it('picks the highest-confidence entry as primary with candidates ranked', () => {
    const zone = locateFieldZone([mrpA, mfr, mrpB], 'MRP');
    assert.equal(zone.field, 'MRP');
    assert.deepEqual(zone.primary, mrpB);
    assert.deepEqual(zone.candidates.map((c) => c.confidence), [90, 70]);
    assert.equal(zone.count, 2);
  });

  it('reports an honest empty zone when the field is absent', () => {
    assert.deepEqual(locateFieldZone([mfr], 'MRP'), {
      field: 'MRP',
      primary: null,
      candidates: [],
      count: 0,
      unionBox: null,
    });
  });

  it('ranks null confidence below any scored entry', () => {
    const unscored = { ...mrpA, confidence: null };
    const zone = locateFieldZone([unscored, mrpA], 'MRP');
    assert.equal(zone.primary.confidence, 70);
  });
});

describe('locateMRPZone (Phase 4 input surface)', () => {
  it('exposes roi, text, confidence, region for tamper detection', () => {
    const zone = locateMRPZone([mrpA, mfr, mrpB]);
    assert.deepEqual(zone.tamperSurface, {
      roi: mrpB.boundingBox,
      text: 'MRP Rs 125',
      confidence: 90,
      region: 'body',
    });
    assert.deepEqual(zone.unionBox, { x: 390, y: 534, w: 554, h: 306 });
  });

  it('exposes nulls — never invented geometry — when no MRP resolved', () => {
    const zone = locateMRPZone([mfr]);
    assert.equal(zone.primary, null);
    assert.deepEqual(zone.tamperSurface, {
      roi: null, text: null, confidence: null, region: null,
    });
  });
});

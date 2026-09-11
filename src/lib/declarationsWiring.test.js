import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkCompliance } from './rules/ruleInterpreter.js';

const field = (text, confidence, region) => ({
  text,
  confidence,
  region,
  boundingBox: { x: 0, y: 0, w: 10, h: 10 },
  fontSizeMm: null,
});

const fontRule = {
  rule_id: 'DECLARATION_FONT_SIZE',
  check_type: 'font_size',
  field: 'DECLARATIONS',
  minimum_mm: 1,
  severity: 'cosmetic',
  clause_citation: 'Rule 7',
};

const placementRule = {
  rule_id: 'DECLARATION_PLACEMENT',
  check_type: 'placement',
  field: 'DECLARATIONS',
  expected_region: 'footer',
  severity: 'cosmetic',
  clause_citation: 'Rule 8',
};

describe('DECLARATIONS wiring', () => {
  it('feeds the aggregated declarations to the font-size rule instead of undefined', () => {
    const [result] = checkCompliance([fontRule], {
      MRP: field('MRP Rs 120', 0.9, 'footer'),
      NET_QUANTITY: field('Net Wt 500g', 0.7, 'footer'),
    });
    // Aggregate confidence is the minimum; font size is honestly missing
    // (null everywhere), not a crash on undefined.
    assert.equal(result.confidence, 0.7);
    assert.equal(result.passed, false);
    assert.match(result.reason, /missing/i);
  });

  it('passes placement when every declaration unanimously satisfies the required region', () => {
    const [result] = checkCompliance([placementRule], {
      MRP: field('MRP Rs 120', 0.9, 'footer'),
      NET_QUANTITY: field('Net Wt 500g', 0.7, 'footer'),
    });
    assert.equal(result.passed, true);
    assert.equal(result.confidence, 0.7);
  });

  it('refuses placement when declarations disagree on region instead of faking unanimity', () => {
    const [result] = checkCompliance([placementRule], {
      MRP: field('MRP Rs 120', 0.9, 'footer'),
      NET_QUANTITY: field('Net Wt 500g', 0.7, 'header'),
    });
    assert.equal(result.passed, false);
    assert.match(result.reason, /missing/i);
  });

  it('does not overwrite a caller-supplied DECLARATIONS entry', () => {
    const [result] = checkCompliance(
      [{ ...fontRule, minimum_mm: 1 }],
      {
        MRP: field('MRP Rs 120', 0.9, 'footer'),
        DECLARATIONS: { text: 'all', confidence: 0.5, region: 'footer', fontSizeMm: 2 },
      }
    );
    assert.equal(result.passed, true);
    assert.equal(result.confidence, 0.5);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanOcrText } from './cleanOcrText.js';

describe('cleanOcrText fragment soup (Wagh Bakri capture)', () => {
  const soup = [
    'WAGH BAKRI PREMIUM MASALA FLAVOUR CHAI',
    'C9',
    '}',
    'Zz',
    '[ER]',
    'Te कि ये',
    '[Ere',
    'Xt',
    'ey',
    'NET WEIGHT:',
    '250 g',
  ].join('\n');

  it('does not fuse short OCR fragments into longer garbage strings', () => {
    const { cleanedText } = cleanOcrText(soup);
    assert.ok(!cleanedText.includes('C9 }'), 'fused "C9 }" must not appear');
    assert.ok(!cleanedText.includes('[Ere Xt ey'), 'fused "[Ere Xt ey" must not appear');
    assert.ok(!cleanedText.includes('Zz [ER]'), 'adjacent fragments must not fuse');
  });

  it('keeps short but real content (e.g. quantities) visible on its own line', () => {
    const { cleanedText } = cleanOcrText(soup);
    assert.ok(cleanedText.includes('250 g'), 'real short line must survive');
  });

  it('still joins genuine wrapped prose across lines', () => {
    const { cleanedText } = cleanOcrText(
      'Once opened, transfer the contents into an air\ntight container and keep the lid tightly closed.'
    );
    assert.ok(
      cleanedText.includes('into an air tight container and keep the lid tightly closed.'),
      `prose must join, got: ${cleanedText}`
    );
  });

  it('preserves Devanagari lines verbatim (no script mangling)', () => {
    const { cleanedText } = cleanOcrText('निर्माता: जैविक उत्पाद लिमिटेड\nशुद्ध शहद और मसाले युक्त चाय');
    assert.ok(cleanedText.includes('निर्माता: जैविक उत्पाद लिमिटेड'));
    assert.ok(cleanedText.includes('शुद्ध शहद और मसाले युक्त चाय'));
  });

  it('returns empty output for empty or non-string input', () => {
    assert.deepEqual(cleanOcrText('   '), { cleanedText: '', extractedFields: {} });
    assert.deepEqual(cleanOcrText(null), { cleanedText: '', extractedFields: {} });
  });
});

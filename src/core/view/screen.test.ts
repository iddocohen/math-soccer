// Copied from math-tank src/core/view/screen.test.ts, the numberPadShown cases; the layout cases are left out.
import { describe, expect, it } from 'vitest';
import { numberPadShown, PAD_QUERIES, PAD_WIDTH_LIMIT, padMediaFromWidth } from './screen';

describe('numberPadShown (FR-031, amendment 16)', () => {
  it('always and never ignore the device', () => {
    for (const finePointer of [true, false]) {
      for (const width of [600, 1024, 1366]) {
        expect(numberPadShown('always', { finePointer, padWidth: width < PAD_WIDTH_LIMIT })).toBe(true);
        expect(numberPadShown('never', { finePointer, padWidth: width < PAD_WIDTH_LIMIT })).toBe(false);
      }
    }
  });

  it('auto shows the pad without a fine pointer or on a screen narrower than 1100 px', () => {
    expect(numberPadShown('auto', { finePointer: false, padWidth: false })).toBe(true);
    expect(numberPadShown('auto', { finePointer: false, padWidth: true })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, padWidth: true })).toBe(true);
    expect(numberPadShown('auto', { finePointer: true, padWidth: false })).toBe(false);
  });

  it('auto shows the pad on an iPad or a Fire tablet that reports a fine pointer', () => {
    // iPad Mini held sideways (1024), Fire 7 sideways (1024), Fire HD 8 sideways (960), any of them upright.
    for (const width of [1024, 960, 768, 600]) {
      expect(numberPadShown('auto', padMediaFromWidth(width, true))).toBe(true);
    }
    // A desktop window or a large tablet held sideways with a mouse or trackpad.
    expect(numberPadShown('auto', padMediaFromWidth(1280, true))).toBe(false);
  });
});

describe('padMediaFromWidth and PAD_QUERIES', () => {
  it('narrower than the limit counts, the limit itself does not', () => {
    expect(padMediaFromWidth(PAD_WIDTH_LIMIT - 1, true).padWidth).toBe(true);
    expect(padMediaFromWidth(PAD_WIDTH_LIMIT, true).padWidth).toBe(false);
    expect(padMediaFromWidth(800, false).finePointer).toBe(false);
  });

  it('uses the media queries of math-tank', () => {
    expect(PAD_QUERIES.padWidth).toBe('(max-width: 1099.98px)');
    expect(PAD_QUERIES.finePointer).toBe('(pointer: fine)');
  });
});

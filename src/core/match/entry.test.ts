// Adapted from math-tank src/core/battle/entry.test.ts.
import { describe, expect, it } from 'vitest';
import { entryReducer, entryValue, maxDigitsOf, type Digit, type EntryKey } from './entry';

const d = (digit: Digit): EntryKey => ({ digit });

function typeKeys(keys: EntryKey[], maxDigits: number, start = ''): string {
  return keys.reduce((entry, key) => entryReducer(entry, key, maxDigits), start);
}

describe('entryReducer', () => {
  it('appends digits', () => {
    expect(typeKeys([d(3), d(7)], 3)).toBe('37');
  });

  it('Backspace removes the last digit and does nothing on an empty entry', () => {
    expect(typeKeys([d(3), d(7), 'backspace'], 3)).toBe('3');
    expect(entryReducer('', 'backspace', 3)).toBe('');
  });

  it('Enter, H and Escape leave the entry unchanged', () => {
    expect(entryReducer('46', 'enter', 3)).toBe('46');
    expect(entryReducer('46', 'help', 3)).toBe('46');
    expect(entryReducer('46', 'escape', 3)).toBe('46');
  });

  it("ignores digits beyond the largest number's length", () => {
    expect(typeKeys([d(1), d(2), d(3), d(4)], maxDigitsOf({ min: 1, max: 100 }))).toBe('123');
    expect(typeKeys([d(1), d(0), d(0), d(0), d(5)], maxDigitsOf({ min: 0, max: 1000 }))).toBe('1000');
    expect(typeKeys([d(4), d(5), d(6)], maxDigitsOf({ min: 10, max: 50 }))).toBe('45');
  });

  it('ignores a digit outside 0 to 9', () => {
    expect(entryReducer('4', { digit: 12 as Digit }, 3)).toBe('4');
  });

  it('never changes its input', () => {
    const entry = '4';
    entryReducer(entry, d(2), 3);
    expect(entry).toBe('4');
  });
});

describe('maxDigitsOf and entryValue', () => {
  it('counts the digits of the larger end', () => {
    expect(maxDigitsOf({ min: 1, max: 100 })).toBe(3);
    expect(maxDigitsOf({ min: 205, max: 480 })).toBe(3);
    expect(maxDigitsOf({ min: 0, max: 1000 })).toBe(4);
  });

  it('reads the typed number, or null when empty', () => {
    expect(entryValue('')).toBeNull();
    expect(entryValue('056')).toBe(56);
  });
});

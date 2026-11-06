// Adapted from math-tank src/core/battle/entry.ts.
/**
 * Keyboard number entry (research R7, contracts/core-api.md `entryReducer`). Pure: returns the new typed text and
 * never changes its input. Ranges in this game start at 0 or above, so there is no minus sign and no clamping: the
 * controller refuses an out-of-range number when the child shoots (FR-005).
 *
 * Only digits and Backspace change the entry. Enter (shoot), H (help) and Escape (pause) are actions of the
 * controller and leave the entry as it is.
 */

export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type EntryKey = { digit: Digit } | 'backspace' | 'enter' | 'help' | 'escape';

/** Digits of the largest number in the range, for example 3 for 1 to 100 and 4 for 0 to 1000. */
export function maxDigitsOf(range: { min: number; max: number }): number {
  return Math.max(String(Math.abs(range.min)).length, String(Math.abs(range.max)).length);
}

/** The entry after `key`. Digits beyond `maxDigits` are ignored. */
export function entryReducer(entry: string, key: EntryKey, maxDigits: number): string {
  if (key === 'backspace') return entry.slice(0, -1);
  if (typeof key === 'string') return entry;
  if (!Number.isInteger(key.digit) || key.digit < 0 || key.digit > 9) return entry;
  return entry.length < maxDigits ? entry + String(key.digit) : entry;
}

/** The typed number, or null when nothing is typed. */
export function entryValue(entry: string): number | null {
  return entry === '' ? null : Number(entry);
}

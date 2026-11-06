// Copied from math-tank src/core/util.test.ts.
import { describe, expect, it } from 'vitest';
import { clamp, isRecord, mergeDeep } from './util';

describe('util', () => {
  it('isRecord accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('clamp limits a number to a range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('mergeDeep merges nested objects key by key and skips prototype keys', () => {
    const merged = mergeDeep({ a: 1, b: { c: 2, d: 3 } }, JSON.parse('{"b":{"d":4},"__proto__":{"x":1}}'));
    expect(merged).toEqual({ a: 1, b: { c: 2, d: 4 } });
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });
});

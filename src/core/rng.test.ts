// Copied from math-tank src/core/rng.test.ts.
import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from './rng';

const DRAWS = 10_000;

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gives a different sequence for a different seed', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() stays in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < DRAWS; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int(min, max) is inclusive and covers both ends over 10,000 draws', () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < DRAWS; i++) {
      const n = rng.int(-3, 4);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(4);
      seen.add(n);
    }
    expect(seen.has(-3)).toBe(true);
    expect(seen.has(4)).toBe(true);
    expect(seen.size).toBe(8);
  });

  it('pick returns only items from the list', () => {
    const rng = createRng(3);
    const items = ['a', 'b', 'c'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const x = rng.pick(items);
      expect(items).toContain(x);
      seen.add(x);
    }
    expect(seen.size).toBe(3);
  });

  it('normal(mean, sd) has sample mean and spread within 5% over 10,000 draws', () => {
    const rng = createRng(2024);
    const mean = 50;
    const sd = 10;
    const xs = Array.from({ length: DRAWS }, () => rng.normal(mean, sd));
    const sampleMean = xs.reduce((s, x) => s + x, 0) / DRAWS;
    const variance = xs.reduce((s, x) => s + (x - sampleMean) ** 2, 0) / (DRAWS - 1);
    const sampleSd = Math.sqrt(variance);
    expect(Math.abs(sampleMean - mean)).toBeLessThanOrEqual(0.05 * mean);
    expect(Math.abs(sampleSd - sd)).toBeLessThanOrEqual(0.05 * sd);
  });
});

describe('deriveSeed', () => {
  it('is stable for the same parts', () => {
    expect(deriveSeed(42, 3, 7)).toBe(deriveSeed(42, 3, 7));
  });

  it('returns an unsigned 32-bit integer', () => {
    const s = deriveSeed(42, 3, 7);
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });

  it('differs for different parts', () => {
    const seeds = new Set<number>();
    for (let turn = 0; turn < 50; turn++) seeds.add(deriveSeed(42, turn, 1));
    expect(seeds.size).toBe(50);
    expect(deriveSeed(42, 3, 7)).not.toBe(deriveSeed(42, 7, 3));
    expect(deriveSeed(1, 2)).not.toBe(deriveSeed(1, 2, 0));
  });
});

describe('shuffled', () => {
  it('returns a permutation of the items, the same one for the same seed, and leaves the input alone', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = createRng(7).shuffled(items);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(createRng(7).shuffled(items)).toEqual(a);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

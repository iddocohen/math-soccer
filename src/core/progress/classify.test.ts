// Adapted from math-tank src/core/progress/classify.test.ts.
import { describe, expect, it } from 'vitest';
import { classifyAttempt, isGuess, type ClassifyInput } from './classify';

function input(extra: Partial<ClassifyInput> = {}): ClassifyInput {
  return { solved: true, helpStep: 0, misses: 0, responseMs: 4000, missTimes: [], shotAt: 100_000, ...extra };
}

describe('classifyAttempt (FR-039, as math-tank)', () => {
  it('flags a goal 1400 ms after the target appeared as a guess, but not one at 1500 ms', () => {
    expect(classifyAttempt(input({ responseMs: 1400 })).guess).toBe(true);
    expect(classifyAttempt(input({ responseMs: 1500 })).guess).toBe(false);
  });

  it('flags a goal after 3 misses within the 5000 ms before it as a guess', () => {
    const at = 100_000;
    expect(classifyAttempt(input({ misses: 3, responseMs: 9000, missTimes: [at - 4500, at - 3000, at - 1000] })).guess).toBe(true);
  });

  it('does not flag a goal after 3 misses spread over 6000 ms', () => {
    const at = 100_000;
    expect(classifyAttempt(input({ misses: 3, responseMs: 9000, missTimes: [at - 6000, at - 3000, at - 1000] })).guess).toBe(false);
  });

  it('never flags an unsolved target as a guess', () => {
    expect(classifyAttempt(input({ solved: false, helpStep: 4, responseMs: 500 })).guess).toBe(false);
  });

  it('is independent only for a first-shot goal without help', () => {
    expect(classifyAttempt(input())).toEqual({ independent: true, guess: false, outcome: 'independent' });
    expect(classifyAttempt(input({ misses: 1, missTimes: [99_000] })).outcome).toBe('assisted');
    expect(classifyAttempt(input({ helpStep: 1 })).outcome).toBe('assisted');
    expect(classifyAttempt(input({ solved: false, helpStep: 4 })).outcome).toBe('unsolved');
  });

  it('isGuess ignores misses after the shot', () => {
    expect(isGuess({ responseMs: 9000, missTimes: [100_500, 101_000, 102_000], shotAt: 100_000 })).toBe(false);
  });
});

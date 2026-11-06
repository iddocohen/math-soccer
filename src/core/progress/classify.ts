// Adapted from math-tank src/core/progress/classify.ts: a target instead of a guided search, misses instead of wrong answers.
/**
 * Classifies one finished target for the progress records (FR-039): alone ('independent'), with help or misses
 * ('assisted'), or not solved before help step 4 showed the answer ('unsolved'). Guesses use math-tank's rule.
 */
import type { Outcome } from '../storage/schemas';

/** A goal shot sooner than this after the target appeared is a guess (FR-039, as math-tank). */
export const GUESS_RESPONSE_MS = 1500;
/** A goal after this many misses ... */
export const GUESS_MISS_COUNT = 3;
/** ... within this many milliseconds before the goal is a guess. */
export const GUESS_MISS_WINDOW_MS = 5000;

export interface ClassifyInput {
  /** Scored before help step 4 showed the answer. */
  solved: boolean;
  /** Highest help step reached; 4 means the answer was shown. */
  helpStep: number;
  misses: number;
  /** From the target appearing to the scoring shot. */
  responseMs: number;
  /** Play times of the misses on this target. */
  missTimes: readonly number[];
  /** Play time of the scoring shot. */
  shotAt: number;
}

export interface Classification {
  independent: boolean;
  guess: boolean;
  outcome: Outcome;
}

/** The guess rule: shot less than 1.5 s after the target appeared, or after 3 or more misses within the 5 s before it. */
export function isGuess(a: Pick<ClassifyInput, 'responseMs' | 'missTimes' | 'shotAt'>): boolean {
  const quickMisses = a.missTimes.filter((t) => t <= a.shotAt && a.shotAt - t <= GUESS_MISS_WINDOW_MS).length;
  return a.responseMs < GUESS_RESPONSE_MS || quickMisses >= GUESS_MISS_COUNT;
}

export function classifyAttempt(a: ClassifyInput): Classification {
  const independent = a.solved && a.helpStep === 0 && a.misses === 0;
  const guess = a.solved && isGuess(a);
  const outcome: Outcome = !a.solved ? 'unsolved' : independent ? 'independent' : 'assisted';
  return { independent, guess, outcome };
}

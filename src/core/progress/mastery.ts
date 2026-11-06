// Adapted from math-tank src/core/progress/mastery.ts, with `skill` renamed to `direction`.
/**
 * Mastery of a direction in a mode (FR-039): at least 10 independent, non-guess attempts and at least 8 of the last
 * 10 counted attempts independent. Guesses never enter the window, and the window is kept across step changes.
 */
import type { DirectionState } from '../storage/schemas';

export const MASTERY_MIN_INDEPENDENT = 10;
export const MASTERY_WINDOW = 10;
export const MASTERY_NEEDED_IN_WINDOW = 8;

export function isMastered(ds: DirectionState): boolean {
  const window = ds.masteryWindow.slice(-MASTERY_WINDOW);
  const independent = window.filter((o) => o === 'independent').length;
  return ds.independent >= MASTERY_MIN_INDEPENDENT && window.length === MASTERY_WINDOW && independent >= MASTERY_NEEDED_IN_WINDOW;
}

// Adapted from math-tank src/core/progress/ladders.ts: one ladder for every direction instead of one per skill.
/**
 * The difficulty ladder of a direction (FR-040, research R9), clamped to the parent's settings:
 * - step 0: hints always shown, direct neighbors;
 * - step 1: hints above and below, or diagonal;
 * - step 2: hints two or three squares away;
 * - step 3: as step 2, with hints on request only.
 * A step the settings do not allow looks the same to the child as a neighboring step (the generator falls back to
 * the nearest step with an allowed distance, see `distancesForStep` in core/targets/nextTarget.ts). Steps up and down
 * skip steps that look the same, as math-tank's `stepUp` and `stepDown`, so the child never "rises" without a change.
 */
import type { Settings } from '../settings/schema';
import { allowedDistances, distancesForStep, MAX_STEP } from '../targets/nextTarget';
import type { Direction } from '../types';

/** What a step means for one direction under the parent's settings: the hint distances and whether hints wait for H. */
function content(direction: Direction, step: number, settings: Settings): string {
  const distances = distancesForStep(step, allowedDistances(settings), direction).slice().sort().join(',');
  const onRequest = step >= MAX_STEP && settings.hintDisplay === 'onRequest';
  return `${distances}|${onRequest ? 'onRequest' : 'always'}`;
}

/** The highest step the settings allow for `direction`: steps above it look the same to the child. */
export function topStep(direction: Direction, settings: Settings): number {
  const top = content(direction, MAX_STEP, settings);
  let i = MAX_STEP;
  while (i > 0 && content(direction, i - 1, settings) === top) i -= 1;
  return i;
}

/** The next step up that looks different from `step`, or `step` when there is none. */
export function stepUp(direction: Direction, step: number, settings: Settings): number {
  const current = content(direction, step, settings);
  for (let j = step + 1; j <= MAX_STEP; j++) if (content(direction, j, settings) !== current) return j;
  return step;
}

/** The nearest step down that looks different from `step`, or `step` when there is none. */
export function stepDown(direction: Direction, step: number, settings: Settings): number {
  const from = Math.min(step, MAX_STEP);
  const current = content(direction, from, settings);
  for (let j = from - 1; j >= 0; j--) if (content(direction, j, settings) !== current) return j;
  return step;
}

/**
 * Targets of the goalkeeper game (research R5, R9; FR-019, FR-038, FR-040, FR-065, FR-086 to FR-089).
 *
 * Answer-first, as math-tank: the child's difficulty level (core/progress/levels.ts) picks the direction and the hint
 * pattern, then the target number is picked among the pattern's placements on the chart
 * (core/targets/patterns.ts). All randomness comes from the given `Rng`, so the same seed gives the same target.
 */
import type { ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import type { Settings } from '../settings/schema';
import { levelChoice, type LevelProgress } from '../progress/levels';
import type { Target } from '../types';
import { placements } from './patterns';

export { DISTANCE_DIRECTIONS, pickDirection, UNMASTERED_WEIGHT } from '../progress/levels';

/** What the generator needs to know about the child's progress; `targetProgress` in core/progress/adaptive.ts fills it. */
export type TargetProgress = LevelProgress;

/** A child without progress: level 1, nothing mastered. */
export const NO_PROGRESS: TargetProgress = { mastered: [], level: 1, xTwoEmpties: false };

export interface NextTargetInput {
  layout: ChartLayout;
  settings: Settings;
  progress: TargetProgress;
  rng: Rng;
  /** The previous target number, not picked again when another number fits. */
  avoid?: number;
}

/** The next target with a hint pattern, answer-first (see the file comment). */
export function nextTarget(input: NextTargetInput): Target {
  const { layout, settings, progress, rng, avoid } = input;
  const pick = levelChoice(layout, settings, progress, rng);
  const options = placements(layout, pick.choice, pick.direction);
  const fresh = options.filter((p) => p.number !== avoid);
  const placement = rng.pick(fresh.length > 0 ? fresh : options);
  const target: Target = {
    number: placement.number,
    hints: placement.hints,
    directions: placement.directions,
    level: pick.level,
    pattern: pick.choice.pattern,
  };
  return placement.queue && placement.queue.length > 0 ? { ...target, queue: placement.queue } : target;
}

/**
 * The next empty square of the same shape after `target` was scored (FR-072), or null when no square is left. The
 * scored square lights up as one more hint.
 */
export function nextInShape(target: Target): Target | null {
  const [next, ...rest] = target.queue ?? [];
  if (!next) return null;
  const following: Target = {
    number: next.number,
    hints: [...target.hints, target.number],
    directions: next.directions,
    level: target.level,
    pattern: target.pattern,
  };
  return rest.length > 0 ? { ...following, queue: rest } : following;
}

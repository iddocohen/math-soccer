/**
 * Targets of the goalkeeper game (research R5, R9; FR-019, FR-038, FR-040, FR-065, FR-067).
 *
 * Answer-first, as math-tank: the ladder (core/progress/ladder.ts) picks the direction and the hint pattern within the
 * parent's choices, then the target number is picked among the pattern's placements on the chart
 * (core/targets/patterns.ts). All randomness comes from the given `Rng`, so the same seed gives the same target.
 */
import type { ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import type { Settings } from '../settings/schema';
import { adaptiveChoice, randomChoice } from '../progress/ladder';
import type { Direction, Target } from '../types';
import { placements } from './patterns';

export { DISTANCE_DIRECTIONS, pickDirection, UNMASTERED_WEIGHT } from '../progress/ladder';

/** What the generator needs to know about the child's progress; the progress module (T042) fills it. */
export interface TargetProgress {
  /** Directions the child has mastered. */
  mastered: readonly Direction[];
  /** The adaptive step per direction, 0 to MAX_STEP of the ladder; a missing direction is at step 0. */
  steps: Partial<Record<Direction, number>>;
}

export const NO_PROGRESS: TargetProgress = { mastered: [], steps: {} };

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
  const pick = settings.adaptive ? adaptiveChoice(layout, settings, progress, rng) : randomChoice(layout, settings, rng);
  const options = placements(layout, pick.choice, pick.direction);
  const fresh = options.filter((p) => p.number !== avoid);
  const placement = rng.pick(fresh.length > 0 ? fresh : options);
  const target: Target = {
    number: placement.number,
    hints: placement.hints,
    directions: placement.directions,
    difficultyStep: pick.step,
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
    difficultyStep: target.difficultyStep,
    pattern: target.pattern,
  };
  return rest.length > 0 ? { ...following, queue: rest } : following;
}

/**
 * Hole and goalkeeper targets (research R5, R9; FR-011, FR-014, FR-019, FR-038, FR-040, FR-065, FR-067).
 *
 * Answer-first, as math-tank. Goalkeeper targets use the hint patterns (core/targets/patterns.ts): the ladder
 * (core/progress/ladder.ts) picks the direction and the pattern within the parent's choices, then the generator picks
 * the target number among the pattern's placements on the chart. Hole targets (removed with T088) still pick the
 * direction, then the hint distance from their own ladder, then the number, and last the hints around it; a hole target
 * is valid only when at least one hint remains on the chart, two for `direct`. All randomness comes from the given
 * `Rng`, so the same seed gives the same target.
 */
import { COLUMNS, numberAt, type ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import type { Settings } from '../settings/schema';
import { adaptiveChoice, DISTANCE_DIRECTIONS, pickDirection, randomChoice } from '../progress/ladder';
import { HINT_DISTANCES, type Direction, type HintDistance, type Mode, type Target } from '../types';
import { clamp } from '../util';
import { directionsOf, hintsFor } from './hints';
import { placements } from './patterns';

export { DISTANCE_DIRECTIONS, pickDirection, UNMASTERED_WEIGHT } from '../progress/ladder';

/** What the generator needs to know about the child's progress; the progress module (T042) fills it. */
export interface TargetProgress {
  /** Directions the child has mastered in this mode. */
  mastered: readonly Direction[];
  /** The adaptive step per direction, 0 to MAX_STEP of the ladder; a missing direction is at step 0. */
  steps: Partial<Record<Direction, number>>;
}

export const NO_PROGRESS: TargetProgress = { mastered: [], steps: {} };

export interface NextTargetInput {
  layout: ChartLayout;
  /** `holes` or `keeper`; line targets come from `makeLine` (US4). */
  mode: Mode;
  settings: Settings;
  progress: TargetProgress;
  rng: Rng;
  /** The previous target number, not picked again when another number fits. */
  avoid?: number;
}

/** The most decorative patched holes on the board in hole mode (FR-011, critique P5). */
export const MAX_PATCHED_HOLES = 3;

/** The highest step of the hole mode ladder (FR-040). */
export const HOLE_MAX_STEP = 3;

/** The hole mode ladder (FR-040): the hint distances of each step, easiest first. Step 3 is step 2 with hints on request. */
export const HOLE_LADDER: ReadonlyArray<readonly HintDistance[]> = [['direct'], ['vertical', 'diagonal'], ['far'], ['far']];

/** The fewest hints a valid target has with this distance. */
function minHints(distance: HintDistance): number {
  return distance === 'direct' ? 2 : 1;
}

/** The hint distances the parent allows, in ladder order. */
export function allowedDistances(settings: Settings): HintDistance[] {
  return HINT_DISTANCES.filter((d) => settings.hintDistance[d]);
}

/** Every number of the range in which the target has enough hints with `distance` and one of them trains `direction`. */
function numbersFor(layout: ChartLayout, distance: HintDistance, direction: Direction): number[] {
  const out: number[] = [];
  for (let n = layout.min; n <= layout.max; n++) {
    const hints = hintsFor(layout, n, distance);
    if (hints.length >= minHints(distance) && directionsOf(n, hints).includes(direction)) out.push(n);
  }
  return out;
}

/**
 * The hint distance for an adaptive step: the ladder's distances at that step that the parent allows and that train
 * `direction`. When none does, the nearest step below, then above, that has one.
 */
export function distancesForStep(step: number, allowed: readonly HintDistance[], direction: Direction): HintDistance[] {
  const fits = (s: number) => (HOLE_LADDER[s] ?? []).filter((d) => allowed.includes(d) && DISTANCE_DIRECTIONS[d].includes(direction));
  for (let delta = 0; delta <= HOLE_MAX_STEP; delta++) {
    for (const s of [step - delta, step + delta]) {
      if (s < 0 || s > HOLE_MAX_STEP) continue;
      const found = fits(s);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/** Hole or goalkeeper target, answer-first (see the file comment). */
export function nextTarget(input: NextTargetInput): Target {
  return input.mode === 'keeper' ? patternTarget(input) : holeTarget(input);
}

/** A goalkeeper target with a hint pattern (FR-065, FR-067). */
function patternTarget(input: NextTargetInput): Target {
  const { layout, mode, settings, progress, rng, avoid } = input;
  const pick = settings.adaptive ? adaptiveChoice(layout, settings, progress, rng) : randomChoice(layout, settings, rng);
  const options = placements(layout, pick.choice, pick.direction);
  const fresh = options.filter((p) => p.number !== avoid);
  const placement = rng.pick(fresh.length > 0 ? fresh : options);
  return {
    mode,
    number: placement.number,
    hints: placement.hints,
    patchedHoles: [],
    directions: placement.directions,
    difficultyStep: pick.step,
    pattern: pick.choice.pattern,
  };
}

/** A hole mode target with hint distances (FR-011, FR-014, FR-040). */
function holeTarget(input: NextTargetInput): Target {
  const { layout, mode, settings, progress, rng, avoid } = input;
  const allowed = allowedDistances(settings);

  // Directions that can be trained on this chart with the allowed distances. A chart of one row has no hint above or
  // below, so only across is left (spec edge case "Very small range").
  const usable = new Map<Direction, Map<HintDistance, number[]>>();
  for (const distance of allowed) {
    for (const direction of DISTANCE_DIRECTIONS[distance]) {
      const numbers = numbersFor(layout, distance, direction);
      if (numbers.length === 0) continue;
      const byDistance = usable.get(direction) ?? new Map<HintDistance, number[]>();
      byDistance.set(distance, numbers);
      usable.set(direction, byDistance);
    }
  }
  if (usable.size === 0) {
    // No allowed distance fits the chart; across neighbors always fit a valid range of at least 10 numbers.
    for (const direction of ['right', 'left'] as const) {
      const numbers = numbersFor(layout, 'direct', direction);
      if (numbers.length > 0) usable.set(direction, new Map([['direct', numbers]]));
    }
  }

  const candidates = [...usable.keys()];
  const direction = pickDirection(candidates, progress.mastered, rng);
  const byDistance = usable.get(direction)!;
  const step = settings.adaptive ? clamp(progress.steps[direction] ?? 0, 0, HOLE_MAX_STEP) : null;
  const choices = step === null ? [...byDistance.keys()] : distancesForStep(step, [...byDistance.keys()], direction);
  const distance = rng.pick(choices.length > 0 ? choices : [...byDistance.keys()]);

  const numbers = byDistance.get(distance)!;
  const fresh = numbers.filter((n) => n !== avoid);
  const number = rng.pick(fresh.length > 0 ? fresh : numbers);
  const hints = hintsFor(layout, number, distance);

  return {
    mode,
    number,
    hints,
    patchedHoles: mode === 'holes' ? patchedHoles(layout, number, hints, rng) : [],
    directions: directionsOf(number, hints),
    difficultyStep: step ?? HOLE_LADDER.findIndex((ds) => ds.includes(distance)),
  };
}

/** Up to MAX_PATCHED_HOLES decorative patched holes, away from the target and its hints. */
function patchedHoles(layout: ChartLayout, target: number, hints: readonly number[], rng: Rng): number[] {
  const count = rng.int(0, MAX_PATCHED_HOLES);
  const out: number[] = [];
  for (let tries = 0; out.length < count && tries < 50; tries++) {
    const row = rng.int(0, layout.rows - 1);
    const col = rng.int(0, COLUMNS - 1);
    const n = numberAt(layout, row, col);
    if (n === null || n === target || hints.includes(n) || out.includes(n)) continue;
    out.push(n);
  }
  return out.sort((a, b) => a - b);
}

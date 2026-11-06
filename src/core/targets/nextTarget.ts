/**
 * Hole and goalkeeper targets (research R5, R9; FR-011, FR-014, FR-019, FR-038, FR-040).
 *
 * Answer-first, as math-tank: the generator picks the direction to train, then the hint distance from the adaptive
 * step clamped to the parent's settings, then the target number, and last the hint numbers around it. A target is
 * valid only when at least one hint remains on the chart, two for `direct`. All randomness comes from the given `Rng`,
 * so the same seed gives the same target.
 */
import { numberAt, type ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import type { Settings } from '../settings/schema';
import { HINT_DISTANCES, type Direction, type HintDistance, type Mode, type Target } from '../types';
import { directionsOf, hintsFor } from './hints';

/** What the generator needs to know about the child's progress; the progress module (T042) fills it. */
export interface TargetProgress {
  /** Directions the child has mastered in this mode. */
  mastered: readonly Direction[];
  /** The adaptive step per direction, 0 to 3; a missing direction is at step 0. */
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

/** Unmastered directions are picked this many times as often as mastered ones (research R9). */
export const UNMASTERED_WEIGHT = 2;

/** The most decorative patched holes on the board in hole mode (FR-011, critique P5). */
export const MAX_PATCHED_HOLES = 3;

/** The highest adaptive step: hints on request only (FR-040). */
export const MAX_STEP = 3;

/** The directions that hints of each distance train. */
const DISTANCE_DIRECTIONS: Record<HintDistance, readonly Direction[]> = {
  direct: ['right', 'left', 'down', 'up'],
  vertical: ['down', 'up'],
  diagonal: ['downRight', 'upLeft', 'downLeft', 'upRight'],
  far: ['right', 'left', 'down', 'up'],
};

/** The difficulty ladder (FR-040): the hint distances of each step, easiest first. Step 3 is step 2 with hints on request. */
const LADDER: ReadonlyArray<readonly HintDistance[]> = [['direct'], ['vertical', 'diagonal'], ['far'], ['far']];

/** The fewest hints a valid target has with this distance. */
function minHints(distance: HintDistance): number {
  return distance === 'direct' ? 2 : 1;
}

/** The hint distances the parent allows, in ladder order. */
export function allowedDistances(settings: Settings): HintDistance[] {
  return HINT_DISTANCES.filter((d) => settings.hintDistance[d]);
}

/**
 * Picks one direction, weighting directions not yet mastered UNMASTERED_WEIGHT times (FR-040: adaptive difficulty
 * favors directions that are not yet mastered).
 */
export function pickDirection(candidates: readonly Direction[], mastered: readonly Direction[], rng: Rng): Direction {
  if (candidates.length === 0) throw new RangeError('pickDirection: no candidates');
  const weights = candidates.map((d) => (mastered.includes(d) ? 1 : UNMASTERED_WEIGHT));
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
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
function distancesForStep(step: number, allowed: readonly HintDistance[], direction: Direction): HintDistance[] {
  const fits = (s: number) => (LADDER[s] ?? []).filter((d) => allowed.includes(d) && DISTANCE_DIRECTIONS[d].includes(direction));
  for (let delta = 0; delta <= MAX_STEP; delta++) {
    for (const s of [step - delta, step + delta]) {
      if (s < 0 || s > MAX_STEP) continue;
      const found = fits(s);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/** Hole or goalkeeper target, answer-first (see the file comment). */
export function nextTarget(input: NextTargetInput): Target {
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
  const step = settings.adaptive ? Math.min(MAX_STEP, Math.max(0, progress.steps[direction] ?? 0)) : null;
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
    difficultyStep: step ?? LADDER.findIndex((ds) => ds.includes(distance)),
  };
}

/** Up to MAX_PATCHED_HOLES decorative patched holes, away from the target and its hints. */
function patchedHoles(layout: ChartLayout, target: number, hints: readonly number[], rng: Rng): number[] {
  const count = rng.int(0, MAX_PATCHED_HOLES);
  const out: number[] = [];
  for (let tries = 0; out.length < count && tries < 50; tries++) {
    const row = rng.int(0, layout.rows - 1);
    const col = rng.int(0, 9);
    const n = numberAt(layout, row, col);
    if (n === null || n === target || hints.includes(n) || out.includes(n)) continue;
    out.push(n);
  }
  return out.sort((a, b) => a - b);
}

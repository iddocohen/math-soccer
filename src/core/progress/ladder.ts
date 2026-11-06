// Step logic adapted from math-tank src/core/progress/ladders.ts: one ladder for every direction instead of one per skill.
/**
 * The difficulty ladder of the goalkeeper game (FR-067, amendment 05), easiest first. Each step names the hint
 * patterns it offers; a direction uses the patterns of its step that train it:
 *
 *   0. Nachbarn (direct neighbors; above and below, or the diagonal neighbors, for those directions)
 *   1. Mitte across
 *   2. Mitte down
 *   3. Reihe down (and Reihe across: design call, so the across directions also meet a row)
 *   4. Mitte or Reihe diagonal
 *   5. Formen (amendment 06; until shapes exist the step falls back to the next lower step)
 *   6. Nachbarn two squares away
 *   7. as step 6, with hints on request ("auf Wunsch") when the parent chose it
 *
 * Everything stays within the parent's choices: the allowed patterns ("Hinweis-Muster"), the allowed hint distances for
 * Nachbarn and the allowed directions ("Richtungen"). A step that offers nothing for a direction under these choices
 * falls back to the nearest lower step that does, else the nearest higher one. Steps up and down skip steps that look the same, as
 * math-tank's `stepUp` and `stepDown`, so the child never "rises" without a change.
 *
 * With adaptive difficulty off, `randomChoice` draws a pattern and then a direction with equal weight.
 */
import type { ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import type { Settings } from '../settings/schema';
import { placements, ROW_GIVEN, SHAPES_AVAILABLE, type Pattern, type PatternChoice } from '../targets/patterns';
import { DIRECTIONS, type Direction, type HintDistance } from '../types';

/** The highest step: hints on request (FR-067 step 8, counted from 0 here). */
export const MAX_STEP = 7;
/** The number of steps, for the progress page's "Stufe 3 von 8". */
export const STEP_COUNT = MAX_STEP + 1;
/** The step whose hints wait for a request when the parent chose "auf Wunsch". */
export const ON_REQUEST_STEP = MAX_STEP;

/** Unmastered directions are picked this many times as often as mastered ones (research R9, FR-067). */
export const UNMASTERED_WEIGHT = 2;

const ACROSS: readonly Direction[] = ['right', 'left'];
const DOWN: readonly Direction[] = ['down', 'up'];
const DIAGONAL: readonly Direction[] = ['downRight', 'upLeft', 'downLeft', 'upRight'];

/** The directions that Nachbarn hints of each distance train. */
export const DISTANCE_DIRECTIONS: Record<HintDistance, readonly Direction[]> = {
  direct: ['right', 'left', 'down', 'up'],
  vertical: ['down', 'up'],
  diagonal: DIAGONAL,
  far: ['right', 'left', 'down', 'up'],
};

/** The directions the parent allows, in DIRECTIONS order. */
export function allowedDirections(settings: Settings): Direction[] {
  return DIRECTIONS.filter((d) => settings.directions[d]);
}

function neighbors(settings: Settings, direction: Direction, distances: readonly HintDistance[]): PatternChoice[] {
  if (!settings.patterns.neighbors) return [];
  return distances.filter((d) => settings.hintDistance[d] && DISTANCE_DIRECTIONS[d].includes(direction)).map((distance) => ({ pattern: 'neighbors', distance }));
}

function middle(settings: Settings, direction: Direction, axis: readonly Direction[]): PatternChoice[] {
  return settings.patterns.middle && axis.includes(direction) ? [{ pattern: 'middle', direction }] : [];
}

function row(settings: Settings, direction: Direction, axis: readonly Direction[]): PatternChoice[] {
  return settings.patterns.row && axis.includes(direction) ? ROW_GIVEN.map((given) => ({ pattern: 'row', direction, given })) : [];
}

/** What step `step` itself offers for `direction` under the parent's choices, without falling back. */
export function stepChoices(step: number, direction: Direction, settings: Settings): PatternChoice[] {
  switch (step) {
    case 0:
      return neighbors(settings, direction, ['direct', 'vertical', 'diagonal']);
    case 1:
      return middle(settings, direction, ACROSS);
    case 2:
      return middle(settings, direction, DOWN);
    case 3:
      return row(settings, direction, [...DOWN, ...ACROSS]);
    case 4:
      return [...middle(settings, direction, DIAGONAL), ...row(settings, direction, DIAGONAL)];
    case 5:
      // Formen: amendment 06 fills this step; until then it offers nothing and falls back to step 4.
      return [];
    case 6:
    case 7:
      return neighbors(settings, direction, ['far']);
    default:
      return [];
  }
}

/**
 * The steps to try for `step`, in order: the step itself, then every lower step from the nearest down, then every
 * higher step from the nearest up. So a step falls back to the next lower pattern first (FR-067, tasks.md T084 note).
 */
function fallbackOrder(step: number): number[] {
  const s = Math.min(Math.max(step, 0), MAX_STEP);
  const order = [s];
  for (let j = s - 1; j >= 0; j--) order.push(j);
  for (let j = s + 1; j <= MAX_STEP; j++) order.push(j);
  return order;
}

/** The step `step` falls back to for `direction`: itself, else the nearest lower, else the nearest higher step with a choice. */
export function effectiveStep(step: number, direction: Direction, settings: Settings): number | null {
  return fallbackOrder(step).find((s) => stepChoices(s, direction, settings).length > 0) ?? null;
}

/** The pattern choices at `step` for `direction`, after the fallback of `effectiveStep`. Empty when no step offers one. */
export function choicesForStep(step: number, direction: Direction, settings: Settings): PatternChoice[] {
  const s = effectiveStep(step, direction, settings);
  return s === null ? [] : stepChoices(s, direction, settings);
}

/** The lowest step that offers `choice` for `direction`: the difficulty step a target of that choice records. */
export function stepOfChoice(choice: PatternChoice, direction: Direction, settings: Settings): number {
  const key = JSON.stringify(choice);
  for (let s = 0; s <= MAX_STEP; s++) {
    if (stepChoices(s, direction, settings).some((c) => JSON.stringify(c) === key)) return s;
  }
  return 0;
}

/** What a step means for one direction under the parent's settings: its choices and whether hints wait for H. */
function content(direction: Direction, step: number, settings: Settings): string {
  const choices = choicesForStep(step, direction, settings).map((c) => JSON.stringify(c)).sort().join(',');
  const onRequest = step >= ON_REQUEST_STEP && settings.hintDisplay === 'onRequest';
  return `${choices}|${onRequest ? 'onRequest' : 'always'}`;
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

/**
 * Picks one direction, weighting directions not yet mastered UNMASTERED_WEIGHT times (FR-067: adaptive difficulty
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

/** One pattern choice for one direction, as the target generator uses it. */
export interface LadderPick {
  direction: Direction;
  choice: PatternChoice;
  /** The ladder step the target records (0 to MAX_STEP). */
  step: number;
}

/** Answers of `fits`, by range, choice and direction: they never change, and every target asks them again. */
const fitCache = new Map<string, boolean>();

/** True when `choice` has a placement on `layout` that trains `direction`. */
function fits(layout: ChartLayout, choice: PatternChoice, direction: Direction): boolean {
  const key = `${layout.min}-${layout.max}|${JSON.stringify(choice)}|${direction}`;
  let found = fitCache.get(key);
  if (found === undefined) {
    found = placements(layout, choice, direction).length > 0;
    fitCache.set(key, found);
  }
  return found;
}

/** Every choice of every step for `direction` under the settings, once each, in ladder order. */
function allChoices(direction: Direction, settings: Settings): PatternChoice[] {
  const seen = new Set<string>();
  const out: PatternChoice[] = [];
  for (let s = 0; s <= MAX_STEP; s++) {
    for (const c of stepChoices(s, direction, settings)) {
      const key = JSON.stringify(c);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(c);
      }
    }
  }
  return out;
}

/**
 * The settings the generator works with. "Formen" without shapes counts as the next lower pattern, Reihe (FR-067
 * note in tasks.md). When the parent's choices leave nothing that fits the chart (for example only "down" on a chart of
 * one row), across with direct neighbors is used, which fits every range of at least 10 numbers.
 */
function workingSettings(settings: Settings): Settings {
  if (SHAPES_AVAILABLE || !settings.patterns.shape) return settings;
  return { ...settings, patterns: { ...settings.patterns, row: true, shape: false } };
}

const FALLBACK: LadderPick = { direction: 'right', choice: { pattern: 'neighbors', distance: 'direct' }, step: 0 };

/**
 * The adaptive pick (FR-067): a direction among the allowed ones that the chart can train, unmastered ones weighted
 * twice, then a pattern choice from that direction's step.
 */
export function adaptiveChoice(
  layout: ChartLayout,
  parent: Settings,
  progress: { mastered: readonly Direction[]; steps: Partial<Record<Direction, number>> },
  rng: Rng,
): LadderPick {
  const settings = workingSettings(parent);
  const usable = new Map<Direction, PatternChoice[]>();
  for (const direction of allowedDirections(settings)) {
    const ok = allChoices(direction, settings).filter((c) => fits(layout, c, direction));
    if (ok.length > 0) usable.set(direction, ok);
  }
  if (usable.size === 0) return FALLBACK;
  const direction = pickDirection([...usable.keys()], progress.mastered, rng);
  const fitting = usable.get(direction)!;
  const step = Math.min(Math.max(progress.steps[direction] ?? 0, 0), MAX_STEP);
  // The step's choices that fit this chart; when none fits, those of the nearest lower, then higher, step that fit.
  const fitKeys = new Set(fitting.map((c) => JSON.stringify(c)));
  for (const s of fallbackOrder(step)) {
    const here = stepChoices(s, direction, settings).filter((c) => fitKeys.has(JSON.stringify(c)));
    if (here.length > 0) return { direction, choice: rng.pick(here), step };
  }
  return { direction, choice: rng.pick(fitting), step };
}

/**
 * The pick with adaptive difficulty off (FR-067): a pattern among the allowed ones with equal weight, then a direction
 * among the allowed ones that pattern can train on this chart, with equal weight, then one of its variants.
 */
export function randomChoice(layout: ChartLayout, parent: Settings, rng: Rng): LadderPick {
  const settings = workingSettings(parent);
  const byPattern = new Map<Pattern, Map<Direction, PatternChoice[]>>();
  for (const direction of allowedDirections(settings)) {
    for (const choice of allChoices(direction, settings)) {
      if (!fits(layout, choice, direction)) continue;
      const byDirection = byPattern.get(choice.pattern) ?? new Map<Direction, PatternChoice[]>();
      byDirection.set(direction, [...(byDirection.get(direction) ?? []), choice]);
      byPattern.set(choice.pattern, byDirection);
    }
  }
  if (byPattern.size === 0) return FALLBACK;
  const pattern = rng.pick([...byPattern.keys()]);
  const byDirection = byPattern.get(pattern)!;
  const direction = rng.pick([...byDirection.keys()]);
  const choice = rng.pick(byDirection.get(direction)!);
  return { direction, choice, step: stepOfChoice(choice, direction, settings) };
}

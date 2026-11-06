// Adapted from math-tank src/core/progress/adaptive.ts, with `skill` renamed to `direction` and no sessions.
/**
 * Records one finished target in Progress (FR-037 to FR-040, research R9). Pure: returns a new Progress.
 *
 * Every direction of the attempt, in the attempt's mode, gets its counters and windows updated; with adaptive
 * difficulty on, its step moves by math-tank's rule: up one step after RAISE_ROW independent targets in a row, down one
 * step when LOWER_NEEDED of the last LOWER_WINDOW needed help or were not solved. `recent` is cleared on a step change,
 * so the row starts again. Guesses are counted but never enter `recent` or `masteryWindow`, so they neither count
 * nor break the row.
 */
import type { Settings } from '../settings/schema';
import type { AttemptRecord, DirectionState, Outcome, Progress } from '../storage/schemas';
import type { TargetProgress } from '../targets/nextTarget';
import { DIRECTIONS, type Direction, type Mode } from '../types';
import { stepDown, stepUp, topStep } from './ladder';
import { isMastered } from './mastery';

/** The attempt list keeps the newest 2000 (FR-037, as math-tank); the direction counters keep the totals. */
export const MAX_ATTEMPTS = 2000;
export const RECENT_MAX = 6;
export const MASTERY_WINDOW_MAX = 10;
/** Up after this many independent targets in a row. */
export const RAISE_ROW = 3;
/** Down when at least LOWER_NEEDED of the last LOWER_WINDOW targets needed help or were not solved. */
export const LOWER_WINDOW = 3;
export const LOWER_NEEDED = 2;

/** Key of a direction in a mode in `Progress.directions`. */
export function directionKey(mode: Mode, direction: Direction): string {
  return `${mode}|${direction}`;
}

export function emptyDirectionState(): DirectionState {
  return { step: 0, recent: [], masteryWindow: [], attempts: 0, independent: 0, assisted: 0, guesses: 0 };
}

/** The progress outcome of a stored attempt. */
export function outcomeOf(a: Pick<AttemptRecord, 'solved' | 'helpStep' | 'misses'>): Outcome {
  if (!a.solved) return 'unsolved';
  return a.helpStep === 0 && a.misses === 0 ? 'independent' : 'assisted';
}

/** The independent outcomes at the end of `recent`. */
function rowOf(ds: DirectionState): number {
  let row = 0;
  while (row < ds.recent.length && ds.recent[ds.recent.length - 1 - row] === 'independent') row += 1;
  return row;
}

/** How many more independent targets in a row raise the step: 1 to RAISE_ROW, or null at the top or with adaptive off. */
export function rowToRaise(ds: DirectionState, direction: Direction, settings: Settings): number | null {
  if (!settings.adaptive || ds.step >= topStep(direction, settings)) return null;
  return Math.max(1, RAISE_ROW - rowOf(ds));
}

function nextStep(ds: DirectionState, direction: Direction, settings: Settings): DirectionState {
  const struggling = ds.recent.slice(-LOWER_WINDOW).filter((o) => o !== 'independent').length;
  let step = ds.step;
  if (rowOf(ds) >= RAISE_ROW) step = stepUp(direction, ds.step, settings);
  else if (struggling >= LOWER_NEEDED) step = stepDown(direction, ds.step, settings);
  return step === ds.step ? ds : { ...ds, step, recent: [] };
}

function updateDirection(ds: DirectionState, a: AttemptRecord, direction: Direction, settings: Settings): DirectionState {
  if (a.guess) return { ...ds, attempts: ds.attempts + 1, guesses: ds.guesses + 1 };
  const outcome = outcomeOf(a);
  const updated: DirectionState = {
    ...ds,
    attempts: ds.attempts + 1,
    independent: ds.independent + (outcome === 'independent' ? 1 : 0),
    assisted: ds.assisted + (outcome === 'independent' ? 0 : 1),
    recent: [...ds.recent, outcome].slice(-RECENT_MAX),
    masteryWindow: [...ds.masteryWindow, outcome].slice(-MASTERY_WINDOW_MAX),
  };
  return settings.adaptive ? nextStep(updated, direction, settings) : updated;
}

export function recordAttempt(p: Progress, a: AttemptRecord, settings: Settings): Progress {
  const directions = { ...p.directions };
  for (const direction of new Set(a.directions)) {
    const key = directionKey(a.mode, direction);
    directions[key] = updateDirection(directions[key] ?? emptyDirectionState(), a, direction, settings);
  }
  return { ...p, attempts: [...p.attempts, a].slice(-MAX_ATTEMPTS), directions };
}

/**
 * What target selection needs for `mode` (FR-040): the mastered directions, and each direction's step clamped to
 * what the settings allow now, so a parent who narrows the settings never gets a step beyond them.
 */
export function targetProgress(p: Progress, mode: Mode, settings: Settings): TargetProgress {
  const mastered: Direction[] = [];
  const steps: Partial<Record<Direction, number>> = {};
  for (const direction of DIRECTIONS) {
    const ds = p.directions[directionKey(mode, direction)];
    if (!ds) continue;
    if (isMastered(ds)) mastered.push(direction);
    steps[direction] = Math.min(ds.step, topStep(direction, settings));
  }
  return { mastered, steps };
}

// Adapted from math-tank src/core/progress/adaptive.ts, with `skill` renamed to `direction`, no sessions, and one
// difficulty level for the child instead of a step per skill (amendment 09).
/**
 * Records one finished target in Progress (FR-037 to FR-040, FR-087, research R9). Pure: returns a new Progress.
 *
 * Every direction of the attempt, in the attempt's mode, gets its counters and mastery window updated. The target's
 * level gets its counters (FR-090). With adaptive difficulty on, the child's level moves by math-tank's rule: up one
 * level after RAISE_ROW targets in a row solved alone, down one level when LOWER_NEEDED of the last LOWER_WINDOW needed
 * help or were not solved, always within the parent's range (core/progress/levels.ts). `levelRecent` and `levelWins`
 * are cleared on a level change, so the row starts again. Guesses are counted but never enter `levelRecent` or
 * `masteryWindow`, so they neither count nor break the row.
 */
import type { Settings } from '../settings/schema';
import type { AttemptRecord, DirectionState, LevelCount, Outcome, Progress } from '../storage/schemas';
import type { TargetProgress } from '../targets/nextTarget';
import { DIRECTIONS, PLAYED_MODE, type Direction, type Mode } from '../types';
import { currentLevel, levelDown, levelUp, topLevel, X_LEVEL, X_TWO_EMPTIES_AFTER, type Level } from './levels';
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
  return { masteryWindow: [], attempts: 0, independent: 0, assisted: 0, guesses: 0 };
}

export function emptyLevelCount(): LevelCount {
  return { independent: 0, assisted: 0, guesses: 0 };
}

/** The progress outcome of a stored attempt. */
export function outcomeOf(a: Pick<AttemptRecord, 'solved' | 'helpStep' | 'misses'>): Outcome {
  if (!a.solved) return 'unsolved';
  return a.helpStep === 0 && a.misses === 0 ? 'independent' : 'assisted';
}

/** The independent outcomes at the end of `recent`. */
function rowOf(recent: readonly Outcome[]): number {
  let row = 0;
  while (row < recent.length && recent[recent.length - 1 - row] === 'independent') row += 1;
  return row;
}

/** How many more targets in a row solved alone raise the level: 1 to RAISE_ROW, or null at the top or with adaptive off. */
export function rowToRaise(p: Progress, settings: Settings): number | null {
  if (!settings.adaptive || currentLevel(p.level, settings) >= topLevel(settings)) return null;
  return Math.max(1, RAISE_ROW - rowOf(p.levelRecent));
}

function updateDirection(ds: DirectionState, a: AttemptRecord): DirectionState {
  if (a.guess) return { ...ds, attempts: ds.attempts + 1, guesses: ds.guesses + 1 };
  const outcome = outcomeOf(a);
  return {
    ...ds,
    attempts: ds.attempts + 1,
    independent: ds.independent + (outcome === 'independent' ? 1 : 0),
    assisted: ds.assisted + (outcome === 'independent' ? 0 : 1),
    masteryWindow: [...ds.masteryWindow, outcome].slice(-MASTERY_WINDOW_MAX),
  };
}

function updateCount(c: LevelCount, a: AttemptRecord): LevelCount {
  if (a.guess) return { ...c, guesses: c.guesses + 1 };
  return outcomeOf(a) === 'independent' ? { ...c, independent: c.independent + 1 } : { ...c, assisted: c.assisted + 1 };
}

/** The level fields after one attempt that is not a guess (FR-087). */
function nextLevel(p: Progress, a: AttemptRecord, settings: Settings): Pick<Progress, 'level' | 'levelRecent' | 'levelWins'> {
  const level = currentLevel(p.level, settings);
  const outcome = outcomeOf(a);
  const recent = [...p.levelRecent, outcome].slice(-RECENT_MAX);
  const wins = p.levelWins + (outcome === 'independent' ? 1 : 0);
  if (!settings.adaptive) return { level, levelRecent: recent, levelWins: wins };
  const struggling = recent.slice(-LOWER_WINDOW).filter((o) => o !== 'independent').length;
  let next: Level = level;
  if (rowOf(recent) >= RAISE_ROW) next = levelUp(level, settings);
  else if (struggling >= LOWER_NEEDED) next = levelDown(level, settings);
  return next === level ? { level, levelRecent: recent, levelWins: wins } : { level: next, levelRecent: [], levelWins: 0 };
}

/** Adds one finished target to `p`; `settings` are the ones the round used. */
export function recordAttempt(p: Progress, a: AttemptRecord, settings: Settings): Progress {
  const directions = { ...p.directions };
  for (const direction of new Set(a.directions)) {
    const key = directionKey(a.mode, direction);
    directions[key] = updateDirection(directions[key] ?? emptyDirectionState(), a);
  }
  const attempts = [...p.attempts, a].slice(-MAX_ATTEMPTS);
  // Only goalkeeper attempts have a level; attempts of the removed modes only reach here in tests and old data.
  if (a.mode !== PLAYED_MODE) return { ...p, attempts, directions };
  const key = String(a.level);
  const levels = { ...p.levels, [key]: updateCount(p.levels[key] ?? emptyLevelCount(), a) };
  const level = a.guess ? {} : nextLevel(p, a, settings);
  return { ...p, attempts, directions, levels, ...level };
}

/**
 * Adds one finished target of a cup match to `p` (amendment 13, FR-109): its counts and directions go in as usual, but
 * the child's current level and its row of outcomes stay, because a cup match plays the level of its stage.
 */
export function recordAttemptKeepingLevel(p: Progress, a: AttemptRecord, settings: Settings): Progress {
  return { ...recordAttempt(p, a, settings), level: p.level, levelRecent: p.levelRecent, levelWins: p.levelWins };
}

/**
 * The level reached by an attempt (FR-088): the new level when `after` is higher than `before`, else null. A level
 * going down returns null, so it never shows.
 */
export function levelRaised(before: Progress, after: Progress, settings: Settings): Level | null {
  const from = currentLevel(before.level, settings);
  const to = currentLevel(after.level, settings);
  return to > from ? to : null;
}

/**
 * What target selection needs (FR-086, FR-089): the mastered directions of the goalkeeper game, the current level in
 * the parent's range, and whether the X shape gets two empty squares (after X_TWO_EMPTIES_AFTER targets solved alone at
 * level 5, adaptive difficulty on). Attempts of the removed hole and line modes do not steer it (amendment 05).
 */
export function targetProgress(p: Progress, settings: Settings): TargetProgress {
  const mastered: Direction[] = [];
  for (const direction of DIRECTIONS) {
    const ds = p.directions[directionKey(PLAYED_MODE, direction)];
    if (ds && isMastered(ds)) mastered.push(direction);
  }
  const level = currentLevel(p.level, settings);
  const xTwoEmpties = settings.adaptive && level === X_LEVEL && p.level === X_LEVEL && p.levelWins >= X_TWO_EMPTIES_AFTER;
  return { mastered, level, xTwoEmpties };
}

// Adapted from math-tank src/core/progress/summarize.ts: rows per direction instead of per skill and range.
/**
 * Data for the parent progress page (FR-039, contracts/screens.md "Progress"). Pure: reads Progress and the personal
 * bests and returns plain rows; the page only formats them.
 */
import type { Settings } from '../settings/schema';
import type { Progress, Records } from '../storage/schemas';
import { STEP_COUNT } from './ladder';
import { DIRECTIONS, EARLIER_MODES, MODES, PLAYED_MODE, type Direction, type EarlierMode, type Mode } from '../types';
import { directionKey, emptyDirectionState, rowToRaise } from './adaptive';
import { isMastered } from './mastery';

/**
 * One direction: the counters, step and mastery of the goalkeeper game, and the attempts of the removed hole and line
 * modes as one "früher" total (amendment 05, FR-070).
 */
export interface DirectionRow {
  direction: Direction;
  attempts: number;
  /** Targets solved alone, guesses not counted. */
  independent: number;
  /** Targets solved after help or misses, plus targets left unsolved. */
  withHelp: number;
  guesses: number;
  /** 0 to 7; the page shows `step + 1` of `stepCount`. */
  step: number;
  stepCount: number;
  /** More independent targets in a row that raise the step; null at the top step, with adaptive off or without settings. */
  toRaise: number | null;
  mastered: boolean;
  /** Attempts in hole and line mode, from before amendment 05. */
  earlier: number;
}

export interface BestRow {
  min: number;
  max: number;
  mode: Mode;
  roundType: 'untilHearts' | 'goalCount';
  goals: number;
  timeMs: number;
}

export interface ProgressSummary {
  /** Per direction (DIRECTIONS order); only directions with attempts in any mode. */
  directions: DirectionRow[];
  /** Personal bests of the goalkeeper game, by range and round type; a plain list, no ranking. */
  bests: BestRow[];
  /** Personal bests of the removed hole and line modes, kept under "früher" and no longer compared (FR-070). */
  earlierBests: Array<BestRow & { mode: EarlierMode }>;
}

function isEarlier(b: BestRow): b is BestRow & { mode: EarlierMode } {
  return (EARLIER_MODES as readonly Mode[]).includes(b.mode);
}

/** A record key `${min}-${max}|${mode}|${roundType}` (records.ts recordKey), or null. */
export function parseRecordKey(key: string): Omit<BestRow, 'goals' | 'timeMs'> | null {
  const m = /^(\d+)-(\d+)\|(holes|lines|keeper)\|(untilHearts|goalCount)$/.exec(key);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2]), mode: m[3] as Mode, roundType: m[4] as BestRow['roundType'] };
}

/** `settings` gives each row its `toRaise`. */
export function summarize(p: Progress, records: Records, settings?: Settings): ProgressSummary {
  const directions: DirectionRow[] = [];
  for (const direction of DIRECTIONS) {
    const found = p.directions[directionKey(PLAYED_MODE, direction)];
    const earlier = EARLIER_MODES.reduce((sum, mode) => sum + (p.directions[directionKey(mode, direction)]?.attempts ?? 0), 0);
    if ((found?.attempts ?? 0) === 0 && earlier === 0) continue;
    const ds = found ?? emptyDirectionState();
    directions.push({
      direction,
      attempts: ds.attempts,
      independent: ds.independent,
      withHelp: ds.assisted,
      guesses: ds.guesses,
      step: ds.step,
      stepCount: STEP_COUNT,
      toRaise: settings ? rowToRaise(ds, direction, settings) : null,
      mastered: isMastered(ds),
      earlier,
    });
  }
  const all: BestRow[] = [];
  for (const [key, best] of Object.entries(records.bests)) {
    const parsed = parseRecordKey(key);
    if (parsed) all.push({ ...parsed, goals: best.goals, timeMs: best.timeMs });
  }
  all.sort((a, b) => a.min - b.min || a.max - b.max || MODES.indexOf(a.mode) - MODES.indexOf(b.mode) || a.roundType.localeCompare(b.roundType));
  return { directions, bests: all.filter((b) => b.mode === PLAYED_MODE), earlierBests: all.filter(isEarlier) };
}

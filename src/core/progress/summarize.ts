// Adapted from math-tank src/core/progress/summarize.ts: rows per direction and mode instead of per skill and range.
/**
 * Data for the parent progress page (FR-039, contracts/screens.md "Progress"). Pure: reads Progress and the personal
 * bests and returns plain rows; the page only formats them.
 */
import type { Settings } from '../settings/schema';
import type { Progress, Records } from '../storage/schemas';
import { STEP_COUNT } from './ladder';
import { DIRECTIONS, MODES, type Direction, type Mode } from '../types';
import { directionKey, rowToRaise } from './adaptive';
import { isMastered } from './mastery';

export interface DirectionRow {
  mode: Mode;
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
  /** Per mode (start screen order), then per direction (DIRECTIONS order); only directions with attempts. */
  directions: DirectionRow[];
  /** Personal bests, by range, mode and round type; a plain list, no ranking. */
  bests: BestRow[];
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
  for (const mode of MODES) {
    for (const direction of DIRECTIONS) {
      const ds = p.directions[directionKey(mode, direction)];
      if (!ds || ds.attempts === 0) continue;
      directions.push({
        mode,
        direction,
        attempts: ds.attempts,
        independent: ds.independent,
        withHelp: ds.assisted,
        guesses: ds.guesses,
        step: ds.step,
        stepCount: STEP_COUNT,
        toRaise: settings ? rowToRaise(ds, direction, settings) : null,
        mastered: isMastered(ds),
      });
    }
  }
  const bests: BestRow[] = [];
  for (const [key, best] of Object.entries(records.bests)) {
    const parsed = parseRecordKey(key);
    if (parsed) bests.push({ ...parsed, goals: best.goals, timeMs: best.timeMs });
  }
  bests.sort((a, b) => a.min - b.min || a.max - b.max || MODES.indexOf(a.mode) - MODES.indexOf(b.mode) || a.roundType.localeCompare(b.roundType));
  return { directions, bests };
}

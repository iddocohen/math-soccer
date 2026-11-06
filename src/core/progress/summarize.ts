// Adapted from math-tank src/core/progress/summarize.ts: rows per direction instead of per skill and range.
/**
 * Data for the parent progress page (FR-039, contracts/screens.md "Progress"). Pure: reads Progress and the personal
 * bests and returns plain rows; the page only formats them.
 */
import type { Settings } from '../settings/schema';
import type { Progress, Records } from '../storage/schemas';
import { DIRECTIONS, EARLIER_MODES, MODES, PLAYED_MODE, type Direction, type EarlierMode, type Mode, type RoundType } from '../types';
import { directionKey, emptyDirectionState, emptyLevelCount, rowToRaise } from './adaptive';
import { currentLevel, LEVELS, type Level } from './levels';
import { isMastered } from './mastery';

/**
 * One direction: the counters and mastery of the goalkeeper game, and the attempts of the removed hole and line modes as
 * one "früher" total (amendment 05, FR-070).
 */
export interface DirectionRow {
  direction: Direction;
  attempts: number;
  /** Targets solved alone, guesses not counted. */
  independent: number;
  /** Targets solved after help or misses, plus targets left unsolved. */
  withHelp: number;
  guesses: number;
  mastered: boolean;
  /** Attempts in hole and line mode, from before amendment 05. */
  earlier: number;
}

/** One difficulty level (FR-090): targets solved alone and with help at it. */
export interface LevelRow {
  level: Level;
  independent: number;
  /** Targets solved after help or misses, plus targets left unsolved. */
  withHelp: number;
  guesses: number;
}

/** The child's level now (FR-090). */
export interface CurrentLevel {
  level: Level;
  /** More targets in a row solved alone that raise the level; null at the top level or with adaptive off. */
  toRaise: number | null;
}

export interface BestRow {
  min: number;
  max: number;
  mode: Mode;
  roundType: RoundType;
  /** The challenge time of a time challenge best; null for the other round types. */
  challengeMinutes: number | null;
  goals: number;
  timeMs: number;
}

export interface ProgressSummary {
  /** The current level; null without settings. */
  level: CurrentLevel | null;
  /** Every level, 1 to 5, with its counters. */
  levels: LevelRow[];
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

/** A record key `${min}-${max}|${mode}|${roundType}`, with `|${minutes}` for a time challenge (records.ts recordKey), or null. */
export function parseRecordKey(key: string): Omit<BestRow, 'goals' | 'timeMs'> | null {
  const m = /^(\d+)-(\d+)\|(holes|lines|keeper)\|(?:(untilHearts|goalCount)|time\|(\d+))$/.exec(key);
  if (!m) return null;
  const base = { min: Number(m[1]), max: Number(m[2]), mode: m[3] as Mode };
  if (m[4] !== undefined) return { ...base, roundType: m[4] as BestRow['roundType'], challengeMinutes: null };
  return { ...base, roundType: 'time', challengeMinutes: Number(m[5]) };
}

/** `settings` gives the current level. */
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
      mastered: isMastered(ds),
      earlier,
    });
  }
  const all: BestRow[] = [];
  for (const [key, best] of Object.entries(records.bests)) {
    const parsed = parseRecordKey(key);
    if (parsed) all.push({ ...parsed, goals: best.goals, timeMs: best.timeMs });
  }
  all.sort((a, b) => a.min - b.min || a.max - b.max || MODES.indexOf(a.mode) - MODES.indexOf(b.mode) || a.roundType.localeCompare(b.roundType) || (a.challengeMinutes ?? 0) - (b.challengeMinutes ?? 0));
  const levels: LevelRow[] = LEVELS.map((level) => {
    const c = p.levels[String(level)] ?? emptyLevelCount();
    return { level, independent: c.independent, withHelp: c.assisted, guesses: c.guesses };
  });
  const level = settings ? { level: currentLevel(p.level, settings), toRaise: rowToRaise(p, settings) } : null;
  return { level, levels, directions, bests: all.filter((b) => b.mode === PLAYED_MODE), earlierBests: all.filter(isEarlier) };
}

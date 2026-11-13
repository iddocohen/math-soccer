// Adapted from math-tank src/core/progress/summarize.ts: rows per direction instead of per skill and range.
/**
 * Data for the parent progress page (FR-039, contracts/screens.md "Progress"). Pure: reads Progress and the personal
 * bests and returns plain rows; the page only formats them.
 */
import type { Settings } from '../settings/schema';
import type { Progress, Records } from '../storage/schemas';
import type { MatchMode } from '../match/rounds';
import { DIRECTIONS, PLAYED_MODE, type Direction, type Mode, type RoundType } from '../types';
import { directionKey, emptyLevelCount, rowToRaise } from './adaptive';
import { currentLevel, LEVELS, type Level } from './levels';
import { isMastered } from './mastery';

/** One direction: the counters and mastery of the goalkeeper game. */
export interface DirectionRow {
  direction: Direction;
  attempts: number;
  /** Targets solved alone, guesses not counted. */
  independent: number;
  /** Targets solved after help or misses, plus targets left unsolved. */
  withHelp: number;
  guesses: number;
  mastered: boolean;
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
  /**
   * The match mode of the best (amendment 21): "Spielen" and the time challenge are 'normal'. "Torwart" counts the
   * most saves out of 10, "Elfmeter" the shootouts won, "Mauer" goals as the normal round type does.
   */
  matchMode: MatchMode;
  /** The round type; null for "Torwart" and "Elfmeter", which do not follow it. */
  roundType: RoundType | null;
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
  /** Per direction (DIRECTIONS order); only directions with attempts. */
  directions: DirectionRow[];
  /** Personal bests of the goalkeeper game, by range and round type; a plain list, no ranking. */
  bests: BestRow[];
}

/**
 * A record key (records.ts recordKey), or null: `${min}-${max}|${mode}|${roundType}`, with `|${minutes}` for a time
 * challenge and `|wall` for "Mauer"; `${min}-${max}|${mode}|keeper` for "Torwart" and `|shootout` for "Elfmeter".
 */
export function parseRecordKey(key: string): Omit<BestRow, 'goals' | 'timeMs'> | null {
  const m = /^(\d+)-(\d+)\|(keeper)\|(?:(untilHearts|goalCount)(\|wall)?|time\|(\d+)|(keeper|shootout))$/.exec(key);
  if (!m) return null;
  const base = { min: Number(m[1]), max: Number(m[2]), mode: m[3] as Mode };
  if (m[4] !== undefined) return { ...base, matchMode: m[5] ? 'wall' : 'normal', roundType: m[4] as RoundType, challengeMinutes: null };
  if (m[7] !== undefined) return { ...base, matchMode: m[7] as MatchMode, roundType: null, challengeMinutes: null };
  return { ...base, matchMode: 'normal', roundType: 'time', challengeMinutes: Number(m[6]) };
}

/** The order of the bests per range: "Spielen" and the time challenge, then "Mauer", "Torwart", "Elfmeter". */
const MODE_ORDER: Record<MatchMode, number> = { normal: 0, wall: 1, keeper: 2, shootout: 3 };

/** `settings` gives the current level. */
export function summarize(p: Progress, records: Records, settings?: Settings): ProgressSummary {
  const directions: DirectionRow[] = [];
  for (const direction of DIRECTIONS) {
    const ds = p.directions[directionKey(PLAYED_MODE, direction)];
    if (!ds || ds.attempts === 0) continue;
    directions.push({
      direction,
      attempts: ds.attempts,
      independent: ds.independent,
      withHelp: ds.assisted,
      guesses: ds.guesses,
      mastered: isMastered(ds),
    });
  }
  const all: BestRow[] = [];
  for (const [key, best] of Object.entries(records.bests)) {
    const parsed = parseRecordKey(key);
    if (parsed) all.push({ ...parsed, goals: best.goals, timeMs: best.timeMs });
  }
  all.sort(
    (a, b) =>
      a.min - b.min ||
      a.max - b.max ||
      MODE_ORDER[a.matchMode] - MODE_ORDER[b.matchMode] ||
      (a.roundType ?? '').localeCompare(b.roundType ?? '') ||
      (a.challengeMinutes ?? 0) - (b.challengeMinutes ?? 0),
  );
  const levels: LevelRow[] = LEVELS.map((level) => {
    const c = p.levels[String(level)] ?? emptyLevelCount();
    return { level, independent: c.independent, withHelp: c.assisted, guesses: c.guesses };
  });
  const level = settings ? { level: currentLevel(p.level, settings), toRaise: rowToRaise(p, settings) } : null;
  return { level, levels, directions, bests: all };
}

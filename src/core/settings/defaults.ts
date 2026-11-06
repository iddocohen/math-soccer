import type { Difficulty, RangePreset, Settings } from './schema';

/** Limits from data-model.md "Settings". */
export const RANGE_MIN_LIMIT = 0;
export const RANGE_MAX_LIMIT = 1000;
/** "`max - min >= 9`": at least one full row of 10 numbers. */
export const RANGE_SPAN_MIN = 9;
/** The time challenge lengths the parent can choose, in minutes (FR-076). */
export const CHALLENGE_MINUTES = [1, 2, 3, 5] as const;
export type ChallengeMinutes = (typeof CHALLENGE_MINUTES)[number];
export const GOALS_PER_ROUND_MIN = 1;
export const GOALS_PER_ROUND_MAX = 20;

/** The fixed ranges behind each preset; `custom` takes min and max as set. */
export const RANGE_PRESETS: Record<Exclude<RangePreset, 'custom'>, { min: number; max: number }> = {
  '1-100': { min: 1, max: 100 },
  '0-1000': { min: 0, max: 1000 },
};

/** "misses per heart: 5, 4, 3" for easy, normal and challenging. */
export const MISSES_PER_HEART: Record<Difficulty, 3 | 4 | 5> = { easy: 5, normal: 4, challenging: 3 };

/** The defaults listed in data-model.md "Settings". A new object on every call. */
export function defaultSettings(): Settings {
  return {
    version: 2,
    range: { preset: '1-100', min: 1, max: 100 },
    hintDisplay: 'always',
    hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
    directions: {
      right: true,
      down: true,
      downRight: true,
      downLeft: true,
      left: false,
      up: false,
      upLeft: false,
      upRight: false,
    },
    patterns: { neighbors: true, middle: true, row: true, shape: true },
    shapes: { I: true, O: true, T: true, L: true, J: true, S: true, Z: true },
    timeChallenge: { allowed: true, minutes: 2 },
    roundType: 'untilHearts',
    goalsPerRound: 10,
    difficulty: 'easy',
    adaptive: true,
    sound: { effects: true, crowd: true, ohh: true, speech: false },
    numberPad: 'auto',
    showClock: false,
    showRecords: true,
    lockerRoom: true,
    pointAfterFullHelp: true,
  };
}

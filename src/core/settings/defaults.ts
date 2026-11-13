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
/**
 * The difficulty levels (amendments 09 and 18): 1 "Gerade Linien" to 6 "Ausschnitte"; core/progress/levels.ts says what
 * each offers.
 */
export const LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type Level = (typeof LEVELS)[number];
export const GOALS_PER_ROUND_MAX = 20;
/** "Tore pro Spiel" of a cup match (amendment 13, FR-108): 3 to 10, default 5. */
export const CUP_GOALS_MIN = 3;
export const CUP_GOALS_MAX = 10;
export const CUP_GOALS_DEFAULT = 5;

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
    version: 1,
    range: { preset: '1-100', min: 1, max: 100 },
    hintDisplay: 'always',
    hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
    levels: { start: 1, hardest: 6 },
    shapes: { I: true, O: true, T: true, L: true, J: true, S: true, Z: true },
    timeChallenge: { allowed: true, minutes: 2 },
    roundType: 'untilHearts',
    goalsPerRound: 10,
    cupGoals: CUP_GOALS_DEFAULT,
    difficulty: 'easy',
    adaptive: true,
    sound: { effects: true, crowd: true, ohh: true, speech: false },
    numberPad: 'auto',
    showClock: false,
    showRecords: true,
    lockerRoom: true,
    pointAfterFullHelp: true,
    rowColumnHelper: true,
    modesAllowed: { wall: true, keeper: true, shootout: true, torwand: true, family: true },
    keeperSpeed: 'medium',
  };
}

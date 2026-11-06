import type { Difficulty, RangePreset, Settings } from './schema';

/** Limits from data-model.md "Settings". */
export const RANGE_MIN_LIMIT = 0;
export const RANGE_MAX_LIMIT = 1000;
/** "`max - min >= 9`": at least one full row of 10 numbers. */
export const RANGE_SPAN_MIN = 9;
export const LINE_LENGTH_MIN = 3;
export const LINE_LENGTH_MAX = 10;
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
    version: 1,
    range: { preset: '1-100', min: 1, max: 100 },
    modes: { holes: true, lines: true, keeper: true },
    hintDisplay: 'always',
    hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
    lineDirections: {
      right: true,
      down: true,
      downRight: true,
      downLeft: true,
      left: false,
      up: false,
      upLeft: false,
      upRight: false,
    },
    lineLength: 5,
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

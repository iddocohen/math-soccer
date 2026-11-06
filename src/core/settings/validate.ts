import {
  GOALS_PER_ROUND_MAX,
  GOALS_PER_ROUND_MIN,
  RANGE_MAX_LIMIT,
  RANGE_MIN_LIMIT,
  RANGE_PRESETS,
  RANGE_SPAN_MIN,
} from './defaults';
import type { Settings } from './schema';

/** Keys of `settingsErrors` in the translation table (src/i18n/de.ts). */
export const SETTINGS_ERROR_KEYS = [
  'rangeNotInteger',
  'rangeOutside',
  'rangeOrder',
  'rangeSpan',
  'rangePresetMismatch',
  'noHintDistance',
  'noDirection',
  'noPattern',
  'noShape',
  'goalsPerRound',
] as const;

export type SettingsErrorKey = (typeof SETTINGS_ERROR_KEYS)[number];

/** A translation key plus the path of the field it belongs to. */
export interface SettingsError {
  key: SettingsErrorKey;
  path: string;
}

function isInt(v: number, lo: number, hi: number): boolean {
  return Number.isInteger(v) && v >= lo && v <= hi;
}

/** Checks every rule of data-model.md "Settings". An empty list means the settings are valid. */
export function validateSettings(s: Settings): SettingsError[] {
  const errors: SettingsError[] = [];
  const { min, max, preset } = s.range;

  // range: "integers, `0 <= min < max <= 1000`, `max - min >= 9`"
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    errors.push({ key: 'rangeNotInteger', path: 'range' });
  } else {
    if (min < RANGE_MIN_LIMIT || max > RANGE_MAX_LIMIT) errors.push({ key: 'rangeOutside', path: 'range' });
    if (min >= max) errors.push({ key: 'rangeOrder', path: 'range' });
    else if (max - min < RANGE_SPAN_MIN) errors.push({ key: 'rangeSpan', path: 'range' });
  }
  if (preset !== 'custom') {
    const fixed = RANGE_PRESETS[preset];
    if (fixed.min !== min || fixed.max !== max) errors.push({ key: 'rangePresetMismatch', path: 'range.preset' });
  }

  // hintDistance, directions, patterns: "at least one true"; shapes: at least one while "Formen" is on
  if (!Object.values(s.hintDistance).some(Boolean)) errors.push({ key: 'noHintDistance', path: 'hintDistance' });
  if (!Object.values(s.directions).some(Boolean)) errors.push({ key: 'noDirection', path: 'directions' });
  if (!Object.values(s.patterns).some(Boolean)) errors.push({ key: 'noPattern', path: 'patterns' });
  if (s.patterns.shape && !Object.values(s.shapes).some(Boolean)) errors.push({ key: 'noShape', path: 'shapes' });

  // goalsPerRound: "1 to 20"
  if (!isInt(s.goalsPerRound, GOALS_PER_ROUND_MIN, GOALS_PER_ROUND_MAX)) {
    errors.push({ key: 'goalsPerRound', path: 'goalsPerRound' });
  }
  return errors;
}

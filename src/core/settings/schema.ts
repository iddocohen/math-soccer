import { z } from 'zod';
import { GOALS_PER_ROUND_MAX, GOALS_PER_ROUND_MIN, LINE_LENGTH_MAX, LINE_LENGTH_MIN } from './defaults';

/**
 * Structural schema of the stored settings, version 1 (`mathsoccer.settings.v1`, data-model.md "Settings").
 * Rules across fields (range order and width, "at least one true") live in validate.ts; the limits of line length and
 * goals per round are checked here too, so stored settings outside them are invalid on load.
 */

export const rangePresetSchema = z.enum(['1-100', '0-1000', 'custom']);

export const rangeSchema = z.object({
  preset: rangePresetSchema,
  min: z.number().int(),
  max: z.number().int(),
});

export const settingsSchema = z.object({
  version: z.literal(1),
  range: rangeSchema,
  modes: z.object({ holes: z.boolean(), lines: z.boolean(), keeper: z.boolean() }),
  hintDisplay: z.enum(['always', 'onRequest']),
  hintDistance: z.object({ direct: z.boolean(), vertical: z.boolean(), diagonal: z.boolean(), far: z.boolean() }),
  lineDirections: z.object({
    right: z.boolean(),
    down: z.boolean(),
    downRight: z.boolean(),
    downLeft: z.boolean(),
    left: z.boolean(),
    up: z.boolean(),
    upLeft: z.boolean(),
    upRight: z.boolean(),
  }),
  lineLength: z.number().int().min(LINE_LENGTH_MIN).max(LINE_LENGTH_MAX),
  roundType: z.enum(['untilHearts', 'goalCount']),
  goalsPerRound: z.number().int().min(GOALS_PER_ROUND_MIN).max(GOALS_PER_ROUND_MAX),
  difficulty: z.enum(['easy', 'normal', 'challenging']),
  adaptive: z.boolean(),
  sound: z.object({ effects: z.boolean(), crowd: z.boolean(), ohh: z.boolean(), speech: z.boolean() }),
  numberPad: z.enum(['auto', 'always', 'never']),
  showClock: z.boolean(),
  showRecords: z.boolean(),
  lockerRoom: z.boolean(),
  pointAfterFullHelp: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsRange = z.infer<typeof rangeSchema>;
export type RangePreset = z.infer<typeof rangePresetSchema>;
export type Difficulty = Settings['difficulty'];

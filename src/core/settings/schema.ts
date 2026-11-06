import { z } from 'zod';

/**
 * Structural schema of the stored settings, version 1 (`mathsoccer.settings.v1`, data-model.md "Settings").
 * Rules across fields (range order and width, "at least one true") live in validate.ts.
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
  lineLength: z.number().int(),
  roundType: z.enum(['untilHearts', 'goalCount']),
  goalsPerRound: z.number().int(),
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

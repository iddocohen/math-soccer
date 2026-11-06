import { z } from 'zod';
import { CHALLENGE_MINUTES, GOALS_PER_ROUND_MAX, GOALS_PER_ROUND_MIN, LEVELS } from './defaults';

/**
 * Structural schema of the stored settings, version 3 (stored under `mathsoccer.settings.v1`, data-model.md
 * "Settings"; amendments 05 to 07 and 09). Version 1 had game modes, line directions and a line length; version 2 had
 * "Richtungen" and "Hinweis-Muster", which the difficulty levels replace; migrate.ts turns both into version 3. Rules across fields (range order and width, "at least one true") live in validate.ts; the limits of
 * goals per round and the challenge minutes are checked here too, so stored settings outside them are invalid on load.
 */

export const rangePresetSchema = z.enum(['1-100', '0-1000', 'custom']);

export const rangeSchema = z.object({
  preset: rangePresetSchema,
  min: z.number().int(),
  max: z.number().int(),
});

export const settingsSchema = z.object({
  version: z.literal(3),
  range: rangeSchema,
  hintDisplay: z.enum(['always', 'onRequest']),
  hintDistance: z.object({ direct: z.boolean(), vertical: z.boolean(), diagonal: z.boolean(), far: z.boolean() }),
  /** "Stufe am Anfang" and "Schwerste Stufe" (FR-085): the range of difficulty levels, 1 to 5. */
  levels: z.object({ start: z.literal(LEVELS), hardest: z.literal(LEVELS) }),
  /** "Formen" (FR-074): the single shapes of levels 3 and 4; with every shape off, those levels are skipped. */
  shapes: z.object({ I: z.boolean(), O: z.boolean(), T: z.boolean(), L: z.boolean(), J: z.boolean(), S: z.boolean(), Z: z.boolean() }),
  /** "Zeit-Challenge" (FR-075, FR-076): whether the start screen offers it, and its length in minutes. */
  timeChallenge: z.object({
    allowed: z.boolean(),
    minutes: z.literal(CHALLENGE_MINUTES),
  }),
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
export type LevelRange = Settings['levels'];

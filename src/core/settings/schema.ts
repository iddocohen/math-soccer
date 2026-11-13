import { z } from 'zod';
import { CHALLENGE_MINUTES, CUP_GOALS_MAX, CUP_GOALS_MIN, GOALS_PER_ROUND_MAX, GOALS_PER_ROUND_MIN, LEVELS } from './defaults';
import { KEEPER_SPEEDS } from '../match/keeper';

/**
 * Structural schema of the stored settings, version 1 (stored under `mathsoccer.settings.v1`, data-model.md
 * "Settings"). Rules across fields (range order and width, "at least one true") live in validate.ts; the limits of goals
 * per round and the challenge minutes are checked here too, so stored settings outside them are invalid on load.
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
  /** "Tore pro Spiel" (amendment 13, FR-108): the goals that win a cup match. */
  cupGoals: z.number().int().min(CUP_GOALS_MIN).max(CUP_GOALS_MAX),
  difficulty: z.enum(['easy', 'normal', 'challenging']),
  adaptive: z.boolean(),
  sound: z.object({ effects: z.boolean(), crowd: z.boolean(), ohh: z.boolean(), speech: z.boolean() }),
  numberPad: z.enum(['auto', 'always', 'never']),
  showClock: z.boolean(),
  showRecords: z.boolean(),
  lockerRoom: z.boolean(),
  pointAfterFullHelp: z.boolean(),
  /** "Zeilen- und Spaltenhilfe" (FR-093): the row scale beside the goal and the column scale above it. */
  rowColumnHelper: z.boolean(),
  /**
   * "Spielarten erlauben" (amendment 21, FR-141): each mode bought in the locker room shows its start screen button only
   * while it is on here. Added with a default, so settings stored before it still load (no migration).
   */
  modesAllowed: z.object({ wall: z.boolean(), keeper: z.boolean(), shootout: z.boolean() }).default({ wall: true, keeper: true, shootout: true }),
  /** "Schussgeschwindigkeit" of "Selbst ins Tor" (amendment 21, FR-144): langsam 10 s, mittel 8 s, schnell 5 s. */
  keeperSpeed: z.enum(KEEPER_SPEEDS).default('medium'),
});

export type Settings = z.infer<typeof settingsSchema>;
export type RangePreset = z.infer<typeof rangePresetSchema>;
export type Difficulty = Settings['difficulty'];

import { z } from 'zod';
import { DIRECTIONS, MODES } from '../types';

/**
 * Schemas of the stored kinds other than settings (data-model.md). These are first versions: later tasks extend them
 * (T029 the round, T036 the personal bests, T043 the attempt records, T057 the locker room). A change to a stored
 * shape raises its version and adds a step in migrate.ts.
 */

export const modeSchema = z.enum(MODES);

/** `mathsoccer.progress.v1`: attempt records, capped at the last 2000 (data-model "AttemptRecord"). */
export const progressSchema = z.object({
  version: z.literal(1),
  attempts: z.array(z.record(z.string(), z.unknown())),
});
export type Progress = z.infer<typeof progressSchema>;

export function emptyProgress(): Progress {
  return { version: 1, attempts: [] };
}

/** `mathsoccer.records.v1`: personal bests by `min-max|mode|roundType` (data-model "PersonalBest"). */
export const recordsSchema = z.object({
  version: z.literal(1),
  bests: z.record(
    z.string(),
    z.object({ goals: z.number().int().min(0), timeMs: z.number().min(0), at: z.string() }),
  ),
});
export type Records = z.infer<typeof recordsSchema>;

export function emptyRecords(): Records {
  return { version: 1, bests: {} };
}

/** `mathsoccer.lockerroom.v1`: stars and the chosen look (data-model "LockerRoom"). */
export const lockerRoomSchema = z.object({
  version: z.literal(1),
  stars: z.number().int().min(0),
  totalEarned: z.number().int().min(0),
  owned: z.array(z.string()),
  ball: z.string(),
  shirtColor: z.string(),
  shirtNumber: z.number().int().min(1).max(99),
  shirtName: z.string().max(10),
  scarfColor: z.string(),
});
export type LockerRoom = z.infer<typeof lockerRoomSchema>;

/** The free starter items; the item ids are placeholders until the item list exists (T057). */
export function emptyLockerRoom(): LockerRoom {
  return {
    version: 1,
    stars: 0,
    totalEarned: 0,
    owned: ['ball.starter', 'shirt.white', 'scarf.yellow'],
    ball: 'ball.starter',
    shirtColor: 'shirt.white',
    shirtNumber: 10,
    shirtName: '',
    scarfColor: 'scarf.yellow',
  };
}

/** A hole or goalkeeper target (data-model "Target"). */
export const targetSchema = z.object({
  mode: modeSchema,
  number: z.number().int(),
  hints: z.array(z.number().int()),
  patchedHoles: z.array(z.number().int()),
  directions: z.array(z.enum(DIRECTIONS)),
  difficultyStep: z.number().int().min(0).max(3),
});

/**
 * `mathsoccer.round.v1`: the running round, kept on refresh (data-model "Round"). No stored round means no round to
 * continue. The round is saved between shots, so a stored phase is `aiming` or `celebrating`.
 */
export const roundSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  mode: modeSchema,
  roundType: z.enum(['untilHearts', 'goalCount']),
  min: z.number().int(),
  max: z.number().int(),
  goals: z.number().int().min(0),
  hearts: z.number().int().min(0).max(3),
  missesInRow: z.number().int().min(0),
  helpStep: z.number().int().min(0).max(3),
  target: targetSchema.nullable(),
  /** How many targets the round has had; the seed of the next target derives from it. */
  targetCount: z.number().int().min(0),
  starsThisRound: z.number().int().min(0),
  elapsedMs: z.number().min(0),
  phase: z.enum(['aiming', 'celebrating']),
});
export type StoredRound = z.infer<typeof roundSchema>;

import { z } from 'zod';
import { DIRECTIONS, MODES } from '../types';

/**
 * Schemas of the stored kinds other than settings (data-model.md). These are first versions: later tasks extend them
 * (T029 the round, T036 the personal bests, T043 the attempt records, T057 the locker room). A change to a stored
 * shape raises its version and adds a step in migrate.ts.
 */

export const modeSchema = z.enum(MODES);

/** How one finished target went for a direction: alone, with help or misses, or not solved (as math-tank). */
export const outcomeSchema = z.enum(['independent', 'assisted', 'unsolved']);
export type Outcome = z.infer<typeof outcomeSchema>;

/** One finished target (data-model "AttemptRecord", FR-037). */
export const attemptRecordSchema = z.object({
  /** ISO 8601 time the target was finished. */
  at: z.string(),
  mode: modeSchema,
  min: z.number().int(),
  max: z.number().int(),
  target: z.number().int(),
  /** The directions the target counts toward (FR-038). */
  directions: z.array(z.enum(DIRECTIONS)),
  /** The hint distances the parent allowed. */
  hintDistance: z.object({ direct: z.boolean(), vertical: z.boolean(), diagonal: z.boolean(), far: z.boolean() }),
  /** How hints showed for this target: always, or on request (parent setting or adaptive step 3). */
  hintDisplay: z.enum(['always', 'onRequest']),
  difficultyStep: z.number().int().min(0).max(3),
  /** Scored before help step 3 showed the answer. */
  solved: z.boolean(),
  /** The highest help step used on the target, 0 to 3. */
  helpStep: z.number().int().min(0).max(3),
  misses: z.number().int().min(0),
  /** Play time from the target appearing to the scoring shot (or to the end of the round). */
  responseMs: z.number().min(0),
  guess: z.boolean(),
});
export type AttemptRecord = z.infer<typeof attemptRecordSchema>;

/** The adaptive state of one direction in one mode (data-model "DirectionProgress", as math-tank's SkillProgress). */
export const directionStateSchema = z.object({
  /** Adaptive step, 0 to 3. */
  step: z.number().int().min(0).max(3),
  /** Newest last, at most 6; cleared on a step change. Guesses never enter it. */
  recent: z.array(outcomeSchema),
  /** Newest last, at most 10; kept across step changes. Guesses never enter it. */
  masteryWindow: z.array(outcomeSchema),
  attempts: z.number().int().min(0),
  independent: z.number().int().min(0),
  assisted: z.number().int().min(0),
  guesses: z.number().int().min(0),
});
export type DirectionState = z.infer<typeof directionStateSchema>;

/**
 * `mathsoccer.progress.v1`: attempt records, capped at the last 2000, and the state per `mode|direction`, which keeps
 * counting after old attempts drop out of the list.
 */
export const progressSchema = z.object({
  version: z.literal(1),
  attempts: z.array(attemptRecordSchema),
  directions: z.record(z.string(), directionStateSchema).default({}),
});
export type Progress = z.infer<typeof progressSchema>;

export function emptyProgress(): Progress {
  return { version: 1, attempts: [], directions: {} };
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

/** A line of line mode (data-model "Line"). */
export const lineSchema = z.object({
  squares: z.array(z.number().int()).min(1),
  direction: z.enum(DIRECTIONS),
  given: z.number().int().min(0),
  index: z.number().int().min(0),
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
  /** The line in line mode (T050); null in the other modes. */
  line: lineSchema.nullable().default(null),
  /** How many targets the round has had; the seed of the next target derives from it. */
  targetCount: z.number().int().min(0),
  starsThisRound: z.number().int().min(0),
  elapsedMs: z.number().min(0),
  /** Play time when the current target appeared, for the attempt's response time (T043). */
  targetStartMs: z.number().min(0).default(0),
  /** All misses on the current target; `missesInRow` restarts after a lost heart, this does not. */
  targetMisses: z.number().int().min(0).default(0),
  /** Play times of the shots that missed the current target, for the guess rule (T043). */
  missTimes: z.array(z.number().min(0)).default([]),
  phase: z.enum(['aiming', 'celebrating']),
});
export type StoredRound = z.infer<typeof roundSchema>;

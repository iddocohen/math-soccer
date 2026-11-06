import { z } from 'zod';
import { STARTER } from '../rewards/items';
import { GOALS_PER_ROUND_MAX, GOALS_PER_ROUND_MIN } from '../settings/defaults';
import { PATTERNS } from '../targets/patterns';
import { DIRECTIONS, MODES } from '../types';

/**
 * Schemas of the stored kinds other than settings (data-model.md). These are first versions: later tasks extend them
 * (T029 the round, T036 the personal bests, T043 the attempt records, T057 the locker room). A change to a stored
 * shape raises its version and adds a step in migrate.ts.
 */

/** The mode of an attempt or best: `keeper`, or `holes` and `lines` in data from before amendment 05 (FR-070). */
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
  /** The ladder step, 0 to 7 (core/progress/ladder.ts); attempts of the removed hole mode used 0 to 3. */
  difficultyStep: z.number().int().min(0).max(7),
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
  /** Adaptive step, 0 to 7 (core/progress/ladder.ts); older data holds 0 to 3. */
  step: z.number().int().min(0).max(7),
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

/**
 * `mathsoccer.lockerroom.v1`: stars and the chosen look (data-model "LockerRoom"). `owned` lists the bought items; the
 * free items are owned without being listed (src/core/rewards/items.ts). Loading also drops unknown items and puts the
 * starter item back where a chosen item is not owned (`cleanLockerRoom`).
 */
export const lockerRoomSchema = z.object({
  version: z.literal(1),
  stars: z.number().int().min(0),
  totalEarned: z.number().int().min(0),
  owned: z.array(z.string()),
  ball: z.string(),
  shirtColor: z.string(),
  shirtNumber: z.number().int().min(1).max(99),
  shirtName: z.string().max(10).regex(/^[\p{L} -]*$/u),
  scarfColor: z.string(),
});
export type LockerRoom = z.infer<typeof lockerRoomSchema>;

/** A new player: no stars, the starter items, shirt number 10 and no name. */
export function emptyLockerRoom(): LockerRoom {
  return {
    version: 1,
    stars: 0,
    totalEarned: 0,
    owned: [],
    ball: STARTER.ball,
    shirtColor: STARTER.shirt,
    shirtNumber: 10,
    shirtName: '',
    scarfColor: STARTER.scarf,
  };
}

/** A goalkeeper target (data-model "Target"). */
export const targetSchema = z.object({
  number: z.number().int(),
  hints: z.array(z.number().int()),
  directions: z.array(z.enum(DIRECTIONS)),
  difficultyStep: z.number().int().min(0).max(7),
  pattern: z.enum(PATTERNS),
});

/**
 * `mathsoccer.round.v1`, version 2: the running round, kept on refresh (data-model "Round"). No stored round means no
 * round to continue. The round is saved between shots, so a stored phase is `aiming` or `celebrating`. The rules
 * between fields (`roundRules`) make a damaged round invalid, so it is discarded on load. Version 1 had a mode and a
 * line; migrate.ts turns a goalkeeper round of version 1 into version 2, and storage.ts discards hole and line rounds
 * (FR-070).
 */
export const roundSchema = z
  .object({
    version: z.literal(2),
    seed: z.number().int(),
    roundType: z.enum(['untilHearts', 'goalCount']),
    /** Goals per round at the round start (FR-052); missing in rounds stored before it was kept. */
    goalsPerRound: z.number().int().min(GOALS_PER_ROUND_MIN).max(GOALS_PER_ROUND_MAX).optional(),
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
    /** Play time when the current target appeared, for the attempt's response time (T043). */
    targetStartMs: z.number().min(0).default(0),
    /** All misses on the current target; `missesInRow` restarts after a lost heart, this does not. */
    targetMisses: z.number().int().min(0).default(0),
    /** Play times of the shots that missed the current target, for the guess rule (T043). */
    missTimes: z.array(z.number().min(0)).default([]),
    phase: z.enum(['aiming', 'celebrating']),
  })
  .superRefine(roundRules);
export type StoredRound = z.infer<typeof roundSchema>;

/** Rules between the fields of a stored round: the range goes up, an aiming round has a target, and it lies in the range. */
function roundRules(r: { phase: string; min: number; max: number; target: { number: number } | null }, ctx: z.RefinementCtx): void {
  const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
  if (r.min >= r.max) issue('min must be below max', 'max');
  if (r.phase === 'aiming' && r.target === null) issue('an aiming round needs a target', 'target');
  if (r.target && (r.target.number < r.min || r.target.number > r.max)) issue('target outside the range', 'target');
}

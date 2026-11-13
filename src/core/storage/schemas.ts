import { z } from 'zod';
import { STARTER } from '../rewards/items';
import { CHALLENGE_MINUTES, CUP_GOALS_MAX, CUP_GOALS_MIN, GOALS_PER_ROUND_MAX, GOALS_PER_ROUND_MIN, LEVELS } from '../settings/defaults';
import { PATTERNS } from '../targets/patterns';
import { MATCH_MODES } from '../match/rounds';
import { KEEPER_SHOTS } from '../match/keeper';
import { DIRECTIONS, MODES, ROUND_TYPES } from '../types';

/**
 * Schemas of the stored kinds other than settings (data-model.md). Every kind is at version 1 since the stored data
 * baseline (T106). A change to a stored shape raises its version and adds a step in migrate.ts.
 */

/** The mode of an attempt or best: always `keeper`, the goalkeeper game. */
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
  /** How hints showed for this target: always, or on request (parent setting at the hardest level). */
  hintDisplay: z.enum(['always', 'onRequest']),
  /** The difficulty level of the target, 1 to 6 (amendments 09 and 18). */
  level: z.literal(LEVELS),
  /** Scored before help step 4 showed the answer. */
  solved: z.boolean(),
  /** The highest help step used on the target, 0 to 4 (amendment 10). */
  helpStep: z.number().int().min(0).max(4),
  misses: z.number().int().min(0),
  /** Play time from the target appearing to the scoring shot (or to the end of the round). */
  responseMs: z.number().min(0),
  guess: z.boolean(),
});
export type AttemptRecord = z.infer<typeof attemptRecordSchema>;

/**
 * The counters of one direction in one mode (data-model "DirectionProgress", as math-tank's SkillProgress). Since
 * amendment 09 the difficulty is one level for the child (`Progress.level`), not a step per direction.
 */
export const directionStateSchema = z.object({
  /** Newest last, at most 10. Guesses never enter it. */
  masteryWindow: z.array(outcomeSchema),
  attempts: z.number().int().min(0),
  independent: z.number().int().min(0),
  assisted: z.number().int().min(0),
  guesses: z.number().int().min(0),
});
export type DirectionState = z.infer<typeof directionStateSchema>;

/** Targets solved alone and with help at one level (FR-090); guesses are counted apart. */
export const levelCountSchema = z.object({
  independent: z.number().int().min(0),
  assisted: z.number().int().min(0),
  guesses: z.number().int().min(0),
});
export type LevelCount = z.infer<typeof levelCountSchema>;

/**
 * `mathsoccer.progress.v1`: attempt records, capped at the last 2000, the state per `mode|direction`, which keeps
 * counting after old attempts drop out of the list, and the child's difficulty level (amendment 09).
 */
export const progressSchema = z.object({
  version: z.literal(1),
  attempts: z.array(attemptRecordSchema),
  directions: z.record(z.string(), directionStateSchema),
  /** The current level (FR-086); null before the first target and after a reset, so the start level applies. */
  level: z.literal(LEVELS).nullable(),
  /** Outcomes since the level last changed, newest last, at most 6; guesses never enter it (FR-087). */
  levelRecent: z.array(outcomeSchema),
  /** Targets solved alone since the level last changed; at level 5 the X shape gets two empty squares after 2. */
  levelWins: z.number().int().min(0),
  /** Counters per level, keyed "1" to "5" (FR-090). */
  levels: z.record(z.string(), levelCountSchema),
});
export type Progress = z.infer<typeof progressSchema>;

export function emptyProgress(): Progress {
  return { version: 1, attempts: [], directions: {}, level: null, levelRecent: [], levelWins: 0, levels: {} };
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
  celebration: z.string(),
  // Amendment 20: added with defaults, so a locker room stored before them still loads (no migration).
  trail: z.string().default(STARTER.trail),
  goalEffect: z.string().default(STARTER.goalEffect),
  mascot: z.string().default(STARTER.mascot),
  // Amendment 20 part 2: the stadium and the weather, also with defaults.
  stadiumName: z.string().max(14).regex(/^[\p{L}\p{N} -]*$/u).default('Mathe-Arena'),
  stands: z.string().default(STARTER.stands),
  floodlight: z.string().default(STARTER.floodlight),
  weather: z.string().default(STARTER.weather),
  // Amendment 21: the game modes unlocked with stars (src/core/rewards/modes.ts), also with a default.
  modes: z.array(z.string()).default([]),
});
export type LockerRoom = z.infer<typeof lockerRoomSchema>;

/** A new player: no stars, the starter items, shirt number 10, no name, the celebration "Arme hoch", no trail, goal effect or mascot, the stadium "Mathe-Arena" with the usual stands and white floodlights, the evening, and no game mode unlocked. */
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
    celebration: STARTER.celebration,
    trail: STARTER.trail,
    goalEffect: STARTER.goalEffect,
    mascot: STARTER.mascot,
    stadiumName: 'Mathe-Arena',
    stands: STARTER.stands,
    floodlight: STARTER.floodlight,
    weather: STARTER.weather,
    modes: [],
  };
}

/** The five matches of a cup (amendment 13, FR-106): two group games, quarter final, semi final, final. */
export const CUP_MATCHES = 5;

/**
 * `mathsoccer.cup.v1`, version 1 (amendment 13, FR-106 to FR-112): the cup journey. `cup` is the number of the cup
 * being played (1 for the first); `stage` the next match, 0 (Gruppenspiel 1) to 4 (Finale); `tries` the lost tries of
 * that match; `scores` the results of the matches already won in this cup, one per stage before `stage`; `trophies` the
 * won cups, oldest first.
 */
export const cupSchema = z
  .object({
    version: z.literal(1),
    cup: z.number().int().min(1),
    stage: z.number().int().min(0).max(CUP_MATCHES - 1),
    tries: z.number().int().min(0),
    /** The child's goals and the opponent's: the hearts lost in the match. */
    scores: z.array(z.object({ goals: z.number().int().min(0), against: z.number().int().min(0).max(3) })),
    trophies: z.array(z.object({ cup: z.number().int().min(1), at: z.string() })),
  })
  .refine((c) => c.scores.length === c.stage, { message: 'one score per won match', path: ['scores'] });
export type Cup = z.infer<typeof cupSchema>;

/** No cup played yet: the first cup at its first group game. */
export function emptyCup(): Cup {
  return { version: 1, cup: 1, stage: 0, tries: 0, scores: [], trophies: [] };
}

/** A goalkeeper target (data-model "Target"). */
export const targetSchema = z.object({
  number: z.number().int(),
  hints: z.array(z.number().int()),
  directions: z.array(z.enum(DIRECTIONS)),
  level: z.literal(LEVELS),
  pattern: z.enum(PATTERNS),
  /** Formen or the X shape with two empty squares: the empty squares still to shoot after this one (FR-072). */
  queue: z.array(z.object({ number: z.number().int(), directions: z.array(z.enum(DIRECTIONS)) })).optional(),
  /** A cutout of level 6 (amendment 18): all its squares and the given ones; the filled ones are the other hints. */
  cutout: z.object({ squares: z.array(z.number().int()), given: z.array(z.number().int()) }).optional(),
});

/**
 * `mathsoccer.round.v1`, version 1: the running round, kept on refresh (data-model "Round"). No stored round means no
 * round to continue. The round is saved between shots, so a stored phase is `aiming` or `celebrating`. The rules
 * between fields (`roundRules`) make a damaged round invalid, so it is discarded on load.
 */
export const roundSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int(),
    roundType: z.enum(ROUND_TYPES),
    /** The length of a time challenge in minutes (FR-076); null for the other round types. */
    challengeMinutes: z.literal(CHALLENGE_MINUTES).nullable(),
    /** Goals per round at the round start (FR-052). */
    goalsPerRound: z.number().int().min(GOALS_PER_ROUND_MIN).max(GOALS_PER_ROUND_MAX),
    min: z.number().int(),
    max: z.number().int(),
    goals: z.number().int().min(0),
    hearts: z.number().int().min(0).max(3),
    missesInRow: z.number().int().min(0),
    helpStep: z.number().int().min(0).max(4),
    target: targetSchema.nullable(),
    /** How many targets the round has had; the seed of the next target derives from it. */
    targetCount: z.number().int().min(0),
    starsThisRound: z.number().int().min(0),
    elapsedMs: z.number().min(0),
    /** Play time when the current target appeared, for the attempt's response time (T043). */
    targetStartMs: z.number().min(0),
    /** All misses on the current target; `missesInRow` restarts after a lost heart, this does not. */
    targetMisses: z.number().int().min(0),
    /** Play times of the shots that missed the current target, for the guess rule (T043). */
    missTimes: z.array(z.number().min(0)),
    /** A cup match (amendment 13): its level, the goals that win it, and its cup and stage; null for the other round types. */
    cupMatch: z
      .object({
        level: z.literal(LEVELS),
        goals: z.number().int().min(CUP_GOALS_MIN).max(CUP_GOALS_MAX),
        cup: z.number().int().min(1),
        stage: z.number().int().min(0).max(CUP_MATCHES - 1),
      })
      .nullable(),
    /** The match mode (amendment 21): the usual game or the free kick with the wall; added with a default. */
    mode: z.enum(MATCH_MODES).default('normal'),
    /** The wall of "Freistoß mit Mauer" in front of the current target: its first and last column and its defenders. */
    wall: z
      .object({ from: z.number().int().min(0).max(9), to: z.number().int().min(0).max(9), defenders: z.number().int().min(3).max(5) })
      .nullable()
      .default(null),
    /** "Selbst ins Tor" (amendment 21, FR-143): the shots decided so far; 0 in the other modes. Added with a default. */
    shots: z.number().int().min(0).max(KEEPER_SHOTS).default(0),
    /** The opponent's shot at the current target in "Selbst ins Tor"; null in the other modes. Added with a default. */
    keeperShot: z
      .object({
        totalMs: z.number().positive(),
        leftMs: z.number().min(0),
        held: z.boolean(),
        result: z.enum(['saved', 'wrong', 'late']).nullable(),
        typed: z.number().int().nullable(),
        resultLeftMs: z.number().min(0),
      })
      .nullable()
      .default(null),
    phase: z.enum(['aiming', 'celebrating']),
  })
  .superRefine(roundRules);
export type StoredRound = z.infer<typeof roundSchema>;

/** Rules between the fields of a stored round: the range goes up, an aiming round has a target, it lies in the range, a wall belongs to the wall mode and a shot at the child in goal to the keeper mode. */
function roundRules(
  r: {
    phase: string;
    min: number;
    max: number;
    roundType: string;
    challengeMinutes: number | null;
    cupMatch: unknown;
    mode: string;
    wall: { from: number; to: number } | null;
    keeperShot: unknown;
    target: { number: number; queue?: Array<{ number: number }>; cutout?: { squares: number[] } } | null;
  },
  ctx: z.RefinementCtx,
): void {
  const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
  if (r.min >= r.max) issue('min must be below max', 'max');
  if (r.phase === 'aiming' && r.target === null) issue('an aiming round needs a target', 'target');
  if ((r.roundType === 'time') !== (r.challengeMinutes !== null)) issue('a time challenge, and only it, has minutes', 'challengeMinutes');
  if ((r.roundType === 'cup') !== (r.cupMatch !== null)) issue('a cup match, and only it, has a cup level', 'cupMatch');
  if (r.wall !== null && (r.mode !== 'wall' || r.wall.from > r.wall.to)) issue('a wall stands only in the wall mode, left to right', 'wall');
  if (r.keeperShot !== null && r.mode !== 'keeper') issue('a shot at the child in goal belongs to the keeper mode', 'keeperShot');
  const numbers = r.target ? [r.target.number, ...(r.target.queue ?? []).map((q) => q.number), ...(r.target.cutout?.squares ?? [])] : [];
  if (numbers.some((n) => n < r.min || n > r.max)) issue('target outside the range', 'target');
}

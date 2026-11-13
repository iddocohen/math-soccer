/**
 * The match state owner (research R7, data-model "Round", contracts/core-api.md `MatchController`), shaped after
 * math-tank's BattleController. React and Phaser read `getState()`, listen with `subscribe()` and send actions; they
 * never change the state. Every change creates a new state object, so `useSyncExternalStore` sees it.
 *
 * Phases: aiming --shoot(n in range)--> ballInFlight --ballLanded--> a goal goes on to celebrating, and
 * celebrationDone gives the next target or ends the round; a miss returns to aiming. roundOver ends the round, at 0
 * hearts (`untilHearts`), at `goalsPerRound` goals (`goalCount`), or when the countdown of a time challenge ends
 * (`time`).
 *
 * Time challenge (amendment 07, FR-075 to FR-080): `start('time')` starts a round of the challenge minutes from the
 * parent's settings. The countdown is the challenge time minus the time played, so it stops exactly when the round
 * clock does (FR-078: paused, a parent screen or the locker room open, or the tab hidden) and a refresh continues it from
 * the stored time played. There are no hearts, so misses cost only time. At zero a round that aims ends at once; a ball
 * in flight still lands and counts, and a goal is still celebrated, and then the round ends.
 *
 * The goalkeeper game (T029, T053, amendment 05, FR-019, FR-020): targets come from `nextTarget`, with the hint numbers
 * of a hint pattern lit in the grid around an empty target square. The target number is a goal worth `STARS.goal`; any
 * other number is a miss whose square shows its number for SHOWN_MS (FR-004) and raises the help step. After the
 * difficulty's number of misses in a row a heart is lost, the target stays and help jumps to the answer (FR-027). The
 * keeper's dive and catch are drawn by KeeperView from this state; the controller does not track the keeper. The round
 * is saved between shots so a refresh continues it (FR-036a: a stored round for another range is discarded).
 *
 * Help (T038, T096, FR-024, FR-025, amendment 10): H, the help button and each miss raise the help step up to 4: the
 * row, the column, the help chart, the answer. Step 3 opens the help chart; Enter, Space, Escape or a tap close it, and that Enter does not shoot. Help never changes hearts, stars or
 * goals. What each step shows comes from help.ts.
 *
 * Settings saved during a round (amendment 01, FR-052, after math-tank's `applySettingsNow`): `applySettings` takes them
 * into the running round. Round type and goals per round keep their round-start values. When a target-shaping setting
 * changed (TARGET_KEYS), the round gets a new target on the board of the new range; goals, hearts, stars, time and
 * the paused state stay, and the dropped target records no attempt. While the ball flies or the goal is celebrated,
 * the new target waits until the round is back in 'aiming' and the landing feedback has finished: after a miss that is
 * SHOWN_MS of play time, so the scene still reads the landed ball, the message and the shown square right after
 * `ballLanded`.
 *
 * "Zum Start" (amendment 14, FR-118): `abandon()` drops the round without a round end; see there.
 *
 * Cup match (amendment 13, FR-108, FR-109): `startCup()` starts a round of type 'cup' with the level and the goals of the
 * match (core/cup). Hearts work as in `untilHearts`. Every target uses the match level, whatever the child's current
 * level is, so adaptive difficulty never changes the level inside the match. The round ends won at the match's goals
 * (`cupMatchWon`), or lost when the hearts are gone. The app records the result in the cup.
 *
 * Cutouts (amendment 18, FR-125 to FR-128): a level 6 target is one empty square of a cutout. A correct number on a square
 * that is not the cutout's last one fills it: the ball lands on the square with the outcome 'filled', `STARS.cutoutFill` are
 * earned, the attempt is recorded, and the next square becomes the target at once, with no goal and no celebration.
 * The keeper does not take part (the scene reads `isCutoutFill`). The last square is a normal shot: a goal with the
 * celebration and `STARS.goal` plus `STARS.cutoutBonus`, and the one goal of the cutout for the goal count and the cup.
 * Misses, hearts and help work per square, as for any target.
 *
 * "Freistoß mit Mauer" (amendment 21, FR-142): `start('wall')` starts a round in the match mode 'wall' with the parent's
 * round type. Every new target gets a wall of defenders over a band of free columns (core/match/wall.ts); after a
 * filled square of a cutout the wall stays, after a goal it moves. A shot at a number behind the wall lands with the
 * outcome 'blocked' and the message 'blocked': it counts as a miss in every way (misses, hearts, help), and the square of
 * the typed number shows its number as after any miss. The start kinds and their modes live in core/match/rounds.ts.
 *
 * "Selbst ins Tor" (amendment 21, FR-143 to FR-146): `start('keeper')` starts a round in the match mode 'keeper'. The
 * child is the goalkeeper and an opponent shoots at the target square (core/match/keeper.ts). There is no ball of the
 * child and no celebration: the phase stays 'aiming' until the round ends, and `play.shot` carries the shot.
 * - While the shot flies its `leftMs` counts down with the time played; help holds it until the next key (FR-145), and
 *   the open help chart holds it too. Typing works the whole flight; Enter decides the shot with the typed number.
 * - The target number saves: one more save (`goals`) and `STARS.save`. A wrong number, or none before `leftMs`
 *   reaches 0 ('late'), concedes: the target square shows its number. Out-of-range numbers are not shot, as always.
 * - A decided shot shows for KEEPER_RESULT_MS of play time, then the next shot comes, or the round ends after
 *   KEEPER_SHOTS shots. Hearts and the round type play no part. These shots record no attempts, because the squares
 *   follow the level in reverse and are not targets of the child's level.
 *
 * "Elfmeterschießen" (amendment 21 part 3, FR-147, FR-148): `start('shootout')` starts a round in the match mode
 * 'shootout' against a cup team (`keeperOpponent`). `play.kicks` holds the kicks of both sides (core/match/shootout.ts):
 * side 0 is the child, side 1 the opponent, and the turn is `nextSide(kicks)`.
 * - The child's turn plays as "Spielen": a target of his level from `nextTarget`, help as usual, one shot. The target
 *   number scores (the celebration follows, then the opponent's turn); any other number is a miss of the kick: its
 *   square shows its number, and after the `afterMiss` wait (SHOWN_MS) of play time the opponent's turn comes. Hearts, the
 *   round type and the goal count play no part. Both record an attempt, as any finished target does.
 * - The opponent's turn plays as "Selbst ins Tor": `play.shot` flies at a square of `keeperTarget`, the first one of
 *   the round at the slow speed. A save is a miss of the opponent; a wrong number or none in time is his goal. The
 *   opponent never misses on his own. These shots record no attempts.
 * - Shapes and cutouts do not go on across turns: each kick of the child has a new target.
 * - After SHOOTOUT_ROUNDS rounds, or a round of sudden death, with one side ahead the round ends. A win earns
 *   `STARS.shootoutWin`; goals and saves earn none, and a loss takes nothing away. `goals` counts the child's goals.
 *
 * "Torwandschießen" (amendment 23, FR-155 to FR-157): `start('torwand')` starts a round in the match mode 'torwand'. A
 * board covers the goal with two or three holes (`play.holes`, core/match/torwand.ts); the target is one of them and
 * has fewer hints than usual. There is no keeper. Each shot ends its target, and the holes move:
 * - the target number scores, is celebrated and earns `STARS.goal`;
 * - the number of a decoy hole flies through it and misses ('decoy'), any other number hits the board ('miss'); either
 *   way its square shows its number, and after the `afterMiss` wait (SHOWN_MS) of play time the next target comes.
 * - After TORWAND_SHOTS shots (`shots`) the round ends. Hearts and the round type play no part. Every shot records an
 *   attempt.
 *
 * "Papa gegen Kind" (amendment 23, FR-158 to FR-161): `start('family', setup)` starts a shootout in the match mode
 * 'family'. Side 0 is the child, side 1 the grown-up (`play.name`, `play.level`); both shoot as the child does in
 * the shootout, against the computer keeper.
 * - Before each kick the round waits for the turn card (`turnCard`): it names the shooter, and Enter or a tap (`startTurn`) hides it.
 *   While it shows nothing is typed, shot or asked.
 * - The grown-up's targets use his level; the child's use the child's level.
 * - Only the child's kicks record attempts, count as `goals` and earn `STARS.goal` per goal; his win adds
 *   `STARS.familyWin`. The grown-up's kicks record nothing.
 *
 * Views get a deep read-only view of the state (`MatchView`). In development builds `set()` checks the rules between
 * fields the types do not hold (`matchInvariantErrors`) and throws when one is broken. The state is a union per phase,
 * and what only one kind of round has lives in the tagged field `play` (refactor R2).
 *
 * Events (refactor R1): every listener of `subscribe` gets the events of the change (`MatchEvent`), so the views act on
 * what happened instead of comparing states. One change can carry several events, in this order: `roundStarted`,
 * `shot`, `landed`, `keeperShotDecided`, `levelUp`, `starsEarned`, `targetChanged`, `roundEnded`.
 *
 * Pause reasons (refactor R1): `pause(reason)` and `resume(reason)` keep a set of reasons. The clock runs only while the
 * set is empty. The child, a parent screen and the locker room over the match also pause play (`paused`: keys, the
 * scene and the help chart stop); the cup's intro card and a hidden tab only stop the clock. A new round, a restored
 * round and "Zum Start" drop the child's pause; the other reasons belong to the app and stay until it resumes them.
 */
import { layoutChart } from '../chart/layout';
import { createRng, deriveSeed } from '../rng';
import { newStars, starsAfter } from '../rewards/lockerRoom';
import { MISSES_PER_HEART, type ChallengeMinutes, type Level } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { makeAttemptRecord } from '../progress/attempt';
import type { AttemptRecord, StoredRound } from '../storage/schemas';
import { nextInShape, NO_PROGRESS, nextTarget, type TargetProgress } from '../targets/nextTarget';
import { isCutoutFill, type DeepReadonly, type RoundType, type Target } from '../types';
import { entryReducer, entryValue, maxDigitsOf, type EntryKey } from './entry';
import { ANSWER_STEP, CHART_STEP } from './help';
import { START_KIND_INFO, roundTypeOf, type ControllerKind, type MatchMode } from './rounds';
import { placeWall, wallBlocks, wallClear, type Wall } from './wall';
import { flightMsOf, KEEPER_RESULT_MS, KEEPER_SHOTS, keeperTarget, newShot, shotResult, type KeeperShot } from './keeper';
import { addKick, emptyKicks, nextSide, shootoutWinner, type Kick, type ShootoutKicks } from './shootout';
import { torwandHit, torwandHoles, torwandTarget, TORWAND_SHOTS } from './torwand';
import { defaultFamilySetup, type FamilySetup } from './family';

export type Phase = 'aiming' | 'ballInFlight' | 'celebrating' | 'roundOver';

/** How long the square of a missed number shows its number (FR-004: at least 1.5 seconds). */
export const SHOWN_MS = 1500;

/** Time played is saved with the round at most this often, so ticks do not write storage on every frame. */
const SAVE_TIME_EVERY_MS = 1000;

/** What the message line says; the app turns it into German text. */
export type MatchMessage =
  | { kind: 'outOfRange'; min: number; max: number }
  | { kind: 'goal' }
  /** A square of a cutout filled with the correct number (amendment 18). */
  | { kind: 'filled'; number: number }
  /** A goal that raised the difficulty level (FR-088); a level going down shows nothing. */
  | { kind: 'levelUp'; level: Level }
  | { kind: 'miss'; number: number }
  /** A shot at a number behind the wall of "Freistoß mit Mauer" (amendment 21): a miss. */
  | { kind: 'blocked'; number: number }
  /** "Selbst ins Tor" (amendment 21): a save, a wrong number with the target's number, or a shot not answered in time. */
  | { kind: 'saved' }
  | { kind: 'conceded'; number: number }
  | { kind: 'late'; number: number }
  /** "Elfmeterschießen" (amendment 21): the child's kick missed; his turn is over. */
  | { kind: 'kickMissed'; number: number }
  /** "Torwandschießen" (amendment 23): the ball went through a decoy hole, or hit the board. */
  | { kind: 'decoy'; number: number }
  | { kind: 'board'; number: number }
  | { kind: 'heartLost'; number: number };

/**
 * The ball after a shot: the typed number and, once landed, whether it scored, filled a square of a cutout (no goal,
 * amendment 18), missed, or hit the wall of "Freistoß mit Mauer" (a miss too, amendment 21). In "Torwandschießen" a
 * miss hits the board, and 'decoy' flies through a decoy hole (amendment 23).
 */
export interface Ball {
  number: number;
  outcome: 'goal' | 'filled' | 'miss' | 'blocked' | 'decoy' | null;
  /** Play time of the shot (`elapsedMs`), for the attempt record. */
  atMs: number;
}

/**
 * What happened in one state change, for the views (refactor R1):
 * - `roundStarted`: `start`, `startCup` or `restore` began a round;
 * - `shot`: the child's ball flies (phase 'ballInFlight');
 * - `landed`: the ball arrived, with its outcome;
 * - `keeperShotDecided`: the opponent's shot was saved, conceded or came too late;
 * - `levelUp`: a scored target raised the child's level (FR-088);
 * - `starsEarned`: `starsThisRound` grew by `n`; a started or restored round earns none;
 * - `targetChanged`: a new target, also the first one of a round;
 * - `roundEnded`: the round reached 'roundOver'.
 */
export type MatchEvent =
  | { type: 'roundStarted' }
  | { type: 'shot' }
  | { type: 'landed'; outcome: NonNullable<Ball['outcome']> }
  | { type: 'keeperShotDecided' }
  | { type: 'levelUp'; level: Level }
  | { type: 'starsEarned'; n: number }
  | { type: 'targetChanged' }
  | { type: 'roundEnded' };

/**
 * Why the round is paused: the child (Escape, the pause or home button), a parent screen or the transfer dialog, the
 * locker room over the match, the cup's intro card, or a hidden tab.
 */
export type PauseReason = 'child' | 'parent' | 'lockerRoom' | 'cupIntro' | 'hidden';

/** The reasons that only stop the clock; the round stays playable. */
const CLOCK_ONLY_REASONS: ReadonlySet<PauseReason> = new Set<PauseReason>(['cupIntro', 'hidden']);

/** A missed square that shows its number until `remainingMs` of play time has passed (FR-004). */
export interface ShownSquare {
  number: number;
  remainingMs: number;
}

/**
 * The target the child just scored, for the round end; the full attempt record goes to `onAttempt` (T043).
 * `solved` is false when the goal came after help step 4, the answer (FR-025b, FR-094).
 */
export interface FinishedAttempt {
  number: number;
  solved: boolean;
  /** The highest help step used on the target, 0 to 4. */
  helpStep: number;
}

/**
 * What only one kind of round has (refactor R2), tagged by `kind`; the match mode derives from it (`modeOf`):
 * - `normal`, `time` and `cup` play the usual game. A time challenge has its length in minutes (FR-076), a cup match
 *   the level of its targets and the goals that win it (FR-108, FR-109).
 * - `wall`: the wall in front of the current target, null when no column is free (amendment 21).
 * - `keeper`: the opponent's shot at the current target, null after the round ("Selbst ins Tor").
 * - `shootout`: the kicks of the child (side 0) and the opponent (side 1), and the opponent's shot on his turn
 *   ("Elfmeterschießen").
 * - `torwand`: the holes of the board, the target's first ("Torwandschießen", amendment 23).
 * - `family`: the kicks of the child and the grown-up, and the grown-up's name and level ("Papa gegen Kind").
 */
export type Play =
  | { kind: 'normal' }
  | { kind: 'time'; minutes: ChallengeMinutes }
  | { kind: 'cup'; match: CupMatchSetup }
  | { kind: 'wall'; wall: Wall | null }
  | { kind: 'keeper'; shot: KeeperShot | null }
  | { kind: 'shootout'; kicks: [Kick[], Kick[]]; shot: KeeperShot | null }
  | { kind: 'torwand'; holes: number[] }
  | { kind: 'family'; kicks: [Kick[], Kick[]]; name: string; level: Level };

export type PlayKind = Play['kind'];

/**
 * What the round waits for before the child can type, shoot or ask again (refactor R2): `afterMiss` while the square
 * of a missed kick or a missed shot at the board shows its number, for `ms` more play time; `turnCard` while the turn
 * card of "Papa gegen Kind" shows, until `startTurn`.
 */
export type Wait = { reason: 'afterMiss'; ms: number } | { reason: 'turnCard' };

/** A ball in flight: the typed number, no outcome yet. */
export type FlyingBall = Ball & { outcome: null };

/** A ball that arrived, with its outcome. */
export type LandedBall = Ball & { outcome: NonNullable<Ball['outcome']> };

/**
 * The fields that depend on the phase (review H4): a ball without an outcome exists exactly in 'ballInFlight', the
 * celebration follows a goal, and no missed square shows after the round ended.
 */
type PhaseFields =
  | { phase: 'aiming'; ball: LandedBall | null; shown: ShownSquare | null }
  | { phase: 'ballInFlight'; ball: FlyingBall; shown: ShownSquare | null }
  | { phase: 'celebrating'; ball: LandedBall & { outcome: 'goal' }; shown: ShownSquare | null }
  | { phase: 'roundOver'; ball: LandedBall | null; shown: null };

interface MatchFields {
  /** False before the first `start()`. */
  started: boolean;
  roundType: RoundType;
  /** What only this kind of round has; `modeOf` gives the match mode. */
  play: Play;
  /** What the round waits for before play goes on; null when nothing waits. */
  wait: Wait | null;
  /** "Selbst ins Tor" and "Torwandschießen": the shots decided so far, up to KEEPER_SHOTS or TORWAND_SHOTS; 0 otherwise. */
  shots: number;
  seed: number;
  min: number;
  max: number;
  paused: boolean;
  /** Digits typed so far, '' when none. */
  entry: string;
  message: MatchMessage | null;
  target: Target | null;
  /** How many targets the round has had; the next target's random numbers derive from the seed and this count. */
  targetCount: number;
  goals: number;
  /** 3 down to 0; used with `untilHearts`. */
  hearts: number;
  missesInRow: number;
  /** 0 to 4: none, row, column, help chart, answer (help.ts). */
  helpStep: number;
  /** The help chart of step 3 is open (FR-025a). */
  helpChartOpen: boolean;
  /** The last number shot at the current target, marked on the help chart; null before the first miss. */
  lastGuess: number | null;
  /** The last target scored in this round, or null. */
  lastAttempt: FinishedAttempt | null;
  starsThisRound: number;
  /** Time played, not counted while paused or after the round. */
  elapsedMs: number;
  /** Play time when the current target appeared (T043). */
  targetStartMs: number;
  /** All misses on the current target; `missesInRow` restarts after a lost heart, this does not (T043). */
  targetMisses: number;
  /** Play times of the newest misses on the current target, for the guess rule (T043). */
  missTimes: number[];
}

/** The match state: the fields of every phase, and those that depend on the phase. */
export type MatchState = MatchFields & PhaseFields;

/** The match state in phase `P`. */
type StateIn<P extends Phase> = Extract<MatchState, { phase: P }>;

/**
 * The match state as React and Phaser read it from `getState()`: they cannot change it. It is a union per phase, so a
 * ball without an outcome exists only in flight and the round end shows no missed square.
 */
export type MatchView = DeepReadonly<MatchState>;

/** The match mode of a round with `play`: 'normal' for the usual game, the time challenge and the cup. */
export function modeOf(s: { play: { kind: PlayKind } }): MatchMode {
  const { kind } = s.play;
  return kind === 'time' || kind === 'cup' ? 'normal' : kind;
}

/** The play of `s` when it is of kind `kind`, else null. */
export function playOf<P extends { kind: PlayKind }, K extends P['kind']>(s: { play: P }, kind: K): Extract<P, { kind: K }> | null {
  return s.play.kind === kind ? (s.play as Extract<P, { kind: K }>) : null;
}

type ShotOf<P> = P extends { shot: infer S } ? S : never;
type KicksOf<P> = P extends { kicks: infer K } ? K : never;

/** The opponent's shot: in "Selbst ins Tor", and in "Elfmeterschießen" on the opponent's turn; null otherwise. */
export function keeperShotOf<P extends { kind: PlayKind }>(s: { play: P }): ShotOf<P> | null {
  return 'shot' in s.play ? (s.play.shot as ShotOf<P>) : null;
}

/** The kicks of a shootout ("Elfmeterschießen", "Papa gegen Kind"); null in the other modes. */
export function kicksOf<P extends { kind: PlayKind }>(s: { play: P }): KicksOf<P> | null {
  return 'kicks' in s.play ? (s.play.kicks as KicksOf<P>) : null;
}

/** True while a decided shot of the opponent shows its result: nothing is typed or asked. */
function shotDecided(s: { play: Play }): boolean {
  const shot = keeperShotOf(s);
  return shot !== null && shot.result !== null;
}

/** `play` with the opponent's shot `shot`; a play without a shot stays as it is. */
function withShot(play: Play, shot: KeeperShot | null): Play {
  return play.kind === 'keeper' || play.kind === 'shootout' ? { ...play, shot } : play;
}

/** `play` with the kicks `kicks`; a play without kicks stays as it is. */
function withKicks(play: Play, kicks: [Kick[], Kick[]]): Play {
  return play.kind === 'shootout' || play.kind === 'family' ? { ...play, kicks } : play;
}

/**
 * The rules between fields the types do not hold, as messages; an empty list means the state is consistent: the
 * child shoots no ball in the mode 'keeper' or while the opponent shoots.
 */
export function matchInvariantErrors(s: MatchState): string[] {
  const errors: string[] = [];
  if (s.play.kind === 'keeper' && s.ball !== null) errors.push('a ball of the child in the keeper mode');
  if (keeperShotOf(s) !== null && s.ball !== null) errors.push('a ball of the child while the opponent shoots');
  return errors;
}

/**
 * True when `b` differs from `a` only in the time played, the shown square's time left, the time left of the
 * opponent's shot and the time left of the wait, as after a `tick` that changed nothing else. The views skip such
 * states, except the clock; the scene reads the shot's time left on every frame.
 */
export function onlyTimeChanged(a: MatchView, b: MatchView): boolean {
  if (a.elapsedMs === b.elapsedMs && a.shown === b.shown && a.play === b.play && a.wait === b.wait) return false;
  if (a.shown?.number !== b.shown?.number) return false;
  if (a.wait?.reason !== b.wait?.reason) return false;
  if (a.play !== b.play) {
    // Only the opponent's shot counts down inside the play; any other change of the play is not a matter of time.
    if (a.play.kind !== b.play.kind || keeperShotOf(a) === null || kicksOf(a) !== kicksOf(b) || !sameShot(keeperShotOf(a), keeperShotOf(b))) return false;
  }
  for (const key of Object.keys(b) as Array<keyof MatchView>) {
    if (!TIMED_KEYS.has(key) && a[key] !== b[key]) return false;
  }
  return true;
}

/** The fields a `tick` changes; `onlyTimeChanged` compares them on their own. */
const TIMED_KEYS = new Set<keyof MatchView>(['elapsedMs', 'shown', 'play', 'wait']);

/** True when two shots differ at most in their time left. */
function sameShot(a: DeepReadonly<KeeperShot> | null, b: DeepReadonly<KeeperShot> | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.totalMs === b.totalMs && a.held === b.held && a.result === b.result && a.typed === b.typed;
}

/** Where the running round is kept (`mathsoccer.round.v1`); the app connects browser storage. */
export interface RoundStore {
  load(): StoredRound | null;
  save(round: StoredRound): void;
  clear(): void;
}

export interface MatchControllerOptions {
  /** Read on every `start()` and `restore()`; settings saved during a round reach it through `applySettings`. */
  settings: () => Settings;
  /** A new round seed; defaults to the clock. */
  newSeed?: () => number;
  /** The next target for the round; defaults to `nextTarget` from core/targets with the round's seeded `Rng`. */
  nextTarget?: (state: MatchState) => Target | null;
  /** The child's progress for target selection; T042 connects it. */
  progress?: () => TargetProgress;
  /** Saves the round so a refresh continues it; no saving without it. */
  store?: RoundStore;
  /**
   * Receives one record per finished target: scored, or left when the round ended (T043, FR-037). Returns the new
   * level when the record raised the child's level (FR-088), else null or nothing.
   */
  onAttempt?: (record: AttemptRecord) => Level | null | void;
  /** The wall clock for the records' `at`; defaults to now. */
  now?: () => Date;
}

export const START_HEARTS = 3;

/** The match state fields a stored round keeps; `phase` and `goalsPerRound` are saved and restored on their own. */
const STORED_KEYS = [
  'seed',
  'roundType',
  'play',
  'wait',
  'shots',
  'min',
  'max',
  'goals',
  'hearts',
  'missesInRow',
  'helpStep',
  'target',
  'targetCount',
  'starsThisRound',
  'elapsedMs',
  'targetStartMs',
  'targetMisses',
  'missTimes',
] as const satisfies ReadonlyArray<keyof MatchState & keyof StoredRound>;

type StoredFields = Pick<MatchState, (typeof STORED_KEYS)[number]>;

function storedFields(from: StoredFields): StoredFields {
  return Object.fromEntries(STORED_KEYS.map((key) => [key, from[key]])) as unknown as StoredFields;
}

/** The fields every new target starts from: no misses in a row, no help, no shown square. */
const TARGET_RESET = {
  missesInRow: 0,
  helpStep: 0,
  helpChartOpen: false,
  lastGuess: null,
  shown: null,
} as const satisfies Partial<MatchState>;

/**
 * What a cup match needs (core/cup `nextMatch`): the level of its targets and the goals that win it. `cup` and `stage`
 * name the match in the cup, so the app can tell when the cup was replaced during the match.
 */
export interface CupMatchSetup {
  level: Level;
  goals: number;
  cup: number;
  stage: number;
}

/** True when the cup match of `s` has ended won: its goals were scored before the hearts were gone (FR-108). */
export function cupMatchWon(s: { play: DeepReadonly<Play>; goals: number }): boolean {
  return s.play.kind === 'cup' && s.goals >= s.play.match.goals;
}

/** The length of the time challenge of `s` in milliseconds, or null for another round type. */
export function challengeMs(s: { play: DeepReadonly<Play> }): number | null {
  return s.play.kind === 'time' ? s.play.minutes * 60_000 : null;
}

/** The time left of a time challenge, never below 0; null for another round type. */
export function remainingMs(s: { play: DeepReadonly<Play>; elapsedMs: number }): number | null {
  const total = challengeMs(s);
  return total === null ? null : Math.max(0, total - s.elapsedMs);
}

/** True when the countdown of a time challenge has reached zero. */
function timeUp(s: MatchState): boolean {
  return remainingMs(s) === 0;
}

/** The play of a new round in the match mode `mode`. */
function freshPlay(mode: MatchMode, roundType: RoundType, s: Settings, cupMatch: CupMatchSetup | null, family: FamilySetup | null): Play {
  switch (mode) {
    case 'normal':
      if (cupMatch !== null) return { kind: 'cup', match: { ...cupMatch } };
      return roundType === 'time' ? { kind: 'time', minutes: s.timeChallenge.minutes } : { kind: 'normal' };
    case 'wall':
      return { kind: 'wall', wall: null };
    case 'keeper':
      return { kind: 'keeper', shot: null };
    case 'shootout':
      return { kind: 'shootout', kicks: emptyKicks(), shot: null };
    case 'torwand':
      return { kind: 'torwand', holes: [] };
    case 'family': {
      const grownup = family ?? defaultFamilySetup();
      return { kind: 'family', kicks: emptyKicks(), name: grownup.name, level: grownup.level };
    }
  }
}

function freshState(
  s: Settings,
  seed: number,
  started: boolean,
  kind: ControllerKind = 'play',
  cupMatch: CupMatchSetup | null = null,
  family: FamilySetup | null = null,
): StateIn<'aiming'> {
  const roundType = cupMatch !== null ? 'cup' : roundTypeOf(kind, s);
  const play = freshPlay(cupMatch !== null ? 'normal' : START_KIND_INFO[kind].mode, roundType, s, cupMatch, family);
  return {
    started,
    roundType,
    play,
    // "Papa gegen Kind" starts with the turn card of the first shooter (FR-158).
    wait: play.kind === 'family' ? { reason: 'turnCard' } : null,
    shots: 0,
    seed,
    min: s.range.min,
    max: s.range.max,
    phase: 'aiming',
    paused: false,
    entry: '',
    message: null,
    ball: null,
    target: null,
    targetCount: 0,
    shown: null,
    goals: 0,
    hearts: START_HEARTS,
    missesInRow: 0,
    helpStep: 0,
    helpChartOpen: false,
    lastGuess: null,
    lastAttempt: null,
    starsThisRound: 0,
    elapsedMs: 0,
    targetStartMs: 0,
    targetMisses: 0,
    missTimes: [],
  };
}

/** The settings that shape targets: a change gives the running round a new target (FR-052). */
const TARGET_KEYS = [
  'range',
  'hintDisplay',
  'hintDistance',
  'levels',
  'shapes',
  'difficulty',
  'adaptive',
  'pointAfterFullHelp',
] as const satisfies ReadonlyArray<keyof Settings>;

/** The settings that shape the whole round; they keep their round-start values until the next round (FR-052). */
const ROUND_KEYS = ['roundType', 'goalsPerRound'] as const satisfies ReadonlyArray<keyof Settings>;

/** True when a target-shaping setting differs between `a` and `b`. */
function changesTargets(a: Settings, b: Settings): boolean {
  return TARGET_KEYS.some((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
}

/** Mixed into the seed of each wall, so the wall's random numbers differ from those of the target. */
const WALL_SEED = 0x3a11;
/** Mixed into the seeds of the board's holes and hints in "Torwandschießen" (amendment 23). */
const TORWAND_SEED = 0x70a1;

/** The guess rule looks at misses within the last 5 seconds; this many are enough to keep (classify.ts). */
const MISS_TIMES_KEPT = 5;

/** Who shoots at the current target: the child, the opponent at the child in goal, or the grown-up of "Papa gegen Kind". */
export type Turn = 'child' | 'opponent' | 'grownup';

/**
 * Whose turn it is in `s`: the opponent always in "Selbst ins Tor"; in a shootout side 0 is the child and side 1 the
 * opponent ("Elfmeterschießen") or the grown-up ("Papa gegen Kind"), null once it is over; the child in the other modes.
 */
export function turnOf(s: { play: DeepReadonly<Play> }): Turn | null {
  const { play } = s;
  if (play.kind === 'keeper') return 'opponent';
  if (play.kind !== 'shootout' && play.kind !== 'family') return 'child';
  const side = nextSide(play.kicks);
  if (side === null) return null;
  if (side === 0) return 'child';
  return play.kind === 'family' ? 'grownup' : 'opponent';
}

export class MatchController {
  private state: MatchState;
  private readonly listeners = new Set<(events: readonly MatchEvent[]) => void>();
  /** Events of the change being built; `set()` sends them with the new state. */
  private queued: MatchEvent[] = [];
  /** Why the round is paused; the clock runs only while this is empty. */
  private readonly pauseReasons = new Set<PauseReason>();
  private readonly options: MatchControllerOptions;
  /** The settings the running round uses: those of its start, updated by `applySettings` (FR-052). */
  private roundSettings: Settings;
  /** True while saved target-shaping settings wait for the round to be back in 'aiming' (FR-052). */
  private newTargetPending = false;
  /**
   * Play time left of the landing feedback of the last miss or decided shot; a pending new target waits for it, and
   * for a running `afterMiss` wait.
   */
  private feedbackMs = 0;

  constructor(options: MatchControllerOptions) {
    this.options = options;
    this.roundSettings = options.settings();
    this.state = freshState(this.roundSettings, 0, false);
  }

  getState(): MatchView {
    return this.state;
  }

  /** The settings the running round uses; round type and goals per round are those of the round start (FR-052). */
  getRoundSettings(): Settings {
    return this.roundSettings;
  }

  /**
   * Takes settings saved during the round into it (FR-052). Round type and goals per round keep their round-start
   * values. A target-shaping change gives a new target, now or once the ball has landed or the celebration ended; other
   * changes only give a new state object, so the views read the new settings. Before a round or after it ends nothing
   * changes: the next `start()` reads the settings.
   */
  applySettings(settings: Settings): void {
    const s = this.state;
    if (!s.started || s.phase === 'roundOver') return;
    const merged: Settings = structuredClone(settings);
    for (const key of ROUND_KEYS) (merged as Record<string, unknown>)[key] = this.roundSettings[key];
    const rebuild = changesTargets(this.roundSettings, merged);
    this.roundSettings = merged;
    if (rebuild) this.newTargetPending = true;
    // set() gives the new target when the round aims and no landing feedback runs.
    this.set({ ...s });
  }

  /**
   * The round on the board of the round settings' range with a new target. Goals, hearts, stars, time and the
   * paused state stay; the unfinished target is dropped without an attempt record.
   */
  private withNewSettings(s: StateIn<'aiming'>): MatchState {
    this.newTargetPending = false;
    return this.withNextTarget({
      ...s,
      ...TARGET_RESET,
      min: this.roundSettings.range.min,
      max: this.roundSettings.range.max,
      entry: '',
      message: null,
      ball: null,
      target: null,
    });
  }

  /** Calls `fn` after every state change, with the events of the change; returns a function that stops it. */
  subscribe(fn: (events: readonly MatchEvent[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Starts a new round with the current settings: a normal round, a time challenge with `'time'` (FR-075), or the free
   * kick with the wall with `'wall'` (FR-142).
   */
  start(kind: ControllerKind = 'play', family: FamilySetup | null = null): void {
    this.begin(kind, null, family);
  }

  /**
   * Starts a cup match (amendment 13, FR-108): hearts as in "Bis die Bälle weg sind", every target at `match.level`, won
   * at `match.goals` goals.
   */
  startCup(match: CupMatchSetup): void {
    this.begin('play', match);
  }

  /** A new round with the current settings and a new seed: a normal round, a time challenge or a cup match. */
  private begin(kind: ControllerKind, cupMatch: CupMatchSetup | null, family: FamilySetup | null = null): void {
    this.clearPending();
    this.roundSettings = this.options.settings();
    const seed = this.options.newSeed?.() ?? Date.now() % 2_147_483_647;
    this.queued.push({ type: 'roundStarted' });
    this.set(this.withNextTarget(freshState(this.roundSettings, seed, true, kind, cupMatch, family)));
  }

  /** "Papa gegen Kind": hides the turn card, so the shooter can aim (Enter or a tap on the card). */
  startTurn(): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase !== 'aiming' || s.wait?.reason !== 'turnCard') return;
    this.set({ ...s, wait: null }, { save: false });
  }

  /**
   * Drops a waiting settings change, the landing feedback's wait and the child's pause: a round starts, comes back or
   * ends.
   */
  private clearPending(): void {
    this.newTargetPending = false;
    this.feedbackMs = 0;
    this.pauseReasons.delete('child');
  }

  /**
   * Continues the stored round after a refresh. Returns false, and deletes the stored round, when there is none or it
   * no longer fits the settings: another range (FR-036a), a time challenge the parent no longer allows (amendment 07), or
   * a mode the parent turned off in "Spielarten erlauben" (amendment 21).
   */
  restore(): boolean {
    const store = this.options.store;
    const stored = store?.load() ?? null;
    if (!store || !stored) return false;
    const s = this.options.settings();
    const challengeOff = stored.roundType === 'time' && !s.timeChallenge.allowed;
    const mode = modeOf(stored);
    const modeOff = mode !== 'normal' && !s.modesAllowed[mode];
    if (stored.min !== s.range.min || stored.max !== s.range.max || challengeOff || modeOff) {
      store.clear();
      return false;
    }
    this.clearPending();
    // Round type and goals per round keep their round-start values across a refresh (FR-052).
    const roundType = stored.roundType === 'time' || stored.roundType === 'cup' ? s.roundType : stored.roundType;
    this.roundSettings = { ...s, roundType, goalsPerRound: stored.goalsPerRound };
    const state: StateIn<'aiming'> = { ...freshState(this.roundSettings, stored.seed, true), ...storedFields(stored), phase: 'aiming' };
    this.queued.push({ type: 'roundStarted' });
    // A round saved during the celebration goes on as if the celebration had ended.
    if (stored.phase === 'celebrating') this.set(this.afterCelebration(state));
    else this.set(state);
    return true;
  }

  /**
   * One key of the match: digits and Backspace edit the entry, Enter shoots, H asks for help, Escape pauses. While the
   * help chart is open, Enter and Escape only close it, and a digit or Backspace closes it and edits the entry.
   */
  typeKey(key: EntryKey): void {
    if (!this.state.started) return;
    // A held shot of "Selbst ins Tor" flies on with the next key after help (FR-145).
    const shot = keeperShotOf(this.state);
    if (shot?.held && !this.state.paused && key !== 'help' && key !== 'escape') {
      this.set({ ...this.state, play: withShot(this.state.play, { ...shot, held: false }) }, { save: false });
    }
    if (this.state.helpChartOpen && key !== 'help') {
      this.closeHelpChart();
      if (key === 'escape' || key === 'enter') return;
    }
    if (key === 'escape') {
      if (this.state.paused) this.resume('child');
      else this.pause('child');
      return;
    }
    if (this.state.paused) return;
    if (key === 'enter') {
      this.shoot();
      return;
    }
    if (key === 'help') {
      this.askHelp();
      return;
    }
    if (this.state.phase !== 'aiming') return;
    // Between two shots of "Selbst ins Tor", after a missed kick or shot at the board, and under the turn card, no
    // number is typed.
    if (shotDecided(this.state)) return;
    if (this.state.wait !== null) return;
    const entry = entryReducer(this.state.entry, key, maxDigitsOf(this.state));
    if (entry !== this.state.entry) this.set({ ...this.state, entry }, { save: false });
  }

  /**
   * Shoots the typed number. A number outside the range is not shot; the message names the range (FR-005). During the
   * goal celebration, Enter (or a tap) skips it and shoots nothing (FR-114).
   */
  shoot(): void {
    const s = this.state;
    if (s.started && !s.paused && s.phase === 'celebrating') {
      this.skipCelebration();
      return;
    }
    if (!s.started || s.paused || s.phase !== 'aiming') return;
    // Enter on the turn card of "Papa gegen Kind" starts the turn and does not also shoot.
    if (s.wait?.reason === 'turnCard') {
      this.startTurn();
      return;
    }
    // Enter closes the open help chart and does not also shoot.
    if (s.helpChartOpen) {
      this.closeHelpChart();
      return;
    }
    const n = entryValue(s.entry);
    if (n === null) return;
    if (n < s.min || n > s.max) {
      this.set({ ...s, entry: '', message: { kind: 'outOfRange', min: s.min, max: s.max } }, { save: false });
      return;
    }
    const shot = keeperShotOf(s);
    if (s.play.kind === 'keeper' || shot !== null) {
      if (shot !== null && shot.result === null) this.decideShot(s, n);
      return;
    }
    if (s.wait !== null) return;
    this.queued.push({ type: 'shot' });
    this.set({ ...s, entry: '', message: null, phase: 'ballInFlight', ball: { number: n, outcome: null, atMs: s.elapsedMs } }, { save: false });
  }

  /** Called by the scene when the ball arrives. Decides goal or miss from the ball's number and the target. */
  ballLanded(): void {
    const s = this.state;
    if (s.phase !== 'ballInFlight') return;
    const hit = s.target !== null && s.ball.number === s.target.number;
    if (s.play.kind === 'torwand') {
      this.torwandLanded(s, s.play.holes, s.ball, hit);
      return;
    }
    const kicks = kicksOf(s);
    if (kicks !== null) {
      this.kicked(s, kicks, s.ball, hit);
      return;
    }
    if (hit && isCutoutFill(s.target)) {
      this.filled(s, s.ball);
      return;
    }
    if (hit) {
      // A shot at the answer of help step 4 scores and celebrates; it counts for the goal counter only when the parent
      // keeps "Punkt nach voller Hilfe" on (FR-025b).
      const counts = this.counts(s);
      const { attempt, levelUp } = this.scored(s, s.ball);
      this.set({
        ...s,
        ball: { ...s.ball, outcome: 'goal' },
        lastAttempt: attempt,
        phase: 'celebrating',
        goals: counts ? s.goals + 1 : s.goals,
        // The last square of a cutout adds the bonus for the whole cutout (FR-126).
        starsThisRound: starsAfter(s, 'goal', s.target?.cutout ? 'cutoutBonus' : null),
        missesInRow: 0,
        message: levelUp === null ? { kind: 'goal' } : { kind: 'levelUp', level: levelUp },
      });
      return;
    }

    const number = s.ball.number;
    const misses = s.missesInRow + 1;
    const shown: ShownSquare = { number, remainingMs: SHOWN_MS };
    // A number behind the wall hits the wall (FR-142); it counts as any other miss.
    const blocked = wallBlocks(layoutChart(s.min, s.max), playOf(s, 'wall')?.wall ?? null, number);
    const missMessage: MatchMessage = blocked ? { kind: 'blocked', number } : { kind: 'miss', number };
    const missed = {
      ...s,
      ball: { ...s.ball, outcome: blocked ? ('blocked' as const) : ('miss' as const) },
      targetMisses: s.targetMisses + 1,
      missTimes: [...s.missTimes, s.ball.atMs].slice(-MISS_TIMES_KEPT),
      lastGuess: number,
    };
    this.feedbackMs = SHOWN_MS;
    const heartLost = (s.roundType === 'untilHearts' || s.roundType === 'cup') && misses >= MISSES_PER_HEART[this.roundSettings.difficulty];
    if (heartLost) {
      // The target stays; help jumps to the answer and the child shoots it (FR-027, critique P7).
      const hearts = s.hearts - 1;
      const lost = { ...missed, hearts, missesInRow: 0, helpStep: ANSWER_STEP, helpChartOpen: false, message: { kind: 'heartLost', number } as const };
      // After the last heart the round ends on this target: it counts as not solved (FR-037), and no square shows
      // under the round end.
      if (hearts <= 0) this.endRound({ ...lost, shown: null, phase: 'roundOver' });
      else this.set({ ...lost, shown, phase: 'aiming' });
      return;
    }
    if (timeUp(s)) {
      // The time ran out while the ball flew: it landed and missed, and the round ends (FR-077).
      this.endRound({ ...missed, shown: null, phase: 'roundOver', helpChartOpen: false, message: missMessage });
      return;
    }
    this.set({
      ...missed,
      shown,
      phase: 'aiming',
      missesInRow: misses,
      ...this.helpRaised(s.helpStep),
      message: missMessage,
    });
  }

  /**
   * Decides the opponent's shot of "Selbst ins Tor" (FR-143): `typed` is the number the child shot, null when the ball
   * arrived first. A save counts for the saves and earns `STARS.save`; a save on the answer of help step 4 counts
   * only with "Punkt nach voller Hilfe" (FR-025b), as a goal does. Otherwise the target square shows its number.
   */
  private decideShot(s: StateIn<'aiming'>, typed: number | null): void {
    const shot = keeperShotOf(s);
    const target = s.target;
    if (shot === null || target === null) return;
    const result = shotResult(target.number, typed);
    const saved = result === 'saved';
    const counts = this.counts(s);
    let message: MatchMessage = { kind: 'saved' };
    if (result === 'wrong') message = { kind: 'conceded', number: target.number };
    else if (result === 'late') message = { kind: 'late', number: target.number };
    const decided = { ...shot, held: false, result, typed, resultLeftMs: KEEPER_RESULT_MS };
    const shown = saved ? null : { number: target.number, remainingMs: KEEPER_RESULT_MS };
    // Settings saved now give their new target after the result, so they never drop a decided shot (FR-052).
    this.feedbackMs = KEEPER_RESULT_MS;
    this.queued.push({ type: 'keeperShotDecided' });
    if (s.play.kind === 'shootout') {
      // The opponent's kick of the shootout: a save is his miss. Saves earn no stars here (FR-148).
      this.set({
        ...s,
        entry: '',
        helpChartOpen: false,
        play: { ...s.play, shot: decided, kicks: addKick(s.play.kicks, saved ? 'miss' : 'goal') },
        shown,
        lastGuess: typed,
        message,
      });
      return;
    }
    this.set({
      ...s,
      entry: '',
      helpChartOpen: false,
      play: withShot(s.play, decided),
      shots: Math.min(KEEPER_SHOTS, s.shots + 1),
      goals: saved && counts ? s.goals + 1 : s.goals,
      starsThisRound: starsAfter(s, saved ? 'save' : null),
      shown,
      lastGuess: typed,
      message,
    });
  }

  /**
   * After a decided shot: the next shot, or the end of the round after KEEPER_SHOTS shots (FR-146). In the shootout,
   * the next kick or the end.
   */
  private afterShot(s: MatchState): void {
    if (s.play.kind === 'shootout') {
      this.set(this.nextKick({ ...s, play: { ...s.play, shot: null } }));
      return;
    }
    const next = { ...s, ...TARGET_RESET, entry: '', message: null };
    if (s.shots >= KEEPER_SHOTS) {
      this.set({ ...next, play: withShot(s.play, null), ball: null, phase: 'roundOver' });
      return;
    }
    this.set(this.withNextTarget(next));
  }

  /**
   * The child's kick of the shootout landed (FR-147): the target number scores and is celebrated; any other number is
   * a miss of the kick, and its square shows its number until the opponent's turn. Both record the attempt. In "Papa
   * gegen Kind" the grown-up's kicks land here too; they record nothing (FR-161).
   */
  private kicked(s: StateIn<'ballInFlight'>, kicks: ShootoutKicks, ball: FlyingBall, hit: boolean): void {
    if (hit) {
      // In "Papa gegen Kind" only the child's goals count and earn stars (FR-160).
      const child = turnOf(s) !== 'grownup';
      const { attempt, levelUp } = this.scored(s, ball);
      this.set({
        ...s,
        ball: { ...ball, outcome: 'goal' },
        lastAttempt: child ? attempt : s.lastAttempt,
        phase: 'celebrating',
        goals: child ? s.goals + 1 : s.goals,
        starsThisRound: starsAfter(s, s.play.kind === 'family' && child ? 'goal' : null),
        missesInRow: 0,
        play: withKicks(s.play, addKick(kicks, 'goal')),
        wait: null,
        message: levelUp === null ? { kind: 'goal' } : { kind: 'levelUp', level: levelUp },
      });
      return;
    }
    this.missedWithWait(s, ball, 'miss', { play: withKicks(s.play, addKick(kicks, 'miss')), message: { kind: 'kickMissed', number: ball.number } });
  }

  /**
   * A missed kick of the shootout or a missed shot at the board: the attempt is recorded, and the square shows its
   * number while the round waits SHOWN_MS of play time (`afterMiss`). `rest` adds what the mode changes. The wait also
   * holds back a waiting settings change until the next turn or target (FR-052).
   */
  private missedWithWait(s: StateIn<'ballInFlight'>, ball: FlyingBall, outcome: 'miss' | 'decoy', rest: Pick<MatchFields, 'message'> & Partial<Pick<MatchFields, 'play' | 'shots'>>): void {
    const missed: StateIn<'aiming'> = {
      ...s,
      phase: 'aiming',
      ball: { ...ball, outcome },
      targetMisses: s.targetMisses + 1,
      missTimes: [...s.missTimes, ball.atMs].slice(-MISS_TIMES_KEPT),
      lastGuess: ball.number,
      helpChartOpen: false,
    };
    this.recordAttempt(missed, { solved: false, endedAt: ball.atMs });
    this.set({ ...missed, ...rest, shown: { number: ball.number, remainingMs: SHOWN_MS }, wait: { reason: 'afterMiss', ms: SHOWN_MS } });
  }

  /**
   * The shootout after a kick: the next kick, or the end once a side has won (FR-147). A win of the child adds
   * `STARS.shootoutWin` (FR-148), in "Papa gegen Kind" `STARS.familyWin` (FR-160).
   */
  private nextKick(s: MatchState): MatchState {
    const kicks = kicksOf(s);
    if (kicks === null) return s;
    const next = { ...s, ...TARGET_RESET, ball: null, entry: '', message: null, play: withShot(s.play, null) };
    const winner = shootoutWinner(kicks);
    const family = s.play.kind === 'family';
    if (winner !== null) {
      const win = family ? 'familyWin' : 'shootoutWin';
      return { ...next, wait: null, phase: 'roundOver', starsThisRound: starsAfter(s, winner === 0 ? win : null) };
    }
    // "Papa gegen Kind": the turn card names the next shooter (FR-158).
    return this.withNextTarget({ ...next, wait: family ? { reason: 'turnCard' } : null, phase: 'aiming' });
  }

  /**
   * A shot at the board of "Torwandschießen" landed (FR-156): the target hole scores and is celebrated; a decoy hole or
   * the board is a miss whose square shows its number until the next target. Both record the attempt.
   */
  private torwandLanded(s: StateIn<'ballInFlight'>, holes: readonly number[], ball: FlyingBall, hit: boolean): void {
    const shots = Math.min(TORWAND_SHOTS, s.shots + 1);
    if (hit) {
      const counts = this.counts(s);
      const { attempt, levelUp } = this.scored(s, ball);
      this.set({
        ...s,
        ball: { ...ball, outcome: 'goal' },
        lastAttempt: attempt,
        phase: 'celebrating',
        shots,
        goals: counts ? s.goals + 1 : s.goals,
        starsThisRound: starsAfter(s, 'goal'),
        missesInRow: 0,
        message: levelUp === null ? { kind: 'goal' } : { kind: 'levelUp', level: levelUp },
      });
      return;
    }
    const decoy = torwandHit(holes, s.target?.number ?? NaN, ball.number) === 'decoy';
    this.missedWithWait(s, ball, decoy ? 'decoy' : 'miss', { shots, message: { kind: decoy ? 'decoy' : 'board', number: ball.number } });
  }

  /** "Torwandschießen" after a shot: the next target with new holes, or the end after TORWAND_SHOTS shots (FR-157). */
  private nextShot(s: MatchState): MatchState {
    const next = { ...s, ...TARGET_RESET, ball: null, entry: '', message: null, wait: null };
    if (s.shots >= TORWAND_SHOTS) return { ...next, phase: 'roundOver' };
    return this.withNextTarget({ ...next, phase: 'aiming' });
  }

  /**
   * A square of a cutout that is not its last one got the correct number (FR-125): the attempt is recorded, `STARS.cutoutFill`
   * are earned and the next square is the target at once; no goal, no celebration. When the time of a time challenge ran
   * out while the ball flew, the round ends here instead.
   */
  private filled(s: StateIn<'ballInFlight'>, ball: FlyingBall): void {
    const { attempt, levelUp } = this.scored(s, ball);
    const message: MatchMessage = levelUp === null ? { kind: 'filled', number: ball.number } : { kind: 'levelUp', level: levelUp };
    const landed = {
      ...s,
      ...TARGET_RESET,
      ball: { ...ball, outcome: 'filled' as const },
      lastAttempt: attempt,
      starsThisRound: starsAfter(s, 'cutoutFill'),
      message,
    };
    if (timeUp(s)) {
      this.set({ ...landed, phase: 'roundOver' });
      return;
    }
    this.set(this.withNextTarget({ ...landed, phase: 'aiming' }));
  }

  /**
   * True when a goal or a save at the target of `s` counts: before help step 4 showed the answer, or after it with
   * "Punkt nach voller Hilfe" on (FR-025b).
   */
  private counts(s: MatchState): boolean {
    return s.helpStep < ANSWER_STEP || this.roundSettings.pointAfterFullHelp;
  }

  /** Records the attempt at the target of `s` that `ball` just scored; returns it for `lastAttempt`, and a new level. */
  private scored(s: MatchState, ball: Pick<Ball, 'number' | 'atMs'>): { attempt: FinishedAttempt; levelUp: Level | null } {
    const solved = s.helpStep < ANSWER_STEP;
    const levelUp = this.recordAttempt(s, { solved, endedAt: ball.atMs });
    if (levelUp !== null) this.queued.push({ type: 'levelUp', level: levelUp });
    return { attempt: { number: ball.number, solved, helpStep: s.helpStep }, levelUp };
  }

  /** Enter or a tap during the goal celebration (FR-114): it ends now, as if it had played to the end. */
  skipCelebration(): void {
    if (this.state.paused) return;
    this.celebrationDone();
  }

  /** Called by the scene when the goal celebration ends: the next target, or the end of the round. */
  celebrationDone(): void {
    if (this.state.phase !== 'celebrating') return;
    this.set(this.afterCelebration(this.state));
  }

  /** One help step further, up to step 4, while the child aims. Step 3 opens the help chart. */
  askHelp(): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase !== 'aiming') return;
    if (s.helpStep >= ANSWER_STEP) return;
    if (shotDecided(s)) return;
    if (s.wait !== null) return;
    // Help holds the opponent's shot until the next key, so asking never costs a save (FR-145).
    const shot = keeperShotOf(s);
    const play = shot === null ? s.play : withShot(s.play, { ...shot, held: true });
    this.set({ ...s, ...this.helpRaised(s.helpStep), play });
  }

  /** Closes the help chart; the help step stays. */
  closeHelpChart(): void {
    if (!this.state.helpChartOpen) return;
    this.set({ ...this.state, helpChartOpen: false }, { save: false });
  }

  /**
   * Adds `reason` to the pause reasons. The child pauses only a running round that is not paused yet; the app's reasons
   * are kept whatever the round does, so a round that starts while one is set starts paused or without its clock.
   */
  pause(reason: PauseReason = 'child'): void {
    const s = this.state;
    if (reason === 'child' && (!s.started || s.paused || s.phase === 'roundOver')) return;
    if (this.pauseReasons.has(reason)) return;
    this.pauseReasons.add(reason);
    this.syncPaused();
  }

  /** Removes `reason`; the round plays again once no reason that pauses play is left. */
  resume(reason: PauseReason = 'child'): void {
    if (!this.pauseReasons.delete(reason)) return;
    this.syncPaused();
  }

  /** True when a pause reason other than the clock-only ones holds the running round of `s`. */
  private pausedNow(s: MatchState): boolean {
    if (!s.started || s.phase === 'roundOver') return false;
    for (const reason of this.pauseReasons) if (!CLOCK_ONLY_REASONS.has(reason)) return true;
    return false;
  }

  /** A new state when the pause reasons changed whether play is paused. */
  private syncPaused(): void {
    if (this.pausedNow(this.state) !== this.state.paused) this.set({ ...this.state }, { save: false });
  }

  /**
   * "Zum Start" (amendment 14, FR-118): ends the round without a round end. Stars and the attempts already recorded
   * stay where they went; the unfinished target records no attempt, the round never reaches 'roundOver' (so it is no
   * personal best), the stored round is deleted, and a time challenge's countdown stops because no round runs. The
   * state goes back to the one before the first `start()`.
   */
  abandon(): void {
    if (!this.state.started) return;
    this.clearPending();
    this.options.store?.clear();
    this.set(freshState(this.roundSettings, 0, false), { save: false });
  }

  /**
   * Adds `ms` of time played while a round runs and no pause reason is set (FR-029): not while paused, while the cup's
   * intro card shows or while the tab is hidden. The shown square counts down with the same time.
   */
  tick(ms: number): void {
    const s = this.state;
    if (!s.started || this.pauseReasons.size > 0 || s.phase === 'roundOver' || !(ms > 0)) return;
    // A time challenge's time played stops at its length, so the countdown shows 0:00 while a last ball lands.
    const total = challengeMs(s);
    const elapsedMs = total === null ? s.elapsedMs + ms : Math.min(total, s.elapsedMs + ms);

    const remaining = s.shown ? s.shown.remainingMs - ms : 0;
    const shown = s.shown && remaining > 0 ? { ...s.shown, remainingMs: remaining } : null;
    const save = Math.floor(elapsedMs / SAVE_TIME_EVERY_MS) !== Math.floor(s.elapsedMs / SAVE_TIME_EVERY_MS);
    this.feedbackMs = Math.max(0, this.feedbackMs - ms);
    let next: MatchState = { ...s, elapsedMs, shown };
    const shot = keeperShotOf(s);
    // The opponent shoots only while the child aims: the child has no ball of his own then.
    if (shot !== null && next.phase === 'aiming') {
      if (shot.result === null) {
        // The shot flies, unless help or the help chart holds it (FR-145).
        if (!shot.held && !s.helpChartOpen) {
          const leftMs = Math.max(0, shot.leftMs - ms);
          next = { ...next, play: withShot(s.play, { ...shot, leftMs }) };
          if (leftMs === 0) {
            this.decideShot(next, null);
            return;
          }
        }
      } else {
        const resultLeftMs = Math.max(0, shot.resultLeftMs - ms);
        next = { ...next, play: withShot(s.play, { ...shot, resultLeftMs }) };
        if (resultLeftMs === 0) {
          this.afterShot(next);
          return;
        }
      }
    }
    if (s.wait?.reason === 'afterMiss') {
      // After a missed shot at the board the next target comes, after a missed kick of the child the opponent's turn,
      // once its square has shown its number.
      const waitMs = Math.max(0, s.wait.ms - ms);
      next = { ...next, wait: { reason: 'afterMiss', ms: waitMs } };
      if (waitMs === 0) {
        this.set(s.play.kind === 'torwand' ? this.nextShot(next) : this.nextKick(next));
        return;
      }
    }
    // Also a round restored at zero ends here, on its first tick.
    if (timeUp(next) && next.phase === 'aiming') {
      this.endAtZero(next);
      return;
    }
    if (elapsedMs === s.elapsedMs && shown === s.shown && next.play === s.play && next.wait === s.wait) return;
    this.set(next, { save });
  }

  /** Ends a time challenge whose countdown reached zero while the child aimed; the current target counts as not solved. */
  private endAtZero(s: StateIn<'aiming'>): void {
    this.endRound({ ...s, ...TARGET_RESET, entry: '', phase: 'roundOver' });
  }

  /** Ends the round with the state `over` (phase 'roundOver'); its current target counts as not solved. */
  private endRound(over: MatchState): void {
    this.set(over);
    this.recordAttempt(over, { solved: false, endedAt: over.elapsedMs });
  }

  /** The help step after `step`, capped at 4; the help chart is open exactly at step 3. */
  private helpRaised(step: number): Pick<MatchState, 'helpStep' | 'helpChartOpen'> {
    const helpStep = Math.min(ANSWER_STEP, step + 1);
    return { helpStep, helpChartOpen: helpStep === CHART_STEP };
  }

  private afterCelebration(s: MatchState): MatchState {
    // The child's goal in the shootout was celebrated: the opponent's turn, or the end.
    if (kicksOf(s) !== null) return this.nextKick(s);
    // A goal through the board's hole was celebrated: the next target, or the end (FR-157).
    if (s.play.kind === 'torwand') return this.nextShot(s);
    const next = { ...s, ...TARGET_RESET, ball: null, message: null };
    if (s.roundType === 'goalCount' && s.goals >= this.roundSettings.goalsPerRound) return { ...next, phase: 'roundOver' };
    // A cup match is won at its goals (FR-108).
    if (cupMatchWon(s)) return { ...next, phase: 'roundOver' };
    // The last goal of a time challenge was shot before zero and celebrated; now the round ends (FR-077).
    if (timeUp(s)) return { ...next, phase: 'roundOver' };
    return this.withNextTarget({ ...next, phase: 'aiming' });
  }

  /**
   * The state with the round's next target: the next empty square of the same shape or cutout when one is left (FR-072,
   * FR-125), else a new target. A new target after changed settings (`withNewSettings`) clears the target first, so it never continues
   * a shape. In the mode 'wall' the target gets its wall (`wallFor`). In the mode 'keeper' the target is a square of
   * `keeperTarget` and the opponent shoots at it (`newShot`), the first shot of the round at the slow speed (FR-144).
   */
  private withNextTarget(state: MatchState): MatchState {
    const fresh = { targetCount: state.targetCount + 1, targetStartMs: state.elapsedMs, targetMisses: 0, missTimes: [] };
    // The shootout's turns take turns and the board's holes move after every shot, so a shape or cutout never goes on.
    const inShape = state.target && kicksOf(state) === null && state.play.kind !== 'torwand' ? nextInShape(state.target) : null;
    const target = inShape ?? (this.options.nextTarget ? this.options.nextTarget(state) : this.defaultTarget(state));
    const next: MatchState = { ...state, ...fresh, target };
    return { ...next, play: this.playFor(next, target, state.ball?.outcome === 'filled') };
  }

  /**
   * The play of `s` for its new target `target`:
   * - "Torwandschießen": the holes of the board (FR-155);
   * - "Freistoß mit Mauer": the wall (`wallFor`);
   * - "Selbst ins Tor" and the opponent's kicks: the opponent's shot, the first one of the round at the slow speed.
   */
  private playFor(s: MatchState, target: Target | null, keepWall: boolean): Play {
    const { play } = s;
    if (play.kind === 'torwand') {
      if (target === null) return play;
      const rng = createRng(deriveSeed(s.seed, s.targetCount, TORWAND_SEED));
      return { ...play, holes: torwandHoles(layoutChart(s.min, s.max), target, rng) };
    }
    if (play.kind === 'wall') return { ...play, wall: this.wallFor(s, play.wall, keepWall) };
    if (play.kind !== 'keeper' && play.kind !== 'shootout') return play;
    const index = play.kind === 'shootout' ? play.kicks[1].length : s.shots;
    const shot = turnOf(s) === 'opponent' && target !== null ? newShot(flightMsOf(this.roundSettings.keeperSpeed, index)) : null;
    return { ...play, shot };
  }

  /**
   * The wall for the target of `s` in the mode 'wall' (FR-142): the same wall after a filled square of a cutout
   * (`keep`), while it still leaves the target clear; a new one in other columns after a goal or for a new target.
   * Its random numbers derive from the seed and the target count, apart from the target's.
   */
  private wallFor(s: MatchState, wall: Wall | null, keep: boolean): Wall | null {
    if (s.target === null) return null;
    const layout = layoutChart(s.min, s.max);
    if (keep && wall !== null && wallClear(layout, wall, s.target)) return wall;
    return placeWall(layout, s.target, createRng(deriveSeed(s.seed, s.targetCount, WALL_SEED)), wall);
  }

  /**
   * The next target from core/targets, with the round's seeded `Rng`. A cup match plays its own level (FR-109): the
   * child's level and the X shape's two empty squares of adaptive difficulty do not apply.
   */
  private defaultTarget(state: MatchState): Target | null {
    const progress = this.options.progress?.() ?? NO_PROGRESS;
    if (turnOf(state) === 'opponent') {
      // "Selbst ins Tor" and the opponent's kicks: any square, with hints by the child's level in reverse (FR-146).
      const rng = createRng(deriveSeed(state.seed, state.targetCount));
      return keeperTarget(layoutChart(state.min, state.max), progress.level, rng, state.target?.number ?? null);
    }
    // A cup match plays its level (FR-109); the grown-up of "Papa gegen Kind" plays the level of the start card (FR-159).
    let level: TargetProgress = progress;
    const { play } = state;
    if (play.kind === 'cup') level = { ...progress, level: play.match.level, xTwoEmpties: false };
    else if (play.kind === 'family' && turnOf(state) === 'grownup') level = { ...progress, level: play.level, xTwoEmpties: false };
    const layout = layoutChart(state.min, state.max);
    const base = nextTarget({
      layout,
      settings: this.roundSettings,
      progress: level,
      rng: createRng(deriveSeed(state.seed, state.targetCount)),
      avoid: state.target?.number,
    });
    // At the board the target has fewer hints, by the child's level (FR-156).
    if (play.kind === 'torwand') return torwandTarget(layout, base, createRng(deriveSeed(state.seed, state.targetCount, TORWAND_SEED + 1)));
    return base;
  }

  /** Hands the record of the finished current target of `s` to `onAttempt` (T043); returns a level it raised. */
  private recordAttempt(s: MatchState, end: { solved: boolean; endedAt: number }): Level | null {
    // The squares of "Selbst ins Tor" and of the opponent's kicks follow the level in reverse, so they never move the
    // child's level.
    // The grown-up's kicks of "Papa gegen Kind" are not the child's (FR-161).
    if (!this.options.onAttempt || !s.target || s.play.kind === 'keeper' || keeperShotOf(s) !== null || turnOf(s) === 'grownup') return null;
    const raised = this.options.onAttempt(
      makeAttemptRecord({
        min: s.min,
        max: s.max,
        target: s.target,
        settings: this.roundSettings,
        solved: end.solved,
        helpStep: s.helpStep,
        misses: s.targetMisses,
        startedAt: s.targetStartMs,
        endedAt: end.endedAt,
        missTimes: s.missTimes,
        now: this.options.now?.() ?? new Date(),
      }),
    );
    return raised ?? null;
  }

  private set(next: MatchState, { save = true }: { save?: boolean } = {}): void {
    const prev = this.state;
    const events = this.queued;
    this.queued = [];
    // Every way out of 'ballInFlight' but a new round or "Zum Start" is a landing, and the landing state carries the
    // ball's outcome (read before a waiting settings change replaces the ball).
    if (prev.phase === 'ballInFlight' && next.ball !== null && next.ball.outcome !== null) {
      events.unshift({ type: 'landed', outcome: next.ball.outcome });
    }
    // Settings saved while the ball flew or the goal was celebrated give their new target once the round aims again and
    // the landing feedback has finished (review M1).
    if (this.newTargetPending) {
      if (next.phase === 'roundOver') this.newTargetPending = false;
      else if (next.phase === 'aiming' && next.started && this.feedbackMs <= 0 && next.wait?.reason !== 'afterMiss') {
        next = this.withNewSettings(next);
        save = true;
      }
    }
    next = { ...next, paused: this.pausedNow(next) };
    if (import.meta.env.DEV) {
      const errors = matchInvariantErrors(next);
      if (errors.length > 0) throw new Error(`MatchController: inconsistent state: ${errors.join('; ')}`);
    }
    this.state = next;
    const roundStarted = events.some((e) => e.type === 'roundStarted');
    // A started or restored round's stars were awarded before (FR-042).
    const stars = roundStarted ? 0 : newStars(prev.starsThisRound, next.starsThisRound);
    if (stars > 0) events.push({ type: 'starsEarned', n: stars });
    if (next.started && (roundStarted || next.targetCount !== prev.targetCount)) events.push({ type: 'targetChanged' });
    if (next.started && next.phase === 'roundOver' && prev.phase !== 'roundOver') events.push({ type: 'roundEnded' });
    if (save) this.persist();
    for (const fn of this.listeners) fn(events);
  }

  /** Saves the round between shots, and deletes it once the round is over. */
  private persist(): void {
    const store = this.options.store;
    const s = this.state;
    if (!store || !s.started) return;
    if (s.phase === 'roundOver') {
      store.clear();
      return;
    }
    // While the ball flies the round is saved as it was before the shot; the shot is lost on a refresh.
    if (s.phase !== 'aiming' && s.phase !== 'celebrating') return;
    store.save({ version: 2, ...storedFields(s), goalsPerRound: this.roundSettings.goalsPerRound, phase: s.phase });
  }
}


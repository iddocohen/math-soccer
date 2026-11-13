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
 * Time challenge (amendment 07, FR-075 to FR-080): `start('time')` starts a round of `challengeMinutes` from the
 * parent's settings. The countdown is the challenge time minus the time played, so it stops exactly when the round
 * clock does (FR-078: paused, a parent screen or the locker room open, or the tab hidden) and a refresh continues it from
 * the stored time played. There are no hearts, so misses cost only time. At zero a round that aims ends at once; a ball
 * in flight still lands and counts, and a goal is still celebrated, and then the round ends.
 *
 * The goalkeeper game (T029, T053, amendment 05, FR-019, FR-020): targets come from `nextTarget`, with the hint numbers
 * of a hint pattern lit in the grid around an empty target square. The target number is a goal worth GOAL_STARS; any
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
 * that is not the cutout's last one fills it: the ball lands on the square with the outcome 'filled', FILL_STARS are
 * earned, the attempt is recorded, and the next square becomes the target at once, with no goal and no celebration.
 * The keeper does not take part (the scene reads `isCutoutFill`). The last square is a normal shot: a goal with the
 * celebration and GOAL_STARS plus CUTOUT_BONUS_STARS, and the one goal of the cutout for the goal count and the cup.
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
 * child and no celebration: the phase stays 'aiming' until the round ends, and `keeperShot` carries the shot.
 * - While the shot flies its `leftMs` counts down with the time played; help holds it until the next key (FR-145), and
 *   the open help chart holds it too. Typing works the whole flight; Enter decides the shot with the typed number.
 * - The target number saves: one more save (`goals`) and KEEPER_SAVE_STARS. A wrong number, or none before `leftMs`
 *   reaches 0 ('late'), concedes: the target square shows its number. Out-of-range numbers are not shot, as always.
 * - A decided shot shows for KEEPER_RESULT_MS of play time, then the next shot comes, or the round ends after
 *   KEEPER_SHOTS shots. Hearts and the round type play no part. These shots record no attempts, because the squares
 *   follow the level in reverse and are not targets of the child's level.
 *
 * "Elfmeterschießen" (amendment 21 part 3, FR-147, FR-148): `start('shootout')` starts a round in the match mode
 * 'shootout' against a cup team (`keeperOpponent`). `shootout.kicks` holds the kicks of both sides (core/match/shootout.ts):
 * side 0 is the child, side 1 the opponent, and the turn is `nextSide(kicks)`.
 * - The child's turn plays as "Spielen": a target of his level from `nextTarget`, help as usual, one shot. The target
 *   number scores (the celebration follows, then the opponent's turn); any other number is a miss of the kick: its
 *   square shows its number, and after `shootout.waitMs` (SHOWN_MS) of play time the opponent's turn comes. Hearts, the
 *   round type and the goal count play no part. Both record an attempt, as any finished target does.
 * - The opponent's turn plays as "Selbst ins Tor": `keeperShot` flies at a square of `keeperTarget`, the first one of
 *   the round at the slow speed. A save is a miss of the opponent; a wrong number or none in time is his goal. The
 *   opponent never misses on his own. These shots record no attempts.
 * - Shapes and cutouts do not go on across turns: each kick of the child has a new target.
 * - After SHOOTOUT_ROUNDS rounds, or a round of sudden death, with one side ahead the round ends. A win earns
 *   SHOOTOUT_WIN_STARS; goals and saves earn none, and a loss takes nothing away. `goals` counts the child's goals.
 *
 * Views get a deep read-only view of the state (`MatchView`). In development builds `set()` checks the rules between
 * fields (`matchInvariantErrors`) and throws when one is broken; the state type itself stays one flat record.
 */
import { layoutChart } from '../chart/layout';
import { createRng, deriveSeed } from '../rng';
import { GOAL_STARS } from '../rewards/lockerRoom';
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
import { flightMsOf, KEEPER_RESULT_MS, KEEPER_SAVE_STARS, KEEPER_SHOTS, keeperTarget, newShot, shotResult, type KeeperShot } from './keeper';
import { addKick, emptyKicks, nextSide, shootoutWinner, SHOOTOUT_WIN_STARS, type Kick } from './shootout';

export type Phase = 'aiming' | 'ballInFlight' | 'celebrating' | 'roundOver';

/** How long the square of a missed number shows its number (FR-004: at least 1.5 seconds). */
export const SHOWN_MS = 1500;

/**
 * Stars for a filled square of a cutout, and the bonus for the whole cutout on its last square (amendment 18, FR-125,
 * FR-126). Amendment 19 (FR-132) lowered them: a filled square earns nothing, the whole cutout earns its bonus.
 */
export const FILL_STARS = 0;
export const CUTOUT_BONUS_STARS = 2;

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
  | { kind: 'heartLost'; number: number };

/**
 * The ball after a shot: the typed number and, once landed, whether it scored, filled a square of a cutout (no goal,
 * amendment 18), missed, or hit the wall of "Freistoß mit Mauer" (a miss too, amendment 21).
 */
export interface Ball {
  number: number;
  outcome: 'goal' | 'filled' | 'miss' | 'blocked' | null;
  /** Play time of the shot (`elapsedMs`), for the attempt record. */
  atMs: number;
}

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
 * "Elfmeterschießen" (amendment 21 part 3): the kicks of the child (side 0) and the opponent (side 1), and the play
 * time left before the opponent's turn after a missed kick of the child; 0 when nothing waits.
 */
export interface ShootoutState {
  kicks: [Kick[], Kick[]];
  waitMs: number;
}

export interface MatchState {
  /** False before the first `start()`. */
  started: boolean;
  roundType: RoundType;
  /** The length of a time challenge in minutes (FR-076); null for the other round types. */
  challengeMinutes: ChallengeMinutes | null;
  /** A cup match: the level of its targets and the goals that win it (FR-108, FR-109); null for the other round types. */
  cupMatch: CupMatchSetup | null;
  /** The match mode (core/match/rounds.ts): the usual game, or the free kick with the wall (amendment 21). */
  mode: MatchMode;
  /** The wall in front of the current target; null outside the mode 'wall', or when no column is free. */
  wall: Wall | null;
  /** "Selbst ins Tor": the shots decided so far, up to KEEPER_SHOTS; 0 in the other modes. */
  shots: number;
  /**
   * The opponent's shot at the current target: in "Selbst ins Tor", and in "Elfmeterschießen" on the opponent's turn;
   * null otherwise and after the round.
   */
  keeperShot: KeeperShot | null;
  /** "Elfmeterschießen": the kicks so far; null in the other modes. */
  shootout: ShootoutState | null;
  seed: number;
  min: number;
  max: number;
  phase: Phase;
  paused: boolean;
  /** Digits typed so far, '' when none. */
  entry: string;
  message: MatchMessage | null;
  ball: Ball | null;
  target: Target | null;
  /** How many targets the round has had; the next target's random numbers derive from the seed and this count. */
  targetCount: number;
  /** The square of the last missed number while it shows its number. */
  shown: ShownSquare | null;
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

/** The match state as React and Phaser read it from `getState()`: they cannot change it. */
export type MatchView = DeepReadonly<MatchState>;

/**
 * The rules between fields of the flat state record (review H4), as messages; an empty list means the state is
 * consistent:
 * - a ball without an outcome flies: it exists exactly in 'ballInFlight';
 * - 'celebrating' follows a goal, so its ball has the outcome 'goal';
 * - no missed square shows after the round ended;
 * - a wall stands only in the mode 'wall';
 * - only the modes 'keeper' and 'shootout' have an opponent's shot, and the child shoots no ball in the mode 'keeper'
 *   or while the opponent shoots;
 * - the kicks of a shootout exist exactly in the mode 'shootout'.
 */
export function matchInvariantErrors(s: MatchState): string[] {
  const errors: string[] = [];
  const flying = s.ball !== null && s.ball.outcome === null;
  if ((s.phase === 'ballInFlight') !== flying) errors.push(`ball ${JSON.stringify(s.ball)} in phase ${s.phase}`);
  if (s.phase === 'celebrating' && s.ball?.outcome !== 'goal') errors.push('celebrating without a goal');
  if (s.phase === 'roundOver' && s.shown !== null) errors.push('shown square after the round ended');
  if (s.wall !== null && s.mode !== 'wall') errors.push(`wall in mode ${s.mode}`);
  if (s.keeperShot !== null && s.mode !== 'keeper' && s.mode !== 'shootout') errors.push(`opponent's shot in mode ${s.mode}`);
  if (s.mode === 'keeper' && s.ball !== null) errors.push('a ball of the child in the keeper mode');
  if (s.keeperShot !== null && s.ball !== null) errors.push('a ball of the child while the opponent shoots');
  if ((s.shootout !== null) !== (s.mode === 'shootout')) errors.push(`shootout kicks in mode ${s.mode}`);
  return errors;
}

/**
 * True when `b` differs from `a` only in the time played, the shown square's time left, the time left of the
 * opponent's shot and the wait of a shootout, as after a `tick` that changed nothing else. The views skip such states,
 * except the clock; the scene reads the shot's time left on every frame.
 */
export function onlyTimeChanged(a: MatchView, b: MatchView): boolean {
  if (a.elapsedMs === b.elapsedMs && a.shown === b.shown && a.keeperShot === b.keeperShot && a.shootout === b.shootout) return false;
  if (a.shown?.number !== b.shown?.number) return false;
  if (!sameShot(a.keeperShot, b.keeperShot)) return false;
  if (a.shootout?.kicks !== b.shootout?.kicks) return false;
  for (const key of Object.keys(b) as Array<keyof MatchView>) {
    if (key !== 'elapsedMs' && key !== 'shown' && key !== 'keeperShot' && key !== 'shootout' && a[key] !== b[key]) return false;
  }
  return true;
}

/** True when two shots differ at most in their time left. */
function sameShot(a: MatchView['keeperShot'], b: MatchView['keeperShot']): boolean {
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
  'challengeMinutes',
  'cupMatch',
  'mode',
  'wall',
  'shots',
  'keeperShot',
  'shootout',
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
export function cupMatchWon(s: Pick<MatchState, 'roundType' | 'cupMatch' | 'goals'>): boolean {
  return s.roundType === 'cup' && s.cupMatch !== null && s.goals >= s.cupMatch.goals;
}

/** The length of the time challenge of `s` in milliseconds, or null for another round type. */
export function challengeMs(s: Pick<MatchState, 'challengeMinutes'>): number | null {
  return s.challengeMinutes === null ? null : s.challengeMinutes * 60_000;
}

/** The time left of a time challenge, never below 0; null for another round type. */
export function remainingMs(s: Pick<MatchState, 'challengeMinutes' | 'elapsedMs'>): number | null {
  const total = challengeMs(s);
  return total === null ? null : Math.max(0, total - s.elapsedMs);
}

/** True when the countdown of a time challenge has reached zero. */
function timeUp(s: MatchState): boolean {
  return remainingMs(s) === 0;
}

function freshState(s: Settings, seed: number, started: boolean, kind: ControllerKind = 'play', cupMatch: CupMatchSetup | null = null): MatchState {
  const roundType = cupMatch !== null ? 'cup' : roundTypeOf(kind, s);
  return {
    started,
    roundType,
    challengeMinutes: roundType === 'time' ? s.timeChallenge.minutes : null,
    cupMatch: cupMatch === null ? null : { ...cupMatch },
    mode: cupMatch !== null ? 'normal' : (START_KIND_INFO[kind].mode ?? 'normal'),
    wall: null,
    shots: 0,
    keeperShot: null,
    shootout: cupMatch === null && START_KIND_INFO[kind].mode === 'shootout' ? { kicks: emptyKicks(), waitMs: 0 } : null,
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

/** The guess rule looks at misses within the last 5 seconds; this many are enough to keep (classify.ts). */
const MISS_TIMES_KEPT = 5;

/** True when the opponent shoots at the target of `s`: always in "Selbst ins Tor", on his turn in the shootout. */
function opponentShoots(s: Pick<MatchState, 'mode' | 'shootout'>): boolean {
  if (s.mode === 'keeper') return true;
  return s.shootout !== null && nextSide(s.shootout.kicks) === 1;
}

/** True while a missed kick of the child shows its square, before the opponent's turn: nothing is typed or shot. */
function shootoutWaits(s: Pick<MatchState, 'shootout'>): boolean {
  return s.shootout !== null && s.shootout.waitMs > 0;
}

export class MatchController {
  private state: MatchState;
  private readonly listeners = new Set<() => void>();
  private readonly options: MatchControllerOptions;
  /** The settings the running round uses: those of its start, updated by `applySettings` (FR-052). */
  private roundSettings: Settings;
  /** True while saved target-shaping settings wait for the round to be back in 'aiming' (FR-052). */
  private newTargetPending = false;
  /** Play time left of the landing feedback of the last miss; a pending new target waits for it. */
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
  private withNewSettings(s: MatchState): MatchState {
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

  /** Calls `fn` after every state change; returns a function that stops it. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Starts a new round with the current settings: a normal round, a time challenge with `'time'` (FR-075), or the free
   * kick with the wall with `'wall'` (FR-142).
   */
  start(kind: ControllerKind = 'play'): void {
    this.begin(kind, null);
  }

  /**
   * Starts a cup match (amendment 13, FR-108): hearts as in "Bis die Bälle weg sind", every target at `match.level`, won
   * at `match.goals` goals.
   */
  startCup(match: CupMatchSetup): void {
    this.begin('play', match);
  }

  /** A new round with the current settings and a new seed: a normal round, a time challenge or a cup match. */
  private begin(kind: ControllerKind, cupMatch: CupMatchSetup | null): void {
    this.clearPending();
    this.roundSettings = this.options.settings();
    const seed = this.options.newSeed?.() ?? Date.now() % 2_147_483_647;
    this.set(this.withNextTarget(freshState(this.roundSettings, seed, true, kind, cupMatch)));
  }

  /** Drops a waiting settings change and the landing feedback's wait: a round starts, comes back or ends. */
  private clearPending(): void {
    this.newTargetPending = false;
    this.feedbackMs = 0;
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
    const modeOff = stored.mode !== 'normal' && !s.modesAllowed[stored.mode];
    if (stored.min !== s.range.min || stored.max !== s.range.max || challengeOff || modeOff) {
      store.clear();
      return false;
    }
    this.clearPending();
    // Round type and goals per round keep their round-start values across a refresh (FR-052).
    const roundType = stored.roundType === 'time' || stored.roundType === 'cup' ? s.roundType : stored.roundType;
    this.roundSettings = { ...s, roundType, goalsPerRound: stored.goalsPerRound };
    const state: MatchState = { ...freshState(this.roundSettings, stored.seed, true), ...storedFields(stored) };
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
    const shot = this.state.keeperShot;
    if (shot?.held && !this.state.paused && key !== 'help' && key !== 'escape') {
      this.set({ ...this.state, keeperShot: { ...shot, held: false } }, { save: false });
    }
    if (this.state.helpChartOpen && key !== 'help') {
      this.closeHelpChart();
      if (key === 'escape' || key === 'enter') return;
    }
    if (key === 'escape') {
      if (this.state.paused) this.resume();
      else this.pause();
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
    // Between two shots of "Selbst ins Tor", and after a missed kick of the shootout, no number is typed.
    if (this.state.keeperShot !== null && this.state.keeperShot.result !== null) return;
    if (shootoutWaits(this.state)) return;
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
    if (s.mode === 'keeper' || s.keeperShot !== null) {
      if (s.keeperShot !== null && s.keeperShot.result === null) this.decideShot(s, n);
      return;
    }
    if (shootoutWaits(s)) return;
    this.set({ ...s, entry: '', message: null, phase: 'ballInFlight', ball: { number: n, outcome: null, atMs: s.elapsedMs } }, { save: false });
  }

  /** Called by the scene when the ball arrives. Decides goal or miss from the ball's number and the target. */
  ballLanded(): void {
    const s = this.state;
    if (s.phase !== 'ballInFlight' || !s.ball) return;
    const hit = s.target !== null && s.ball.number === s.target.number;
    if (s.shootout !== null) {
      this.kicked(s, s.shootout, s.ball, hit);
      return;
    }
    if (hit && isCutoutFill(s.target)) {
      this.filled(s, s.ball);
      return;
    }
    if (hit) {
      // A shot at the answer of help step 4 scores and celebrates; it counts for the goal counter only when the parent
      // keeps "Punkt nach voller Hilfe" on (FR-025b).
      const counts = s.helpStep < ANSWER_STEP || this.roundSettings.pointAfterFullHelp;
      const { attempt, levelUp } = this.scored(s, s.ball);
      this.set({
        ...s,
        ball: { ...s.ball, outcome: 'goal' },
        lastAttempt: attempt,
        phase: 'celebrating',
        goals: counts ? s.goals + 1 : s.goals,
        // The last square of a cutout adds the bonus for the whole cutout (FR-126).
        starsThisRound: s.starsThisRound + GOAL_STARS + (s.target?.cutout ? CUTOUT_BONUS_STARS : 0),
        missesInRow: 0,
        message: levelUp === null ? { kind: 'goal' } : { kind: 'levelUp', level: levelUp },
      });
      return;
    }

    const number = s.ball.number;
    const misses = s.missesInRow + 1;
    const shown: ShownSquare = { number, remainingMs: SHOWN_MS };
    // A number behind the wall hits the wall (FR-142); it counts as any other miss.
    const blocked = wallBlocks(layoutChart(s.min, s.max), s.wall, number);
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
      const next: MatchState = {
        ...missed,
        // After the last heart the round ends; no square shows under the round end.
        shown: hearts <= 0 ? null : shown,
        hearts,
        missesInRow: 0,
        helpStep: ANSWER_STEP,
        helpChartOpen: false,
        phase: hearts <= 0 ? 'roundOver' : 'aiming',
        message: { kind: 'heartLost', number },
      };
      // The round ends on this target: it counts as not solved (FR-037).
      if (next.phase === 'roundOver') this.endRound(next);
      else this.set(next);
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
   * arrived first. A save counts for the saves and earns KEEPER_SAVE_STARS; a save on the answer of help step 4 counts
   * only with "Punkt nach voller Hilfe" (FR-025b), as a goal does. Otherwise the target square shows its number.
   */
  private decideShot(s: MatchState, typed: number | null): void {
    const shot = s.keeperShot;
    const target = s.target;
    if (shot === null || target === null) return;
    const result = shotResult(target.number, typed);
    const saved = result === 'saved';
    const counts = s.helpStep < ANSWER_STEP || this.roundSettings.pointAfterFullHelp;
    let message: MatchMessage = { kind: 'saved' };
    if (result === 'wrong') message = { kind: 'conceded', number: target.number };
    else if (result === 'late') message = { kind: 'late', number: target.number };
    const decided = { ...shot, held: false, result, typed, resultLeftMs: KEEPER_RESULT_MS };
    const shown = saved ? null : { number: target.number, remainingMs: KEEPER_RESULT_MS };
    if (s.shootout !== null) {
      // The opponent's kick of the shootout: a save is his miss. Saves earn no stars here (FR-148).
      this.set({
        ...s,
        entry: '',
        helpChartOpen: false,
        keeperShot: decided,
        shootout: { ...s.shootout, kicks: addKick(s.shootout.kicks, saved ? 'miss' : 'goal') },
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
      keeperShot: decided,
      shots: Math.min(KEEPER_SHOTS, s.shots + 1),
      goals: saved && counts ? s.goals + 1 : s.goals,
      starsThisRound: s.starsThisRound + (saved ? KEEPER_SAVE_STARS : 0),
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
    if (s.shootout !== null) {
      this.set(this.nextKick({ ...s, keeperShot: null }));
      return;
    }
    const next: MatchState = { ...s, ...TARGET_RESET, entry: '', message: null };
    if (s.shots >= KEEPER_SHOTS) {
      this.set({ ...next, keeperShot: null, phase: 'roundOver' });
      return;
    }
    this.set(this.withNextTarget(next));
  }

  /**
   * The child's kick of the shootout landed (FR-147): the target number scores and is celebrated; any other number is
   * a miss of the kick, and its square shows its number until the opponent's turn. Both record the attempt.
   */
  private kicked(s: MatchState, shootout: ShootoutState, ball: Ball, hit: boolean): void {
    if (hit) {
      const { attempt, levelUp } = this.scored(s, ball);
      this.set({
        ...s,
        ball: { ...ball, outcome: 'goal' },
        lastAttempt: attempt,
        phase: 'celebrating',
        goals: s.goals + 1,
        missesInRow: 0,
        shootout: { kicks: addKick(shootout.kicks, 'goal'), waitMs: 0 },
        message: levelUp === null ? { kind: 'goal' } : { kind: 'levelUp', level: levelUp },
      });
      return;
    }
    const missed: MatchState = {
      ...s,
      ball: { ...ball, outcome: 'miss' },
      targetMisses: s.targetMisses + 1,
      missTimes: [...s.missTimes, ball.atMs].slice(-MISS_TIMES_KEPT),
      lastGuess: ball.number,
      helpChartOpen: false,
    };
    this.recordAttempt(missed, { solved: false, endedAt: ball.atMs });
    this.feedbackMs = SHOWN_MS;
    this.set({
      ...missed,
      phase: 'aiming',
      shown: { number: ball.number, remainingMs: SHOWN_MS },
      shootout: { kicks: addKick(shootout.kicks, 'miss'), waitMs: SHOWN_MS },
      message: { kind: 'kickMissed', number: ball.number },
    });
  }

  /**
   * The shootout after a kick: the next kick, or the end once a side has won (FR-147). A win of the child adds
   * SHOOTOUT_WIN_STARS (FR-148).
   */
  private nextKick(s: MatchState): MatchState {
    if (s.shootout === null) return s;
    const shootout = { ...s.shootout, waitMs: 0 };
    const next: MatchState = { ...s, ...TARGET_RESET, ball: null, entry: '', message: null, keeperShot: null, shootout };
    const winner = shootoutWinner(shootout.kicks);
    if (winner !== null) {
      return { ...next, phase: 'roundOver', starsThisRound: s.starsThisRound + (winner === 0 ? SHOOTOUT_WIN_STARS : 0) };
    }
    return this.withNextTarget({ ...next, phase: 'aiming' });
  }

  /**
   * A square of a cutout that is not its last one got the correct number (FR-125): the attempt is recorded, FILL_STARS
   * are earned and the next square is the target at once; no goal, no celebration. When the time of a time challenge ran
   * out while the ball flew, the round ends here instead.
   */
  private filled(s: MatchState, ball: Ball): void {
    const { attempt, levelUp } = this.scored(s, ball);
    const landed: MatchState = {
      ...s,
      ...TARGET_RESET,
      ball: { ...ball, outcome: 'filled' },
      lastAttempt: attempt,
      starsThisRound: s.starsThisRound + FILL_STARS,
      message: levelUp === null ? { kind: 'filled', number: ball.number } : { kind: 'levelUp', level: levelUp },
    };
    if (timeUp(s)) {
      this.set({ ...landed, phase: 'roundOver' });
      return;
    }
    this.set(this.withNextTarget({ ...landed, phase: 'aiming' }));
  }

  /** Records the attempt at the target of `s` that `ball` just scored; returns it for `lastAttempt`, and a new level. */
  private scored(s: MatchState, ball: Ball): { attempt: FinishedAttempt; levelUp: Level | null } {
    const solved = s.helpStep < ANSWER_STEP;
    const levelUp = this.recordAttempt(s, { solved, endedAt: ball.atMs });
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
    if (s.keeperShot !== null && s.keeperShot.result !== null) return;
    if (shootoutWaits(s)) return;
    // Help holds the opponent's shot until the next key, so asking never costs a save (FR-145).
    const keeperShot = s.keeperShot === null ? null : { ...s.keeperShot, held: true };
    this.set({ ...s, ...this.helpRaised(s.helpStep), keeperShot });
  }

  /** Closes the help chart; the help step stays. */
  closeHelpChart(): void {
    if (!this.state.helpChartOpen) return;
    this.set({ ...this.state, helpChartOpen: false }, { save: false });
  }

  pause(): void {
    if (!this.state.started || this.state.paused || this.state.phase === 'roundOver') return;
    this.set({ ...this.state, paused: true }, { save: false });
  }

  resume(): void {
    if (!this.state.paused) return;
    this.set({ ...this.state, paused: false }, { save: false });
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
   * Adds `ms` of time played while a round runs and is not paused (FR-029); the app does not tick while the tab is
   * hidden. The shown square counts down with the same time.
   */
  tick(ms: number): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase === 'roundOver' || !(ms > 0)) return;
    // A time challenge's time played stops at its length, so the countdown shows 0:00 while a last ball lands.
    const total = challengeMs(s);
    const elapsedMs = total === null ? s.elapsedMs + ms : Math.min(total, s.elapsedMs + ms);

    const remaining = s.shown ? s.shown.remainingMs - ms : 0;
    const shown = s.shown && remaining > 0 ? { ...s.shown, remainingMs: remaining } : null;
    const save = Math.floor(elapsedMs / SAVE_TIME_EVERY_MS) !== Math.floor(s.elapsedMs / SAVE_TIME_EVERY_MS);
    this.feedbackMs = Math.max(0, this.feedbackMs - ms);
    let next: MatchState = { ...s, elapsedMs, shown };
    const shot = s.keeperShot;
    if (shot !== null) {
      if (shot.result === null) {
        // The shot flies, unless help or the help chart holds it (FR-145).
        if (!shot.held && !s.helpChartOpen) {
          const leftMs = Math.max(0, shot.leftMs - ms);
          next = { ...next, keeperShot: { ...shot, leftMs } };
          if (leftMs === 0) {
            this.decideShot(next, null);
            return;
          }
        }
      } else {
        const resultLeftMs = Math.max(0, shot.resultLeftMs - ms);
        next = { ...next, keeperShot: { ...shot, resultLeftMs } };
        if (resultLeftMs === 0) {
          this.afterShot(next);
          return;
        }
      }
    }
    const shootout = s.shootout;
    if (shootout !== null && shootout.waitMs > 0) {
      // After a missed kick of the child, the opponent's turn comes once its square has shown its number.
      const waitMs = Math.max(0, shootout.waitMs - ms);
      next = { ...next, shootout: { ...shootout, waitMs } };
      if (waitMs === 0) {
        this.set(this.nextKick(next));
        return;
      }
    }
    // Also a round restored at zero ends here, on its first tick.
    if (timeUp(next) && next.phase === 'aiming') {
      this.endAtZero(next);
      return;
    }
    if (elapsedMs === s.elapsedMs && shown === s.shown && next.keeperShot === s.keeperShot && next.shootout === s.shootout) return;
    this.set(next, { save });
  }

  /** Ends a time challenge whose countdown reached zero while the child aimed; the current target counts as not solved. */
  private endAtZero(s: MatchState): void {
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
    if (s.shootout !== null) return this.nextKick(s);
    const next: MatchState = { ...s, ...TARGET_RESET, ball: null, message: null };
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
    // The shootout's turns take turns, so a shape or cutout never goes on into the next kick.
    const inShape = state.target && state.shootout === null ? nextInShape(state.target) : null;
    const target = inShape ?? (this.options.nextTarget ? this.options.nextTarget(state) : this.defaultTarget(state));
    const next: MatchState = { ...state, ...fresh, target };
    // The first shot of the round flies at the slow speed: the first of "Selbst ins Tor", the opponent's first kick.
    const index = next.shootout !== null ? next.shootout.kicks[1].length : next.shots;
    const keeperShot = opponentShoots(next) && target !== null ? newShot(flightMsOf(this.roundSettings.keeperSpeed, index)) : null;
    return { ...next, wall: this.wallFor(next, state.ball?.outcome === 'filled'), keeperShot };
  }

  /**
   * The wall for the target of `s` in the mode 'wall' (FR-142): the same wall after a filled square of a cutout
   * (`keep`), while it still leaves the target clear; a new one in other columns after a goal or for a new target.
   * Its random numbers derive from the seed and the target count, apart from the target's.
   */
  private wallFor(s: MatchState, keep: boolean): Wall | null {
    if (s.mode !== 'wall' || s.target === null) return null;
    const layout = layoutChart(s.min, s.max);
    if (keep && s.wall !== null && wallClear(layout, s.wall, s.target)) return s.wall;
    return placeWall(layout, s.target, createRng(deriveSeed(s.seed, s.targetCount, WALL_SEED)), s.wall);
  }

  /**
   * The next target from core/targets, with the round's seeded `Rng`. A cup match plays its own level (FR-109): the
   * child's level and the X shape's two empty squares of adaptive difficulty do not apply.
   */
  private defaultTarget(state: MatchState): Target | null {
    const progress = this.options.progress?.() ?? NO_PROGRESS;
    if (opponentShoots(state)) {
      // "Selbst ins Tor" and the opponent's kicks: any square, with hints by the child's level in reverse (FR-146).
      const rng = createRng(deriveSeed(state.seed, state.targetCount));
      return keeperTarget(layoutChart(state.min, state.max), progress.level, rng, state.target?.number ?? null);
    }
    return nextTarget({
      layout: layoutChart(state.min, state.max),
      settings: this.roundSettings,
      progress: state.cupMatch === null ? progress : { ...progress, level: state.cupMatch.level, xTwoEmpties: false },
      rng: createRng(deriveSeed(state.seed, state.targetCount)),
      avoid: state.target?.number,
    });
  }

  /** Hands the record of the finished current target of `s` to `onAttempt` (T043); returns a level it raised. */
  private recordAttempt(s: MatchState, end: { solved: boolean; endedAt: number }): Level | null {
    // The squares of "Selbst ins Tor" and of the opponent's kicks follow the level in reverse, so they never move the
    // child's level.
    if (!this.options.onAttempt || !s.target || s.mode === 'keeper' || s.keeperShot !== null) return null;
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
    // Settings saved while the ball flew or the goal was celebrated give their new target once the round aims again and
    // the landing feedback has finished (review M1).
    if (this.newTargetPending) {
      if (next.phase === 'roundOver') this.newTargetPending = false;
      else if (next.phase === 'aiming' && next.started && this.feedbackMs <= 0) {
        next = this.withNewSettings(next);
        save = true;
      }
    }
    if (import.meta.env.DEV) {
      const errors = matchInvariantErrors(next);
      if (errors.length > 0) throw new Error(`MatchController: inconsistent state: ${errors.join('; ')}`);
    }
    this.state = next;
    if (save) this.persist();
    for (const fn of this.listeners) fn();
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
    store.save({ version: 1, ...storedFields(s), goalsPerRound: this.roundSettings.goalsPerRound, phase: s.phase });
  }
}


/**
 * The match state owner (research R7, data-model "Round", contracts/core-api.md `MatchController`), shaped after
 * math-tank's BattleController. React and Phaser read `getState()`, listen with `subscribe()` and send actions; they
 * never change the state. Every change creates a new state object, so `useSyncExternalStore` sees it.
 *
 * Phases: aiming --shoot(n in range)--> ballInFlight --ballLanded--> a goal goes on to celebrating, and
 * celebrationDone gives the next target or ends the round; a miss returns to aiming. roundOver ends the round, at 0
 * hearts (`untilHearts`) or at `goalsPerRound` goals (`goalCount`).
 *
 * Hole mode (T029): a miss shows the square of the typed number for SHOWN_MS (FR-004) and raises the help step; after
 * the difficulty's number of misses in a row a heart is lost, the target stays and help jumps to the answer (FR-027).
 * The round is saved between shots so a refresh continues it (FR-036a: a stored round for another range or mode is
 * discarded).
 *
 * Help (T038, FR-024, FR-025): H, the help button and each miss raise the help step up to 3. Step 2 opens the help
 * chart; Enter, Space, Escape or a tap close it, and that Enter does not shoot. Help never changes hearts, stars or
 * goals. What each step shows comes from help.ts.
 *
 * Line mode (T050, FR-015 to FR-018, FR-026): a round plays lines from `makeLine` (core/targets/lines.ts). The
 * direction of each new line is picked from the parent's line directions, directions not yet mastered twice as often.
 * The target is the next empty square of the line. A correct number lights that square (`correctSquare`), earns
 * SQUARE_STARS and makes the next square the target, without a celebration. The last square scores a goal, which is one
 * finished line for `goalsPerRound`, and earns LINE_STARS on top. Misses, hearts and help work as in hole mode, on the
 * one square: after a lost heart the square stays the target with the answer shown, and the line goes on after it.
 * Every square is one attempt record with the line's direction.
 *
 * Goalkeeper mode (T053, FR-019, FR-020): targets come from `nextTarget` like hole mode, with the hint numbers lit in
 * the grid around an empty target square and no patched holes. The rules are those of hole mode: the target number is
 * a goal worth GOAL_STARS, any other number is a miss whose square shows. The keeper's dive and catch are drawn by
 * KeeperView from this state; the controller does not track the keeper.
 *
 * Settings saved during a round (amendment 01, FR-052, after math-tank's `applySettingsNow`): `applySettings` takes them
 * into the running round. Round type and goals per round keep their round-start values. When a target-shaping setting
 * changed (TARGET_KEYS), the round gets a new target (or a new line) on the board of the new range; goals, hearts, stars,
 * time and the paused state stay, and the dropped target records no attempt. While the ball flies or the goal is
 * celebrated, the new target waits until the round is back in 'aiming' and the landing feedback has finished: after a
 * miss or a lit line square that is SHOWN_MS of play time, so the scene still reads the landed ball, the message and
 * the shown square right after `ballLanded`.
 *
 * Views get a deep read-only view of the state (`MatchView`). In development builds `set()` checks the rules between
 * fields (`matchInvariantErrors`) and throws when one is broken; the state type itself stays one flat record.
 */
import { layoutChart } from '../chart/layout';
import { createRng, deriveSeed } from '../rng';
import { starsFor } from '../rewards/lockerRoom';
import { MISSES_PER_HEART } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { makeAttemptRecord } from '../progress/attempt';
import type { AttemptRecord, StoredRound } from '../storage/schemas';
import { makeLine, type Line } from '../targets/lines';
import { NO_PROGRESS, nextTarget, pickDirection, type TargetProgress } from '../targets/nextTarget';
import { DIRECTIONS, type DeepReadonly, type Mode, type Target } from '../types';
import { entryReducer, entryValue, maxDigitsOf, type EntryKey } from './entry';
import { ANSWER_STEP, CHART_STEP } from './help';

export type Phase = 'aiming' | 'ballInFlight' | 'celebrating' | 'roundOver';

/** The highest help step: step 3 shows the answer. */
export const MAX_HELP_STEP = ANSWER_STEP;

/** How long the square of a missed number shows its number (FR-004: at least 1.5 seconds). */
export const SHOWN_MS = 1500;

/** Time played is saved with the round at most this often, so ticks do not write storage on every frame. */
const SAVE_TIME_EVERY_MS = 1000;

/** What the message line says; the app turns it into German text. */
export type MatchMessage =
  | { kind: 'outOfRange'; min: number; max: number }
  | { kind: 'goal' }
  | { kind: 'correctSquare' }
  | { kind: 'miss'; number: number }
  | { kind: 'heartLost'; number: number };

/** The ball after a shot: the typed number and, once landed, whether it scored or lit a line square. */
export interface Ball {
  number: number;
  outcome: 'goal' | 'square' | 'miss' | null;
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
 * `solved` is false when the goal came after help step 3, the answer (FR-025b).
 */
export interface FinishedAttempt {
  number: number;
  solved: boolean;
  /** The highest help step used on the target, 0 to 3. */
  helpStep: number;
}

export interface MatchState {
  /** False before the first `start()`. */
  started: boolean;
  mode: Mode;
  roundType: Settings['roundType'];
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
  /** The line in line mode; null in the other modes. */
  line: Line | null;
  /** How many targets the round has had; the next target's random numbers derive from the seed and this count. */
  targetCount: number;
  /** The square of the last missed number while it shows its number. */
  shown: ShownSquare | null;
  goals: number;
  /** 3 down to 0; used with `untilHearts`. */
  hearts: number;
  missesInRow: number;
  /** 0 to 3. */
  helpStep: number;
  /** The help chart of step 2 is open (FR-025a). */
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
 * - a line exists only in line mode, and a running line round always has one.
 */
export function matchInvariantErrors(s: MatchState): string[] {
  const errors: string[] = [];
  const flying = s.ball !== null && s.ball.outcome === null;
  if ((s.phase === 'ballInFlight') !== flying) errors.push(`ball ${JSON.stringify(s.ball)} in phase ${s.phase}`);
  if (s.phase === 'celebrating' && s.ball?.outcome !== 'goal') errors.push('celebrating without a goal');
  if (s.phase === 'roundOver' && s.shown !== null) errors.push('shown square after the round ended');
  if (s.line !== null && s.mode !== 'lines') errors.push(`line in ${s.mode} mode`);
  if (s.mode === 'lines' && s.started && s.phase !== 'roundOver' && s.line === null) errors.push('line mode without a line');
  return errors;
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
  progress?: (mode: Mode) => TargetProgress;
  /** Saves the round so a refresh continues it; no saving without it. */
  store?: RoundStore;
  /** Receives one record per finished target: scored, or left when the round ended (T043, FR-037). */
  onAttempt?: (record: AttemptRecord) => void;
  /** The wall clock for the records' `at`; defaults to now. */
  now?: () => Date;
}

export const START_HEARTS = 3;

/** The match state fields a stored round keeps; `phase` and `goalsPerRound` are saved and restored on their own. */
const STORED_KEYS = [
  'seed',
  'mode',
  'roundType',
  'min',
  'max',
  'goals',
  'hearts',
  'missesInRow',
  'helpStep',
  'target',
  'line',
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

function freshState(s: Settings, mode: Mode, seed: number, started: boolean): MatchState {
  return {
    started,
    mode,
    roundType: s.roundType,
    seed,
    min: s.range.min,
    max: s.range.max,
    phase: 'aiming',
    paused: false,
    entry: '',
    message: null,
    ball: null,
    target: null,
    line: null,
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
  'modes',
  'hintDisplay',
  'hintDistance',
  'lineDirections',
  'lineLength',
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

/** The guess rule looks at misses within the last 5 seconds; this many are enough to keep (classify.ts). */
const MISS_TIMES_KEPT = 5;

export class MatchController {
  private state: MatchState;
  private readonly listeners = new Set<() => void>();
  private readonly options: MatchControllerOptions;
  /** The settings the running round uses: those of its start, updated by `applySettings` (FR-052). */
  private roundSettings: Settings;
  /** True while saved target-shaping settings wait for the round to be back in 'aiming' (FR-052). */
  private newTargetPending = false;
  /** Play time left of the landing feedback of the last miss or line square; a pending new target waits for it. */
  private feedbackMs = 0;

  constructor(options: MatchControllerOptions) {
    this.options = options;
    this.roundSettings = options.settings();
    this.state = freshState(this.roundSettings, 'holes', 0, false);
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
   * The round on the board of the round settings' range with a new target or line. Goals, hearts, stars, time and the
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
      line: null,
    });
  }

  /** Calls `fn` after every state change; returns a function that stops it. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Starts a new round in `mode` with the current settings. */
  start(mode: Mode): void {
    this.newTargetPending = false;
    this.feedbackMs = 0;
    this.roundSettings = this.options.settings();
    const seed = this.options.newSeed?.() ?? Date.now() % 2_147_483_647;
    this.set(this.withNextTarget(freshState(this.roundSettings, mode, seed, true)));
  }

  /**
   * Continues the stored round after a refresh. Returns false, and deletes the stored round, when there is none or it
   * no longer fits the settings: another range, or a mode the parent turned off (FR-036a).
   */
  restore(): boolean {
    const store = this.options.store;
    const stored = store?.load() ?? null;
    if (!store || !stored) return false;
    const s = this.options.settings();
    if (stored.min !== s.range.min || stored.max !== s.range.max || !s.modes[stored.mode]) {
      store.clear();
      return false;
    }
    this.newTargetPending = false;
    this.feedbackMs = 0;
    // Round type and goals per round keep their round-start values across a refresh (FR-052); a round stored before
    // they were kept uses the current goals per round.
    this.roundSettings = { ...s, roundType: stored.roundType, goalsPerRound: stored.goalsPerRound ?? s.goalsPerRound };
    const state: MatchState = { ...freshState(this.roundSettings, stored.mode, stored.seed, true), ...storedFields(stored) };
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
    const entry = entryReducer(this.state.entry, key, maxDigitsOf(this.state));
    if (entry !== this.state.entry) this.set({ ...this.state, entry }, { save: false });
  }

  /** Shoots the typed number. A number outside the range is not shot; the message names the range (FR-005). */
  shoot(): void {
    const s = this.state;
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
    this.set({ ...s, entry: '', message: null, phase: 'ballInFlight', ball: { number: n, outcome: null, atMs: s.elapsedMs } }, { save: false });
  }

  /** Called by the scene when the ball arrives. Decides goal or miss from the ball's number and the target. */
  ballLanded(): void {
    const s = this.state;
    if (s.phase !== 'ballInFlight' || !s.ball) return;
    const hit = s.target !== null && s.ball.number === s.target.number;
    if (hit && s.line && s.line.index < s.line.squares.length - 1) {
      this.squareLit(s, s.line);
      return;
    }
    if (hit) {
      // A shot at the answer of help step 3 scores and celebrates; it counts for the goal counter only when the parent
      // keeps "Punkt nach voller Hilfe" on (FR-025b).
      const counts = s.helpStep < MAX_HELP_STEP || this.roundSettings.pointAfterFullHelp;
      // In line mode the goal finishes the line: every square lights, and a correct square's star comes with the bonus.
      const lineStars = starsFor(s.line ? 'lineDone' : 'goal', s.mode);
      this.set({
        ...s,
        line: s.line ? { ...s.line, index: s.line.squares.length } : null,
        ball: { ...s.ball, outcome: 'goal' },
        lastAttempt: this.scored(s, s.ball),
        phase: 'celebrating',
        goals: counts ? s.goals + 1 : s.goals,
        starsThisRound: s.starsThisRound + lineStars,
        missesInRow: 0,
        message: { kind: 'goal' },
      });
      return;
    }

    const number = s.ball.number;
    const misses = s.missesInRow + 1;
    const shown: ShownSquare = { number, remainingMs: SHOWN_MS };
    const missed = {
      ...s,
      ball: { ...s.ball, outcome: 'miss' as const },
      targetMisses: s.targetMisses + 1,
      missTimes: [...s.missTimes, s.ball.atMs].slice(-MISS_TIMES_KEPT),
      lastGuess: number,
    };
    this.feedbackMs = SHOWN_MS;
    const heartLost = s.roundType === 'untilHearts' && misses >= MISSES_PER_HEART[this.roundSettings.difficulty];
    if (heartLost) {
      // The target stays; help jumps to the answer and the child shoots it (FR-027, critique P7).
      const hearts = s.hearts - 1;
      const next: MatchState = {
        ...missed,
        // After the last heart the round ends; no square shows under the round end.
        shown: hearts <= 0 ? null : shown,
        hearts,
        missesInRow: 0,
        helpStep: MAX_HELP_STEP,
        helpChartOpen: false,
        phase: hearts <= 0 ? 'roundOver' : 'aiming',
        message: { kind: 'heartLost', number },
      };
      this.set(next);
      // The round ends on this target: it counts as not solved (FR-037).
      if (next.phase === 'roundOver') this.recordAttempt(next, { solved: false, endedAt: next.elapsedMs });
      return;
    }
    this.set({
      ...missed,
      shown,
      phase: 'aiming',
      missesInRow: misses,
      ...this.helpRaised(s.helpStep),
      message: { kind: 'miss', number },
    });
  }

  /** Records the attempt at the target of `s` that `ball` just scored or lit, and returns it for `lastAttempt`. */
  private scored(s: MatchState, ball: Ball): FinishedAttempt {
    const solved = s.helpStep < MAX_HELP_STEP;
    this.recordAttempt(s, { solved, endedAt: ball.atMs });
    return { number: ball.number, solved, helpStep: s.helpStep };
  }

  /** A correct square of the line that is not its last: it lights, and the next square becomes the target (FR-016). */
  private squareLit(s: MatchState, line: Line): void {
    const ball = s.ball!;
    const next: MatchState = {
      ...s,
      ...TARGET_RESET,
      ball: { ...ball, outcome: 'square' },
      line: { ...line, index: line.index + 1 },
      lastAttempt: this.scored(s, ball),
      starsThisRound: s.starsThisRound + starsFor('square', s.mode),
      message: { kind: 'correctSquare' },
      phase: 'aiming',
    };
    this.feedbackMs = SHOWN_MS;
    this.set(this.withNextTarget(next));
  }

  /** Called by the scene when the goal celebration ends: the next target, or the end of the round. */
  celebrationDone(): void {
    if (this.state.phase !== 'celebrating') return;
    this.set(this.afterCelebration(this.state));
  }

  /** One help step further, up to step 3, while the child aims. Step 2 opens the help chart. */
  askHelp(): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase !== 'aiming') return;
    if (s.helpStep >= MAX_HELP_STEP) return;
    this.set({ ...s, ...this.helpRaised(s.helpStep) });
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
   * Adds `ms` of time played while a round runs and is not paused (FR-029); the app does not tick while the tab is
   * hidden. The shown square counts down with the same time.
   */
  tick(ms: number): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase === 'roundOver' || !(ms > 0)) return;
    const elapsedMs = s.elapsedMs + ms;
    const remaining = s.shown ? s.shown.remainingMs - ms : 0;
    const shown = s.shown && remaining > 0 ? { ...s.shown, remainingMs: remaining } : null;
    const save = Math.floor(elapsedMs / SAVE_TIME_EVERY_MS) !== Math.floor(s.elapsedMs / SAVE_TIME_EVERY_MS);
    this.feedbackMs = Math.max(0, this.feedbackMs - ms);
    this.set({ ...s, elapsedMs, shown }, { save });
  }

  /** The help step after `step`, capped at 3; the help chart is open exactly at step 2. */
  private helpRaised(step: number): Pick<MatchState, 'helpStep' | 'helpChartOpen'> {
    const helpStep = Math.min(MAX_HELP_STEP, step + 1);
    return { helpStep, helpChartOpen: helpStep === CHART_STEP };
  }

  private afterCelebration(s: MatchState): MatchState {
    const next: MatchState = { ...s, ...TARGET_RESET, ball: null, message: null };
    if (s.roundType === 'goalCount' && s.goals >= this.roundSettings.goalsPerRound) return { ...next, phase: 'roundOver' };
    return this.withNextTarget({ ...next, phase: 'aiming' });
  }

  /** The state with the round's next target. */
  private withNextTarget(state: MatchState): MatchState {
    const fresh = { targetCount: state.targetCount + 1, targetStartMs: state.elapsedMs, targetMisses: 0, missTimes: [] };
    if (state.mode === 'lines') {
      const line = state.line && state.line.index < state.line.squares.length ? state.line : this.newLine(state);
      return { ...state, ...fresh, line, target: lineTarget(line) };
    }
    const target = this.options.nextTarget ? this.options.nextTarget(state) : this.defaultTarget(state);
    return { ...state, ...fresh, target };
  }

  /**
   * A new line for the round: the direction from the parent's line directions, weighting directions not yet mastered
   * in line mode (FR-017, FR-040), and the parent's line length (FR-018).
   */
  private newLine(state: MatchState): Line {
    const s = this.roundSettings;
    const rng = createRng(deriveSeed(state.seed, state.targetCount));
    const enabled = DIRECTIONS.filter((d) => s.lineDirections[d]);
    const progress = this.options.progress?.('lines') ?? NO_PROGRESS;
    const direction = pickDirection(enabled.length > 0 ? enabled : ['right'], progress.mastered, rng);
    return makeLine(layoutChart(state.min, state.max), direction, s.lineLength, rng);
  }

  /** Hole and goalkeeper targets from core/targets. */
  private defaultTarget(state: MatchState): Target | null {
    return nextTarget({
      layout: layoutChart(state.min, state.max),
      mode: state.mode,
      settings: this.roundSettings,
      progress: this.options.progress?.(state.mode) ?? NO_PROGRESS,
      rng: createRng(deriveSeed(state.seed, state.targetCount)),
      avoid: state.target?.number,
    });
  }

  /** Hands the record of the finished current target of `s` to `onAttempt` (T043). */
  private recordAttempt(s: MatchState, end: { solved: boolean; endedAt: number }): void {
    if (!this.options.onAttempt || !s.target) return;
    this.options.onAttempt(
      makeAttemptRecord({
        mode: s.mode,
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

/**
 * The target of the line's current square. Its hint is the square before it, so help step 1 names the step of the line
 * ("+10") and the arrow starts there; it trains the line's direction (FR-038).
 */
export function lineTarget(line: Line): Target {
  const index = Math.min(line.index, line.squares.length - 1);
  return {
    mode: 'lines',
    number: line.squares[index]!,
    hints: index > 0 ? [line.squares[index - 1]!] : [],
    patchedHoles: [],
    directions: [line.direction],
    difficultyStep: 0,
  };
}

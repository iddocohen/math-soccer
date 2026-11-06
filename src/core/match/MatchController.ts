/**
 * The match state owner (research R7, data-model "Round", contracts/core-api.md `MatchController`), shaped after
 * math-tank's BattleController. React and Phaser read `getState()`, listen with `subscribe()` and send actions; they
 * never change the state. Every change creates a new state object, so `useSyncExternalStore` sees it.
 *
 * This is the skeleton from T018: phases, entry, the range check of `shoot()` (FR-005), help steps, pause and time
 * played. Hole-mode targets, hearts, round end and saving the round follow in T029.
 *
 * Phases: aiming --shoot(n in range)--> ballInFlight --ballLanded--> landed; a goal goes on to celebrating and
 * celebrationDone returns to aiming; a miss returns to aiming. roundOver ends the round.
 */
import type { Settings } from '../settings/schema';
import type { Mode, Target } from '../types';
import { entryReducer, entryValue, maxDigitsOf, type EntryKey } from './entry';

export const PHASES = ['aiming', 'ballInFlight', 'landed', 'celebrating', 'roundOver'] as const;
export type Phase = (typeof PHASES)[number];

/** The highest help step: step 3 shows the answer. */
export const MAX_HELP_STEP = 3;

/** What the message line says; the app turns it into German text. */
export type MatchMessage =
  | { kind: 'outOfRange'; min: number; max: number }
  | { kind: 'goal' }
  | { kind: 'miss'; number: number };

/** The ball after a shot: the typed number and, once landed, whether it scored. */
export interface Ball {
  number: number;
  outcome: 'goal' | 'miss' | null;
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
  goals: number;
  /** 3 down to 0; used with `untilHearts`. */
  hearts: number;
  missesInRow: number;
  /** 0 to 3. */
  helpStep: number;
  starsThisRound: number;
  /** Time played, not counted while paused or after the round. */
  elapsedMs: number;
}

export interface MatchControllerOptions {
  /** Read on every `start()`, so changed settings apply from the next round. */
  settings: () => Settings;
  /** A new round seed; defaults to the clock. */
  newSeed?: () => number;
  /** The next target for the round; T028 and T029 connect the target generator. */
  nextTarget?: (state: MatchState) => Target | null;
}

export const START_HEARTS = 3;

export class MatchController {
  private state: MatchState;
  private readonly listeners = new Set<() => void>();
  private readonly options: MatchControllerOptions;

  constructor(options: MatchControllerOptions) {
    this.options = options;
    const s = options.settings();
    this.state = {
      started: false,
      mode: 'holes',
      roundType: s.roundType,
      seed: 0,
      min: s.range.min,
      max: s.range.max,
      phase: 'aiming',
      paused: false,
      entry: '',
      message: null,
      ball: null,
      target: null,
      goals: 0,
      hearts: START_HEARTS,
      missesInRow: 0,
      helpStep: 0,
      starsThisRound: 0,
      elapsedMs: 0,
    };
  }

  getState(): MatchState {
    return this.state;
  }

  /** Calls `fn` after every state change; returns a function that stops it. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Starts a new round in `mode` with the current settings. */
  start(mode: Mode): void {
    const s = this.options.settings();
    const seed = (this.options.newSeed ?? (() => Date.now() % 2_147_483_647))();
    const fresh: MatchState = {
      started: true,
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
      goals: 0,
      hearts: START_HEARTS,
      missesInRow: 0,
      helpStep: 0,
      starsThisRound: 0,
      elapsedMs: 0,
    };
    this.set({ ...fresh, target: this.pickTarget(fresh) });
  }

  /** One key of the match: digits and Backspace edit the entry, Enter shoots, H asks for help, Escape pauses. */
  typeKey(key: EntryKey): void {
    if (!this.state.started) return;
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
    if (entry !== this.state.entry) this.set({ ...this.state, entry });
  }

  /** Shoots the typed number. A number outside the range is not shot; the message names the range (FR-005). */
  shoot(): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase !== 'aiming') return;
    const n = entryValue(s.entry);
    if (n === null) return;
    if (n < s.min || n > s.max) {
      this.set({ ...s, entry: '', message: { kind: 'outOfRange', min: s.min, max: s.max } });
      return;
    }
    this.set({ ...s, entry: '', message: null, phase: 'ballInFlight', ball: { number: n, outcome: null } });
  }

  /** Called by the scene when the ball arrives. Decides goal or miss from the ball's number and the target. */
  ballLanded(): void {
    const s = this.state;
    if (s.phase !== 'ballInFlight' || !s.ball) return;
    const goal = s.target !== null && s.ball.number === s.target.number;
    const ball: Ball = { ...s.ball, outcome: goal ? 'goal' : 'miss' };
    if (goal) {
      this.set({ ...s, ball, phase: 'celebrating', goals: s.goals + 1, missesInRow: 0, message: { kind: 'goal' } });
      return;
    }
    this.set({
      ...s,
      ball,
      phase: 'aiming',
      missesInRow: s.missesInRow + 1,
      helpStep: Math.min(MAX_HELP_STEP, s.helpStep + 1),
      message: { kind: 'miss', number: s.ball.number },
    });
  }

  /** Called by the scene when the goal celebration ends: the next target. */
  celebrationDone(): void {
    const s = this.state;
    if (s.phase !== 'celebrating') return;
    const next: MatchState = { ...s, phase: 'aiming', ball: null, helpStep: 0, message: null };
    this.set({ ...next, target: this.pickTarget(next) });
  }

  /** One help step further, up to step 3. Not while the ball flies or after the round. */
  askHelp(): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase === 'ballInFlight' || s.phase === 'roundOver') return;
    if (s.helpStep >= MAX_HELP_STEP) return;
    this.set({ ...s, helpStep: s.helpStep + 1 });
  }

  pause(): void {
    if (!this.state.started || this.state.paused || this.state.phase === 'roundOver') return;
    this.set({ ...this.state, paused: true });
  }

  resume(): void {
    if (!this.state.paused) return;
    this.set({ ...this.state, paused: false });
  }

  /** Adds `ms` of time played while a round runs and is not paused (FR-029). */
  tick(ms: number): void {
    const s = this.state;
    if (!s.started || s.paused || s.phase === 'roundOver' || !(ms > 0)) return;
    this.set({ ...s, elapsedMs: s.elapsedMs + ms });
  }

  private pickTarget(state: MatchState): Target | null {
    return this.options.nextTarget?.(state) ?? null;
  }

  private set(next: MatchState): void {
    this.state = next;
    for (const fn of this.listeners) fn();
  }
}

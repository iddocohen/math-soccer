/**
 * Help in three steps (T037; FR-024, FR-025, FR-025b, spec US2): H and each miss raise the help step up to 3, help
 * never changes hearts or stars, step 1 shows the hint numbers with "auf Wunsch" and names the way from the closest
 * hint, step 2 opens the help chart (Enter closes it without shooting), and a goal after step 3 scores but the attempt
 * is not solved.
 */
import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { Target } from '../types';
import type { Digit } from './entry';
import { helpHint, hintsVisible, ON_REQUEST_STEP, targetHintDisplay } from './help';
import { GOAL_STARS } from '../rewards/lockerRoom';
import { MatchController, MAX_HELP_STEP } from './MatchController';

const layout = layoutChart(1, 100);

function target(number: number, hints: number[] = [number - 10]): Target {
  return { number, hints, directions: ['down'], difficultyStep: 0, pattern: 'neighbors' };
}

function makeController(over: Partial<Settings> = {}, answer = 46) {
  const settings = { ...defaultSettings(), ...over };
  const c = new MatchController({ settings: () => settings, newSeed: () => 3, nextTarget: () => target(answer) });
  c.start();
  return c;
}

function shootNumber(c: MatchController, n: number) {
  for (const ch of String(n)) c.typeKey({ digit: Number(ch) as Digit });
  c.typeKey('enter');
  c.ballLanded();
}

describe('help steps (FR-024, FR-025)', () => {
  it('H raises the help step by one up to 3, and never further', () => {
    const c = makeController();
    const steps: number[] = [];
    for (let i = 0; i < 5; i++) {
      c.typeKey('help');
      steps.push(c.getState().helpStep);
      if (c.getState().helpChartOpen) c.closeHelpChart();
    }
    expect(steps).toEqual([1, 2, 3, 3, 3]);
  });

  it('each miss raises the help step by one up to 3', () => {
    // "Bis eine Zahl von Toren" so that no heart limit cuts in.
    const c = makeController({ roundType: 'goalCount' });
    const steps: number[] = [];
    for (let i = 0; i < 4; i++) {
      shootNumber(c, 56);
      steps.push(c.getState().helpStep);
      c.closeHelpChart();
    }
    expect(steps).toEqual([1, 2, 3, 3]);
  });

  it('H and a miss add up: H to step 1, a miss to step 2', () => {
    const c = makeController({ roundType: 'goalCount' });
    c.askHelp();
    shootNumber(c, 47);
    expect(c.getState()).toMatchObject({ helpStep: 2, helpChartOpen: true, lastGuess: 47 });
  });

  it('help never changes hearts, stars or goals', () => {
    const c = makeController();
    const before = c.getState();
    for (let i = 0; i < 3; i++) {
      c.askHelp();
      c.closeHelpChart();
    }
    const after = c.getState();
    expect(after.helpStep).toBe(MAX_HELP_STEP);
    expect({ hearts: after.hearts, stars: after.starsThisRound, goals: after.goals }).toEqual({
      hearts: before.hearts,
      stars: before.starsThisRound,
      goals: before.goals,
    });
  });

  it('help is not available while the ball flies', () => {
    const c = makeController();
    c.typeKey({ digit: 5 });
    c.typeKey('enter');
    c.askHelp();
    expect(c.getState()).toMatchObject({ phase: 'ballInFlight', helpStep: 0 });
  });

  it('a new target starts at help step 0 with the chart closed and no last number', () => {
    const c = makeController({ roundType: 'goalCount' });
    shootNumber(c, 47);
    c.askHelp();
    shootNumber(c, 46);
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ helpStep: 0, helpChartOpen: false, lastGuess: null });
  });
});

describe('help step 1: the hint', () => {
  it('shows the hint numbers with "auf Wunsch" from step 1, and always with "immer"', () => {
    expect([0, 1, 2, 3].map((step) => hintsVisible('onRequest', step))).toEqual([false, true, true, true]);
    expect([0, 1, 2, 3].map((step) => hintsVisible('always', step))).toEqual([true, true, true, true]);
  });

  it('names the direction from the closest neighbor: 36 is one row above 46, so "down"', () => {
    expect(helpHint(layout, target(46, [36]))).toEqual({ from: 36, offset: 10, direction: 'down' });
    expect(helpHint(layout, target(46, [45]))).toEqual({ from: 45, offset: 1, direction: 'right' });
    expect(helpHint(layout, target(46, [57]))).toEqual({ from: 57, offset: -11, direction: 'upLeft' });
    expect(helpHint(layout, target(46, [55]))).toEqual({ from: 55, offset: -9, direction: 'upRight' });
  });

  it('prefers the closest hint, then the smaller difference', () => {
    expect(helpHint(layout, target(46, [26, 36]))?.from).toBe(36);
    expect(helpHint(layout, target(46, [56, 47]))?.from).toBe(47);
  });

  it('a hint further away has no direction, only the difference', () => {
    expect(helpHint(layout, target(46, [26]))).toEqual({ from: 26, offset: 20, direction: null });
  });

  it('does not take a number across the row end as a neighbor: 40 and 41 are not side by side', () => {
    expect(helpHint(layout, target(41, [40]))).toEqual({ from: 40, offset: 1, direction: null });
  });

  it('is null without a target or without hint numbers', () => {
    expect(helpHint(layout, null)).toBeNull();
    expect(helpHint(layout, target(46, []))).toBeNull();
  });
});

describe('help step 2: the help chart', () => {
  it('opens at step 2 and closes at step 3', () => {
    const c = makeController();
    c.askHelp();
    expect(c.getState().helpChartOpen).toBe(false);
    c.askHelp();
    expect(c.getState().helpChartOpen).toBe(true);
    c.askHelp();
    expect(c.getState()).toMatchObject({ helpStep: 3, helpChartOpen: false });
  });

  it('Enter closes the open chart and does not shoot', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ helpStep: 2, helpChartOpen: false, phase: 'aiming', ball: null });
    c.shoot();
    expect(c.getState().phase).toBe('aiming');
  });

  it('a digit closes the open chart and is typed', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    c.typeKey({ digit: 4 });
    expect(c.getState()).toMatchObject({ helpChartOpen: false, entry: '4' });
  });

  it('Escape closes the open chart and does not pause', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    c.typeKey('escape');
    expect(c.getState()).toMatchObject({ helpChartOpen: false, paused: false });
  });

  it('marks the last number shot at the target', () => {
    const c = makeController({ roundType: 'goalCount' });
    shootNumber(c, 47);
    shootNumber(c, 37);
    expect(c.getState()).toMatchObject({ helpStep: 2, helpChartOpen: true, lastGuess: 37 });
  });
});

describe('help step 3: the answer (FR-025b)', () => {
  it('a shot at the answer scores as usual and the attempt is recorded as unsolved', () => {
    const c = makeController();
    for (let i = 0; i < 3; i++) {
      c.askHelp();
      c.closeHelpChart();
    }
    shootNumber(c, 46);
    expect(c.getState()).toMatchObject({
      phase: 'celebrating',
      goals: 1,
      starsThisRound: GOAL_STARS,
      message: { kind: 'goal' },
      lastAttempt: { number: 46, solved: false, helpStep: 3 },
    });
  });

  it('with "Punkt nach voller Hilfe" off, the goal after step 3 does not count for the goal counter', () => {
    const c = makeController({ pointAfterFullHelp: false });
    for (let i = 0; i < 3; i++) {
      c.askHelp();
      c.closeHelpChart();
    }
    shootNumber(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 0, lastAttempt: { solved: false } });
  });

  it('a goal with help step 1 or 2 is solved with help', () => {
    const c = makeController();
    c.askHelp();
    shootNumber(c, 46);
    expect(c.getState().lastAttempt).toEqual({ number: 46, solved: true, helpStep: 1 });
  });
});

describe('targetHintDisplay (FR-040, FR-067: on request only at the top ladder step)', () => {
  it('shows hints always with "immer", whatever the step', () => {
    expect(targetHintDisplay({ hintDisplay: 'always', adaptive: true }, { difficultyStep: ON_REQUEST_STEP })).toBe('always');
  });

  it('with "auf Wunsch" and adaptive on, waits for a request only at step 7', () => {
    const s = { hintDisplay: 'onRequest' as const, adaptive: true };
    expect(ON_REQUEST_STEP).toBe(7);
    expect([0, 3, 6, 7].map((difficultyStep) => targetHintDisplay(s, { difficultyStep }))).toEqual(['always', 'always', 'always', 'onRequest']);
  });

  it('with "auf Wunsch" and adaptive off, applies the parent choice', () => {
    expect(targetHintDisplay({ hintDisplay: 'onRequest', adaptive: false }, { difficultyStep: 0 })).toBe('onRequest');
  });
});

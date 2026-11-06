/**
 * Help in four steps (T037, T096; FR-024, FR-025, FR-025b, FR-091 to FR-095, spec US2, amendment 10): H and each miss
 * raise the help step up to 4, help never changes hearts or stars, step 1 shows the hint numbers with "auf Wunsch",
 * names the way from the closest hint and lights the target's row, step 2 lights its column, step 3 opens the help
 * chart (Enter closes it without shooting), and a goal after step 4 scores but the attempt is not solved. The row
 * scale labels each row with its tens, the column scale 1 to 10.
 */
import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { Target } from '../types';
import type { Digit } from './entry';
import { ANSWER_STEP, CHART_STEP, COLUMN_STEP, columnLabel, helpHint, hintsVisible, ROW_STEP, rowColumnHelp, rowLabel, scalesShown, targetHintDisplay } from './help';
import { GOAL_STARS } from '../rewards/lockerRoom';
import { MatchController, MAX_HELP_STEP } from './MatchController';

const layout = layoutChart(1, 100);

function target(number: number, hints: number[] = [number - 10]): Target {
  return { number, hints, directions: ['down'], level: 1, pattern: 'neighbors' };
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
  it('H raises the help step by one up to 4, and never further', () => {
    const c = makeController();
    const steps: number[] = [];
    for (let i = 0; i < 5; i++) {
      c.typeKey('help');
      steps.push(c.getState().helpStep);
      if (c.getState().helpChartOpen) c.closeHelpChart();
    }
    expect(steps).toEqual([1, 2, 3, 4, 4]);
  });

  it('each miss raises the help step by one up to 4', () => {
    // "Bis eine Zahl von Toren" so that no heart limit cuts in.
    const c = makeController({ roundType: 'goalCount' });
    const steps: number[] = [];
    for (let i = 0; i < 5; i++) {
      shootNumber(c, 56);
      steps.push(c.getState().helpStep);
      c.closeHelpChart();
    }
    expect(steps).toEqual([1, 2, 3, 4, 4]);
  });

  it('H and a miss add up: H to step 1, a miss to step 2', () => {
    const c = makeController({ roundType: 'goalCount' });
    c.askHelp();
    shootNumber(c, 47);
    expect(c.getState()).toMatchObject({ helpStep: 2, helpChartOpen: false, lastGuess: 47 });
  });

  it('follows the order row, column, whole chart, answer (FR-094)', () => {
    expect([ROW_STEP, COLUMN_STEP, CHART_STEP, ANSWER_STEP]).toEqual([1, 2, 3, 4]);
    expect(MAX_HELP_STEP).toBe(ANSWER_STEP);
  });

  it('help never changes hearts, stars or goals', () => {
    const c = makeController();
    const before = c.getState();
    for (let i = 0; i < 4; i++) {
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
    expect([0, 1, 2, 3, 4].map((step) => hintsVisible('onRequest', step))).toEqual([false, true, true, true, true]);
    expect([0, 1, 2, 3, 4].map((step) => hintsVisible('always', step))).toEqual([true, true, true, true, true]);
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

describe('help step 3: the help chart', () => {
  it('opens at step 3 and closes at step 4', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    expect(c.getState().helpChartOpen).toBe(false);
    c.askHelp();
    expect(c.getState().helpChartOpen).toBe(true);
    c.askHelp();
    expect(c.getState()).toMatchObject({ helpStep: 4, helpChartOpen: false });
  });

  it('Enter closes the open chart and does not shoot', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    c.askHelp();
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ helpStep: 3, helpChartOpen: false, phase: 'aiming', ball: null });
    c.shoot();
    expect(c.getState().phase).toBe('aiming');
  });

  it('a digit closes the open chart and is typed', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    c.askHelp();
    c.typeKey({ digit: 4 });
    expect(c.getState()).toMatchObject({ helpChartOpen: false, entry: '4' });
  });

  it('Escape closes the open chart and does not pause', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    c.askHelp();
    c.typeKey('escape');
    expect(c.getState()).toMatchObject({ helpChartOpen: false, paused: false });
  });

  it('marks the last number shot at the target', () => {
    const c = makeController({ roundType: 'goalCount' });
    shootNumber(c, 47);
    shootNumber(c, 57);
    shootNumber(c, 37);
    expect(c.getState()).toMatchObject({ helpStep: 3, helpChartOpen: true, lastGuess: 37 });
  });
});

describe('help step 4: the answer (FR-025b, FR-094)', () => {
  it('a shot after step 4 scores as usual and the attempt is recorded as unsolved', () => {
    const c = makeController();
    for (let i = 0; i < 4; i++) {
      c.askHelp();
      c.closeHelpChart();
    }
    shootNumber(c, 46);
    expect(c.getState()).toMatchObject({
      phase: 'celebrating',
      goals: 1,
      starsThisRound: GOAL_STARS,
      message: { kind: 'goal' },
      lastAttempt: { number: 46, solved: false, helpStep: 4 },
    });
  });

  it('with "Punkt nach voller Hilfe" off, the goal after step 4 does not count for the goal counter', () => {
    const c = makeController({ pointAfterFullHelp: false });
    for (let i = 0; i < 4; i++) {
      c.askHelp();
      c.closeHelpChart();
    }
    shootNumber(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 0, lastAttempt: { solved: false } });
  });

  it('a goal with help step 1, 2 or 3 is solved with help', () => {
    for (const step of [1, 2, 3]) {
      const c = makeController();
      for (let i = 0; i < step; i++) {
        c.askHelp();
        c.closeHelpChart();
      }
      shootNumber(c, 46);
      expect(c.getState().lastAttempt).toEqual({ number: 46, solved: true, helpStep: step });
    }
  });
});

describe('the row and column helper (FR-091 to FR-095, amendment 10)', () => {
  const labels = (min: number, max: number) => {
    const l = layoutChart(min, max);
    return Array.from({ length: l.rows }, (_, row) => rowLabel(l, row));
  };

  it('labels each row with its tens: 0 to 90 for 1 to 100', () => {
    expect(labels(1, 100)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('labels each row with its tens: 0 to 1000 for 0 to 1000, and 190 for the row 191 to 200', () => {
    const all = labels(0, 1000);
    expect(all).toHaveLength(101);
    expect(all.slice(0, 3)).toEqual([0, 10, 20]);
    expect(all.at(-1)).toBe(1000);
    expect(labels(1, 200).at(-1)).toBe(190);
  });

  it('labels each row with its tens: 200 to 470 for 205 to 480', () => {
    const all = labels(205, 480);
    expect(all[0]).toBe(200);
    expect(all.at(-1)).toBe(470);
    expect(all).toEqual(Array.from({ length: 28 }, (_, i) => 200 + i * 10));
  });

  it('labels the columns 1 to 10', () => {
    expect(Array.from({ length: 10 }, (_, col) => columnLabel(col))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('lights no band before help, the row from step 1 and the column from step 2: 46 is in row 40, column 6', () => {
    const t = target(46);
    expect(rowColumnHelp(layout, t, 0, true)).toMatchObject({ litRow: null, litColumn: null });
    expect(rowColumnHelp(layout, t, 1, true)).toMatchObject({ litRow: 4, litColumn: null });
    for (const step of [2, 3, 4]) expect(rowColumnHelp(layout, t, step, true)).toMatchObject({ litRow: 4, litColumn: 5 });
    const help = rowColumnHelp(layout, t, 2, true);
    expect(help.rows.filter((r) => r.lit).map((r) => r.text)).toEqual(['40']);
    expect(help.columns.filter((c) => c.lit).map((c) => c.text)).toEqual(['6']);
  });

  it('matches the bands to the target: 100 is in row 90, column 10, and 91 in row 90, column 1', () => {
    expect(rowColumnHelp(layout, target(100), 2, true)).toMatchObject({ litRow: 9, litColumn: 9 });
    expect(rowColumnHelp(layout, target(91), 2, true)).toMatchObject({ litRow: 9, litColumn: 0 });
    expect(rowLabel(layout, 9)).toBe(90);
  });

  it('shows every label of a shown scale while the helper is on, and none when it is off unless help lights it (FR-095)', () => {
    const on = rowColumnHelp(layout, target(46), 2, true);
    expect(on.rows).toHaveLength(10);
    expect(on.columns).toHaveLength(10);
    const off = rowColumnHelp(layout, target(46), 0, false);
    expect(off).toMatchObject({ rows: [], columns: [] });
    const offHelped = rowColumnHelp(layout, target(46), 2, false);
    expect(offHelped.rows).toEqual([{ index: 4, text: '40', lit: true }]);
    expect(offHelped.columns).toEqual([{ index: 5, text: '6', lit: true }]);
    expect(offHelped).toMatchObject({ litRow: 4, litColumn: 5 });
  });

  it('shows only every fifth row label over 20 rows, and the lit one always', () => {
    const big = layoutChart(0, 1000);
    const help = rowColumnHelp(big, target(463), 1, true);
    const texts = help.rows.map((r) => r.text);
    expect(texts).toContain('460');
    expect(texts).toContain('450');
    expect(texts).not.toContain('470');
    expect(help.rows.filter((r) => !r.lit).every((r) => r.index % 5 === 0)).toBe(true);
    expect(rowColumnHelp(layoutChart(1, 200), null, 1, true).rows).toHaveLength(20);
  });
});

describe('the scales show only with help (amendment 14, FR-115)', () => {
  const t46 = { number: 46 };

  it('hides both scales at help step 0, shows the row scale from step 1 and the column scale from step 2', () => {
    expect(scalesShown(0)).toBe('none');
    expect(scalesShown(1)).toBe('row');
    for (const step of [2, 3, 4]) expect(scalesShown(step)).toBe('both');
    expect(rowColumnHelp(layout, t46, 0, true)).toMatchObject({ rows: [], columns: [], litRow: null, litColumn: null });
    const one = rowColumnHelp(layout, t46, 1, true);
    expect(one.rows).toHaveLength(10);
    expect(one.columns).toEqual([]);
    expect(one).toMatchObject({ litRow: 4, litColumn: null });
  });

  it('shows no scale and no band once the target is scored', () => {
    for (const step of [0, 1, 2, 3, 4]) {
      expect(scalesShown(step, true)).toBe('none');
      expect(rowColumnHelp(layout, t46, step, true, true)).toEqual({ rows: [], columns: [], litRow: null, litColumn: null });
    }
  });

  it('a replaced target starts again without scales, since a new target starts at help step 0', () => {
    const c = makeController();
    c.askHelp();
    c.askHelp();
    expect(scalesShown(c.getState().helpStep)).toBe('both');
    // A target-shaping setting saved during the round replaces the target (FR-052).
    c.applySettings({ ...defaultSettings(), pointAfterFullHelp: !defaultSettings().pointAfterFullHelp });
    expect(scalesShown(c.getState().helpStep)).toBe('none');
  });
});

describe('targetHintDisplay (FR-040, amendment 09: on request only at the hardest level)', () => {
  const base = defaultSettings();
  it('shows hints always with "immer", whatever the level', () => {
    expect(targetHintDisplay({ ...base, hintDisplay: 'always', adaptive: true }, { level: 5 })).toBe('always');
  });

  it('with "auf Wunsch" and adaptive on, waits for a request only at the hardest level the parent allows', () => {
    const s = { ...base, hintDisplay: 'onRequest' as const, adaptive: true };
    expect(([1, 2, 3, 4, 5] as const).map((level) => targetHintDisplay(s, { level }))).toEqual(['always', 'always', 'always', 'always', 'onRequest']);
    const upTo2 = { ...s, levels: { start: 1 as const, hardest: 2 as const } };
    expect(([1, 2] as const).map((level) => targetHintDisplay(upTo2, { level }))).toEqual(['always', 'onRequest']);
  });

  it('with "auf Wunsch" and adaptive off, applies the parent choice', () => {
    expect(targetHintDisplay({ ...base, hintDisplay: 'onRequest', adaptive: false }, { level: 1 })).toBe('onRequest');
  });
});

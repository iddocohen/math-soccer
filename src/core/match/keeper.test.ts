/**
 * "Selbst ins Tor" (amendment 21 part 2, T114, FR-143 to FR-146): the squares and hints by level, the flight time per
 * speed, and the controller's round: saves, goals on a wrong or late number, help holding the flight, 10 shots and the
 * stars per save.
 */
import { describe, expect, it } from 'vitest';
import { cellOf, layoutChart } from '../chart/layout';
import { TEAMS } from '../cup/teams';
import { createRng } from '../rng';
import { defaultSettings, LEVELS, type Level } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { roundSchema, type StoredRound } from '../storage/schemas';
import type { AttemptRecord } from '../storage/schemas';
import { keeperShotOf, MatchController, onlyTimeChanged, type RoundStore } from './MatchController';
import type { Digit } from './entry';
import {
  flightMsOf,
  KEEPER_FLIGHT_MS,
  KEEPER_RESULT_MS,
  KEEPER_SHOTS,
  keeperHintCount,
  keeperOpponent,
  keeperTarget,
  shotResult,
} from './keeper';
import { START_KIND_INFO } from './rounds';
import { STARS } from '../rewards/lockerRoom';

const layout = layoutChart(1, 100);

function type(c: MatchController, n: number) {
  for (const ch of String(n)) c.typeKey({ digit: Number(ch) as Digit });
}

function shoot(c: MatchController, n: number) {
  type(c, n);
  c.typeKey('enter');
}

function memoryStore(): RoundStore & { round: StoredRound | null } {
  const store = {
    round: null as StoredRound | null,
    load: () => store.round,
    save: (r: StoredRound) => {
      store.round = structuredClone(r);
    },
    clear: () => {
      store.round = null;
    },
  };
  return store;
}

function keeperRound(settings: () => Settings = defaultSettings, options: { level?: Level; store?: RoundStore; attempts?: AttemptRecord[] } = {}) {
  const c = new MatchController({
    settings,
    newSeed: () => 21,
    progress: () => ({ mastered: [], level: options.level ?? 1, xTwoEmpties: false }),
    store: options.store,
    onAttempt: options.attempts ? (r) => void options.attempts!.push(r) : undefined,
  });
  c.start('keeper');
  return c;
}

/** Ends the shown result of a decided shot, so the next shot flies. */
function nextShot(c: MatchController) {
  c.tick(KEEPER_RESULT_MS);
}

describe('squares and hints by level, in reverse (FR-146)', () => {
  it('levels 1 to 2 show the row and column neighbors, 3 to 4 fewer, 5 to 6 none', () => {
    expect(LEVELS.map(keeperHintCount)).toEqual(['all', 'all', 'some', 'some', 'none', 'none']);
    for (let seed = 1; seed <= 60; seed++) {
      for (const level of LEVELS) {
        const t = keeperTarget(layout, level, createRng(seed));
        expect(t.number).toBeGreaterThanOrEqual(1);
        expect(t.number).toBeLessThanOrEqual(100);
        expect(t.level).toBe(level);
        const at = cellOf(layout, t.number);
        for (const h of t.hints) {
          const c = cellOf(layout, h);
          // Each hint is a row or a column neighbor.
          expect(Math.abs(c.row - at.row) + Math.abs(c.col - at.col)).toBe(1);
        }
        const rowNeighbors = t.hints.filter((h) => cellOf(layout, h).row === at.row).length;
        const colNeighbors = t.hints.length - rowNeighbors;
        if (level <= 2) {
          const expected = [at.col > 0, at.col < 9, at.row > 0, at.row < 9].filter(Boolean).length;
          expect(t.hints).toHaveLength(expected);
        } else if (level <= 4) {
          expect(rowNeighbors).toBe(1);
          expect(colNeighbors).toBe(1);
        } else {
          expect(t.hints).toEqual([]);
        }
      }
    }
  });

  it('never the square of the shot before', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const first = keeperTarget(layout, 1, createRng(seed));
      expect(keeperTarget(layout, 1, createRng(seed), first.number).number).not.toBe(first.number);
    }
  });

  it('the opponent is a cup team, the same for the same seed', () => {
    expect(TEAMS).toContain(keeperOpponent(5));
    expect(keeperOpponent(5)).toBe(keeperOpponent(5));
  });
});

describe('flight time per "Schussgeschwindigkeit" (FR-144)', () => {
  it('langsam 10 s, mittel 8 s, schnell 5 s; the first shot of a round is always slow', () => {
    expect(KEEPER_FLIGHT_MS).toEqual({ slow: 10_000, medium: 8_000, fast: 5_000 });
    expect(flightMsOf('fast', 0)).toBe(10_000);
    expect(flightMsOf('fast', 1)).toBe(5_000);
    expect(flightMsOf('medium', 3)).toBe(8_000);
    expect(defaultSettings().keeperSpeed).toBe('medium');
  });

  it('the round flies its first shot slowly and the next ones at the parent\'s speed', () => {
    const c = keeperRound(() => ({ ...defaultSettings(), keeperSpeed: 'fast' }));
    expect(keeperShotOf(c.getState())).toMatchObject({ totalMs: 10_000, leftMs: 10_000, result: null });
    shoot(c, c.getState().target!.number);
    nextShot(c);
    expect(keeperShotOf(c.getState())).toMatchObject({ totalMs: 5_000, leftMs: 5_000, result: null });
  });
});

describe('the child in goal (FR-143)', () => {
  it('starts in the mode keeper from "Torwart", with no ball of his own and no hearts lost', () => {
    expect(START_KIND_INFO.keeper.mode).toBe('keeper');
    const c = keeperRound();
    const s = c.getState();
    expect(s).toMatchObject({ play: { kind: 'keeper' }, phase: 'aiming', shots: 0, goals: 0, ball: null });
    expect(s.target).not.toBeNull();
  });

  it('the correct number saves: a save, 1 star, and the next shot after the result', () => {
    const c = keeperRound();
    const first = c.getState().target!.number;
    shoot(c, first);
    expect(c.getState()).toMatchObject({ shots: 1, goals: 1, starsThisRound: STARS.save, shown: null, message: { kind: 'saved' } });
    expect(keeperShotOf(c.getState())).toMatchObject({ result: 'saved', typed: first });
    // No number is typed between two shots.
    type(c, 5);
    expect(c.getState().entry).toBe('');
    nextShot(c);
    expect(keeperShotOf(c.getState())).toMatchObject({ result: null, typed: null });
    expect(c.getState().target!.number).not.toBe(first);
    expect(c.getState().message).toBeNull();
  });

  it('a wrong number concedes: no save, no star, and the real square shows its number', () => {
    const c = keeperRound();
    const target = c.getState().target!.number;
    const wrong = target === 1 ? 2 : target - 1;
    shoot(c, wrong);
    expect(c.getState()).toMatchObject({ shots: 1, goals: 0, starsThisRound: 0, message: { kind: 'conceded', number: target } });
    expect(c.getState().shown?.number).toBe(target);
    expect(keeperShotOf(c.getState())).toMatchObject({ result: 'wrong', typed: wrong });
    expect(shotResult(target, wrong)).toBe('wrong');
  });

  it('too late concedes: the ball arrives when the flight time is over', () => {
    const c = keeperRound();
    const target = c.getState().target!.number;
    type(c, 4);
    c.tick(9_999);
    expect(keeperShotOf(c.getState())).toMatchObject({ result: null, leftMs: 1 });
    expect(c.getState().entry).toBe('4');
    c.tick(1);
    expect(c.getState()).toMatchObject({ shots: 1, goals: 0, entry: '', message: { kind: 'late', number: target } });
    expect(keeperShotOf(c.getState())).toMatchObject({ result: 'late', typed: null });
    expect(c.getState().shown?.number).toBe(target);
  });

  it('typing is never blocked during the flight, and a number out of range is not shot', () => {
    const c = keeperRound();
    type(c, 1);
    c.tick(3_000);
    type(c, 0);
    type(c, 1);
    expect(c.getState().entry).toBe('101');
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ shots: 0, message: { kind: 'outOfRange', min: 1, max: 100 } });
    expect(keeperShotOf(c.getState())?.result).toBeNull();
  });

  it('a round has 10 shots and ends with the saves; each save earns 1 star', () => {
    const c = keeperRound();
    for (let i = 0; i < KEEPER_SHOTS; i++) {
      const target = c.getState().target!.number;
      // Saves on the even shots, a wrong number on the odd ones.
      shoot(c, i % 2 === 0 ? target : target === 1 ? 2 : target - 1);
      expect(c.getState().shots).toBe(i + 1);
      nextShot(c);
    }
    expect(c.getState()).toMatchObject({ phase: 'roundOver', shots: 10, goals: 5, starsThisRound: 5 * STARS.save, play: { kind: 'keeper', shot: null }, shown: null });
  });

  it('settings saved while the last shot\'s result shows wait for it: the round still ends after 10 shots', () => {
    const c = keeperRound();
    for (let i = 0; i < KEEPER_SHOTS - 1; i++) {
      shoot(c, c.getState().target!.number);
      nextShot(c);
    }
    shoot(c, c.getState().target!.number);
    expect(keeperShotOf(c.getState())?.result).toBe('saved');
    c.applySettings({ ...defaultSettings(), hintDisplay: 'onRequest' });
    // The decided shot still shows; the new settings do not throw in an 11th shot.
    expect(keeperShotOf(c.getState())?.result).toBe('saved');
    nextShot(c);
    expect(c.getState()).toMatchObject({ phase: 'roundOver', shots: KEEPER_SHOTS, goals: KEEPER_SHOTS });
  });

  it('its shots record no attempts, so they never move the child\'s level', () => {
    const attempts: AttemptRecord[] = [];
    const c = keeperRound(defaultSettings, { attempts });
    shoot(c, c.getState().target!.number);
    nextShot(c);
    c.tick(20_000);
    expect(attempts).toEqual([]);
  });

  it('the targets follow the child\'s level: level 5 has no hints', () => {
    const c = keeperRound(defaultSettings, { level: 5 });
    expect(c.getState().target?.hints).toEqual([]);
    expect(c.getState().target?.level).toBe(5);
  });

  it('a tick that only moves the flight is a time change for the views', () => {
    const c = keeperRound();
    const before = c.getState();
    c.tick(250);
    expect(keeperShotOf(c.getState())?.leftMs).toBe(9_750);
    expect(onlyTimeChanged(before, c.getState())).toBe(true);
  });
});

describe('help holds the flight (FR-145)', () => {
  it('help stops the ball until the next key; the help steps follow amendment 10', () => {
    const c = keeperRound();
    c.tick(2_000);
    c.typeKey('help');
    expect(c.getState()).toMatchObject({ helpStep: 1 });
    expect(keeperShotOf(c.getState())).toMatchObject({ held: true, leftMs: 8_000 });
    c.tick(60_000);
    expect(keeperShotOf(c.getState())).toMatchObject({ held: true, leftMs: 8_000, result: null });
    // H again raises the help and keeps holding.
    c.typeKey('help');
    expect(c.getState()).toMatchObject({ helpStep: 2 });
    // The next digit lets the ball fly on.
    type(c, 3);
    expect(keeperShotOf(c.getState())?.held).toBe(false);
    expect(c.getState().entry).toBe('3');
    c.tick(1_000);
    expect(keeperShotOf(c.getState())?.leftMs).toBe(7_000);
  });

  it('the help chart of step 3 holds the flight too; Enter closes it and the ball flies on', () => {
    const c = keeperRound();
    c.askHelp();
    c.askHelp();
    c.askHelp();
    expect(c.getState()).toMatchObject({ helpStep: 3, helpChartOpen: true });
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ helpChartOpen: false, shots: 0 });
    expect(keeperShotOf(c.getState())?.held).toBe(false);
    c.tick(500);
    expect(keeperShotOf(c.getState())?.leftMs).toBe(9_500);
  });

  it('a save on the answer of step 4 counts with "Punkt nach voller Hilfe", and earns its star either way', () => {
    for (const pointAfterFullHelp of [true, false]) {
      const c = keeperRound(() => ({ ...defaultSettings(), pointAfterFullHelp }));
      for (let i = 0; i < 4; i++) c.askHelp();
      c.closeHelpChart();
      shoot(c, c.getState().target!.number);
      expect(c.getState()).toMatchObject({ goals: pointAfterFullHelp ? 1 : 0, starsThisRound: 1 });
    }
  });
});

describe('stored keeper rounds', () => {
  it('a refresh continues the round with its shot', () => {
    const store = memoryStore();
    const c = keeperRound(defaultSettings, { store });
    c.tick(1_000);
    expect(store.round).toMatchObject({ play: { kind: 'keeper' }, shots: 0 });
    expect(roundSchema.safeParse(store.round).success).toBe(true);
    const again = new MatchController({ settings: defaultSettings, store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ play: { kind: 'keeper' }, target: c.getState().target });
    expect(keeperShotOf(again.getState())?.leftMs).toBe(9_000);
  });

  it('a refresh drops a keeper round the parent turned off; a keeper round without its shot is invalid', () => {
    const store = memoryStore();
    keeperRound(defaultSettings, { store });
    expect(roundSchema.safeParse({ ...store.round, play: { kind: 'keeper' } }).success).toBe(false);
    const off = () => ({ ...defaultSettings(), modesAllowed: { wall: true, keeper: false, shootout: true, torwand: true, family: true } });
    expect(new MatchController({ settings: off, store }).restore()).toBe(false);
    expect(store.round).toBeNull();
  });
});

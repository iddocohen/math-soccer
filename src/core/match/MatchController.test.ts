import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { StoredRound } from '../storage/schemas';
import type { Target } from '../types';
import { GOAL_STARS, MatchController, MAX_HELP_STEP, missesPerHeart, SHOWN_MS, type RoundStore } from './MatchController';
import type { Digit } from './entry';

function target(number: number): Target {
  return { mode: 'holes', number, hints: [number - 1], patchedHoles: [], directions: ['right'], difficultyStep: 0 };
}

function makeController(answer = 46) {
  const c = new MatchController({ settings: defaultSettings, newSeed: () => 7, nextTarget: () => target(answer) });
  c.start('holes');
  return c;
}

function type(c: MatchController, text: string) {
  for (const ch of text) c.typeKey({ digit: Number(ch) as Digit });
}

describe('MatchController skeleton', () => {
  it('starts in aiming with a target, 3 hearts and no goals', () => {
    const s = makeController().getState();
    expect(s).toMatchObject({ started: true, mode: 'holes', seed: 7, phase: 'aiming', goals: 0, hearts: 3, helpStep: 0 });
    expect(s.target?.number).toBe(46);
  });

  it('refuses a number above the range: no shot, the range message, entry cleared (FR-005)', () => {
    const c = makeController();
    type(c, '150');
    c.shoot();
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, entry: '', message: { kind: 'outOfRange', min: 1, max: 100 } });
  });

  it('refuses 0 in the range 1 to 100', () => {
    const c = makeController();
    type(c, '0');
    c.typeKey('enter');
    expect(c.getState().phase).toBe('aiming');
    expect(c.getState().message).toEqual({ kind: 'outOfRange', min: 1, max: 100 });
  });

  it('does nothing when Enter is pressed with nothing typed', () => {
    const c = makeController();
    const before = c.getState();
    c.shoot();
    expect(c.getState()).toBe(before);
  });

  it('shoots an in-range number and lands it as a goal, then the next target after the celebration', () => {
    const c = makeController();
    type(c, '46');
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ phase: 'ballInFlight', ball: { number: 46, outcome: null }, entry: '' });
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, ball: { outcome: 'goal' }, message: { kind: 'goal' } });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, helpStep: 0 });
  });

  it('lands a wrong number as a miss: back to aiming, help step +1, the square named', () => {
    const c = makeController();
    type(c, '56');
    c.shoot();
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'aiming', goals: 0, missesInRow: 1, helpStep: 1, message: { kind: 'miss', number: 56 } });
  });

  it('ignores typing and help while the ball flies', () => {
    const c = makeController();
    type(c, '46');
    c.shoot();
    type(c, '1');
    c.askHelp();
    expect(c.getState()).toMatchObject({ entry: '', helpStep: 0, phase: 'ballInFlight' });
  });

  it('H raises the help step up to 3', () => {
    const c = makeController();
    for (let i = 0; i < 5; i++) c.typeKey('help');
    expect(c.getState().helpStep).toBe(3);
  });

  it('Escape pauses and resumes; time played stops while paused (FR-029)', () => {
    const c = makeController();
    c.tick(1000);
    c.typeKey('escape');
    expect(c.getState().paused).toBe(true);
    c.tick(5000);
    type(c, '4');
    expect(c.getState()).toMatchObject({ elapsedMs: 1000, entry: '' });
    c.typeKey('escape');
    c.tick(500);
    expect(c.getState()).toMatchObject({ paused: false, elapsedMs: 1500 });
  });

  it('notifies subscribers with a new state object and stops after unsubscribe', () => {
    const c = makeController();
    let calls = 0;
    const off = c.subscribe(() => calls++);
    const before = c.getState();
    type(c, '4');
    expect(calls).toBe(1);
    expect(c.getState()).not.toBe(before);
    off();
    type(c, '6');
    expect(calls).toBe(1);
  });

  it('reads the settings again on start', () => {
    let settings = defaultSettings();
    const c = new MatchController({ settings: () => settings, newSeed: () => 1 });
    settings = { ...settings, range: { preset: 'custom', min: 205, max: 480 } };
    c.start('keeper');
    expect(c.getState()).toMatchObject({ mode: 'keeper', min: 205, max: 480 });
    const n = c.getState().target!.number;
    expect(n).toBeGreaterThanOrEqual(205);
    expect(n).toBeLessThanOrEqual(480);
  });
});

/** A controller whose targets are 46, 47, 48 and so on, one per target, with `over` merged into the default settings. */
function holes(over: Partial<Settings> = {}, store?: RoundStore) {
  const settings = { ...defaultSettings(), ...over };
  let next = 46;
  const c = new MatchController({ settings: () => settings, newSeed: () => 7, nextTarget: () => target(next++), store });
  c.start('holes');
  return c;
}

function shootAndLand(c: MatchController, n: number) {
  type(c, String(n));
  c.shoot();
  c.ballLanded();
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

describe('hole mode: goals and misses (US1)', () => {
  it('a correct number gives a goal, 2 stars, and a new target after the celebration', () => {
    const c = holes();
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, starsThisRound: GOAL_STARS, target: { number: 46 } });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', goals: 1, helpStep: 0, missesInRow: 0, target: { number: 47 } });
  });

  it('a wrong number gives a miss: help step +1, the target unchanged, the square shown', () => {
    const c = holes();
    shootAndLand(c, 56);
    expect(c.getState()).toMatchObject({
      phase: 'aiming',
      goals: 0,
      hearts: 3,
      helpStep: 1,
      missesInRow: 1,
      target: { number: 46 },
      shown: { number: 56, remainingMs: SHOWN_MS },
      message: { kind: 'miss', number: 56 },
    });
  });

  it('an out-of-range number does not shoot', () => {
    const c = holes();
    type(c, '101');
    c.shoot();
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, missesInRow: 0, message: { kind: 'outOfRange' } });
  });

  it('shows the missed square for at least 1.5 s of play time, not counting a pause (FR-004)', () => {
    expect(SHOWN_MS).toBeGreaterThanOrEqual(1500);
    const c = holes();
    shootAndLand(c, 56);
    c.tick(1000);
    c.pause();
    c.tick(5000);
    c.resume();
    expect(c.getState().shown).toEqual({ number: 56, remainingMs: 500 });
    c.tick(499);
    expect(c.getState().shown?.number).toBe(56);
    c.tick(1);
    expect(c.getState().shown).toBeNull();
  });
});

describe('hearts (FR-027)', () => {
  it('misses per heart are 5, 4, 3 by difficulty', () => {
    expect([missesPerHeart('easy'), missesPerHeart('normal'), missesPerHeart('challenging')]).toEqual([5, 4, 3]);
  });

  for (const [difficulty, limit] of [['easy', 5], ['normal', 4], ['challenging', 3]] as const) {
    it(`${difficulty}: a heart is lost only at the ${limit}th miss in a row`, () => {
      const c = holes({ difficulty });
      for (let i = 1; i < limit; i++) {
        shootAndLand(c, 56);
        expect(c.getState().hearts).toBe(3);
      }
      shootAndLand(c, 56);
      expect(c.getState()).toMatchObject({ hearts: 2, missesInRow: 0, message: { kind: 'heartLost', number: 56 } });
    });
  }

  it('a single miss never costs a heart', () => {
    for (const difficulty of ['easy', 'normal', 'challenging'] as const) {
      const c = holes({ difficulty });
      shootAndLand(c, 56);
      expect(c.getState().hearts).toBe(3);
    }
  });

  it('a lost heart keeps the target, jumps help to step 3, and the next correct shot moves on', () => {
    const c = holes({ difficulty: 'challenging' });
    for (let i = 0; i < 3; i++) shootAndLand(c, 56);
    expect(c.getState()).toMatchObject({ hearts: 2, helpStep: MAX_HELP_STEP, target: { number: 46 }, phase: 'aiming' });
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1 });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', helpStep: 0, target: { number: 47 } });
  });

  it('with goalCount no heart is lost', () => {
    const c = holes({ roundType: 'goalCount', difficulty: 'challenging' });
    for (let i = 0; i < 10; i++) shootAndLand(c, 56);
    expect(c.getState()).toMatchObject({ hearts: 3, phase: 'aiming', missesInRow: 10, helpStep: 3 });
  });
});

describe('round end', () => {
  it('ends at 0 hearts', () => {
    const c = holes({ difficulty: 'challenging' });
    for (let i = 0; i < 9; i++) shootAndLand(c, 56);
    expect(c.getState()).toMatchObject({ hearts: 0, phase: 'roundOver' });
    c.tick(1000);
    expect(c.getState().elapsedMs).toBe(0);
  });

  it('ends at goalsPerRound goals after the last celebration', () => {
    const c = holes({ roundType: 'goalCount', goalsPerRound: 2 });
    shootAndLand(c, 46);
    c.celebrationDone();
    shootAndLand(c, 47);
    expect(c.getState().phase).toBe('celebrating');
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 2 });
  });

  it('untilHearts does not end at goalsPerRound', () => {
    const c = holes({ goalsPerRound: 1 });
    shootAndLand(c, 46);
    c.celebrationDone();
    expect(c.getState().phase).toBe('aiming');
  });
});

describe('point after full help (FR-025b)', () => {
  it('a shot at the answer of help step 3 scores and counts by default', () => {
    const c = holes();
    for (let i = 0; i < 3; i++) c.askHelp();
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, starsThisRound: GOAL_STARS });
  });

  it('with the setting off it celebrates and earns stars but does not count for the goals', () => {
    const c = holes({ pointAfterFullHelp: false });
    for (let i = 0; i < 3; i++) c.askHelp();
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 0, starsThisRound: GOAL_STARS });
  });

  it('a shot after help step 2 still counts with the setting off', () => {
    const c = holes({ pointAfterFullHelp: false });
    c.askHelp();
    c.askHelp();
    shootAndLand(c, 46);
    expect(c.getState().goals).toBe(1);
  });
});

describe('default targets from core/targets', () => {
  it('gives hole targets on the chart, the same for the same seed, and a new number after a goal', () => {
    const make = () => {
      const c = new MatchController({ settings: defaultSettings, newSeed: () => 123 });
      c.start('holes');
      return c;
    };
    const a = make();
    const b = make();
    expect(a.getState().target).toEqual(b.getState().target);
    const first = a.getState().target!;
    expect(first.hints.length).toBeGreaterThanOrEqual(1);
    shootAndLand(a, first.number);
    a.celebrationDone();
    expect(a.getState().target!.number).not.toBe(first.number);
  });
});

describe('saving the round (mathsoccer.round.v1)', () => {
  it('saves between shots and a new controller continues the round after a refresh', () => {
    const store = memoryStore();
    const c = holes({}, store);
    shootAndLand(c, 46);
    c.celebrationDone();
    shootAndLand(c, 56);
    c.tick(2500);
    expect(store.round).toMatchObject({ goals: 1, missesInRow: 1, helpStep: 1, target: { number: 47 }, elapsedMs: 2500, phase: 'aiming' });

    const again = new MatchController({ settings: defaultSettings, store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ started: true, mode: 'holes', goals: 1, missesInRow: 1, helpStep: 1, target: { number: 47 }, phase: 'aiming' });
  });

  it('does not save typing or a ball in flight', () => {
    const store = memoryStore();
    const c = holes({}, store);
    const saved = store.round;
    type(c, '4');
    c.typeKey({ digit: 6 });
    c.shoot();
    expect(store.round).toBe(saved);
  });

  it('a round saved during the celebration continues with the next target', () => {
    const store = memoryStore();
    const settings = defaultSettings();
    const c = new MatchController({ settings: () => settings, newSeed: () => 5, store });
    c.start('holes');
    shootAndLand(c, c.getState().target!.number);
    expect(store.round?.phase).toBe('celebrating');
    const again = new MatchController({ settings: () => settings, store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ phase: 'aiming', goals: 1 });
    expect(again.getState().target).not.toBeNull();
  });

  it('deletes the stored round when the round ends', () => {
    const store = memoryStore();
    const c = holes({ roundType: 'goalCount', goalsPerRound: 1 }, store);
    shootAndLand(c, 46);
    c.celebrationDone();
    expect(store.round).toBeNull();
  });

  it('discards a stored round whose range no longer matches the settings (FR-036a)', () => {
    const store = memoryStore();
    holes({}, store);
    const changed = { ...defaultSettings(), range: { preset: 'custom' as const, min: 1, max: 200 } };
    const again = new MatchController({ settings: () => changed, store });
    expect(again.restore()).toBe(false);
    expect(store.round).toBeNull();
    expect(again.getState().started).toBe(false);
  });

  it('discards a stored round whose mode the parent turned off (FR-036a)', () => {
    const store = memoryStore();
    holes({}, store);
    const changed = { ...defaultSettings(), modes: { holes: false, lines: true, keeper: true } };
    expect(new MatchController({ settings: () => changed, store }).restore()).toBe(false);
    expect(store.round).toBeNull();
  });

  it('returns false without a stored round', () => {
    expect(new MatchController({ settings: defaultSettings, store: memoryStore() }).restore()).toBe(false);
  });
});

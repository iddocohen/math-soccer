import { describe, expect, it } from 'vitest';
import { defaultSettings, MISSES_PER_HEART } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { AttemptRecord, StoredRound } from '../storage/schemas';
import { isCutoutFill, type Target } from '../types';
import { GOAL_STARS } from '../rewards/lockerRoom';
import {
  cupMatchWon,
  CUTOUT_BONUS_STARS,
  FILL_STARS,
  MatchController,
  matchInvariantErrors,
  remainingMs,
  SHOWN_MS,
  START_HEARTS,
  type MatchState,
  type RoundStore,
} from './MatchController';
import type { Digit } from './entry';
import { ANSWER_STEP } from './help';

function target(number: number): Target {
  return { number, hints: [number - 1], directions: ['right'], level: 1, pattern: 'neighbors' };
}

function makeController(answer = 46) {
  const c = new MatchController({ settings: defaultSettings, newSeed: () => 7, nextTarget: () => target(answer) });
  c.start();
  return c;
}

function type(c: MatchController, text: string) {
  for (const ch of text) c.typeKey({ digit: Number(ch) as Digit });
}

describe('MatchController skeleton', () => {
  it('starts in aiming with a target, 3 hearts and no goals', () => {
    const s = makeController().getState();
    expect(s).toMatchObject({ started: true, seed: 7, phase: 'aiming', goals: 0, hearts: 3, helpStep: 0 });
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

  it('skips the goal celebration with Enter and shoots nothing, also with a number typed (FR-114)', () => {
    const c = makeController();
    type(c, '46');
    c.typeKey('enter');
    c.ballLanded();
    // Digits typed during the celebration are not taken, so nothing is typed when it is skipped.
    type(c, '46');
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, entry: '', goals: 1 });
    // The next Enter with nothing typed shoots nothing either.
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null });
  });

  it('skips the celebration with skipCelebration (a tap), not while paused, and not outside a celebration', () => {
    const c = makeController();
    const aiming = c.getState();
    c.skipCelebration();
    expect(c.getState()).toBe(aiming);
    type(c, '46');
    c.shoot();
    c.ballLanded();
    c.pause();
    c.skipCelebration();
    c.shoot();
    expect(c.getState().phase).toBe('celebrating');
    c.resume();
    c.skipCelebration();
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, goals: 1 });
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

  it('H raises the help step up to 4', () => {
    const c = makeController();
    for (let i = 0; i < 6; i++) c.typeKey('help');
    expect(c.getState().helpStep).toBe(4);
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
    c.start();
    expect(c.getState()).toMatchObject({ min: 205, max: 480 });
    const n = c.getState().target!.number;
    expect(n).toBeGreaterThanOrEqual(205);
    expect(n).toBeLessThanOrEqual(480);
  });
});

/** A controller whose targets are 46, 47, 48 and so on, one per target, with `over` merged into the default settings. */
function fixed(over: Partial<Settings> = {}, store?: RoundStore) {
  const settings = { ...defaultSettings(), ...over };
  let next = 46;
  const c = new MatchController({ settings: () => settings, newSeed: () => 7, nextTarget: () => target(next++), store });
  c.start();
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

describe('goals and misses (US1)', () => {
  it('a correct number gives a goal, 2 stars, and a new target after the celebration', () => {
    const c = fixed();
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, starsThisRound: GOAL_STARS, target: { number: 46 } });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', goals: 1, helpStep: 0, missesInRow: 0, target: { number: 47 } });
  });

  it('a wrong number gives a miss: help step +1, the target unchanged, the square shown', () => {
    const c = fixed();
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
    const c = fixed();
    type(c, '101');
    c.shoot();
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, missesInRow: 0, message: { kind: 'outOfRange' } });
  });

  it('shows the missed square for at least 1.5 s of play time, not counting a pause (FR-004)', () => {
    expect(SHOWN_MS).toBeGreaterThanOrEqual(1500);
    const c = fixed();
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
    expect([MISSES_PER_HEART.easy, MISSES_PER_HEART.normal, MISSES_PER_HEART.challenging]).toEqual([5, 4, 3]);
  });

  for (const [difficulty, limit] of [['easy', 5], ['normal', 4], ['challenging', 3]] as const) {
    it(`${difficulty}: a heart is lost only at the ${limit}th miss in a row`, () => {
      const c = fixed({ difficulty });
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
      const c = fixed({ difficulty });
      shootAndLand(c, 56);
      expect(c.getState().hearts).toBe(3);
    }
  });

  it('a lost heart keeps the target, jumps help to step 4, and the next correct shot moves on', () => {
    const c = fixed({ difficulty: 'challenging' });
    for (let i = 0; i < 3; i++) shootAndLand(c, 56);
    expect(c.getState()).toMatchObject({ hearts: 2, helpStep: ANSWER_STEP, target: { number: 46 }, phase: 'aiming' });
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1 });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', helpStep: 0, target: { number: 47 } });
  });

  it('with goalCount no heart is lost', () => {
    const c = fixed({ roundType: 'goalCount', difficulty: 'challenging' });
    for (let i = 0; i < 10; i++) shootAndLand(c, 56);
    expect(c.getState()).toMatchObject({ hearts: 3, phase: 'aiming', missesInRow: 10, helpStep: 4 });
  });
});

describe('round end', () => {
  it('ends at 0 hearts', () => {
    const c = fixed({ difficulty: 'challenging' });
    for (let i = 0; i < 9; i++) shootAndLand(c, 56);
    expect(c.getState()).toMatchObject({ hearts: 0, phase: 'roundOver' });
    c.tick(1000);
    expect(c.getState().elapsedMs).toBe(0);
  });

  it('ends at goalsPerRound goals after the last celebration', () => {
    const c = fixed({ roundType: 'goalCount', goalsPerRound: 2 });
    shootAndLand(c, 46);
    c.celebrationDone();
    shootAndLand(c, 47);
    expect(c.getState().phase).toBe('celebrating');
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 2 });
  });

  it('untilHearts does not end at goalsPerRound', () => {
    const c = fixed({ goalsPerRound: 1 });
    shootAndLand(c, 46);
    c.celebrationDone();
    expect(c.getState().phase).toBe('aiming');
  });
});

describe('point after full help (FR-025b)', () => {
  it('a shot at the answer of help step 4 scores and counts by default', () => {
    const c = fixed();
    for (let i = 0; i < 4; i++) c.askHelp();
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, starsThisRound: GOAL_STARS });
  });

  it('with the setting off it celebrates and earns stars but does not count for the goals', () => {
    const c = fixed({ pointAfterFullHelp: false });
    for (let i = 0; i < 4; i++) c.askHelp();
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 0, starsThisRound: GOAL_STARS });
  });

  it('a shot after help step 3 still counts with the setting off', () => {
    const c = fixed({ pointAfterFullHelp: false });
    c.askHelp();
    c.askHelp();
    c.askHelp();
    shootAndLand(c, 46);
    expect(c.getState().goals).toBe(1);
  });
});

describe('default targets from core/targets', () => {
  it('gives targets on the chart, the same for the same seed, and a new number after a goal', () => {
    const make = () => {
      const c = new MatchController({ settings: defaultSettings, newSeed: () => 123 });
      c.start();
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
    const c = fixed({}, store);
    shootAndLand(c, 46);
    c.celebrationDone();
    shootAndLand(c, 56);
    c.tick(2500);
    expect(store.round).toMatchObject({ goals: 1, missesInRow: 1, helpStep: 1, target: { number: 47 }, elapsedMs: 2500, phase: 'aiming' });

    const again = new MatchController({ settings: defaultSettings, store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ started: true, goals: 1, missesInRow: 1, helpStep: 1, target: { number: 47 }, phase: 'aiming' });
  });

  it('does not save typing or a ball in flight', () => {
    const store = memoryStore();
    const c = fixed({}, store);
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
    c.start();
    shootAndLand(c, c.getState().target!.number);
    expect(store.round?.phase).toBe('celebrating');
    const again = new MatchController({ settings: () => settings, store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ phase: 'aiming', goals: 1 });
    expect(again.getState().target).not.toBeNull();
  });

  it('deletes the stored round when the round ends', () => {
    const store = memoryStore();
    const c = fixed({ roundType: 'goalCount', goalsPerRound: 1 }, store);
    shootAndLand(c, 46);
    c.celebrationDone();
    expect(store.round).toBeNull();
  });

  it('discards a stored round whose range no longer matches the settings (FR-036a)', () => {
    const store = memoryStore();
    fixed({}, store);
    const changed = { ...defaultSettings(), range: { preset: 'custom' as const, min: 1, max: 200 } };
    const again = new MatchController({ settings: () => changed, store });
    expect(again.restore()).toBe(false);
    expect(store.round).toBeNull();
    expect(again.getState().started).toBe(false);
  });

  it('a refresh keeps the round-start goals per round and round type, not the current settings (FR-052, H7)', () => {
    const store = memoryStore();
    let settings: Settings = { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 2 };
    const c = new MatchController({ settings: () => settings, newSeed: () => 5, store });
    c.start();
    shootAndLand(c, c.getState().target!.number);
    c.celebrationDone();
    // Saved mid-round: the round keeps 2 goals and the stored round says so.
    settings = { ...settings, roundType: 'untilHearts', goalsPerRound: 5 };
    c.applySettings(settings);
    expect(store.round).toMatchObject({ roundType: 'goalCount', goalsPerRound: 2 });

    const again = new MatchController({ settings: () => settings, store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ roundType: 'goalCount', goals: 1 });
    expect(again.getRoundSettings()).toMatchObject({ roundType: 'goalCount', goalsPerRound: 2 });
    shootAndLand(again, again.getState().target!.number);
    again.celebrationDone();
    expect(again.getState()).toMatchObject({ phase: 'roundOver', goals: 2 });
  });

  it('a refresh during the final goal\'s celebration restores straight into roundOver and deletes the stored round', () => {
    const store = memoryStore();
    const settings: Settings = { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 };
    const c = new MatchController({ settings: () => settings, newSeed: () => 5, store });
    c.start();
    shootAndLand(c, c.getState().target!.number);
    expect(store.round?.phase).toBe('celebrating');
    const again = new MatchController({ settings: () => settings, store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ phase: 'roundOver', goals: 1 });
    expect(store.round).toBeNull();
  });

  it('returns false without a stored round', () => {
    expect(new MatchController({ settings: defaultSettings, store: memoryStore() }).restore()).toBe(false);
  });
});

describe('attempt records (T043, FR-037)', () => {
  function recording(settings: () => Settings = defaultSettings) {
    const records: AttemptRecord[] = [];
    const c = new MatchController({
      settings,
      newSeed: () => 7,
      nextTarget: () => target(46),
      onAttempt: (r) => void records.push(r),
      now: () => new Date('2026-11-06T12:00:00.000Z'),
    });
    c.start();
    return { c, records };
  }

  function shot(c: MatchController, n: number, waitMs = 0) {
    c.tick(waitMs);
    type(c, String(n));
    c.shoot();
    c.ballLanded();
  }

  it('records one attempt per scored target with misses, help, response time and directions', () => {
    const { c, records } = recording();
    shot(c, 45, 2000);
    shot(c, 46, 3000);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      mode: 'keeper',
      min: 1,
      max: 100,
      target: 46,
      directions: ['right'],
      solved: true,
      helpStep: 1,
      misses: 1,
      responseMs: 5000,
      guess: false,
      at: '2026-11-06T12:00:00.000Z',
    });
    c.celebrationDone();
    shot(c, 46, 4000);
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({ solved: true, helpStep: 0, misses: 0, responseMs: 4000 });
  });

  it('marks a goal under 1.5 s as a guess and a goal after the shown answer as not solved', () => {
    const { c, records } = recording();
    shot(c, 46, 1000);
    expect(records[0]!.guess).toBe(true);
    c.celebrationDone();
    for (let i = 0; i < MISSES_PER_HEART.easy; i++) shot(c, 45, 2000);
    expect(c.getState().helpStep).toBe(ANSWER_STEP);
    shot(c, 46, 2000);
    expect(records[1]).toMatchObject({ solved: false, helpStep: ANSWER_STEP, misses: MISSES_PER_HEART.easy });
  });

  it('records the target left when the round ends at 0 hearts as not solved', () => {
    const { c, records } = recording(() => ({ ...defaultSettings(), difficulty: 'challenging' }));
    for (let i = 0; i < 3 * MISSES_PER_HEART.challenging; i++) shot(c, 45, 2000);
    expect(c.getState().phase).toBe('roundOver');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ solved: false, misses: 9 });
  });
});

describe('MatchController goalkeeper targets (T053, FR-019, FR-020, FR-065)', () => {
  const keeperOnly: Settings = defaultSettings();

  function keeperController(seed = 11) {
    const c = new MatchController({ settings: () => keeperOnly, newSeed: () => seed });
    c.start();
    return c;
  }

  it('aims at a target with the hint numbers of a hint pattern around it', () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = keeperController(seed).getState().target!;
      expect(['neighbors', 'middle', 'row']).toContain(t.pattern);
      expect(t.hints.length).toBeGreaterThan(0);
      expect(t.hints).not.toContain(t.number);
    }
  });

  it('the target number scores a goal with the goal stars, and the next target is a new keeper target', () => {
    const c = keeperController();
    const first = c.getState().target!.number;
    shootAndLand(c, first);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, starsThisRound: GOAL_STARS, ball: { outcome: 'goal' } });
    c.celebrationDone();
    expect(c.getState().target!.pattern).toBeDefined();
    expect(c.getState().target!.number).not.toBe(first);
  });

  it('another number is a miss: its square shows and the target stays', () => {
    const c = keeperController();
    const n = c.getState().target!.number;
    const wrong = n === 100 ? 99 : n + 1;
    shootAndLand(c, wrong);
    expect(c.getState()).toMatchObject({ phase: 'aiming', goals: 0, ball: { outcome: 'miss' }, shown: { number: wrong }, message: { kind: 'miss', number: wrong } });
    expect(c.getState().target!.number).toBe(n);
  });
});

describe('applySettings: saved settings reach the running round (amendment 01, FR-052)', () => {
  const RANGE_20 = { preset: 'custom', min: 1, max: 20 } as const;

  function live(over: Partial<Settings> = {}) {
    let settings: Settings = { ...defaultSettings(), ...over };
    const records: AttemptRecord[] = [];
    const store = memoryStore();
    const c = new MatchController({ settings: () => settings, newSeed: () => 5, onAttempt: (r) => void records.push(r), store });
    c.start();
    const save = (next: Partial<Settings>) => {
      settings = { ...settings, ...next };
      return settings;
    };
    return { c, records, store, save };
  }

  /** Scores the current target and ends the celebration. */
  function goal(c: MatchController) {
    shootAndLand(c, c.getState().target!.number);
    c.celebrationDone();
  }

  /** Shoots a number that is not the target and lands it. */
  function miss(c: MatchController) {
    const t = c.getState().target!.number;
    shootAndLand(c, t === 1 ? 2 : t - 1);
  }

  it('a new range gives a new target on the new board and keeps goals, hearts, stars and time', () => {
    const { c, records, store, save } = live();
    goal(c);
    miss(c);
    c.tick(4000);
    const before = c.getState();
    const recordsBefore = records.length;
    c.applySettings(save({ range: { ...RANGE_20 } }));
    const s = c.getState();
    expect(s.min).toBe(1);
    expect(s.max).toBe(20);
    expect(s.target!.number).toBeGreaterThanOrEqual(1);
    expect(s.target!.number).toBeLessThanOrEqual(20);
    expect(s.targetCount).toBe(before.targetCount + 1);
    expect(s).toMatchObject({ goals: before.goals, hearts: before.hearts, starsThisRound: before.starsThisRound, elapsedMs: before.elapsedMs });
    expect(s).toMatchObject({ helpStep: 0, missesInRow: 0, targetMisses: 0, shown: null, phase: 'aiming' });
    // The dropped target records no attempt.
    expect(records).toHaveLength(recordsBefore);
    // The stored round has the new range, so a refresh keeps it.
    expect(store.round).toMatchObject({ min: 1, max: 20, goals: before.goals });
  });

  it('round type and goals per round keep their round-start values', () => {
    const { c, save } = live({ roundType: 'goalCount', goalsPerRound: 2 });
    c.applySettings(save({ roundType: 'untilHearts', goalsPerRound: 5, range: { ...RANGE_20 } }));
    expect(c.getState().roundType).toBe('goalCount');
    expect(c.getRoundSettings().goalsPerRound).toBe(2);
    goal(c);
    goal(c);
    expect(c.getState().phase).toBe('roundOver');
  });

  it('display-only changes keep the target', () => {
    const { c, save } = live();
    const before = c.getState();
    c.applySettings(save({ showClock: true, numberPad: 'always', sound: { effects: false, crowd: false, ohh: false, speech: false }, lockerRoom: false }));
    const s = c.getState();
    expect(s).not.toBe(before);
    expect(s.target).toEqual(before.target);
    expect(s.targetCount).toBe(before.targetCount);
  });

  it('a new difficulty is a target-shaping change and also sets the misses per heart', () => {
    const { c, save } = live({ difficulty: 'easy' });
    const before = c.getState().targetCount;
    c.applySettings(save({ difficulty: 'challenging' }));
    expect(c.getState().targetCount).toBe(before + 1);
    for (let i = 0; i < MISSES_PER_HEART.challenging; i++) miss(c);
    expect(c.getState().hearts).toBe(2);
  });

  it('a paused round stays paused with the new target', () => {
    const { c, save } = live();
    c.pause();
    c.applySettings(save({ range: { ...RANGE_20 } }));
    expect(c.getState()).toMatchObject({ paused: true, max: 20 });
  });

  it('while the ball flies, the new target waits until the ball has landed and its feedback has finished (M1)', () => {
    const { c, save } = live();
    const t = c.getState().target!.number;
    const wrong = t === 1 ? 2 : t - 1;
    type(c, String(wrong));
    c.shoot();
    c.applySettings(save({ range: { ...RANGE_20 } }));
    expect(c.getState()).toMatchObject({ phase: 'ballInFlight', max: 100 });
    c.ballLanded();
    // The scene reads the landed ball, the message and the shown square right after ballLanded.
    expect(c.getState()).toMatchObject({ phase: 'aiming', max: 100, ball: { outcome: 'miss' }, message: { kind: 'miss', number: wrong } });
    expect(c.getState().shown).toEqual({ number: wrong, remainingMs: SHOWN_MS });
    c.tick(SHOWN_MS - 250);
    expect(c.getState()).toMatchObject({ max: 100 });
    expect(c.getState().shown).not.toBeNull();
    c.tick(250);
    expect(c.getState()).toMatchObject({ phase: 'aiming', max: 20, shown: null, ball: null });
    expect(c.getState().target!.number).toBeLessThanOrEqual(20);
  });

  it('a goal scored during the change still counts, and the next target is on the new board', () => {
    const { c, records, save } = live();
    const t = c.getState().target!.number;
    type(c, String(t));
    c.shoot();
    c.applySettings(save({ range: { ...RANGE_20 } }));
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1 });
    expect(records).toHaveLength(1);
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', max: 20 });
  });

  it('changes nothing before a round or after it ended', () => {
    const settings = defaultSettings();
    const c = new MatchController({ settings: () => settings, newSeed: () => 5 });
    const idle = c.getState();
    c.applySettings({ ...settings, range: { ...RANGE_20 } });
    expect(c.getState()).toBe(idle);

    const { c: ended, save } = live({ roundType: 'goalCount', goalsPerRound: 1 });
    goal(ended);
    const over = ended.getState();
    ended.applySettings(save({ range: { ...RANGE_20 } }));
    expect(ended.getState()).toBe(over);
  });
});

describe('state rules checked in development builds (review H4, partial)', () => {
  /** A copy of a running round's state that a test may change. */
  function aiming(): MatchState {
    return structuredClone(makeController().getState()) as MatchState;
  }

  it('a running round has no broken rule', () => {
    expect(matchInvariantErrors(aiming())).toEqual([]);
  });

  it('a ball without an outcome exists exactly while it flies', () => {
    expect(matchInvariantErrors({ ...aiming(), phase: 'ballInFlight', ball: null })).toHaveLength(1);
    expect(matchInvariantErrors({ ...aiming(), ball: { number: 4, outcome: null, atMs: 0 } })).toHaveLength(1);
    expect(matchInvariantErrors({ ...aiming(), phase: 'ballInFlight', ball: { number: 4, outcome: null, atMs: 0 } })).toEqual([]);
    expect(matchInvariantErrors({ ...aiming(), ball: { number: 4, outcome: 'miss', atMs: 0 } })).toEqual([]);
  });

  it('celebrating needs a goal, and no square shows after the round ended', () => {
    expect(matchInvariantErrors({ ...aiming(), phase: 'celebrating', ball: { number: 4, outcome: 'miss', atMs: 0 } })).toHaveLength(1);
    expect(matchInvariantErrors({ ...aiming(), phase: 'roundOver', shown: { number: 4, remainingMs: 10 } })).toHaveLength(1);
  });

  it('losing the last heart ends the round without a shown square', () => {
    const c = fixed({ roundType: 'untilHearts', difficulty: 'normal' });
    for (let heart = 0; heart < 3; heart++) for (let i = 0; i < MISSES_PER_HEART.normal; i++) shootAndLand(c, 1);
    expect(c.getState()).toMatchObject({ phase: 'roundOver', hearts: 0, shown: null });
  });
});

describe('shape targets with two empty squares (FR-072)', () => {
  const shapeTarget: Target = {
    number: 44,
    hints: [34, 54],
    directions: ['down', 'up'],
    level: 4,
    pattern: 'shape',
    queue: [{ number: 55, directions: ['right'] }],
  };

  function shapeController(store?: RoundStore) {
    let next = 0;
    const c = new MatchController({
      settings: () => ({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 5 }),
      newSeed: () => 7,
      nextTarget: () => (next++ === 0 ? shapeTarget : target(12)),
      store,
    });
    c.start();
    return c;
  }

  it('after the first goal the second empty square is the target, the first lit; then a new target', () => {
    const c = shapeController();
    shootAndLand(c, 44);
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ goals: 1, target: { number: 55, hints: [34, 54, 44], directions: ['right'], pattern: 'shape' } });
    expect(c.getState().target!.queue).toBeUndefined();
    shootAndLand(c, 55);
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ goals: 2, target: { number: 12 } });
  });

  it('a refresh before the first goal keeps the second empty square waiting', () => {
    const store = memoryStore();
    shapeController(store);
    expect(store.round?.target?.queue).toEqual([{ number: 55, directions: ['right'] }]);
    const again = new MatchController({ settings: () => ({ ...defaultSettings(), roundType: 'goalCount' }), store });
    expect(again.restore()).toBe(true);
    shootAndLand(again, 44);
    again.celebrationDone();
    expect(again.getState().target).toMatchObject({ number: 55, hints: [34, 54, 44] });
  });
});

describe('time challenge (amendment 07, FR-075 to FR-080)', () => {
  function challenge(over: Partial<Settings> = {}, store?: RoundStore) {
    const settings: Settings = { ...defaultSettings(), timeChallenge: { allowed: true, minutes: 1 }, difficulty: 'challenging', ...over };
    let next = 46;
    const onAttempt: AttemptRecord[] = [];
    const c = new MatchController({
      settings: () => settings,
      newSeed: () => 7,
      nextTarget: () => target(next++),
      store,
      onAttempt: (r) => void onAttempt.push(r),
    });
    c.start('time');
    return { c, onAttempt };
  }

  it('starts a time round with the challenge minutes and the countdown at the full time', () => {
    const { c } = challenge();
    expect(c.getState()).toMatchObject({ roundType: 'time', challengeMinutes: 1, hearts: START_HEARTS });
    expect(remainingMs(c.getState())).toBe(60_000);
    // A normal round has no countdown.
    const normal = fixed();
    expect(normal.getState().challengeMinutes).toBeNull();
    expect(remainingMs(normal.getState())).toBeNull();
  });

  it('counts down only while playing: not while paused', () => {
    const { c } = challenge();
    c.tick(10_000);
    c.pause();
    c.tick(30_000);
    expect(remainingMs(c.getState())).toBe(50_000);
    c.resume();
    c.tick(5_000);
    expect(remainingMs(c.getState())).toBe(45_000);
  });

  it('loses no hearts on misses: misses cost only time', () => {
    const { c } = challenge();
    for (let i = 0; i < 3 * MISSES_PER_HEART.challenging; i++) shootAndLand(c, 1);
    expect(c.getState()).toMatchObject({ hearts: START_HEARTS, phase: 'aiming' });
  });

  it('ends at zero while aiming, and the open target counts as not solved', () => {
    const { c, onAttempt } = challenge();
    shootAndLand(c, 46);
    c.celebrationDone();
    c.tick(70_000);
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 1, elapsedMs: 60_000 });
    expect(remainingMs(c.getState())).toBe(0);
    expect(onAttempt.map((r) => r.solved)).toEqual([true, false]);
  });

  it('a ball in flight at zero still lands and counts, then the round ends after the celebration', () => {
    const { c } = challenge();
    type(c, '46');
    c.shoot();
    c.tick(61_000);
    expect(c.getState().phase).toBe('ballInFlight');
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1 });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 1 });
  });

  it('a ball in flight at zero that misses ends the round when it lands', () => {
    const { c } = challenge();
    type(c, '12');
    c.shoot();
    c.tick(61_000);
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 0, shown: null });
  });

  it('discards a stored time challenge when the parent no longer allows the challenge (amendment 07)', () => {
    const store = memoryStore();
    const { c } = challenge({}, store);
    c.tick(20_000);
    expect(store.round).toMatchObject({ roundType: 'time' });
    const again = new MatchController({ settings: () => ({ ...defaultSettings(), timeChallenge: { allowed: false, minutes: 1 } }), store });
    expect(again.restore()).toBe(false);
    expect(store.round).toBeNull();
    expect(again.getState().started).toBe(false);
  });

  it('a refresh continues the countdown from the stored time played; saved minutes apply from the next round', () => {
    const store = memoryStore();
    const { c } = challenge({}, store);
    c.tick(20_000);
    expect(store.round).toMatchObject({ roundType: 'time', challengeMinutes: 1, elapsedMs: 20_000 });
    const again = new MatchController({ settings: () => ({ ...defaultSettings(), timeChallenge: { allowed: true, minutes: 5 } }), store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ roundType: 'time', challengeMinutes: 1 });
    expect(remainingMs(again.getState())).toBe(40_000);
    again.tick(40_000);
    expect(again.getState().phase).toBe('roundOver');
  });
});

describe('a goal that raises the level (FR-088, amendment 09)', () => {
  function withLevelUp(raised: Array<1 | 2 | 3 | 4 | 5 | null>) {
    const c = new MatchController({ settings: defaultSettings, newSeed: () => 7, nextTarget: () => target(46), onAttempt: () => raised.shift() ?? null });
    c.start();
    return c;
  }

  function goal(c: MatchController) {
    type(c, '46');
    c.shoot();
    c.ballLanded();
  }

  it('shows "levelUp" with the new level instead of the goal message', () => {
    const c = withLevelUp([2]);
    goal(c);
    expect(c.getState().message).toEqual({ kind: 'levelUp', level: 2 });
  });

  it('shows the plain goal message when the level did not rise', () => {
    const c = withLevelUp([null]);
    goal(c);
    expect(c.getState().message).toEqual({ kind: 'goal' });
  });
});

describe('abandon: "Zum Start" (amendment 14, FR-118)', () => {
  function setup(settings: Settings = defaultSettings()) {
    const records: AttemptRecord[] = [];
    const store = memoryStore();
    const c = new MatchController({
      settings: () => settings,
      store,
      newSeed: () => 7,
      nextTarget: () => target(46),
      onAttempt: (r) => void records.push(r),
    });
    c.start();
    return { c, store, records };
  }

  function shootAt(c: MatchController, n: number) {
    type(c, String(n));
    c.shoot();
    c.ballLanded();
  }

  it('keeps the finished attempts, records none for the open target and never ends the round', () => {
    const { c, store, records } = setup();
    shootAt(c, 46);
    c.celebrationDone();
    shootAt(c, 47);
    expect(records).toHaveLength(1);
    expect(store.round).not.toBeNull();
    const phases: string[] = [];
    c.subscribe(() => phases.push(c.getState().phase));
    c.pause();
    c.abandon();
    // No attempt for the open target, and no 'roundOver', so the app records no personal best.
    expect(records).toHaveLength(1);
    expect(phases).not.toContain('roundOver');
    expect(store.round).toBeNull();
    expect(c.getState()).toMatchObject({ started: false, phase: 'aiming', paused: false, goals: 0, starsThisRound: 0, target: null });
  });

  it('stops the countdown of a time challenge', () => {
    const { c } = setup({ ...defaultSettings(), timeChallenge: { ...defaultSettings().timeChallenge, allowed: true } });
    c.start('time');
    c.tick(5_000);
    c.abandon();
    const before = c.getState();
    c.tick(5_000);
    expect(c.getState()).toBe(before);
    expect(remainingMs(before)).toBeNull();
  });

  it('does nothing before a round started', () => {
    const c = new MatchController({ settings: defaultSettings });
    const before = c.getState();
    c.abandon();
    expect(c.getState()).toBe(before);
  });
});

describe('cup match (amendment 13, FR-108, FR-109)', () => {
  function setup(opts: { settings?: Settings; answer?: number } = {}) {
    const settings = opts.settings ?? defaultSettings();
    const records: AttemptRecord[] = [];
    const store = memoryStore();
    const c = new MatchController({
      settings: () => settings,
      store,
      newSeed: () => 7,
      nextTarget: opts.answer === undefined ? undefined : () => target(opts.answer!),
      // The child's own level is 1: a cup match must not use it.
      progress: () => ({ mastered: [], level: 1, xTwoEmpties: true }),
      onAttempt: (r) => void records.push(r),
    });
    return { c, store, records };
  }

  function shootAt(c: MatchController, n: number) {
    type(c, String(n));
    c.shoot();
    c.ballLanded();
  }

  it('starts a cup round with hearts, the match goals and no countdown', () => {
    const { c } = setup({ answer: 46 });
    c.startCup({ level: 3, goals: 3, cup: 1, stage: 0 });
    expect(c.getState()).toMatchObject({ started: true, roundType: 'cup', cupMatch: { level: 3, goals: 3, cup: 1, stage: 0 }, hearts: 3, challengeMinutes: null });
  });

  it('every target plays the match level, not the child level, and no X shape with two empty squares', () => {
    for (const level of [2, 3, 4, 5] as const) {
      const { c } = setup();
      c.startCup({ level, goals: 5, cup: 1, stage: 0 });
      for (let i = 0; i < 4; i++) {
        const t = c.getState().target!;
        expect(t.level).toBe(level);
        if (level === 5) expect(t.queue ?? []).toHaveLength(0);
        shootAt(c, t.number);
        c.celebrationDone();
      }
    }
  });

  it('is won at the match goals: the round ends after the celebration', () => {
    const { c } = setup({ answer: 46 });
    c.startCup({ level: 1, goals: 3, cup: 1, stage: 0 });
    for (let i = 0; i < 3; i++) {
      expect(cupMatchWon(c.getState())).toBe(false);
      shootAt(c, 46);
      expect(c.getState().phase).toBe('celebrating');
      c.celebrationDone();
    }
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 3, starsThisRound: 3 * GOAL_STARS });
    expect(cupMatchWon(c.getState())).toBe(true);
  });

  it('is lost when the hearts are gone first', () => {
    const settings = defaultSettings();
    const { c } = setup({ settings, answer: 46 });
    c.startCup({ level: 1, goals: 3, cup: 1, stage: 0 });
    shootAt(c, 46);
    c.celebrationDone();
    const misses = START_HEARTS * MISSES_PER_HEART[settings.difficulty];
    for (let m = 0; m < misses; m++) {
      expect(c.getState().phase).toBe('aiming');
      shootAt(c, 47);
    }
    const s = c.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.hearts).toBe(0);
    expect(s.goals).toBeLessThan(3);
    expect(cupMatchWon(s)).toBe(false);
  });

  it('is saved and continued after a refresh with its level and goals', () => {
    const { c, store } = setup({ answer: 46 });
    c.startCup({ level: 4, goals: 6, cup: 1, stage: 0 });
    shootAt(c, 46);
    c.celebrationDone();
    expect(store.round).toMatchObject({ roundType: 'cup', cupMatch: { level: 4, goals: 6, cup: 1, stage: 0 }, goals: 1 });
    const again = new MatchController({ settings: defaultSettings, store, nextTarget: () => target(46) });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ roundType: 'cup', cupMatch: { level: 4, goals: 6, cup: 1, stage: 0 }, goals: 1, hearts: 3 });
    // The round settings keep a round type of "Spielen"; the cup match lives in the state.
    expect(again.getRoundSettings().roundType).toBe('untilHearts');
  });

  it('"Zum Start" ends a cup match as neither won nor lost (FR-118)', () => {
    const { c, store } = setup({ answer: 46 });
    c.startCup({ level: 1, goals: 3, cup: 1, stage: 0 });
    shootAt(c, 46);
    c.celebrationDone();
    const phases: string[] = [];
    c.subscribe(() => phases.push(c.getState().phase));
    c.abandon();
    expect(phases).not.toContain('roundOver');
    expect(store.round).toBeNull();
    expect(c.getState()).toMatchObject({ started: false, roundType: 'untilHearts', cupMatch: null });
  });

  it('a normal round after a cup match is no cup match', () => {
    const { c } = setup({ answer: 46 });
    c.startCup({ level: 2, goals: 3, cup: 1, stage: 0 });
    c.start();
    expect(c.getState()).toMatchObject({ roundType: 'untilHearts', cupMatch: null });
  });
});

describe('cutouts of level 6 (amendment 18, FR-125 to FR-128)', () => {
  // A row of 4: 45 given, then 46, 47, 48 filled one after the other.
  const cutoutTarget: Target = {
    number: 46,
    hints: [45],
    directions: ['right'],
    level: 6,
    pattern: 'cutout',
    queue: [
      { number: 47, directions: ['right'] },
      { number: 48, directions: ['right'] },
    ],
    cutout: { squares: [45, 46, 47, 48], given: [45] },
  };

  function cutoutController(opts: { over?: Partial<Settings>; store?: RoundStore } = {}) {
    let next = 0;
    const records: AttemptRecord[] = [];
    const settings = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 2, ...opts.over };
    const c = new MatchController({
      settings: () => settings,
      newSeed: () => 7,
      nextTarget: () => (next++ === 0 ? cutoutTarget : target(12)),
      onAttempt: (r) => void records.push(r),
      store: opts.store,
    });
    return { c, records };
  }

  it('a correct square earns 1 star, lights up and the next square is the target at once, without a goal', () => {
    const { c } = cutoutController();
    c.start();
    shootAndLand(c, 46);
    expect(c.getState()).toMatchObject({
      phase: 'aiming',
      goals: 0,
      starsThisRound: FILL_STARS,
      ball: { number: 46, outcome: 'filled' },
      message: { kind: 'filled', number: 46 },
      target: { number: 47, hints: [45, 46], cutout: { squares: [45, 46, 47, 48], given: [45] } },
    });
    expect(isCutoutFill(c.getState().target as Target)).toBe(true);
  });

  it('the last square is a goal with the celebration and the 3 bonus stars; one goal for the whole cutout', () => {
    const { c } = cutoutController();
    c.start();
    shootAndLand(c, 46);
    shootAndLand(c, 47);
    expect(c.getState()).toMatchObject({ goals: 0, starsThisRound: 2 * FILL_STARS, target: { number: 48 } });
    // The last square: the keeper steps in (no more squares after it).
    expect(isCutoutFill(c.getState().target as Target)).toBe(false);
    shootAndLand(c, 48);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, ball: { outcome: 'goal' }, starsThisRound: 2 * FILL_STARS + GOAL_STARS + CUTOUT_BONUS_STARS });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', goals: 1, target: { number: 12 } });
  });

  it('a cutout counts one goal toward the goal count', () => {
    const { c } = cutoutController({ over: { goalsPerRound: 1 } });
    c.start();
    for (const n of [46, 47, 48]) shootAndLand(c, n);
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 1 });
  });

  it('a cutout counts one goal toward the goals of a cup match', () => {
    const { c } = cutoutController();
    c.startCup({ level: 6, goals: 3, cup: 1, stage: 4 });
    for (const n of [46, 47, 48]) shootAndLand(c, n);
    expect(c.getState().goals).toBe(1);
  });

  it('records one attempt per square with its direction', () => {
    const { c, records } = cutoutController();
    c.start();
    shootAndLand(c, 56);
    for (const n of [46, 47, 48]) shootAndLand(c, n);
    expect(records.map((r) => [r.target, r.directions, r.level, r.misses])).toEqual([
      [46, ['right'], 6, 1],
      [47, ['right'], 6, 0],
      [48, ['right'], 6, 0],
    ]);
  });

  it('misses, hearts and help count per square; a lost heart shows the answer and the cutout goes on', () => {
    const { c } = cutoutController({ over: { roundType: 'untilHearts' } });
    c.start();
    c.askHelp();
    expect(c.getState().helpStep).toBe(1);
    shootAndLand(c, 46);
    // The next square starts without help or misses.
    expect(c.getState()).toMatchObject({ target: { number: 47 }, helpStep: 0, missesInRow: 0 });
    const misses = MISSES_PER_HEART[defaultSettings().difficulty];
    for (let i = 0; i < misses; i++) shootAndLand(c, 90 + i);
    expect(c.getState()).toMatchObject({ hearts: START_HEARTS - 1, helpStep: ANSWER_STEP, target: { number: 47 }, phase: 'aiming' });
    shootAndLand(c, 47);
    expect(c.getState()).toMatchObject({ target: { number: 48 }, helpStep: 0, hearts: START_HEARTS - 1 });
  });

  it('a refresh continues a half-filled cutout with its given and filled squares', () => {
    const store = memoryStore();
    const { c } = cutoutController({ store });
    c.start();
    shootAndLand(c, 46);
    expect(store.round?.target).toMatchObject({ number: 47, hints: [45, 46], cutout: { squares: [45, 46, 47, 48], given: [45] } });
    const again = new MatchController({ settings: () => ({ ...defaultSettings(), roundType: 'goalCount' }), store });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ starsThisRound: FILL_STARS, target: { number: 47, hints: [45, 46], queue: [{ number: 48 }] } });
    shootAndLand(again, 47);
    shootAndLand(again, 48);
    expect(again.getState()).toMatchObject({ phase: 'celebrating', goals: 1 });
  });

  it('ends a time challenge when its time ran out while the ball flew to a square', () => {
    const { c } = cutoutController({ over: { timeChallenge: { allowed: true, minutes: 1 } } });
    c.start('time');
    type(c, '46');
    c.shoot();
    c.tick(60_000);
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'roundOver', starsThisRound: FILL_STARS, goals: 0 });
  });
});

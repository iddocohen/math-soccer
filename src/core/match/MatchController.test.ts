import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { AttemptRecord, StoredRound } from '../storage/schemas';
import type { Target } from '../types';
import {
  GOAL_STARS,
  LINE_STARS,
  MatchController,
  matchInvariantErrors,
  MAX_HELP_STEP,
  missesPerHeart,
  PHASES,
  SHOWN_MS,
  SQUARE_STARS,
  type MatchState,
  type RoundStore,
} from './MatchController';
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

  it('a refresh keeps the round-start goals per round and round type, not the current settings (FR-052, H7)', () => {
    const store = memoryStore();
    let settings: Settings = { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 2 };
    const c = new MatchController({ settings: () => settings, newSeed: () => 5, store });
    c.start('holes');
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

  it('a round stored without goals per round uses the current settings', () => {
    const store = memoryStore();
    const settings: Settings = { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 3 };
    holes({ roundType: 'goalCount', goalsPerRound: 3 }, store);
    delete store.round!.goalsPerRound;
    const again = new MatchController({ settings: () => settings, store });
    expect(again.restore()).toBe(true);
    expect(again.getRoundSettings().goalsPerRound).toBe(3);
  });

  it('a refresh during the final goal\'s celebration restores straight into roundOver and deletes the stored round', () => {
    const store = memoryStore();
    const settings: Settings = { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 };
    const c = new MatchController({ settings: () => settings, newSeed: () => 5, store });
    c.start('holes');
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
      onAttempt: (r) => records.push(r),
      now: () => new Date('2026-11-06T12:00:00.000Z'),
    });
    c.start('holes');
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
      mode: 'holes',
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
    for (let i = 0; i < missesPerHeart('easy'); i++) shot(c, 45, 2000);
    expect(c.getState().helpStep).toBe(MAX_HELP_STEP);
    shot(c, 46, 2000);
    expect(records[1]).toMatchObject({ solved: false, helpStep: MAX_HELP_STEP, misses: missesPerHeart('easy') });
  });

  it('records the target left when the round ends at 0 hearts as not solved', () => {
    const { c, records } = recording(() => ({ ...defaultSettings(), difficulty: 'challenging' }));
    for (let i = 0; i < 3 * missesPerHeart('challenging'); i++) shot(c, 45, 2000);
    expect(c.getState().phase).toBe('roundOver');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ solved: false, misses: 9 });
  });
});

describe('line mode (US4, FR-015 to FR-018, FR-026)', () => {
  const downOnly: Settings = {
    ...defaultSettings(),
    lineDirections: { right: false, down: true, downRight: false, downLeft: false, left: false, up: false, upLeft: false, upRight: false },
  };

  function lineController(settings: Settings = downOnly, extra: Partial<ConstructorParameters<typeof MatchController>[0]> = {}) {
    const c = new MatchController({ settings: () => settings, newSeed: () => 11, ...extra });
    c.start('lines');
    return c;
  }

  function shootAndLand(c: MatchController, n: number) {
    type(c, String(n));
    c.shoot();
    c.ballLanded();
  }

  it('starts a line with two printed squares and the next square as the target', () => {
    const s = lineController().getState();
    expect(s.line).not.toBeNull();
    const line = s.line!;
    expect(line.direction).toBe('down');
    expect(line.squares).toHaveLength(5);
    expect(line.index).toBe(2);
    expect(line.squares[1]! - line.squares[0]!).toBe(10);
    expect(s.target).toMatchObject({ mode: 'lines', number: line.squares[2], hints: [line.squares[1]], directions: ['down'] });
  });

  it('a correct square lights, earns a star and makes the next square the target, without a goal', () => {
    const c = lineController();
    const line = c.getState().line!;
    shootAndLand(c, line.squares[2]!);
    const s = c.getState();
    expect(s).toMatchObject({ phase: 'aiming', goals: 0, starsThisRound: SQUARE_STARS, message: { kind: 'correctSquare' }, ball: { outcome: 'square' } });
    expect(s.line!.index).toBe(3);
    expect(s.target!.number).toBe(line.squares[3]);
  });

  it('finishing the line scores one goal with the line bonus, then a new line starts', () => {
    const c = lineController();
    const line = c.getState().line!;
    for (const n of line.squares.slice(2)) shootAndLand(c, n);
    const s = c.getState();
    expect(s).toMatchObject({ phase: 'celebrating', goals: 1, message: { kind: 'goal' }, ball: { outcome: 'goal' } });
    expect(s.starsThisRound).toBe(3 * SQUARE_STARS + LINE_STARS);
    expect(s.line!.index).toBe(line.squares.length);
    c.celebrationDone();
    const after = c.getState();
    expect(after.phase).toBe('aiming');
    expect(after.line!.index).toBe(2);
    expect(after.line!.direction).toBe('down');
  });

  it('a goal is one finished line for goalsPerRound', () => {
    const c = lineController({ ...downOnly, roundType: 'goalCount', goalsPerRound: 1 });
    const line = c.getState().line!;
    shootAndLand(c, line.squares[2]!);
    expect(c.getState().goals).toBe(0);
    shootAndLand(c, line.squares[3]!);
    shootAndLand(c, line.squares[4]!);
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 1 });
  });

  it('a wrong number is a miss and the target stays', () => {
    const c = lineController();
    const target = c.getState().target!.number;
    shootAndLand(c, target === 100 ? 99 : target + 1);
    expect(c.getState()).toMatchObject({ phase: 'aiming', helpStep: 1, missesInRow: 1, target: { number: target } });
  });

  it('a lost heart keeps the square as the target with the answer shown, then the line continues (FR-027)', () => {
    const c = lineController({ ...downOnly, difficulty: 'challenging' });
    const line = c.getState().line!;
    const target = line.squares[2]!;
    for (let i = 0; i < 3; i++) shootAndLand(c, target === 100 ? 99 : target + 1);
    expect(c.getState()).toMatchObject({ hearts: 2, helpStep: MAX_HELP_STEP, target: { number: target } });
    shootAndLand(c, target);
    expect(c.getState()).toMatchObject({ phase: 'aiming', helpStep: 0, target: { number: line.squares[3] } });
  });

  it('records one attempt per line square with the line direction', () => {
    const records: AttemptRecord[] = [];
    const c = lineController(downOnly, { onAttempt: (r) => records.push(r) });
    const line = c.getState().line!;
    for (const n of line.squares.slice(2)) shootAndLand(c, n);
    expect(records.map((r) => r.target)).toEqual(line.squares.slice(2));
    expect(records.every((r) => r.mode === 'lines' && r.solved && r.directions.join() === 'down')).toBe(true);
  });

  it('picks directions from the enabled ones, unmastered twice as often', () => {
    const two: Settings = { ...downOnly, lineDirections: { ...downOnly.lineDirections, right: true } };
    const counts = { down: 0, right: 0 };
    for (let seed = 0; seed < 300; seed++) {
      const c = new MatchController({ settings: () => two, newSeed: () => seed, progress: () => ({ mastered: ['right'], steps: {} }) });
      c.start('lines');
      const d = c.getState().line!.direction;
      expect(['down', 'right']).toContain(d);
      counts[d as 'down' | 'right']++;
    }
    expect(counts.down).toBeGreaterThan(counts.right * 1.4);
  });

  it('a refresh continues the line', () => {
    let saved: StoredRound | null = null;
    const store: RoundStore = { load: () => saved, save: (r) => (saved = r), clear: () => (saved = null) };
    const c = lineController(downOnly, { store });
    const line = c.getState().line!;
    shootAndLand(c, line.squares[2]!);
    const again = new MatchController({ settings: () => downOnly, store });
    expect(again.restore()).toBe(true);
    expect(again.getState().line).toEqual({ ...line, index: 3 });
    expect(again.getState().target!.number).toBe(line.squares[3]);
  });
});

describe('MatchController goalkeeper mode (T053, FR-019, FR-020)', () => {
  const keeperOnly: Settings = { ...defaultSettings(), modes: { holes: false, lines: false, keeper: true } };

  function keeperController(seed = 11) {
    const c = new MatchController({ settings: () => keeperOnly, newSeed: () => seed });
    c.start('keeper');
    return c;
  }

  it('aims at a keeper target with hint numbers around it and no patched holes', () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = keeperController(seed).getState().target!;
      expect(t.mode).toBe('keeper');
      expect(t.hints.length).toBeGreaterThan(0);
      expect(t.hints).not.toContain(t.number);
      expect(t.patchedHoles).toEqual([]);
    }
  });

  it('the target number scores a goal with the goal stars, and the next target is a new keeper target', () => {
    const c = keeperController();
    const first = c.getState().target!.number;
    shootAndLand(c, first);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, starsThisRound: GOAL_STARS, ball: { outcome: 'goal' } });
    c.celebrationDone();
    expect(c.getState().target!.mode).toBe('keeper');
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

  function live(over: Partial<Settings> = {}, mode: 'holes' | 'lines' = 'holes') {
    let settings: Settings = { ...defaultSettings(), ...over };
    const records: AttemptRecord[] = [];
    const store = memoryStore();
    const c = new MatchController({ settings: () => settings, newSeed: () => 5, onAttempt: (r) => records.push(r), store });
    c.start(mode);
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
    for (let i = 0; i < missesPerHeart('challenging'); i++) miss(c);
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

  it('a correct line square landed during the change keeps its result until its feedback has finished (M1)', () => {
    const { c, save } = live({}, 'lines');
    const line = c.getState().line!;
    type(c, String(c.getState().target!.number));
    c.shoot();
    c.applySettings(save({ range: { ...RANGE_20 } }));
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'aiming', max: 100, ball: { outcome: 'square' }, message: { kind: 'correctSquare' } });
    expect(c.getState().line).toMatchObject({ squares: line.squares, index: line.index + 1 });
    c.tick(SHOWN_MS);
    expect(c.getState()).toMatchObject({ max: 20, ball: null });
    expect(c.getState().line!.squares.every((n) => n >= 1 && n <= 20)).toBe(true);
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

  it('in line mode a target-shaping change starts a new line on the new board', () => {
    const { c, save } = live({}, 'lines');
    const before = c.getState().line!;
    c.applySettings(save({ range: { ...RANGE_20 } }));
    const line = c.getState().line!;
    expect(line).not.toEqual(before);
    expect(line.squares.every((n) => n >= 1 && n <= 20)).toBe(true);
    expect(c.getState().target!.number).toBe(line.squares[line.index]);
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
  /** A copy of a running hole round's state that a test may change. */
  function aiming(): MatchState {
    return structuredClone(makeController().getState()) as MatchState;
  }

  it('the phases are aiming, ballInFlight, celebrating and roundOver; there is no landed phase (H2)', () => {
    expect([...PHASES]).toEqual(['aiming', 'ballInFlight', 'celebrating', 'roundOver']);
  });

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

  it('a line exists only in line mode, and a running line round has one', () => {
    const line = { squares: [1, 2, 3], direction: 'right' as const, given: 2, index: 2 };
    expect(matchInvariantErrors({ ...aiming(), line })).toHaveLength(1);
    expect(matchInvariantErrors({ ...aiming(), mode: 'lines', line: null })).toHaveLength(1);
    expect(matchInvariantErrors({ ...aiming(), mode: 'lines', line })).toEqual([]);
    expect(matchInvariantErrors({ ...aiming(), mode: 'lines', line: null, phase: 'roundOver' })).toEqual([]);
  });

  it('losing the last heart ends the round without a shown square', () => {
    const c = holes({ roundType: 'untilHearts', difficulty: 'normal' });
    for (let heart = 0; heart < 3; heart++) for (let i = 0; i < missesPerHeart('normal'); i++) shootAndLand(c, 1);
    expect(c.getState()).toMatchObject({ phase: 'roundOver', hearts: 0, shown: null });
  });
});

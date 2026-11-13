/**
 * Refactor R2: what only one kind of round has lives in the tagged field `play`, the match mode derives from it, the
 * rounds that wait before play goes on share one `wait`, and a stored round of the old shape is discarded.
 */
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { memoryKeyValue } from '../storage/keyValue';
import { clearRound, loadRound, ROUND_KEY, saveRound } from '../storage/storage';
import type { Digit } from './entry';
import { keeperShotOf, kicksOf, MatchController, modeOf, playOf, SHOWN_MS, type RoundStore } from './MatchController';
import type { ControllerKind } from './rounds';

function controller(store?: RoundStore) {
  return new MatchController({
    settings: () => ({ ...defaultSettings(), roundType: 'untilHearts' }),
    newSeed: () => 21,
    progress: () => ({ mastered: [], level: 3, xTwoEmpties: false }),
    store,
  });
}

function type(c: MatchController, n: number) {
  for (const ch of String(n)) c.typeKey({ digit: Number(ch) as Digit });
}

/** Shoots a number that is not the target and lets the ball land: a miss. */
function miss(c: MatchController) {
  const target = c.getState().target!.number;
  type(c, target === 1 ? 2 : target - 1);
  c.typeKey('enter');
  c.ballLanded();
}

describe('the tagged play of each kind of round (refactor R2)', () => {
  const started = (kind: ControllerKind) => {
    const c = controller();
    c.start(kind);
    return c.getState();
  };

  it('the usual game, the time challenge and the cup play the mode "normal" with their own fields', () => {
    expect(started('play').play).toEqual({ kind: 'normal' });
    expect(started('time').play).toEqual({ kind: 'time', minutes: defaultSettings().timeChallenge.minutes });
    const c = controller();
    c.startCup({ level: 2, goals: 4, cup: 1, stage: 0 });
    expect(c.getState().play).toEqual({ kind: 'cup', match: { level: 2, goals: 4, cup: 1, stage: 0 } });
    for (const s of [started('play'), started('time'), c.getState()]) expect(modeOf(s)).toBe('normal');
  });

  it('each mode to unlock has its tag, its fields and its derived mode', () => {
    const wall = started('wall');
    expect(modeOf(wall)).toBe('wall');
    expect(playOf(wall, 'wall')!.wall).not.toBeNull();

    const keeper = started('keeper');
    expect(modeOf(keeper)).toBe('keeper');
    expect(keeperShotOf(keeper)).toMatchObject({ result: null });

    const shootout = started('shootout');
    expect(modeOf(shootout)).toBe('shootout');
    expect(kicksOf(shootout)).toEqual([[], []]);
    // The child kicks first, so the opponent has no shot yet.
    expect(keeperShotOf(shootout)).toBeNull();

    const torwand = started('torwand');
    expect(modeOf(torwand)).toBe('torwand');
    expect(playOf(torwand, 'torwand')!.holes[0]).toBe(torwand.target!.number);

    const family = started('family');
    expect(modeOf(family)).toBe('family');
    expect(family.play).toMatchObject({ kind: 'family', kicks: [[], []], name: 'Papa', level: 6 });
  });

  it('`playOf` gives null for a play of another kind', () => {
    const s = started('keeper');
    expect(playOf(s, 'wall')).toBeNull();
    expect(playOf(s, 'torwand')).toBeNull();
    expect(kicksOf(s)).toBeNull();
    expect(keeperShotOf(started('play'))).toBeNull();
  });
});

describe('the one shared wait (refactor R2)', () => {
  it('a missed shot at the board waits SHOWN_MS of play time, counting down with ticks, then the next target comes', () => {
    const c = controller();
    c.start('torwand');
    const first = c.getState().targetCount;
    miss(c);
    expect(c.getState().wait).toEqual({ reason: 'afterMiss', ms: SHOWN_MS });
    c.tick(500);
    expect(c.getState().wait).toEqual({ reason: 'afterMiss', ms: SHOWN_MS - 500 });
    // While it waits, nothing is typed and no help is given.
    c.typeKey({ digit: 5 });
    c.typeKey('help');
    expect(c.getState()).toMatchObject({ entry: '', helpStep: 0 });
    c.tick(SHOWN_MS - 500);
    expect(c.getState().wait).toBeNull();
    expect(c.getState().targetCount).toBe(first + 1);
  });

  it('the wait does not count down while the round is paused', () => {
    const c = controller();
    c.start('shootout');
    miss(c);
    c.tick(400);
    c.pause('child');
    c.tick(5_000);
    expect(c.getState().wait).toEqual({ reason: 'afterMiss', ms: SHOWN_MS - 400 });
    c.pause('hidden');
    c.resume('child');
    c.tick(5_000);
    expect(c.getState().wait).toEqual({ reason: 'afterMiss', ms: SHOWN_MS - 400 });
    c.resume('hidden');
    c.tick(SHOWN_MS - 400);
    // The opponent's turn: the wait is over and his shot flies.
    expect(c.getState().wait).toBeNull();
    expect(keeperShotOf(c.getState())).toMatchObject({ result: null });
  });

  it('the turn card of "Papa gegen Kind" waits until the turn starts, whatever the time', () => {
    const c = controller();
    c.start('family');
    expect(c.getState().wait).toEqual({ reason: 'turnCard' });
    c.tick(60_000);
    expect(c.getState().wait).toEqual({ reason: 'turnCard' });
    c.startTurn();
    expect(c.getState().wait).toBeNull();
  });
});

describe('the stored round of version 2 (refactor R2)', () => {
  /** A round stored in browser storage through the app's loaders. */
  function storeOn(kv: ReturnType<typeof memoryKeyValue>): RoundStore {
    return { load: () => loadRound(kv).value, save: (r) => void saveRound(kv, r), clear: () => void clearRound(kv) };
  }

  it('saves the play and the wait, and a refresh continues them', () => {
    const kv = memoryKeyValue();
    const c = controller(storeOn(kv));
    c.start('torwand');
    miss(c);
    const saved = loadRound(kv).value!;
    expect(saved).toMatchObject({ version: 2, play: { kind: 'torwand' }, wait: { reason: 'afterMiss', ms: SHOWN_MS } });
    const again = controller(storeOn(kv));
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ play: c.getState().play, wait: { reason: 'afterMiss', ms: SHOWN_MS } });
  });

  it('a stored round of the old shape (version 1) is discarded: no round to continue', () => {
    const kv = memoryKeyValue();
    const c = controller(storeOn(kv));
    c.start('keeper');
    const { play, wait, ...rest } = loadRound(kv).value!;
    expect(wait).toBeNull();
    const old = {
      ...rest,
      version: 1,
      challengeMinutes: null,
      cupMatch: null,
      mode: 'keeper',
      wall: null,
      keeperShot: keeperShotOf({ play }),
      shootout: null,
      torwand: null,
      family: null,
    };
    kv.set(ROUND_KEY, JSON.stringify(old));
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'invalid' });
    expect(controller(storeOn(kv)).restore()).toBe(false);
  });
});

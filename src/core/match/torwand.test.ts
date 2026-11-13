/**
 * "Torwandschießen" (amendment 23, T117, FR-155 to FR-157): the holes lie on the chart and never overlap, a decoy is a
 * miss and the target a goal, the hint counts per level, and a round of 10 shots with 1 star per goal.
 */
import { describe, expect, it } from 'vitest';
import { cellOf, layoutChart } from '../chart/layout';
import { createRng } from '../rng';
import { defaultSettings, LEVELS, type Level } from '../settings/defaults';
import { roundSchema, type AttemptRecord, type StoredRound } from '../storage/schemas';
import { nextTarget } from '../targets/nextTarget';
import { keeperShotOf, MatchController, modeOf, playOf, SHOWN_MS, type RoundStore } from './MatchController';
import type { Digit } from './entry';
import { holesApart, torwandHintCount, torwandHit, torwandHoleCount, torwandHoles, torwandTarget, TORWAND_SHOTS } from './torwand';

const layout = layoutChart(1, 100);

function baseTarget(level: Level, seed: number) {
  return nextTarget({ layout, settings: defaultSettings(), progress: { mastered: [], level, xTwoEmpties: false }, rng: createRng(seed) });
}

describe('the board and its holes (FR-155)', () => {
  it('holes lie on the chart, on different squares, never touching and never on a hint', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        const target = torwandTarget(layout, baseTarget(level, seed), createRng(seed + 1000));
        const holes = torwandHoles(layout, target, createRng(seed + 2000));
        expect(holes[0]).toBe(target.number);
        expect(holes).toHaveLength(torwandHoleCount(level));
        expect(new Set(holes).size).toBe(holes.length);
        for (const h of holes) {
          expect(h).toBeGreaterThanOrEqual(1);
          expect(h).toBeLessThanOrEqual(100);
          expect(target.hints.includes(h) && h !== target.number).toBe(false);
        }
        for (let i = 0; i < holes.length; i++) {
          for (let j = i + 1; j < holes.length; j++) expect(holesApart(layout, holes[i]!, holes[j]!)).toBe(true);
        }
      }
    }
  });

  it('two holes at levels 1 and 2, three from level 3', () => {
    expect(LEVELS.map(torwandHoleCount)).toEqual([2, 2, 3, 3, 3, 3]);
  });

  it('a small chart still gets spaced holes, as many as fit', () => {
    const small = layoutChart(1, 20);
    const target = torwandTarget(small, { number: 5, hints: [], directions: [], level: 4, pattern: 'neighbors' }, createRng(3));
    const holes = torwandHoles(small, target, createRng(4));
    expect(holes.length).toBeGreaterThanOrEqual(2);
    for (const h of holes.slice(1)) expect(Math.abs(cellOf(small, h).col - cellOf(small, 5).col)).toBeGreaterThanOrEqual(2);
  });

  it('the target is a goal, a decoy hole is a miss through the hole, any other number hits the board', () => {
    expect(torwandHit([47, 12, 80], 47, 47)).toBe('goal');
    expect(torwandHit([47, 12, 80], 47, 12)).toBe('decoy');
    expect(torwandHit([47, 12, 80], 47, 48)).toBe('board');
  });
});

describe('fewer hints (FR-156)', () => {
  it('one neighbor at levels 1 and 2, none from level 3', () => {
    expect(LEVELS.map(torwandHintCount)).toEqual([1, 1, 0, 0, 0, 0]);
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 20; seed++) {
        const base = baseTarget(level, seed);
        const target = torwandTarget(layout, base, createRng(seed));
        expect(target.number).toBe(base.number);
        expect(target.hints).toHaveLength(torwandHintCount(level));
        expect(target.queue).toBeUndefined();
        expect(target.cutout).toBeUndefined();
        for (const h of target.hints) {
          const a = cellOf(layout, h);
          const b = cellOf(layout, target.number);
          expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
        }
      }
    }
  });
});

function type(c: MatchController, n: number) {
  for (const ch of String(n)) c.typeKey({ digit: Number(ch) as Digit });
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

function torwand(options: { level?: Level; attempts?: AttemptRecord[]; store?: RoundStore } = {}) {
  const c = new MatchController({
    settings: defaultSettings,
    newSeed: () => 33,
    progress: () => ({ mastered: [], level: options.level ?? 3, xTwoEmpties: false }),
    onAttempt: options.attempts ? (r) => void options.attempts!.push(r) : undefined,
    store: options.store,
  });
  c.start('torwand');
  return c;
}

/** A number on the board that is neither the target nor a hole. */
function boardNumber(c: MatchController): number {
  const s = c.getState();
  for (let n = 1; n <= 100; n++) if (!playOf(s, 'torwand')!.holes.includes(n)) return n;
  throw new Error('no free square');
}

function shootAt(c: MatchController, n: number) {
  type(c, n);
  c.typeKey('enter');
  expect(c.getState().phase).toBe('ballInFlight');
  c.ballLanded();
}

describe('the "Torwandschießen" round (FR-155 to FR-157)', () => {
  it('"Torwand" starts the mode torwand with holes, the target first, no hearts and no keeper shot', () => {
    const c = torwand();
    const s = c.getState();
    expect(modeOf(s)).toBe('torwand');
    expect(playOf(s, 'torwand')!.holes[0]).toBe(s.target!.number);
    expect(playOf(s, 'torwand')!.holes).toHaveLength(3);
    expect(keeperShotOf(s)).toBeNull();
    expect(s.shots).toBe(0);
    expect(s.target!.hints).toEqual([]);
  });

  it('the target hole scores a goal with 1 star, and the holes move after the celebration', () => {
    const c = torwand();
    const before = playOf(c.getState(), 'torwand')!.holes;
    shootAt(c, c.getState().target!.number);
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, shots: 1, starsThisRound: 1 });
    expect(c.getState().ball!.outcome).toBe('goal');
    c.celebrationDone();
    expect(c.getState().phase).toBe('aiming');
    expect(playOf(c.getState(), 'torwand')!.holes).not.toEqual(before);
  });

  it('a decoy hole is a miss: no goal, its square shows, then the next target comes', () => {
    const c = torwand();
    const s = c.getState();
    const decoy = playOf(s, 'torwand')!.holes[1]!;
    shootAt(c, decoy);
    const after = c.getState();
    expect(after.ball!.outcome).toBe('decoy');
    expect(after.message).toEqual({ kind: 'decoy', number: decoy });
    expect(after.shown).toEqual({ number: decoy, remainingMs: SHOWN_MS });
    expect(after).toMatchObject({ goals: 0, shots: 1, starsThisRound: 0, phase: 'aiming' });
    // Nothing is typed or shot while the square shows.
    type(c, 5);
    expect(c.getState().entry).toBe('');
    c.tick(SHOWN_MS);
    expect(c.getState().targetCount).toBe(2);
    expect(c.getState().ball).toBeNull();
    expect(c.getState().message).toBeNull();
  });

  it('any other number hits the board and shows its square', () => {
    const c = torwand();
    const n = boardNumber(c);
    shootAt(c, n);
    expect(c.getState().ball!.outcome).toBe('miss');
    expect(c.getState().message).toEqual({ kind: 'board', number: n });
    expect(c.getState().shown?.number).toBe(n);
  });

  it('a round is 10 shots, one per target; every shot records an attempt', () => {
    const attempts: AttemptRecord[] = [];
    const c = torwand({ attempts });
    for (let i = 0; i < TORWAND_SHOTS; i++) {
      expect(c.getState().phase).toBe('aiming');
      if (i % 2 === 0) {
        shootAt(c, c.getState().target!.number);
        c.celebrationDone();
      } else {
        shootAt(c, playOf(c.getState(), 'torwand')!.holes[1]!);
        c.tick(SHOWN_MS);
      }
    }
    const s = c.getState();
    expect(s.phase).toBe('roundOver');
    expect(s).toMatchObject({ shots: 10, goals: 5, starsThisRound: 5, hearts: 3 });
    expect(attempts).toHaveLength(10);
    expect(attempts.filter((a) => a.solved)).toHaveLength(5);
  });

  it('hints by level: one at level 1, none at level 5', () => {
    expect(torwand({ level: 1 }).getState().target!.hints).toHaveLength(1);
    expect(torwand({ level: 5 }).getState().target!.hints).toHaveLength(0);
  });

  it('a refresh continues the round with its holes; no holes or a hole outside the range is invalid', () => {
    const store = memoryStore();
    const c = torwand({ store });
    shootAt(c, c.getState().target!.number);
    c.celebrationDone();
    const holes = playOf(c.getState(), 'torwand')!.holes;
    expect(store.round?.play).toEqual({ kind: 'torwand', holes });
    const again = new MatchController({ settings: defaultSettings, store, progress: () => ({ mastered: [], level: 3, xTwoEmpties: false }) });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ play: { kind: 'torwand' }, shots: 1, goals: 1 });
    expect(playOf(again.getState(), 'torwand')!.holes).toEqual(holes);
    const stored = store.round!;
    expect(roundSchema.safeParse({ ...stored, play: { kind: 'torwand', holes: [] } }).success).toBe(false);
    expect(roundSchema.safeParse({ ...stored, play: { kind: 'torwand', holes: [stored.max + 1] } }).success).toBe(false);
    expect(roundSchema.safeParse(stored).success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { cellOf, layoutChart } from '../chart/layout';
import { NO_PROGRESS, nextTarget } from '../targets/nextTarget';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { roundSchema, type StoredRound } from '../storage/schemas';
import { LEVELS } from '../settings/defaults';
import type { Target } from '../types';
import { MatchController, SHOWN_MS, type RoundStore } from './MatchController';
import type { Digit } from './entry';
import { keptClearSquares, placeWall, PLAYER_COLUMNS, wallBlocks, wallClear, wallColumns, WALL_DEFENDERS_MAX, WALL_DEFENDERS_MIN, type Wall } from './wall';

const layout = layoutChart(1, 100);

function target(number: number, hints: number[] = [number - 1, number + 1]): Target {
  return { number, hints, directions: ['right'], level: 1, pattern: 'neighbors' };
}

function type(c: MatchController, text: string) {
  for (const ch of text) c.typeKey({ digit: Number(ch) as Digit });
}

function shoot(c: MatchController, n: number) {
  type(c, String(n));
  c.typeKey('enter');
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

/** A number of the chart in `col` (0 to 9), in the first row. */
const inColumn = (col: number) => col + 1;

describe('placeWall (FR-142)', () => {
  it('never covers the target, its hints, waiting squares or a cutout, at every level and many seeds', () => {
    for (const level of LEVELS) {
      const settings: Settings = { ...defaultSettings(), levels: { start: level, hardest: level } };
      for (let seed = 1; seed <= 150; seed++) {
        const t = nextTarget({ layout, settings, progress: { ...NO_PROGRESS, level }, rng: createRng(seed) });
        const wall = placeWall(layout, t, createRng(seed * 31));
        if (wall === null) continue;
        expect(wallClear(layout, wall, t)).toBe(true);
        for (const n of keptClearSquares(t)) expect(wallBlocks(layout, wall, n)).toBe(false);
      }
    }
  });

  it('has 3 to 5 defenders over at most N - 1 neighboring columns', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const wall = placeWall(layout, target(45), createRng(seed))!;
      seen.add(wall.defenders);
      expect(wall.defenders).toBeGreaterThanOrEqual(WALL_DEFENDERS_MIN);
      expect(wall.defenders).toBeLessThanOrEqual(WALL_DEFENDERS_MAX);
      expect(wall.from).toBeLessThanOrEqual(wall.to);
      expect(wallColumns(wall).length).toBeLessThanOrEqual(wall.defenders - 1);
      expect(wallColumns(wall)).not.toContain(cellOf(layout, 45).col);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('gets narrower when the free columns leave little room, and is null when no column is free', () => {
    // Free columns: only 0 and 9.
    const t = target(45, [42, 43, 44, 46, 47, 48, 39]);
    for (let seed = 1; seed <= 30; seed++) {
      const wall = placeWall(layout, t, createRng(seed))!;
      expect(wall.to - wall.from).toBe(0);
      expect([0, 9]).toContain(wall.from);
    }
    const full = target(45, [41, 42, 43, 44, 46, 47, 48, 49, 50]);
    expect(placeWall(layout, full, createRng(1))).toBeNull();
  });

  it('moves to other columns than the previous wall when another band fits', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const before = placeWall(layout, target(45), createRng(seed))!;
      const after = placeWall(layout, target(45), createRng(seed), before)!;
      expect([after.from, after.to]).not.toEqual([before.from, before.to]);
    }
  });

  it('stands beside the columns of the child\'s player when a band fits there, and in front of him only when none does', () => {
    for (let seed = 1; seed <= 50; seed++) {
      // Target 18 with hints in columns 6 to 8: columns 0 to 2, 5 and 9 are free beside the player.
      const wall = placeWall(layout, target(18), createRng(seed))!;
      for (const c of wallColumns(wall)) expect(PLAYER_COLUMNS).not.toContain(c);
    }
    // Only columns 3 and 4 are free: the wall stands there.
    const hints = [1, 2, 3, 6, 7, 8, 9, 10];
    const crowded = placeWall(layout, { ...target(1, hints) }, createRng(4))!;
    expect(wallColumns(crowded).every((c) => PLAYER_COLUMNS.includes(c))).toBe(true);
  });

  it('blocks exactly the numbers in its columns, in every row', () => {
    const wall: Wall = { from: 2, to: 4, defenders: 4 };
    for (let n = 1; n <= 100; n++) expect(wallBlocks(layout, wall, n)).toBe([2, 3, 4].includes(cellOf(layout, n).col));
    expect(wallBlocks(layout, null, 3)).toBe(false);
  });
});

describe('MatchController in "Freistoß mit Mauer" (FR-142)', () => {
  /** The target 46 with hints 45 and 47 (columns 4 to 6): a wall fits on either side. */
  function wallController(settings: () => Settings = defaultSettings, store?: RoundStore) {
    const c = new MatchController({ settings, newSeed: () => 7, nextTarget: () => target(46), store });
    c.start('wall');
    return c;
  }

  it('starts in the mode "wall" with the parent\'s round type and a wall clear of the target', () => {
    const c = wallController(() => ({ ...defaultSettings(), roundType: 'goalCount' }));
    const s = c.getState();
    expect(s.mode).toBe('wall');
    expect(s.roundType).toBe('goalCount');
    expect(s.challengeMinutes).toBeNull();
    expect(s.wall).not.toBeNull();
    expect(wallClear(layout, s.wall!, s.target!)).toBe(true);
  });

  it('a normal round, a time challenge and a cup match have no wall', () => {
    const c = new MatchController({ settings: defaultSettings, newSeed: () => 7, nextTarget: () => target(46) });
    c.start();
    expect(c.getState()).toMatchObject({ mode: 'normal', wall: null });
    c.start('time');
    expect(c.getState()).toMatchObject({ mode: 'normal', wall: null, roundType: 'time' });
    c.startCup({ level: 1, goals: 3, cup: 1, stage: 0 });
    expect(c.getState()).toMatchObject({ mode: 'normal', wall: null, roundType: 'cup' });
  });

  it('a shot at a number behind the wall hits the wall: a miss, the message "blocked", the square shows its number', () => {
    const c = wallController();
    const wall = c.getState().wall!;
    const behind = inColumn(wall.from);
    shoot(c, behind);
    const s = c.getState();
    expect(s.ball).toMatchObject({ number: behind, outcome: 'blocked' });
    expect(s.message).toEqual({ kind: 'blocked', number: behind });
    expect(s.shown).toEqual({ number: behind, remainingMs: SHOWN_MS });
    expect(s).toMatchObject({ phase: 'aiming', goals: 0, missesInRow: 1, helpStep: 1, targetMisses: 1, starsThisRound: 0 });
    // The wall stays for the same target.
    expect(s.wall).toEqual(wall);
  });

  it('a wrong number in the free part is a usual miss', () => {
    const c = wallController();
    const wall = c.getState().wall!;
    const free = [0, 1, 2, 3, 7, 8, 9].find((col) => col < wall.from || col > wall.to)!;
    shoot(c, inColumn(free));
    expect(c.getState().ball?.outcome).toBe('miss');
    expect(c.getState().message?.kind).toBe('miss');
  });

  it('shots behind the wall cost hearts like any miss', () => {
    const c = wallController();
    const behind = inColumn(c.getState().wall!.from);
    for (let i = 0; i < 5; i++) shoot(c, behind);
    expect(c.getState()).toMatchObject({ hearts: 2, message: { kind: 'heartLost', number: behind } });
  });

  it('the wall moves to new columns after each goal', () => {
    const c = wallController();
    for (let i = 0; i < 6; i++) {
      const before = c.getState().wall!;
      shoot(c, 46);
      c.celebrationDone();
      const after = c.getState().wall!;
      expect([after.from, after.to]).not.toEqual([before.from, before.to]);
      expect(wallClear(layout, after, c.getState().target!)).toBe(true);
    }
  });

  it('keeps the wall after a filled square of a cutout, and moves it after the cutout\'s goal', () => {
    const cutout: Target = {
      number: 12,
      hints: [1, 2, 11],
      directions: ['right'],
      level: 6,
      pattern: 'neighbors',
      queue: [{ number: 13, directions: ['right'] }],
      cutout: { squares: [1, 2, 3, 11, 12, 13], given: [1, 2, 11] },
    };
    const c = new MatchController({ settings: defaultSettings, newSeed: () => 3, nextTarget: () => cutout });
    c.start('wall');
    const first = c.getState().wall!;
    expect(first.from).toBeGreaterThan(2);
    shoot(c, 12);
    expect(c.getState().ball?.outcome).toBe('filled');
    expect(c.getState().target?.number).toBe(13);
    expect(c.getState().wall).toEqual(first);
    shoot(c, 13);
    c.celebrationDone();
    expect([c.getState().wall!.from, c.getState().wall!.to]).not.toEqual([first.from, first.to]);
  });

  it('a refresh continues the round with its mode and the same wall', () => {
    const store = memoryStore();
    const c = wallController(defaultSettings, store);
    const wall = c.getState().wall;
    expect(store.round).toMatchObject({ mode: 'wall', wall });
    expect(roundSchema.safeParse(store.round).success).toBe(true);
    const again = new MatchController({ settings: defaultSettings, store, nextTarget: () => target(46) });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ mode: 'wall', wall });
  });

  it('a refresh drops a wall round the parent turned off in "Spielarten erlauben"', () => {
    const store = memoryStore();
    wallController(defaultSettings, store);
    const off = () => ({ ...defaultSettings(), modesAllowed: { wall: false, keeper: true, shootout: true } });
    const again = new MatchController({ settings: off, store, nextTarget: () => target(46) });
    expect(again.restore()).toBe(false);
    expect(store.round).toBeNull();
  });

  it('a stored round from before amendment 21 loads as a normal round without a wall', () => {
    const store = memoryStore();
    const c = new MatchController({ settings: defaultSettings, newSeed: () => 7, nextTarget: () => target(46), store });
    c.start();
    const old: Partial<StoredRound> = { ...store.round! };
    delete old.mode;
    delete old.wall;
    const parsed = roundSchema.parse(old);
    expect(parsed).toMatchObject({ mode: 'normal', wall: null });
  });

  it('a stored wall outside the wall mode is invalid', () => {
    const store = memoryStore();
    wallController(defaultSettings, store);
    expect(roundSchema.safeParse({ ...store.round, mode: 'normal' }).success).toBe(false);
  });
});

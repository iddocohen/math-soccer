/** Difficulty levels 1 to 6 (T094, T109, amendments 09 and 18, FR-085 to FR-089, FR-129). */
import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { createRng } from '../rng';
import { defaultSettings, type Level } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { nextTarget } from '../targets/nextTarget';
import type { Direction } from '../types';
import { clampLevel, currentLevel, LEVEL_DIRECTIONS, levelChoices, PICK_DIRECTIONS, levelDown, levelRange, levelUp, startLevel, topLevel } from './levels';

const chart = layoutChart(1, 100);
const NO_SHAPES = { I: false, O: false, T: false, L: false, J: false, S: false, Z: false };
const STRAIGHT: Direction[] = ['right', 'left', 'down', 'up'];
const DIAGONAL: Direction[] = ['downRight', 'upLeft', 'downLeft', 'upRight'];

function settings(extra: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...extra };
}

function targetsAt(level: Level, s: Settings = settings(), xTwoEmpties = false, count = 150) {
  const rng = createRng(100 + level);
  return Array.from({ length: count }, () => nextTarget({ layout: chart, settings: s, progress: { mastered: [], level, xTwoEmpties }, rng }));
}

describe('each level offers only its targets', () => {
  it('level 6 "Ausschnitte": cutouts across and down, every square a target in turn (amendment 18)', () => {
    const targets = targetsAt(6);
    expect(new Set(targets.map((t) => t.pattern))).toEqual(new Set(['cutout']));
    for (const t of targets) {
      expect(t.level).toBe(6);
      expect(t.cutout).toBeDefined();
      expect(t.directions.every((d) => STRAIGHT.includes(d))).toBe(true);
    }
    // Boxes, rows and columns, and the shapes all come up.
    expect(new Set(targets.map((t) => t.cutout!.squares.length))).toEqual(new Set([4, 5, 6, 9]));
  });

  it('level 1 "Gerade Linien": Nachbarn, Mitte and Reihe across and down, forward and backward', () => {
    const targets = targetsAt(1);
    expect(new Set(targets.map((t) => t.pattern))).toEqual(new Set(['neighbors', 'middle', 'row']));
    for (const t of targets) {
      expect(t.level).toBe(1);
      expect(t.directions.every((d) => STRAIGHT.includes(d))).toBe(true);
    }
    expect(new Set(targets.flatMap((t) => t.directions))).toEqual(new Set(STRAIGHT));
  });

  it('level 2 "Schräge Linien": Mitte and Reihe on the diagonals, diagonal Nachbarn and the big plus when allowed', () => {
    const targets = targetsAt(2);
    for (const t of targets) {
      expect(['middle', 'row', 'neighbors']).toContain(t.pattern);
      expect(t.directions.length).toBeGreaterThan(0);
      // Every target is either on the diagonals or a big plus with all four arms two squares away (FR-122).
      if (!t.directions.every((d) => DIAGONAL.includes(d))) {
        expect(t.pattern).toBe('neighbors');
        expect(t.hints.map((h) => h - t.number).sort((a, b) => a - b)).toEqual([-20, -2, 2, 20]);
      }
    }
    expect(targets.some((t) => t.hints.includes(t.number - 20))).toBe(true);
    const noDiagonalNeighbors = settings({ hintDistance: { direct: true, vertical: true, diagonal: false, far: false } });
    expect(new Set(targetsAt(2, noDiagonalNeighbors).map((t) => t.pattern))).toEqual(new Set(['middle', 'row']));
    for (const t of targetsAt(2, noDiagonalNeighbors)) expect(t.directions.every((d) => DIAGONAL.includes(d))).toBe(true);
  });

  it('the small plus appears in level 1 and the big plus in level 2, never the other way round (FR-122)', () => {
    const offsets = (t: { number: number; hints: number[] }) => t.hints.map((h) => h - t.number).sort((a, b) => a - b).join(',');
    const level1 = targetsAt(1, settings(), false, 400).filter((t) => t.pattern === 'neighbors').map(offsets);
    const level2 = targetsAt(2, settings(), false, 400).filter((t) => t.pattern === 'neighbors').map(offsets);
    expect(level1).toContain('-10,-1,1,10');
    expect(level1).not.toContain('-20,-2,2,20');
    expect(level2).toContain('-20,-2,2,20');
    expect(level2).not.toContain('-10,-1,1,10');
  });

  it('level 3 "Formen": shapes with one empty square; level 4: two empty squares', () => {
    for (const t of targetsAt(3)) {
      expect(t.pattern).toBe('shape');
      expect(t.hints).toHaveLength(3);
      expect(t.queue).toBeUndefined();
    }
    for (const t of targetsAt(4)) {
      expect(t.pattern).toBe('shape');
      expect(t.hints).toHaveLength(2);
      expect(t.queue).toHaveLength(1);
    }
  });

  it('level 5 "X-Form": the diagonal cross, one empty square, two after the X_TWO_EMPTIES_AFTER rule', () => {
    for (const t of targetsAt(5)) {
      expect(t.pattern).toBe('xshape');
      expect(t.hints).toHaveLength(4);
      expect(t.queue).toBeUndefined();
      expect(t.directions.every((d) => DIAGONAL.includes(d))).toBe(true);
    }
    for (const t of targetsAt(5, settings(), true)) {
      expect(t.pattern).toBe('xshape');
      expect(t.hints).toHaveLength(3);
      expect(t.queue).toHaveLength(1);
    }
  });

  it('PICK_DIRECTIONS and levelChoices agree: no choices for a direction the level does not pick', () => {
    const s = settings();
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      for (const d of [...STRAIGHT, ...DIAGONAL]) {
        const has = levelChoices(level, d, s).length > 0;
        expect(has).toBe(PICK_DIRECTIONS[level].includes(d));
      }
    }
    // Level 2 picks the straight directions only for the big plus.
    for (const d of STRAIGHT) expect(levelChoices(2, d, s)).toEqual([{ pattern: 'neighbors', distance: 'far' }]);
    for (const level of [1, 3, 4, 5, 6] as const) expect(PICK_DIRECTIONS[level]).toEqual(LEVEL_DIRECTIONS[level]);
  });
});

describe('the parent range (FR-085, FR-087)', () => {
  it('clamps the level to the start and the hardest level', () => {
    const s = settings({ levels: { start: 2, hardest: 4 } });
    expect(levelRange(s)).toEqual([2, 3, 4]);
    expect(startLevel(s)).toBe(2);
    expect(topLevel(s)).toBe(4);
    expect(clampLevel(1, s)).toBe(2);
    expect(clampLevel(5, s)).toBe(4);
    expect(clampLevel(null, s)).toBe(2);
    expect(levelUp(4, s)).toBe(4);
    expect(levelDown(2, s)).toBe(2);
  });

  it('keeps the start level with adaptive difficulty off', () => {
    expect(currentLevel(4, settings({ adaptive: false, levels: { start: 2, hardest: 5 } }))).toBe(2);
    expect(currentLevel(4, settings({ levels: { start: 2, hardest: 5 } }))).toBe(4);
  });

  it('turning off all shapes skips levels 3 and 4', () => {
    const s = settings({ shapes: NO_SHAPES });
    // Level 6 offers its cutouts whatever the shape switches say (design call T109).
    expect(levelRange(s)).toEqual([1, 2, 5, 6]);
    expect(levelUp(2, s)).toBe(5);
    expect(levelDown(5, s)).toBe(2);
    expect(clampLevel(3, s)).toBe(5);
    expect(startLevel(settings({ shapes: NO_SHAPES, levels: { start: 3, hardest: 5 } }))).toBe(5);
    // Only levels 3 and 4 in the range: the nearest level below stands in (settings validation refuses this range).
    expect(levelRange(settings({ shapes: NO_SHAPES, levels: { start: 3, hardest: 4 } }))).toEqual([2]);
  });

  it('a level that does not fit the chart falls back to the nearest lower level that fits', () => {
    const oneRow = layoutChart(1, 10);
    const rng = createRng(5);
    for (let i = 0; i < 30; i++) {
      const t = nextTarget({ layout: oneRow, settings: settings(), progress: { mastered: [], level: 2, xTwoEmpties: false }, rng });
      expect(t.level).toBe(1);
      expect(t.directions.every((d) => d === 'right' || d === 'left')).toBe(true);
    }
  });
});

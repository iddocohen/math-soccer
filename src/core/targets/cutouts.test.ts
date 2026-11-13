/** Cutouts from the hundred chart, level 6 "Ausschnitte" (T109, amendment 18, FR-124, FR-125, FR-127). */
import { describe, expect, it } from 'vitest';
import { cellOf, layoutChart, type ChartLayout } from '../chart/layout';
import { defaultSettings } from '../settings/defaults';
import { createRng, deriveSeed } from '../rng';
import { CUTOUT_IDS, cutoutPlacements, cutoutShapes, fillOrder, givenCount, type CutoutId } from './cutouts';
import { nextInShape, nextTarget } from './nextTarget';
import { placements } from './patterns';
import { directionsOf } from './hints';
import type { Target } from '../types';

const chart = layoutChart(1, 100);

/** True when the squares `a` and `b` share an edge on `layout`. */
function touching(layout: ChartLayout, a: number, b: number): boolean {
  const p = cellOf(layout, a);
  const q = cellOf(layout, b);
  return Math.abs(p.row - q.row) + Math.abs(p.col - q.col) === 1;
}

describe('the cutouts (FR-124)', () => {
  it('has the workbook cutouts: boxes, rows and columns of 4 and 5, the Tetris shapes, L and T with arms of 3', () => {
    const sizes = (id: CutoutId) => cutoutShapes(id).map((cells) => cells.length);
    expect(cutoutShapes('box3x3')).toHaveLength(1);
    expect(sizes('box3x3')).toEqual([9]);
    // 2 rows by 3 columns, and turned, 3 rows by 2 columns.
    expect(cutoutShapes('box2x3')).toHaveLength(2);
    expect(sizes('box2x3')).toEqual([6, 6]);
    // A row and a column of each length.
    expect(sizes('line4')).toEqual([4, 4]);
    expect(sizes('line5')).toEqual([5, 5]);
    // The seven shapes in their turns: I 2, O 1, T 4, L 4, J 4, S 2, Z 2.
    expect(cutoutShapes('tetris')).toHaveLength(19);
    expect(sizes('L3')).toEqual([5, 5, 5, 5]);
    expect(sizes('T3')).toEqual([5, 5, 5, 5]);
  });

  it('gives one square in boxes and longer cutouts and two in four-square shapes', () => {
    expect([9, 6, 5, 4].map(givenCount)).toEqual([1, 1, 1, 2]);
    const box = cutoutPlacements(chart, 'box3x3');
    for (const p of box.slice(0, 50)) expect(p.hints).toHaveLength(1);
    for (const p of cutoutPlacements(chart, 'tetris').slice(0, 50)) expect(p.hints).toHaveLength(2);
  });

  it('lies fully on the chart for 1 to 100, 0 to 1000 and 205 to 480, never across a row edge', () => {
    for (const layout of [chart, layoutChart(0, 1000), layoutChart(205, 480)]) {
      for (const id of CUTOUT_IDS) {
        const found = cutoutPlacements(layout, id);
        expect(found.length).toBeGreaterThan(0);
        // Every placement on the small chart; on the large ones every 7th, so the test stays quick.
        const step = layout.max - layout.min < 100 ? 1 : 7;
        for (const p of found.filter((_, i) => i % step === 0)) {
          const all = [...p.hints, p.number, ...p.queue.map((q) => q.number)];
          expect(new Set(all).size).toBe(p.squares.length);
          expect([...all].sort((a, b) => a - b)).toEqual([...p.squares].sort((a, b) => a - b));
          for (const n of all) {
            expect(n).toBeGreaterThanOrEqual(layout.min);
            expect(n).toBeLessThanOrEqual(layout.max);
          }
          // A cutout spans at most 5 columns, so a square across a row edge would show as a wide span.
          const cols = p.squares.map((n) => cellOf(layout, n).col);
          expect(Math.max(...cols) - Math.min(...cols)).toBeLessThan(5);
        }
      }
    }
  });

  it('places the 3×3 box with 68 in the middle as on the workbook page', () => {
    const p = cutoutPlacements(chart, 'box3x3').find((q) => q.hints[0] === 68 && q.squares.includes(57) && q.squares.includes(79));
    expect(p).toBeDefined();
    expect([...p!.squares].sort((a, b) => a - b)).toEqual([57, 58, 59, 67, 68, 69, 77, 78, 79]);
  });
});

describe('filling a cutout (FR-125, FR-127)', () => {
  it('fills outward from the given squares, each next square touching a known one', () => {
    for (const layout of [chart, layoutChart(205, 480)]) {
      for (const id of CUTOUT_IDS) {
        for (const p of cutoutPlacements(layout, id)) {
          const known = [...p.hints];
          for (const n of [p.number, ...p.queue.map((q) => q.number)]) {
            expect(known.some((k) => touching(layout, n, k))).toBe(true);
            known.push(n);
          }
        }
      }
    }
  });

  it('orders by steps from the given square, then in reading order', () => {
    // A 3×3 box with the corner square 0 given: its two neighbours, then the three squares two steps away, and so on.
    const box = cutoutShapes('box3x3')[0]!;
    expect(fillOrder(box, [0])).toEqual([1, 3, 2, 4, 6, 5, 7, 8]);
    // The middle given: the four squares across and down first, then the corners.
    expect(fillOrder(box, [4])).toEqual([1, 3, 5, 7, 0, 2, 6, 8]);
  });

  it('trains the direction from the touching known squares: right of a known square is `right`, below it `down`', () => {
    for (const p of cutoutPlacements(chart, 'box3x3')) {
      const known = [...p.hints];
      for (const step of [{ number: p.number, directions: p.directions }, ...p.queue]) {
        const touchingKnown = known.filter((k) => touching(chart, step.number, k));
        expect(step.directions).toEqual(directionsOf(step.number, touchingKnown));
        expect(step.directions.every((d) => ['right', 'left', 'down', 'up'].includes(d))).toBe(true);
        known.push(step.number);
      }
    }
    const p = cutoutPlacements(chart, 'box3x3').find((q) => q.hints[0] === 68 && q.squares.includes(57) && q.squares.includes(79))!;
    // 58 lies above 68: the child goes up from 68.
    expect(p.number).toBe(58);
    expect(p.directions).toEqual(['up']);
  });

  it('keeps only placements whose first square trains the asked direction', () => {
    for (const p of cutoutPlacements(chart, 'line5', 'down')) expect(p.directions).toContain('down');
  });

  it('a cutout target carries its squares, and the next square lights the filled one up', () => {
    const [first] = placements(chart, { pattern: 'cutout', cutout: 'box3x3' });
    expect(first!.cutout?.squares).toHaveLength(9);
    expect(first!.cutout?.given).toEqual(first!.hints);
    const target: Target = { ...first!, level: 6, pattern: 'cutout' };
    let t: Target | null = target;
    const seen: number[] = [];
    while (t) {
      seen.push(t.number);
      expect(t.cutout).toEqual(target.cutout);
      expect(t.hints).toEqual([...target.hints, ...seen.slice(0, -1)]);
      t = nextInShape(t);
    }
    expect(seen).toHaveLength(8);
  });

  it('nextTarget gives level 6 cutouts', () => {
    const settings = { ...defaultSettings(), levels: { start: 6 as const, hardest: 6 as const } };
    for (let seed = 1; seed <= 20; seed++) {
      const t = nextTarget({ layout: chart, settings, progress: { mastered: [], level: 6, xTwoEmpties: false }, rng: createRng(deriveSeed(seed, 0)) });
      expect(t).toMatchObject({ level: 6, pattern: 'cutout' });
      expect(t.cutout!.squares.length).toBeGreaterThanOrEqual(4);
      expect(t.queue!.length).toBe(t.cutout!.squares.length - t.cutout!.given.length - 1);
    }
  });
});

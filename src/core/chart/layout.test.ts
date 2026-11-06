import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import type { Rect } from '../types';
import { ballKind, cellOf, cellRect, layoutChart, numberAt, showNumbers } from './layout';

/** The goal rectangle in world space (contracts/screens.md: x 300 to 1300, y 230 to 790). */
const GOAL: Rect = { x: 300, y: 230, width: 1000, height: 560 };
const EPS = 1e-9;

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS;
}

function inside(r: Rect, outer: Rect): boolean {
  return (
    r.x >= outer.x - EPS &&
    r.y >= outer.y - EPS &&
    r.x + r.width <= outer.x + outer.width + EPS &&
    r.y + r.height <= outer.y + outer.height + EPS
  );
}

/** Random valid ranges as the settings allow: integers, 0 <= min < max <= 1000, max - min >= 9. */
function randomRanges(count: number, seed: number): Array<[number, number]> {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => {
    const min = rng.int(0, 991);
    const max = rng.int(min + 9, 1000);
    return [min, max] as [number, number];
  });
}

describe('layoutChart', () => {
  it('1 to 100 gives 10 rows with 1 top left, 10 top right, 100 bottom right', () => {
    const layout = layoutChart(1, 100);
    expect(layout.rows).toBe(10);
    expect(layout.zeroBased).toBe(false);
    expect(numberAt(layout, 0, 0)).toBe(1);
    expect(numberAt(layout, 0, 9)).toBe(10);
    expect(numberAt(layout, 9, 9)).toBe(100);
    expect(cellOf(layout, 1)).toEqual({ row: 0, col: 0 });
    expect(cellOf(layout, 10)).toEqual({ row: 0, col: 9 });
    expect(cellOf(layout, 100)).toEqual({ row: 9, col: 9 });
  });

  it('0 to 1000 gives 101 rows starting at 0', () => {
    const layout = layoutChart(0, 1000);
    expect(layout.rows).toBe(101);
    expect(layout.zeroBased).toBe(true);
    expect(layout.firstRowStart).toBe(0);
    expect(numberAt(layout, 0, 0)).toBe(0);
    expect(numberAt(layout, 0, 9)).toBe(9);
    expect(numberAt(layout, 100, 0)).toBe(1000);
    expect(numberAt(layout, 100, 1)).toBeNull();
  });

  it('205 to 480 keeps every number column from the full chart', () => {
    const part = layoutChart(205, 480);
    const full = layoutChart(1, 1000);
    expect(part.firstRowStart).toBe(201);
    for (let n = 205; n <= 480; n++) expect(cellOf(part, n).col).toBe(cellOf(full, n).col);
  });

  it('returns null for squares outside the range in a partial row', () => {
    const layout = layoutChart(205, 480);
    for (let col = 0; col < 4; col++) expect(numberAt(layout, 0, col)).toBeNull();
    expect(numberAt(layout, 0, 4)).toBe(205);
    expect(numberAt(layout, layout.rows - 1, 9)).toBe(480);
    expect(numberAt(layout, -1, 0)).toBeNull();
    expect(numberAt(layout, 0, 10)).toBeNull();
    expect(numberAt(layout, layout.rows, 0)).toBeNull();
  });

  it('numberAt and cellOf agree for every number in range', () => {
    for (const [min, max] of randomRanges(50, 7)) {
      const layout = layoutChart(min, max);
      for (let n = min; n <= max; n++) {
        const { row, col } = cellOf(layout, n);
        expect(numberAt(layout, row, col)).toBe(n);
      }
    }
  });

  it('throws on invalid input', () => {
    expect(() => layoutChart(10, 10)).toThrow(RangeError);
    expect(() => layoutChart(50, 10)).toThrow(RangeError);
    expect(() => layoutChart(1.5, 100)).toThrow(RangeError);
    expect(() => cellOf(layoutChart(1, 100), 101)).toThrow(RangeError);
  });
});

describe('cellRect', () => {
  it('places 1 at the top left and 100 at the bottom right of the goal for 1 to 100', () => {
    const layout = layoutChart(1, 100);
    expect(cellRect(layout, GOAL, 1)).toEqual({ x: 300, y: 230, width: 100, height: 56 });
    const last = cellRect(layout, GOAL, 100);
    expect(last.x + last.width).toBeCloseTo(1300);
    expect(last.y + last.height).toBeCloseTo(790);
  });

  it('property: n + 10 lies directly below n, and squares sit inside the goal without overlap', () => {
    const ranges: Array<[number, number]> = [[1, 100], [0, 1000], [205, 480], [0, 9], ...randomRanges(40, 11)];
    for (const [min, max] of ranges) {
      const layout = layoutChart(min, max);
      const rects: Rect[] = [];
      for (let n = min; n <= max; n++) {
        const r = cellRect(layout, GOAL, n);
        expect(inside(r, GOAL)).toBe(true);
        rects.push(r);
        if (n + 10 <= max) {
          const below = cellRect(layout, GOAL, n + 10);
          expect(below.x).toBeCloseTo(r.x);
          expect(below.width).toBeCloseTo(r.width);
          expect(below.y).toBeCloseTo(r.y + r.height);
        }
      }
      // Rows touch each other: neighbors in a row share an edge, so no gap and no overlap between them.
      for (let i = 1; i < rects.length; i++) {
        const a = rects[i - 1]!;
        const b = rects[i]!;
        if (Math.abs(a.y - b.y) < EPS) expect(b.x).toBeCloseTo(a.x + a.width);
      }
      // No two squares overlap; check pairwise on small charts, by grid cell on large ones.
      if (rects.length <= 200) {
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
        }
      } else {
        const cells = new Set(rects.map((r) => `${Math.round((r.x - GOAL.x) / r.width)},${Math.round((r.y - GOAL.y) / r.height)}`));
        expect(cells.size).toBe(rects.length);
      }
    }
  });

  it('squares of a chart with only full rows cover the whole goal', () => {
    for (const [min, max] of [[1, 100], [0, 99], [201, 500]] as Array<[number, number]>) {
      const layout = layoutChart(min, max);
      let area = 0;
      for (let n = min; n <= max; n++) {
        const r = cellRect(layout, GOAL, n);
        area += r.width * r.height;
      }
      expect(area).toBeCloseTo(GOAL.width * GOAL.height);
    }
  });
});

describe('ballKind and showNumbers', () => {
  it('soccer up to 10 rows, tennis up to 30, ping-pong above', () => {
    expect(ballKind(layoutChart(1, 100))).toBe('soccer');
    expect(ballKind(layoutChart(1, 110))).toBe('tennis');
    expect(ballKind(layoutChart(1, 300))).toBe('tennis');
    expect(ballKind(layoutChart(1, 310))).toBe('pingpong');
    expect(ballKind(layoutChart(0, 1000))).toBe('pingpong');
  });

  it('draws numbers only when squares are at least 14 world pixels high', () => {
    // 560 / 40 rows = 14 pixels; 41 rows is under 14.
    expect(showNumbers(layoutChart(1, 400), GOAL)).toBe(true);
    expect(showNumbers(layoutChart(1, 410), GOAL)).toBe(false);
    expect(showNumbers(layoutChart(0, 1000), GOAL)).toBe(false);
  });
});

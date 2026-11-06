import { describe, expect, it } from 'vitest';
import { cellOf, layoutChart } from '../chart/layout';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import { DIRECTIONS } from '../types';
import { nextInShape, nextTarget } from './nextTarget';
import { placements } from './patterns';
import { SHAPE_CELLS, SHAPE_IDS, shapeDirections, shapePlacements, shapeTurns, type ShapeId } from './shapes';

const chart = layoutChart(1, 100);

/** The squares of a placement as a set of [row, col] moved to the top left, to compare with a shape's turns. */
function normalized(squares: readonly number[], layout = chart): string {
  const cells = squares.map((n) => cellOf(layout, n));
  const minRow = Math.min(...cells.map((c) => c.row));
  const minCol = Math.min(...cells.map((c) => c.col));
  return JSON.stringify(cells.map((c) => [c.row - minRow, c.col - minCol]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!));
}

describe('the seven shapes and their turns (amendment 06)', () => {
  it('has four squares per shape and the number of different turns each shape has', () => {
    const counts = Object.fromEntries(SHAPE_IDS.map((id) => [id, shapeTurns(id).length]));
    expect(counts).toEqual({ I: 2, O: 1, T: 4, L: 4, J: 4, S: 2, Z: 2 });
    for (const id of SHAPE_IDS) for (const turn of shapeTurns(id)) expect(turn).toHaveLength(4);
    expect(SHAPE_CELLS.L).toHaveLength(4);
  });

  it('places the examples of the amendment table', () => {
    const has = (shape: ShapeId, squares: number[]) =>
      shapePlacements(chart, shape, 1).some((p) => [...p.squares].sort((a, b) => a - b).join() === [...squares].sort((a, b) => a - b).join());
    expect(has('I', [34, 35, 36, 37])).toBe(true);
    expect(has('I', [14, 24, 34, 44])).toBe(true);
    expect(has('O', [34, 35, 44, 45])).toBe(true);
    expect(has('T', [34, 35, 36, 45])).toBe(true);
    expect(has('L', [34, 44, 54, 55])).toBe(true);
    expect(has('J', [35, 45, 55, 54])).toBe(true);
    expect(has('S', [35, 36, 44, 45])).toBe(true);
    expect(has('Z', [34, 35, 45, 46])).toBe(true);
  });
});

describe('shape placements (FR-071 to FR-073)', () => {
  for (const layout of [chart, layoutChart(0, 230), layoutChart(5, 23), layoutChart(40, 49)]) {
    it(`every shape in every turn lies fully on ${layout.min} to ${layout.max}, and target plus hints form the shape`, () => {
      for (const shape of SHAPE_IDS) {
        const turns = new Set(shapeTurns(shape).map((t) => JSON.stringify(t)));
        for (const empties of [1, 2] as const) {
          for (const p of shapePlacements(layout, shape, empties)) {
            for (const n of p.squares) {
              expect(n).toBeGreaterThanOrEqual(layout.min);
              expect(n).toBeLessThanOrEqual(layout.max);
            }
            const all = [p.number, ...p.hints, ...p.queue.map((q) => q.number)];
            expect(new Set(all).size).toBe(4);
            expect(turns.has(normalized(all, layout))).toBe(true);
            expect(p.hints).toHaveLength(4 - empties);
            expect(p.queue).toHaveLength(empties - 1);
          }
        }
      }
    });
  }

  it('places every shape on 0 to 1000, both ends included, quickly', () => {
    const big = layoutChart(0, 1000);
    const started = performance.now();
    for (const shape of SHAPE_IDS) {
      const found = shapePlacements(big, shape, 2);
      expect(found.length).toBeGreaterThan(0);
      expect(found.some((p) => p.squares.includes(0))).toBe(true);
    }
    // 1000 sits alone in the last row, so only shapes with a lone bottom square reach it, the I down among them.
    expect(shapePlacements(big, 'I', 1).some((p) => p.squares.includes(1000))).toBe(true);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('a chart of one row has only the I across', () => {
    const oneRow = layoutChart(41, 50);
    for (const shape of SHAPE_IDS) {
      const found = shapePlacements(oneRow, shape, 1);
      if (shape === 'I') expect(found.length).toBeGreaterThan(0);
      else expect(found).toEqual([]);
    }
  });

  it('trains the directions of the lit shape neighbors: in the L 34, 44, 54, 55, 44 trains down and up, 55 across', () => {
    expect(shapeDirections(chart, 44, [34, 54, 55])).toEqual(['down', 'up']);
    expect(shapeDirections(chart, 55, [34, 44, 54])).toEqual(['right']);
    for (const shape of SHAPE_IDS) {
      for (const p of shapePlacements(chart, shape, 1)) {
        expect(p.directions.length).toBeGreaterThan(0);
        expect(p.directions).toEqual(shapeDirections(chart, p.number, p.hints));
        for (const d of p.directions) expect(['right', 'left', 'down', 'up']).toContain(d);
      }
    }
  });

  it('with a direction, every placement trains it; shapes never train a diagonal', () => {
    for (const d of DIRECTIONS) {
      const found = placements(chart, { pattern: 'shape', shape: 'T', empties: 1 }, d);
      if (!['right', 'left', 'down', 'up'].includes(d)) expect(found).toEqual([]);
      for (const p of found) expect(p.directions).toContain(d);
    }
  });

  it('two empty squares give two targets in a row, each trained from its lit neighbors', () => {
    for (const shape of SHAPE_IDS) {
      for (const p of shapePlacements(chart, shape, 2)) {
        const [second] = p.queue;
        expect(second).toBeDefined();
        expect(second!.directions).toEqual(shapeDirections(chart, second!.number, [...p.hints, p.number]));
        expect(second!.directions.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('shape targets in a round (FR-072)', () => {
  const onlyShapes = {
    ...defaultSettings(),
    adaptive: true,
    patterns: { neighbors: false, middle: false, row: false, shape: true },
  };

  it('ladder step 6 (index 5) gives one empty square; step 7 and above (index 6, 7) give two', () => {
    const rng = createRng(3);
    for (let i = 0; i < 40; i++) {
      const one = nextTarget({ layout: chart, settings: onlyShapes, progress: { mastered: [], steps: { right: 5, down: 5 } }, rng });
      expect(one.pattern).toBe('shape');
      expect(one.queue).toBeUndefined();
      expect(one.hints).toHaveLength(3);
      const two = nextTarget({ layout: chart, settings: onlyShapes, progress: { mastered: [], steps: { right: 6, down: 7 } }, rng });
      expect(two.pattern).toBe('shape');
      expect(two.hints).toHaveLength(2);
      expect(two.queue).toHaveLength(1);
    }
  });

  it('after the first goal the second empty square is the target and the first one lights up', () => {
    const rng = createRng(8);
    const first = nextTarget({ layout: chart, settings: onlyShapes, progress: { mastered: [], steps: { right: 7, down: 7 } }, rng });
    const second = nextInShape(first)!;
    expect(second.number).toBe(first.queue![0]!.number);
    expect(second.hints).toEqual([...first.hints, first.number]);
    expect(second.queue).toBeUndefined();
    expect(second.pattern).toBe('shape');
    expect(nextInShape(second)).toBeNull();
  });
});

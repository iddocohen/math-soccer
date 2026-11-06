/** The X shape of level 5 (T094, amendment 09). */
import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { nextInShape } from './nextTarget';
import { placements } from './patterns';
import { xPlacements, xSquares } from './xshape';

const chart = layoutChart(1, 100);

describe('X shape placements', () => {
  it('is the centre and its four diagonal corners: 45 with 34, 36, 54 and 56', () => {
    expect(xSquares(chart, 4, 4)).toEqual([45, 34, 36, 54, 56]);
  });

  it('stays fully on the chart, also on a partial range, and never wraps across a row edge', () => {
    for (const layout of [chart, layoutChart(205, 480), layoutChart(0, 1000)]) {
      for (const p of xPlacements(layout, 2)) {
        const all = [p.number, ...p.hints, ...p.queue.map((q) => q.number)];
        expect(new Set(all).size).toBe(5);
        for (const n of all) {
          expect(n).toBeGreaterThanOrEqual(layout.min);
          expect(n).toBeLessThanOrEqual(layout.max);
        }
        // The centre and the corners sit in three rows and three columns.
        const cols = new Set(p.squares.map((n) => (n - (layout.zeroBased ? 0 : 1)) % 10));
        expect(cols.size).toBe(3);
        expect(Math.max(...cols) - Math.min(...cols)).toBe(2);
      }
    }
  });

  it('has no placement on a chart of one or two rows', () => {
    expect(xPlacements(layoutChart(1, 10), 1)).toEqual([]);
    expect(xPlacements(layoutChart(1, 20), 1)).toEqual([]);
  });

  it('trains only diagonals: the centre all four, a corner the line through the centre', () => {
    const one = xPlacements(chart, 1).filter((p) => p.squares[0] === 45);
    expect(one).toHaveLength(5);
    expect(one.find((p) => p.number === 45)!.directions).toEqual(['downRight', 'upLeft', 'downLeft', 'upRight']);
    expect(one.find((p) => p.number === 34)!.directions).toEqual(['upLeft']);
    expect(one.find((p) => p.number === 56)!.directions).toEqual(['downRight']);
  });

  it('with two empty squares, the second becomes the target after the first goal, the first now lit', () => {
    const p = placements(chart, { pattern: 'xshape', empties: 2 }).find((x) => x.number === 45 && x.queue?.[0]?.number === 56)!;
    expect(p.hints.sort()).toEqual([34, 36, 54]);
    const first = { number: p.number, hints: p.hints, directions: p.directions, level: 5 as const, pattern: 'xshape' as const, queue: p.queue };
    const second = nextInShape(first)!;
    expect(second.number).toBe(56);
    expect(second.hints).toContain(45);
    expect(second.directions).toEqual(['downRight']);
    expect(nextInShape(second)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { cellOf, layoutChart, numberAt } from '../chart/layout';
import { createRng } from '../rng';
import { DIRECTIONS, type Direction } from '../types';
import { DIRECTION_STEP, LINE_GIVEN, LINE_MIN_LENGTH, makeLine } from './lines';

const hundred = layoutChart(1, 100);

describe('makeLine', () => {
  it('every square of a line lies on the chart and follows the direction in row and column space', () => {
    for (const layout of [hundred, layoutChart(0, 100), layoutChart(15, 87), layoutChart(200, 500)]) {
      for (const direction of DIRECTIONS) {
        for (let seed = 0; seed < 30; seed++) {
          const line = makeLine(layout, direction, 5, createRng(seed));
          expect(line.squares).toHaveLength(5);
          const [dRow, dCol] = DIRECTION_STEP[line.direction];
          line.squares.forEach((n, i) => {
            expect(n).toBeGreaterThanOrEqual(layout.min);
            expect(n).toBeLessThanOrEqual(layout.max);
            if (i === 0) return;
            const a = cellOf(layout, line.squares[i - 1]!);
            const b = cellOf(layout, n);
            expect([b.row - a.row, b.col - a.col]).toEqual([dRow, dCol]);
          });
        }
      }
    }
  });

  it('+11 and +9 lines never wrap across a row edge', () => {
    for (const direction of ['downRight', 'downLeft', 'upLeft', 'upRight'] as const) {
      for (let seed = 0; seed < 200; seed++) {
        const line = makeLine(hundred, direction, 5, createRng(seed));
        const cols = line.squares.map((n) => cellOf(hundred, n).col);
        for (let i = 1; i < cols.length; i++) expect(Math.abs(cols[i]! - cols[i - 1]!)).toBe(1);
        // 10 to 21 adds 11 but goes from the end of a row to the second square of the next one.
        const steps = line.squares.slice(1).map((n, i) => n - line.squares[i]!);
        const expected = { downRight: 11, downLeft: 9, upLeft: -11, upRight: -9 }[direction];
        expect(steps.every((s) => s === expected)).toBe(true);
      }
    }
  });

  it('starts with the given squares printed and the next square as the target', () => {
    const line = makeLine(hundred, 'down', 5, createRng(1));
    expect(line.given).toBe(LINE_GIVEN);
    expect(line.index).toBe(LINE_GIVEN);
    expect(line.direction).toBe('down');
  });

  it('length shortens to 3 when the chart is too small, and falls back to right when nothing fits', () => {
    // 1 to 30 has 3 rows: a down line of 5 does not fit, one of 3 does.
    const three = layoutChart(1, 30);
    const down = makeLine(three, 'down', 5, createRng(4));
    expect(down.direction).toBe('down');
    expect(down.squares).toHaveLength(LINE_MIN_LENGTH);

    // 1 to 20 has 2 rows: no down or diagonal line of 3 fits, so the line goes right with the asked length.
    const two = layoutChart(1, 20);
    for (const direction of ['down', 'up', 'downRight', 'downLeft'] as Direction[]) {
      const line = makeLine(two, direction, 5, createRng(7));
      expect(line.direction).toBe('right');
      expect(line.squares).toHaveLength(5);
      const steps = line.squares.slice(1).map((n, i) => n - line.squares[i]!);
      expect(steps.every((s) => s === 1)).toBe(true);
    }
  });

  it('a partial row does not take squares outside the range', () => {
    // 5 to 14: the first row holds 5 to 10, the second 11 to 14.
    const layout = layoutChart(5, 14);
    for (let seed = 0; seed < 50; seed++) {
      const line = makeLine(layout, 'right', 10, createRng(seed));
      for (const n of line.squares) {
        const { row, col } = cellOf(layout, n);
        expect(numberAt(layout, row, col)).toBe(n);
      }
      expect(line.squares.length).toBeGreaterThanOrEqual(LINE_MIN_LENGTH);
    }
  });

  it('same seed gives the same line', () => {
    for (const direction of DIRECTIONS) {
      expect(makeLine(hundred, direction, 6, createRng(42))).toEqual(makeLine(hundred, direction, 6, createRng(42)));
    }
  });

  it('starts vary with the seed', () => {
    const starts = new Set(Array.from({ length: 40 }, (_, seed) => makeLine(hundred, 'down', 5, createRng(seed)).squares[0]));
    expect(starts.size).toBeGreaterThan(10);
  });
});

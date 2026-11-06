/**
 * The X shape, difficulty level 5 "X-Form" (amendment 09): a centre square and its four diagonal corners. The centre 45
 * has the corners 34, 36, 54 and 56. The shape is placed fully on the chart in row and column space, so it never wraps
 * across a row edge.
 *
 * One square is empty and the other four light up as hints. With two empty squares the child shoots them one after the
 * other, as with the shapes of amendment 06 (FR-072): the second empty square becomes the next target after the first
 * goal, with the first one now lit as a hint.
 *
 * An X target trains the diagonals only: the directions come from the lit squares that lie on a diagonal line with the
 * empty square (the centre, and the opposite corner two steps away). Two corners on the same side, such as 34 and 36,
 * are two squares apart across, but that line is not part of the X, so it is not counted.
 */
import { COLUMNS, numberAt, type ChartLayout } from '../chart/layout';
import type { Direction } from '../types';
import { directionsOf } from './hints';
import type { QueuedSquare } from './shapes';

/** The squares of the X as [row, column] from the centre: the centre first, then the corners. */
export const X_CELLS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** The directions an X target can train. */
export const X_DIRECTIONS: readonly Direction[] = ['downRight', 'upLeft', 'downLeft', 'upRight'];

/** How many squares of the X are empty. */
export type XEmpties = 1 | 2;

/** An X placed on the chart: the first target, its hints, its trained directions and the empty square after it. */
export interface XPlacement {
  number: number;
  hints: number[];
  directions: Direction[];
  /** The empty square shot after `number`; empty for one empty square. */
  queue: QueuedSquare[];
  /** All five squares, the centre first. */
  squares: number[];
}

/** The diagonal directions square `n` trains from the lit squares of the X. */
export function xDirections(n: number, lit: readonly number[]): Direction[] {
  return directionsOf(n, lit).filter((d) => X_DIRECTIONS.includes(d));
}

/** The five squares of the X with its centre at `row`, `col`, or null when any square is off the chart. */
export function xSquares(layout: ChartLayout, row: number, col: number): number[] | null {
  const squares = X_CELLS.map(([r, c]) => numberAt(layout, row + r, col + c));
  return squares.some((s) => s === null) ? null : (squares as number[]);
}

/** Every placement of the X with `empties` empty squares on the chart; with `direction`, only those that train it. */
export function xPlacements(layout: ChartLayout, empties: XEmpties, direction?: Direction): XPlacement[] {
  const out: XPlacement[] = [];
  for (let row = 1; row < layout.rows - 1; row++) {
    for (let col = 1; col < COLUMNS - 1; col++) {
      const squares = xSquares(layout, row, col);
      if (!squares) continue;
      for (const first of squares) {
        if (empties === 1) {
          const lit = squares.filter((s) => s !== first);
          const directions = xDirections(first, lit);
          if (directions.length === 0 || (direction !== undefined && !directions.includes(direction))) continue;
          out.push({ number: first, hints: lit, directions, queue: [], squares });
          continue;
        }
        for (const second of squares) {
          if (second === first) continue;
          const lit = squares.filter((s) => s !== first && s !== second);
          const directions = xDirections(first, lit);
          const secondDirections = xDirections(second, [...lit, first]);
          if (directions.length === 0 || secondDirections.length === 0) continue;
          if (direction !== undefined && !directions.includes(direction)) continue;
          out.push({ number: first, hints: lit, directions, queue: [{ number: second, directions: secondDirections }], squares });
        }
      }
    }
  }
  return out;
}

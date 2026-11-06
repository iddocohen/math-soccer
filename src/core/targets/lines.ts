/**
 * Lines for line mode (research R6; FR-015 to FR-018; data-model "Line").
 *
 * `makeLine` steps in row and column space, not by adding the step to the number, so a diagonal line never wraps from
 * the end of one row to the start of the next (10 + 11 = 21 is not down-right of 10). Every square lies on the chart.
 * When no start fits, the line is shortened one square at a time down to LINE_MIN_LENGTH; when even that does not fit
 * (a chart of one or two rows), the line goes right instead. All randomness comes from the given `Rng`.
 */
import { COLUMNS, numberAt, type ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import type { Direction } from '../types';
import { MOVE } from './hints';

/** The squares printed at the start of a line; the next square is the first target. */
export const LINE_GIVEN = 2;

/** The shortest line: the given squares and one target. */
export const LINE_MIN_LENGTH = 3;

export interface Line {
  /** The numbers of the line in order. */
  squares: number[];
  direction: Direction;
  /** `squares[0..given-1]` are printed. */
  given: number;
  /** `squares[index]` is the current target; `index === squares.length` once the line is finished. */
  index: number;
}

/** Every line of `length` squares in `direction` that lies fully on the chart, by start number. */
function linesFitting(layout: ChartLayout, direction: Direction, length: number): number[][] {
  const [dRow, dCol] = MOVE[direction];
  const out: number[][] = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const squares: number[] = [];
      for (let i = 0; i < length; i++) {
        const n = numberAt(layout, row + i * dRow, col + i * dCol);
        if (n === null) break;
        squares.push(n);
      }
      if (squares.length === length) out.push(squares);
    }
  }
  return out;
}

/** The longest lines up to `length`, down to LINE_MIN_LENGTH, in `direction`; empty when none fits. */
function longestFitting(layout: ChartLayout, direction: Direction, length: number): number[][] {
  for (let len = length; len >= LINE_MIN_LENGTH; len--) {
    const lines = linesFitting(layout, direction, len);
    if (lines.length > 0) return lines;
  }
  return [];
}

/** A new line in `direction` of `length` squares (see the file comment for the fallbacks). */
export function makeLine(layout: ChartLayout, direction: Direction, length: number, rng: Rng): Line {
  const wanted = Math.max(LINE_MIN_LENGTH, Math.floor(length));
  let used = direction;
  let lines = longestFitting(layout, direction, wanted);
  if (lines.length === 0 && direction !== 'right') {
    used = 'right';
    lines = longestFitting(layout, 'right', wanted);
  }
  if (lines.length === 0) throw new RangeError(`makeLine: no line of ${LINE_MIN_LENGTH} fits ${layout.min} to ${layout.max}`);
  return { squares: rng.pick(lines), direction: used, given: LINE_GIVEN, index: LINE_GIVEN };
}


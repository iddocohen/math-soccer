import type { Rect } from '../types';

/**
 * The number chart inside the goal (research R3, R4; data-model ChartLayout). Every square of the board, the ball's
 * landing spot, the hints and the help chart come from this one mapping, so the ball lands on the square of the typed
 * number by construction (FR-003, SC-004).
 */

/** Squares per row. */
export const COLUMNS = 10;

/** Squares smaller than this many world pixels high show no number (research R4, FR-009). */
export const MIN_NUMBER_HEIGHT = 14;

export type BallKind = 'soccer' | 'tennis' | 'pingpong';

export interface ChartLayout {
  min: number;
  max: number;
  /** `min <= 0`: rows start at multiples of 10; otherwise at multiples of 10 plus 1. */
  zeroBased: boolean;
  /** Start number of the first row. */
  firstRowStart: number;
  rows: number;
}

/** Start number of the row that holds `n`. */
function rowStartOf(zeroBased: boolean, n: number): number {
  return zeroBased ? Math.floor(n / COLUMNS) * COLUMNS : Math.floor((n - 1) / COLUMNS) * COLUMNS + 1;
}

/** Lays out the chart of `min` to `max`. Throws on invalid input; callers validate settings first. */
export function layoutChart(min: number, max: number): ChartLayout {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) {
    throw new RangeError(`layoutChart(${min}, ${max}): needs integers with min < max`);
  }
  const zeroBased = min <= 0;
  const firstRowStart = rowStartOf(zeroBased, min);
  const rows = (rowStartOf(zeroBased, max) - firstRowStart) / COLUMNS + 1;
  return { min, max, zeroBased, firstRowStart, rows };
}

/** True when `n` lies in the chart's range. */
export function inChart(layout: ChartLayout, n: number): boolean {
  return n >= layout.min && n <= layout.max;
}

/** Row and column of `n`, both from 0 at the top left. Throws for a number outside the range. */
export function cellOf(layout: ChartLayout, n: number): { row: number; col: number } {
  if (!Number.isInteger(n) || n < layout.min || n > layout.max) {
    throw new RangeError(`cellOf(${n}): outside ${layout.min} to ${layout.max}`);
  }
  const start = rowStartOf(layout.zeroBased, n);
  return { row: (start - layout.firstRowStart) / COLUMNS, col: n - start };
}

/** The number on a square, or null for a square outside the chart or outside the range in a partial row. */
export function numberAt(layout: ChartLayout, row: number, col: number): number | null {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (row < 0 || row >= layout.rows || col < 0 || col >= COLUMNS) return null;
  const n = layout.firstRowStart + row * COLUMNS + col;
  return n >= layout.min && n <= layout.max ? n : null;
}

/** The squares of the chart that carry a number, row by row from the top left: the number, its row and its column. */
export function chartSquares(layout: ChartLayout): Array<{ n: number; row: number; col: number }> {
  const squares: Array<{ n: number; row: number; col: number }> = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const n = numberAt(layout, row, col);
      if (n !== null) squares.push({ n, row, col });
    }
  }
  return squares;
}

/** World rectangle of the square of `n` inside the goal rectangle. */
export function cellRect(layout: ChartLayout, goal: Rect, n: number): Rect {
  const { row, col } = cellOf(layout, n);
  return cellRectAt(layout, goal, row, col);
}

/** World rectangle of the square at `row`, `col` inside the goal rectangle, also for squares outside the range. */
export function cellRectAt(layout: ChartLayout, goal: Rect, row: number, col: number): Rect {
  const width = goal.width / COLUMNS;
  const height = goal.height / layout.rows;
  return { x: goal.x + col * width, y: goal.y + row * height, width, height };
}

/** The middle of `r`. */
export function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Soccer ball up to 10 rows, tennis ball up to 30 rows, ping-pong ball above (research R4). */
export function ballKind(layout: ChartLayout): BallKind {
  if (layout.rows <= 10) return 'soccer';
  if (layout.rows <= 30) return 'tennis';
  return 'pingpong';
}

/** False when squares are under 14 world pixels high; then only the target, hints and shown square carry numbers. */
export function showNumbers(layout: ChartLayout, goal: Rect): boolean {
  return goal.height / layout.rows >= MIN_NUMBER_HEIGHT;
}

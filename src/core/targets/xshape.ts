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
import { numberAt, type ChartLayout } from '../chart/layout';
import type { Direction } from '../types';
import { DIAGONAL, directionsOf, hintOffsets } from './hints';
import { modelPlacements, turnPlacements, type EmptyRule, type ModelTurn, type SquaresPlacement } from './shapes';

/** The squares of the X as [row, column] from the centre: the centre first, then the corners. */
export const X_CELLS: ReadonlyArray<readonly [number, number]> = [[0, 0], ...hintOffsets('diagonal')];

/** How many squares of the X are empty. */
export type XEmpties = 1 | 2;

/** An X placed on the chart: the first target, its hints, its trained directions and the empty square after it. */
export type XPlacement = SquaresPlacement;

/** The diagonal directions square `n` trains from the lit squares of the X. */
export function xDirections(n: number, lit: readonly number[]): Direction[] {
  return directionsOf(n, lit).filter((d) => DIAGONAL.includes(d));
}

/** The five squares of the X with its centre at `row`, `col`, or null when any square is off the chart. */
export function xSquares(layout: ChartLayout, row: number, col: number): number[] | null {
  const squares = X_CELLS.map(([r, c]) => numberAt(layout, row + r, col + c));
  return squares.some((s) => s === null) ? null : (squares as number[]);
}

/** Any square of the X may be empty when it trains a diagonal; no lit square count is needed. */
const X_RULE: EmptyRule = { directions: xDirections, minPointing: 0 };

/** The X as its one turn, by number of empty squares; worked out once, like the shapes. */
const X_TURNS: Record<XEmpties, ModelTurn[]> = {
  1: [{ cells: X_CELLS, model: modelPlacements(X_CELLS, 1, X_RULE) }],
  2: [{ cells: X_CELLS, model: modelPlacements(X_CELLS, 2, X_RULE) }],
};

/** Every placement of the X with `empties` empty squares on the chart; with `direction`, only those that train it. */
export function xPlacements(layout: ChartLayout, empties: XEmpties, direction?: Direction): XPlacement[] {
  return turnPlacements(layout, X_TURNS[empties], direction);
}

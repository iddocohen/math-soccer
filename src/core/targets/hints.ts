/**
 * Hint numbers around a target and the directions they train (research R5, FR-014, FR-038).
 *
 * Hints are placed in row and column space on the chart layout, so a hint never wraps across a row edge, and hints off
 * the chart (outside the range, or outside a partial first or last row) are dropped.
 */
import { cellOf, numberAt, type ChartLayout } from '../chart/layout';
import { DIRECTIONS, type Direction, type HintDistance } from '../types';

/** The number step of each direction on a chart with rows of 10 (data-model "Settings"). */
export const STEP: Record<Direction, number> = {
  right: 1,
  left: -1,
  down: 10,
  up: -10,
  downRight: 11,
  upLeft: -11,
  downLeft: 9,
  upRight: -9,
};

/** Each direction as a move of [rows, columns]. */
export const MOVE: Record<Direction, readonly [number, number]> = {
  right: [0, 1],
  left: [0, -1],
  down: [1, 0],
  up: [-1, 0],
  downRight: [1, 1],
  upLeft: [-1, -1],
  downLeft: [1, -1],
  upRight: [-1, 1],
};

/** The straight directions, across and down, both ways, in the order of DIRECTIONS. */
export const STRAIGHT: readonly Direction[] = ['right', 'left', 'down', 'up'];

/** The diagonal directions, both ways, in the order of DIRECTIONS. */
export const DIAGONAL: readonly Direction[] = ['downRight', 'upLeft', 'downLeft', 'upRight'];

/**
 * Where the hints sit relative to the target, as [dRow, dCol]:
 * - `direct`: left, right, above, below.
 * - `vertical`: above and below only.
 * - `diagonal`: the four diagonal neighbors.
 * - `far`: two squares away to the left, right, above and below.
 */
export function hintOffsets(distance: HintDistance): Array<[number, number]> {
  switch (distance) {
    case 'direct':
      return [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ];
    case 'vertical':
      return [
        [-1, 0],
        [1, 0],
      ];
    case 'diagonal':
      return [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
    case 'far':
      return [
        [0, -2],
        [0, 2],
        [-2, 0],
        [2, 0],
      ];
  }
}

/** The hint numbers of target `n` for `distance`, in the order of `hintOffsets`, without those off the chart. */
export function hintsFor(layout: ChartLayout, n: number, distance: HintDistance): number[] {
  const { row, col } = cellOf(layout, n);
  const hints: number[] = [];
  for (const [dRow, dCol] of hintOffsets(distance)) {
    const hint = numberAt(layout, row + dRow, col + dCol);
    if (hint !== null) hints.push(hint);
  }
  return hints;
}

/**
 * The directions a target trains: the step from each hint to the target (FR-038). The hint 36 above the target 46
 * gives `down` (+10), the hint 45 beside it gives `right` (+1). A hint 2 or 3 squares away counts as the matching
 * direction. The result follows the order of DIRECTIONS and holds each direction once.
 */
export function directionsOf(n: number, hints: readonly number[]): Direction[] {
  const found = new Set<Direction>();
  for (const hint of hints) {
    const direction = directionOfStep(n - hint);
    if (direction !== null) found.add(direction);
  }
  return DIRECTIONS.filter((d) => found.has(d));
}

/** The direction whose step, taken 1, 2 or 3 times, is `diff`; one step is checked first. Null when none fits. */
function directionOfStep(diff: number): Direction | null {
  for (const times of [1, 2, 3]) {
    for (const d of DIRECTIONS) {
      if (STEP[d] * times === diff) return d;
    }
  }
  return null;
}

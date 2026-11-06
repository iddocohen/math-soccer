/**
 * Hint patterns of the goalkeeper game (amendment 05, FR-065): which numbers light up around an empty target square.
 *
 * - Nachbarn (`neighbors`): the squares around the target, as a hint distance chooses them (see `hintsFor`).
 * - Mitte (`middle`): the square on each side of the target in one direction, so the target is the middle. Across:
 *   45 _ 47; down: 36 _ 56; diagonal: 35 _ 57.
 * - Reihe (`row`): two or three squares before the target in one direction, so the target continues the row. Down:
 *   16, 26, 36, then 46; diagonal down-right: 13, 24, 35, then 46. Backward directions run the other way.
 * - Formen (`shape`): one or two empty squares of a four-square shape; see shapes.ts (amendment 06).
 * - X-Form (`xshape`): one or two empty squares of the diagonal cross; see xshape.ts (amendment 09).
 *
 * Placements step in row and column space on the chart layout, so a pattern never wraps across a row edge, and a
 * placement exists only when every hint square lies on the chart. The trained directions come from the hints, as
 * FR-038 says (`directionsOf`).
 */
import { cellOf, numberAt, type ChartLayout } from '../chart/layout';
import type { Direction, HintDistance } from '../types';
import { directionsOf, hintsFor, MOVE } from './hints';
import { shapePlacements, type QueuedSquare, type ShapeEmpties, type ShapeId } from './shapes';
import { xPlacements, type XEmpties } from './xshape';

export const PATTERNS = ['neighbors', 'middle', 'row', 'shape', 'xshape'] as const;
export type Pattern = (typeof PATTERNS)[number];

/** How many squares of a row are printed before the target. */
export const ROW_GIVEN = [2, 3] as const;
export type RowGiven = (typeof ROW_GIVEN)[number];

/** One pattern with its direction or hint distance: everything but the target number. */
export type PatternChoice =
  | { pattern: 'neighbors'; distance: HintDistance }
  | { pattern: 'middle'; direction: Direction }
  | { pattern: 'row'; direction: Direction; given: RowGiven }
  | { pattern: 'shape'; shape: ShapeId; empties: ShapeEmpties }
  | { pattern: 'xshape'; empties: XEmpties };

/** The choices whose placement depends only on the target square: every pattern but Formen and the X shape. */
export type LineChoice = Exclude<PatternChoice, { pattern: 'shape' } | { pattern: 'xshape' }>;

/** A choice placed on the chart: the target, its hint numbers and the directions it trains. */
export interface Placement {
  number: number;
  hints: number[];
  directions: Direction[];
  /** Formen or the X shape with two empty squares: the empty square shot after this one (FR-072). */
  queue?: QueuedSquare[];
}

/** The fewest hints a Nachbarn target has with this distance (two for direct neighbors, so the pattern still reads). */
export function minNeighborHints(distance: HintDistance): number {
  return distance === 'direct' ? 2 : 1;
}

/** The number `k` steps in `direction` from `n`, or null off the chart. */
function stepFrom(layout: ChartLayout, n: number, direction: Direction, k: number): number | null {
  const { row, col } = cellOf(layout, n);
  const [dRow, dCol] = MOVE[direction];
  return numberAt(layout, row + dRow * k, col + dCol * k);
}

/** The hint numbers of `choice` around the target `n`, or null when the pattern does not fit there. */
export function patternHints(layout: ChartLayout, choice: LineChoice, n: number): number[] | null {
  switch (choice.pattern) {
    case 'neighbors': {
      const hints = hintsFor(layout, n, choice.distance);
      return hints.length >= minNeighborHints(choice.distance) ? hints : null;
    }
    case 'middle': {
      const before = stepFrom(layout, n, choice.direction, -1);
      const after = stepFrom(layout, n, choice.direction, 1);
      return before === null || after === null ? null : [before, after];
    }
    case 'row': {
      const hints: number[] = [];
      for (let k = choice.given; k >= 1; k--) {
        const h = stepFrom(layout, n, choice.direction, -k);
        if (h === null) return null;
        hints.push(h);
      }
      return hints;
    }
  }
}

/** The placement of `choice` with the target `n`, or null when it does not fit. */
export function placeAt(layout: ChartLayout, choice: LineChoice, n: number): Placement | null {
  const hints = patternHints(layout, choice, n);
  return hints === null ? null : { number: n, hints, directions: directionsOf(n, hints) };
}

/** Every placement of `choice` on the chart, by target number; with `direction`, only those that train it. */
export function placements(layout: ChartLayout, choice: PatternChoice, direction?: Direction): Placement[] {
  if (choice.pattern === 'shape' || choice.pattern === 'xshape') {
    const found = choice.pattern === 'shape' ? shapePlacements(layout, choice.shape, choice.empties, direction) : xPlacements(layout, choice.empties, direction);
    return found.map(({ number, hints, directions, queue }) => (queue.length > 0 ? { number, hints, directions, queue } : { number, hints, directions }));
  }
  const out: Placement[] = [];
  for (let n = layout.min; n <= layout.max; n++) {
    const p = placeAt(layout, choice, n);
    if (p && (direction === undefined || p.directions.includes(direction))) out.push(p);
  }
  return out;
}

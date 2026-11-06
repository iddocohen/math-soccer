/**
 * Hint patterns of the goalkeeper game (amendment 05, FR-065): which numbers light up around an empty target square.
 *
 * - Nachbarn (`neighbors`): the squares around the target, as a hint distance chooses them (see `hintsFor`).
 * - Mitte (`middle`): the square on each side of the target in one direction, so the target is the middle. Across:
 *   45 _ 47; down: 36 _ 56; diagonal: 35 _ 57.
 * - Reihe (`row`): two or three squares before the target in one direction, so the target continues the row. Down:
 *   16, 26, 36, then 46; diagonal down-right: 13, 24, 35, then 46. Backward directions run the other way.
 * - Formen (`shape`): amendment 06; not built yet (SHAPES_AVAILABLE), so the ladder uses the next lower pattern.
 *
 * Placements step in row and column space on the chart layout, so a pattern never wraps across a row edge, and a
 * placement exists only when every hint square lies on the chart. The trained directions come from the hints, as
 * FR-038 says (`directionsOf`).
 */
import { cellOf, numberAt, type ChartLayout } from '../chart/layout';
import type { Direction, HintDistance } from '../types';
import { directionsOf, hintsFor, MOVE } from './hints';

export const PATTERNS = ['neighbors', 'middle', 'row', 'shape'] as const;
export type Pattern = (typeof PATTERNS)[number];

/** False until amendment 06 adds the shapes; until then a chosen "Formen" falls back to the next lower pattern. */
export const SHAPES_AVAILABLE = false;

/** How many squares of a row are printed before the target. */
export const ROW_GIVEN = [2, 3] as const;
export type RowGiven = (typeof ROW_GIVEN)[number];

/** One pattern with its direction or hint distance: everything but the target number. */
export type PatternChoice =
  | { pattern: 'neighbors'; distance: HintDistance }
  | { pattern: 'middle'; direction: Direction }
  | { pattern: 'row'; direction: Direction; given: RowGiven };

/** A choice placed on the chart: the target, its hint numbers and the directions it trains. */
export interface Placement {
  number: number;
  hints: number[];
  directions: Direction[];
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
export function patternHints(layout: ChartLayout, choice: PatternChoice, n: number): number[] | null {
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
export function placeAt(layout: ChartLayout, choice: PatternChoice, n: number): Placement | null {
  const hints = patternHints(layout, choice, n);
  return hints === null ? null : { number: n, hints, directions: directionsOf(n, hints) };
}

/** Every placement of `choice` on the chart, by target number; with `direction`, only those that train it. */
export function placements(layout: ChartLayout, choice: PatternChoice, direction?: Direction): Placement[] {
  const out: Placement[] = [];
  for (let n = layout.min; n <= layout.max; n++) {
    const p = placeAt(layout, choice, n);
    if (p && (direction === undefined || p.directions.includes(direction))) out.push(p);
  }
  return out;
}

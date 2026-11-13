/**
 * "Freistoß mit Mauer" (amendment 21, FR-142): a wall of 3 to 5 defenders stands in front of the goal and covers a band
 * of chart columns. Pure functions; the controller places the wall, the scene draws it (src/game/WallView.ts).
 *
 * - The band never covers a column of the target, its hints, the waiting squares of a shape or the squares of a cutout
 *   (`keptClearSquares`), so the target and its hints are always in the free part.
 * - The defenders stand shoulder to shoulder: a wall of N defenders covers N - 1 columns. When the free columns leave
 *   no room for that, the band gets narrower (down to one column) with the same defenders. When no column is free at
 *   all, the target has no wall.
 * - A shot at a number in a covered column hits the wall (`wallBlocks`): a miss.
 * - The wall keeps clear of the columns in front of which the child's player stands (`PLAYER_COLUMNS`), so he never
 *   hides a defender. Only when no band fits beside him does it stand there.
 * - After a goal the wall moves: a new band is drawn, another one than before. When only the old band fits at the
 *   full width, a narrower band elsewhere is taken; only when no other band fits at all does the wall stay.
 */
import { cellOf, COLUMNS, type ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import type { DeepReadonly, Target } from '../types';

export const WALL_DEFENDERS_MIN = 3;
export const WALL_DEFENDERS_MAX = 5;

/**
 * The chart columns the child's player stands in front of at the kick spot (src/game/playerPose.ts `PLAYER_FEET`; a
 * unit test there checks they match). The wall avoids them when it can.
 */
export const PLAYER_COLUMNS: readonly number[] = [3, 4];

export interface Wall {
  /** The first and the last chart column the wall covers, 0 to 9, `from <= to`. */
  from: number;
  to: number;
  /** How many defenders stand in it, 3 to 5. */
  defenders: number;
}

/** The squares a wall or a waiting keeper must leave free: the target, its hints, a shape's waiting squares, a cutout. */
export function keptClearSquares(target: DeepReadonly<Target>): number[] {
  const squares = [target.number, ...target.hints, ...(target.queue ?? []).map((q) => q.number), ...(target.cutout?.squares ?? [])];
  return [...new Set(squares)];
}

/** The columns a wall covers, left to right. */
export function wallColumns(wall: Wall): number[] {
  const cols: number[] = [];
  for (let c = wall.from; c <= wall.to; c++) cols.push(c);
  return cols;
}

/** True when the wall covers the column of `n`: a shot at `n` hits the wall. */
export function wallBlocks(layout: ChartLayout, wall: DeepReadonly<Wall> | null, n: number): boolean {
  if (wall === null) return false;
  const { col } = cellOf(layout, n);
  return col >= wall.from && col <= wall.to;
}

/** True when the wall covers none of the squares to keep clear of `target`. */
export function wallClear(layout: ChartLayout, wall: DeepReadonly<Wall>, target: DeepReadonly<Target>): boolean {
  return keptClearSquares(target).every((n) => !wallBlocks(layout, wall, n));
}

/**
 * A wall for `target`: 3 to 5 defenders over the widest band of free columns up to N - 1 columns that differs from
 * `previous`, beside the columns in `avoid` when such a band exists. Null when every column holds a square to keep
 * clear.
 */
export function placeWall(
  layout: ChartLayout,
  target: DeepReadonly<Target>,
  rng: Rng,
  previous: DeepReadonly<Wall> | null = null,
  avoid: readonly number[] = PLAYER_COLUMNS,
): Wall | null {
  const busy = new Set(keptClearSquares(target).map((n) => cellOf(layout, n).col));
  const defenders = rng.int(WALL_DEFENDERS_MIN, WALL_DEFENDERS_MAX);
  // A band that moves beside the player first, then one that moves in front of him; when none moves, the wall stays.
  const free = new Set([...busy, ...avoid]);
  return bandFor(free, defenders, rng, previous, true) ?? bandFor(busy, defenders, rng, previous, true) ?? bandFor(busy, defenders, rng, previous, false);
}

/**
 * The widest band of columns without `busy` ones for `defenders` that differs from `previous`; with `mustMove` false,
 * the widest band there is when none differs. Null when there is none.
 */
function bandFor(busy: ReadonlySet<number>, defenders: number, rng: Rng, previous: DeepReadonly<Wall> | null, mustMove: boolean): Wall | null {
  const same = (b: Wall) => previous !== null && b.from === previous.from && b.to === previous.to;
  let fallback: Wall[] = [];
  for (let width = defenders - 1; width >= 1; width--) {
    const bands = freeBands(busy, width, defenders);
    const moved = bands.filter((b) => !same(b));
    if (moved.length > 0) return rng.pick(moved);
    if (fallback.length === 0) fallback = bands;
  }
  return !mustMove && fallback.length > 0 ? rng.pick(fallback) : null;
}

/** Every band of `width` neighboring columns with none of the `busy` columns. */
function freeBands(busy: ReadonlySet<number>, width: number, defenders: number): Wall[] {
  const bands: Wall[] = [];
  for (let from = 0; from + width <= COLUMNS; from++) {
    let free = true;
    for (let c = from; c < from + width; c++) if (busy.has(c)) free = false;
    if (free) bands.push({ from, to: from + width - 1, defenders });
  }
  return bands;
}

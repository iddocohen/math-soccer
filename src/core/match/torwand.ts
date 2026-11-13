/**
 * "Torwandschießen" (amendment 23, FR-155 to FR-157): a board covers the goal mouth, with two or three round holes cut
 * into chart squares. Pure functions; the controller plays the shots (MatchController, mode 'torwand') and the scene
 * draws the board (src/game/TorwandView.ts).
 *
 * - One hole is the target ("Triff die 47!"); the others are decoys at other chart squares.
 * - Hint numbers follow the child's level, with fewer than usual: one row or column neighbor at levels 1 and 2, none
 *   from level 3 (`torwandHintCount`).
 * - Holes never share a square and never touch: each hole lies at least two squares (in rows or columns) from every
 *   other hole, so the round cutouts never overlap. A decoy never sits on a hint square.
 * - Levels 1 and 2 have two holes, from level 3 three (`torwandHoleCount`). When the chart has no room for a spaced
 *   decoy, the target gets fewer decoys (a 2-row chart can still hold two).
 * - A round is TORWAND_SHOTS shots, one per target; each goal earns `STARS.goal` (src/core/rewards/lockerRoom.ts).
 */
import { cellOf, numberAt, COLUMNS, type ChartLayout } from '../chart/layout';
import type { Level } from '../settings/defaults';
import type { Rng } from '../rng';
import type { DeepReadonly, Target } from '../types';

/** The shots of a round (FR-157). */
export const TORWAND_SHOTS = 10;

/** How a shot at the board ends: through the target hole, through a decoy hole, or against the board. */
export type TorwandHit = 'goal' | 'decoy' | 'board';

/** The hint numbers a target gets at `level` (FR-156): one neighbor at levels 1 and 2, none from level 3. */
export function torwandHintCount(level: Level): 0 | 1 {
  return level <= 2 ? 1 : 0;
}

/** The holes of the board at `level`, the target's included: two at levels 1 and 2, three from level 3. */
export function torwandHoleCount(level: Level): 2 | 3 {
  return level <= 2 ? 2 : 3;
}

/** The row and column neighbors of `n` on the chart. */
function neighborsOf(layout: ChartLayout, n: number): number[] {
  const { row, col } = cellOf(layout, n);
  const around: Array<[number, number]> = [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col],
    [row + 1, col],
  ];
  return around.map(([r, c]) => numberAt(layout, r, c)).filter((x): x is number => x !== null);
}

/**
 * The target of a shot at the board: the number, level, pattern and directions of `base` (a target of the child's level
 * from `nextTarget`), with the hints cut down by level (FR-156). Shapes and cutouts do not go on at the board, so the
 * queue and the cutout are dropped: each shot has one target.
 */
export function torwandTarget(layout: ChartLayout, base: DeepReadonly<Target>, rng: Rng): Target {
  const count = torwandHintCount(base.level);
  const hints = count === 0 ? [] : rng.shuffled(neighborsOf(layout, base.number)).slice(0, count);
  return { number: base.number, hints, directions: [...base.directions], level: base.level, pattern: base.pattern };
}

/** True when two squares are at least two rows or two columns apart, so their holes do not touch. */
export function holesApart(layout: ChartLayout, a: number, b: number): boolean {
  const p = cellOf(layout, a);
  const q = cellOf(layout, b);
  return Math.max(Math.abs(p.row - q.row), Math.abs(p.col - q.col)) >= 2;
}

/**
 * The holes for `target`, the target's first, then the decoys (FR-155). The decoys lie on other chart squares, never
 * on a hint, and every hole keeps at least one square between itself and the others.
 */
export function torwandHoles(layout: ChartLayout, target: DeepReadonly<Target>, rng: Rng): number[] {
  const holes = [target.number];
  const hints = new Set(target.hints);
  const squares: number[] = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const n = numberAt(layout, row, col);
      if (n !== null && n !== target.number && !hints.has(n)) squares.push(n);
    }
  }
  const wanted = torwandHoleCount(target.level);
  for (const n of rng.shuffled(squares)) {
    if (holes.length >= wanted) break;
    if (holes.every((h) => holesApart(layout, h, n))) holes.push(n);
  }
  return holes;
}

/** Where a shot at `n` goes: through the target hole, through a decoy hole, or against the board (FR-156). */
export function torwandHit(holes: readonly number[], target: number, n: number): TorwandHit {
  if (n === target) return 'goal';
  return holes.includes(n) ? 'decoy' : 'board';
}

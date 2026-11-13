/**
 * Cutouts from the hundred chart, difficulty level 6 "Ausschnitte" (amendment 18, FR-124 to FR-127), after the workbook
 * page "Ergänze die fehlenden Zahlen in den Ausschnitten aus der Hundertertafel".
 *
 * A cutout is a group of squares placed fully on the chart in row and column space, so it never wraps across a row
 * edge. The child sees its whole outline: one or two squares are given with their numbers, every other square is empty.
 * The cutouts (`CUTOUT_CELLS`), each in all its turns:
 * - `box3x3`: a 3×3 box; `box2x3`: a box of 2 rows and 3 columns, and turned, of 3 rows and 2 columns;
 * - `line4`, `line5`: a row of 4 or 5 squares, and turned, a column;
 * - `tetris`: the seven four-square shapes of amendment 06 (all seven: the shape switches of the settings belong to
 *   levels 3 and 4, design call T109);
 * - `L3`, `T3`: an L and a T with arms of 3 squares.
 *
 * Given squares (design call of the amendment): two in the four-square shapes, one in every other cutout. Any square or
 * pair of squares may be given.
 *
 * The empty squares are filled one after the other, outward from the given ones (FR-125): the order goes by the number
 * of steps across and down from the nearest given square, then in reading order, so each next square shares an edge with
 * a given or already filled square. The directions a square trains come from the known squares that share an edge with
 * it when it is its turn (FR-127): a square right of a known square trains `right`, one below trains `down`.
 *
 * The first empty square is the target and the others wait in `queue`, as the shapes with two empty squares do
 * (shapes.ts), so the placement machinery of the shapes places cutouts too.
 */
import type { ChartLayout } from '../chart/layout';
import { numberAt } from '../chart/layout';
import type { Direction } from '../types';
import { MODEL, MODEL_COL, MODEL_ROW, SHAPE_CELLS, SHAPE_IDS, shapeDirections, turnPlacements, turnsOf, type ModelPlacement, type ModelTurn, type SquaresPlacement } from './shapes';

export const CUTOUT_IDS = ['box3x3', 'box2x3', 'line4', 'line5', 'tetris', 'L3', 'T3'] as const;
export type CutoutId = (typeof CUTOUT_IDS)[number];

type CellList = ReadonlyArray<readonly [number, number]>;

/** A box of `rows` by `cols` squares. */
function box(rows: number, cols: number): CellList {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([r, c]);
  return out;
}

/**
 * The squares of each cutout in its first turn, as [row, column] from the top left; `tetris` lists the seven shapes.
 * The turns give the other boxes, the columns and the turned L and T.
 */
export const CUTOUT_CELLS: Record<CutoutId, readonly CellList[]> = {
  box3x3: [box(3, 3)],
  box2x3: [box(2, 3)],
  line4: [box(1, 4)],
  line5: [box(1, 5)],
  tetris: SHAPE_IDS.map((id) => SHAPE_CELLS[id]),
  // A column of 3 with a foot of 3 to the right, sharing the corner square.
  L3: [[[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]],
  // A bar of 3 with a stem of 3 below its middle, sharing the middle square.
  T3: [[[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]]],
};

/** How many squares of a cutout of `size` squares are given (design call of the amendment). */
export function givenCount(size: number): 1 | 2 {
  return size === 4 ? 2 : 1;
}

/** A cutout placed on the chart: the first empty square, the given squares, the queue of the other empty squares and all squares. */
export type CutoutPlacement = SquaresPlacement;

/** Every way to pick `k` (1 or 2) of the indexes 0 to `n` - 1. */
function picks(n: number, k: 1 | 2): number[][] {
  const out: number[][] = [];
  for (let a = 0; a < n; a++) {
    if (k === 1) out.push([a]);
    else for (let b = a + 1; b < n; b++) out.push([a, b]);
  }
  return out;
}

/** The fill order of the empty squares of a turn with the squares `given` known, by square index (file comment). */
export function fillOrder(cells: CellList, given: readonly number[]): number[] {
  const steps = cells.map(() => Infinity);
  const queue = [...given];
  for (const g of given) steps[g] = 0;
  while (queue.length > 0) {
    const i = queue.shift()!;
    cells.forEach(([r, c], j) => {
      const [ri, ci] = cells[i]!;
      if (steps[j] === Infinity && Math.abs(r - ri) + Math.abs(c - ci) === 1) {
        steps[j] = steps[i]! + 1;
        queue.push(j);
      }
    });
  }
  const empty = cells.map((_, i) => i).filter((i) => !given.includes(i));
  // Reading order breaks ties; `cells` of a turn are sorted in reading order (turnsOf).
  return empty.sort((a, b) => steps[a]! - steps[b]! || a - b);
}

/** The placements of one turn by square index: one per choice of given squares. */
function cutoutModel(cells: CellList): ModelPlacement[] {
  const squares = cells.map(([r, c]) => numberAt(MODEL, MODEL_ROW + r, MODEL_COL + c)!);
  const out: ModelPlacement[] = [];
  for (const given of picks(cells.length, givenCount(cells.length))) {
    const order = fillOrder(cells, given);
    const known = given.map((i) => squares[i]!);
    const steps: Array<{ square: number; directions: Direction[] }> = [];
    for (const i of order) {
      const directions = shapeDirections(MODEL, squares[i]!, known);
      // A square no known square touches cannot be filled from what the child sees; every cutout is connected, so
      // this never happens, but such a placement is left out rather than trained wrongly.
      if (directions.length === 0) break;
      steps.push({ square: i, directions });
      known.push(squares[i]!);
    }
    if (steps.length !== order.length) continue;
    const [first, ...queue] = steps;
    out.push({ first: first!.square, lit: given, directions: first!.directions, queue });
  }
  return out;
}

/** The turns of each cutout with their placements by square index, worked out once on the model chart. */
const cutoutCache = new Map<CutoutId, ModelTurn[]>();
function cutoutTurns(id: CutoutId): ModelTurn[] {
  let turns = cutoutCache.get(id);
  if (turns === undefined) {
    turns = CUTOUT_CELLS[id].flatMap((base) => turnsOf(base)).map((cells) => ({ cells, model: cutoutModel(cells) }));
    cutoutCache.set(id, turns);
  }
  return turns;
}

/** The different turns of cutout `id`, each as [row, column] offsets sorted in reading order. */
export function cutoutShapes(id: CutoutId): CellList[] {
  return cutoutTurns(id).map((t) => t.cells);
}

/** Every placement of cutout `id` on the chart; with `direction`, only those whose first empty square trains it. */
export function cutoutPlacements(layout: ChartLayout, id: CutoutId, direction?: Direction): CutoutPlacement[] {
  return turnPlacements(layout, cutoutTurns(id), direction);
}

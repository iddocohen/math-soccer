/**
 * Shape targets, the hint pattern "Formen" (amendment 06, FR-071 to FR-074).
 *
 * The seven four-square shapes of falling-block games (I, O, T, L, J, S, Z), each in its four turns, placed fully on
 * the chart in row and column space, so a shape never wraps across a row edge. One or two squares of a placed shape
 * are empty; the other squares light up as hints. With two empty squares the child shoots them one after the other:
 * the second empty square becomes the next target after the first goal, with the first one now lit as a hint (FR-072).
 *
 * The directions a shape target trains come from its neighbors inside the shape that are lit at that moment: squares
 * that share an edge with it (FR-073). In the L 34, 44, 54, 55, the square 44 trains down (from 34) and up (from 54),
 * and 55 trains across (from 54). So shapes train across and down and their backward versions, never diagonals.
 *
 * Which squares may be empty (design calls, recorded in tasks.md T091):
 * - one empty square: any square that at least two lit squares point to in a straight line of one to three steps, and
 *   at least one lit square touches;
 * - two empty squares: the first must touch a lit square, and the second must touch a lit square once the first is
 *   filled.
 */
import { cellOf, COLUMNS, layoutChart, numberAt, type ChartLayout } from '../chart/layout';
import { DIRECTIONS, type Direction } from '../types';
import { directionsOf } from './hints';

export const SHAPE_IDS = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'] as const;
export type ShapeId = (typeof SHAPE_IDS)[number];

/** How many squares of a shape are empty: one at level 3 "Formen", two at level 4 "Formen mit 2 Lücken" (amendment 09). */
export type ShapeEmpties = 1 | 2;

/** The squares of each shape in its first turn, as [row, column] from the top left (amendment 06 table). */
export const SHAPE_CELLS: Record<ShapeId, ReadonlyArray<readonly [number, number]>> = {
  I: [[0, 0], [0, 1], [0, 2], [0, 3]],
  O: [[0, 0], [0, 1], [1, 0], [1, 1]],
  T: [[0, 0], [0, 1], [0, 2], [1, 1]],
  L: [[0, 0], [1, 0], [2, 0], [2, 1]],
  J: [[0, 1], [1, 1], [2, 1], [2, 0]],
  S: [[0, 1], [0, 2], [1, 0], [1, 1]],
  Z: [[0, 0], [0, 1], [1, 1], [1, 2]],
};

type Cells = Array<[number, number]>;

/** `cells` turned a quarter clockwise and moved back to row 0 and column 0. */
function turned(cells: ReadonlyArray<readonly [number, number]>): Cells {
  const out = cells.map(([r, c]) => [c, -r] as [number, number]);
  const minRow = Math.min(...out.map(([r]) => r));
  const minCol = Math.min(...out.map(([, c]) => c));
  return out.map(([r, c]) => [r - minRow, c - minCol] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** The different turns of a shape: four for T, L, J; two for I, S, Z; one for O. */
export function shapeTurns(shape: ShapeId): Cells[] {
  const out: Cells[] = [];
  const seen = new Set<string>();
  let cells: Cells = turned(turned(turned(turned(SHAPE_CELLS[shape]))));
  for (let i = 0; i < 4; i++) {
    const key = JSON.stringify(cells);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cells);
    }
    cells = turned(cells);
  }
  return out;
}

/** One empty square still to be shot after the current target of the same shape, with the directions it trains. */
export interface QueuedSquare {
  number: number;
  directions: Direction[];
}

/** A shape placed on the chart: the first target, its hints, its trained directions and the empty squares after it. */
export interface ShapePlacement {
  number: number;
  hints: number[];
  directions: Direction[];
  /** The empty squares shot after `number`, in order; empty for one empty square. */
  queue: QueuedSquare[];
  shape: ShapeId;
  /** All four squares of the shape. */
  squares: number[];
}

/** True when the squares `a` and `b` share an edge on the chart. */
function touches(layout: ChartLayout, a: number, b: number): boolean {
  const p = cellOf(layout, a);
  const q = cellOf(layout, b);
  return Math.abs(p.row - q.row) + Math.abs(p.col - q.col) === 1;
}

/** The directions square `n` trains from the lit squares of its shape that share an edge with it (FR-073). */
export function shapeDirections(layout: ChartLayout, n: number, lit: readonly number[]): Direction[] {
  return directionsOf(
    n,
    lit.filter((h) => touches(layout, n, h)),
  );
}

/** How many lit squares point to `n` in a straight line of one to three steps. */
function pointing(n: number, lit: readonly number[]): number {
  return lit.filter((h) => directionsOf(n, [h]).length > 0).length;
}

/** Every placement of `shape` with `empties` empty squares on the chart; with `direction`, only those that train it. */
export function shapePlacements(layout: ChartLayout, shape: ShapeId, empties: ShapeEmpties, direction?: Direction): ShapePlacement[] {
  const out: ShapePlacement[] = [];
  for (const { cells, model } of modelTurns(shape, empties)) {
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        const squares = cells.map(([r, c]) => numberAt(layout, row + r, col + c));
        if (squares.some((s) => s === null)) continue;
        const at = (i: number) => squares[i]!;
        for (const m of model) {
          if (direction !== undefined && !m.directions.includes(direction)) continue;
          out.push({
            number: at(m.first),
            hints: m.lit.map(at),
            directions: m.directions,
            queue: m.second === null ? [] : [{ number: at(m.second), directions: m.secondDirections }],
            shape,
            squares: squares as number[],
          });
        }
      }
    }
  }
  return out;
}

/** One placement of a turn by square index: the empty squares, the lit ones and the trained directions. */
interface ModelPlacement {
  first: number;
  second: number | null;
  lit: number[];
  directions: Direction[];
  secondDirections: Direction[];
}

/** A chart where every turn fits away from the edges, so the directions read the same as anywhere else. */
const MODEL = layoutChart(1, 100);
const MODEL_ROW = 3;
const MODEL_COL = 3;

/**
 * The turns of `shape` with their placements by square index. The empty squares, their lit neighbors and their
 * directions depend only on the turn, not on where it sits, so they are worked out once per shape and number of empty
 * squares on a model chart, and moved to each place.
 */
const modelCache = new Map<string, Array<{ cells: Cells; model: ModelPlacement[] }>>();
function modelTurns(shape: ShapeId, empties: ShapeEmpties): Array<{ cells: Cells; model: ModelPlacement[] }> {
  const key = `${shape}|${empties}`;
  let turns = modelCache.get(key);
  if (turns === undefined) {
    turns = shapeTurns(shape).map((cells) => ({ cells, model: modelPlacements(cells, empties) }));
    modelCache.set(key, turns);
  }
  return turns;
}

/** The placements of a turn by the rules in the file comment, by square index. */
function modelPlacements(cells: ReadonlyArray<readonly [number, number]>, empties: ShapeEmpties): ModelPlacement[] {
  const squares = cells.map(([r, c]) => numberAt(MODEL, MODEL_ROW + r, MODEL_COL + c)!);
  const indexes = squares.map((_, i) => i);
  const out: ModelPlacement[] = [];
  for (const first of indexes) {
    if (empties === 1) {
      const lit = indexes.filter((i) => i !== first);
      const litNumbers = lit.map((i) => squares[i]!);
      const directions = shapeDirections(MODEL, squares[first]!, litNumbers);
      if (directions.length === 0 || pointing(squares[first]!, litNumbers) < 2) continue;
      out.push({ first, second: null, lit, directions, secondDirections: [] });
      continue;
    }
    for (const second of indexes) {
      if (second === first) continue;
      const lit = indexes.filter((i) => i !== first && i !== second);
      const litNumbers = lit.map((i) => squares[i]!);
      const directions = shapeDirections(MODEL, squares[first]!, litNumbers);
      const secondDirections = shapeDirections(MODEL, squares[second]!, [...litNumbers, squares[first]!]);
      if (directions.length === 0 || secondDirections.length === 0) continue;
      out.push({ first, second, lit, directions, secondDirections });
    }
  }
  return out;
}

/** The directions shapes can train: across and down, both ways. */
export const SHAPE_DIRECTIONS: readonly Direction[] = DIRECTIONS.filter((d) => d === 'right' || d === 'left' || d === 'down' || d === 'up');

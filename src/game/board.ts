/**
 * What the goal board shows (FR-004, FR-011, FR-013, FR-019, FR-024, plan decision 8), as plain data for GoalView. No
 * Phaser here, so the rules have unit tests.
 *
 * Hole mode: a board printed like the chart covers the goal, with one open hole at the target (marked with a yellow
 * outline) and a few patched holes as decoration. Hint numbers are printed when the parent chose "immer", or from help
 * step 1 with "auf Wunsch". At help steps 1 and 2 an arrow points from the closest hint number to the hole (`hintFrom`,
 * from core/match/help.ts). Help step 3 writes the answer in the hole. The square of a missed number is warm orange
 * with its number while `shown` is set. Squares outside the range in a partial first or last row are empty board.
 *
 * Goalkeeper mode (US5 completes it): the goal is open, the grid faint, the hints lit in the kit color. Line mode (US4
 * completes it) prints a mostly blank board with the target outlined.
 */
import { cellRect, COLUMNS, numberAt, showNumbers, type ChartLayout } from '../core/chart/layout';
import type { Mode, Rect, Target } from '../core/types';

/** The inputs of the board. GoalView redraws the cached board texture only when `boardKey` of these changes. */
export interface BoardInput {
  layout: ChartLayout;
  goal: Rect;
  mode: Mode;
  target: Target | null;
  /** Hint numbers are printed ("immer", or help step 1 and later with "auf Wunsch"). */
  hintsVisible: boolean;
  helpStep: number;
  /** The missed number whose square shows, or null. */
  shown: number | null;
  /** The hint number the help arrow starts at (help steps 1 and 2), or null for no arrow. */
  hintFrom: number | null;
}

/** The help arrow in world pixels, from the center of the hint square to the center of the target square. */
export interface Arrow {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/**
 * - `printed`: a board square.
 * - `hole`: the open target hole (the net shows through).
 * - `patch`: a patched hole.
 * - `open`: a square of the open goal (goalkeeper mode).
 * - `empty`: outside the range in a partial row.
 */
export type SquareKind = 'printed' | 'hole' | 'patch' | 'open' | 'empty';

/** What a label looks like: ink on the board, white on the shown square, yellow for the answer in the hole. */
export type LabelStyle = 'ink' | 'shown' | 'answer';

export interface Square {
  /** The number, or null outside the range. */
  n: number | null;
  rect: Rect;
  kind: SquareKind;
  /** The target's yellow outline. */
  outlined: boolean;
  /** Filled in the kit color: a lit hint in goalkeeper mode. */
  lit: boolean;
  /** Filled warm orange: the shown square of a miss. */
  shown: boolean;
  label: { text: string; style: LabelStyle } | null;
}

export interface Board {
  squares: Square[];
  /** Label font size in world pixels. */
  fontSize: number;
  /** False when squares are too small for numbers (research R4): the labels then sit on a dark badge. */
  numbersFit: boolean;
  arrow: Arrow | null;
}

/** Changes exactly when the drawn board changes; GoalView compares it to skip redrawing (plan decision 9). */
export function boardKey(input: BoardInput): string {
  const t = input.target;
  const target = t ? `${t.number}:${t.hints.join(',')}:${t.patchedHoles.join(',')}` : '-';
  const { min, max } = input.layout;
  return [min, max, input.mode, target, input.hintsVisible ? 1 : 0, input.helpStep, input.shown ?? '-', input.hintFrom ?? '-'].join('|');
}

export function buildBoard(input: BoardInput): Board {
  const { layout, goal, mode, target, hintsVisible, helpStep, shown } = input;
  const cellHeight = goal.height / layout.rows;
  const numbersFit = showNumbers(layout, goal);
  const fontSize = numbersFit ? Math.min(34, cellHeight * 0.62) : 13;
  const hints = new Set(target && hintsVisible ? target.hints : []);
  const patched = new Set(target && mode === 'holes' ? target.patchedHoles : []);
  const squares: Square[] = [];

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const n = numberAt(layout, row, col);
      const rect: Rect =
        n === null
          ? { x: goal.x + (col * goal.width) / COLUMNS, y: goal.y + row * cellHeight, width: goal.width / COLUMNS, height: cellHeight }
          : cellRect(layout, goal, n);
      if (n === null) {
        squares.push({ n, rect, kind: mode === 'keeper' ? 'open' : 'empty', outlined: false, lit: false, shown: false, label: null });
        continue;
      }
      const isTarget = target?.number === n;
      const isShown = shown === n;
      let kind: SquareKind = mode === 'keeper' ? 'open' : 'printed';
      if (mode === 'holes' && isTarget) kind = 'hole';
      else if (patched.has(n)) kind = 'patch';

      let label: Square['label'] = null;
      if (hints.has(n)) label = { text: String(n), style: 'ink' };
      if (isTarget && helpStep >= 3) label = { text: String(n), style: mode === 'lines' ? 'ink' : 'answer' };
      if (isShown) label = { text: String(n), style: 'shown' };

      squares.push({ n, rect, kind, outlined: isTarget, lit: mode === 'keeper' && hints.has(n), shown: isShown, label });
    }
  }
  return { squares, fontSize, numbersFit, arrow: helpArrow(input) };
}

function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function helpArrow({ layout, goal, target, helpStep, hintFrom }: BoardInput): Arrow | null {
  if (!target || hintFrom === null || helpStep < 1 || helpStep >= 3) return null;
  if (hintFrom < layout.min || hintFrom > layout.max || hintFrom === target.number) return null;
  return { from: center(cellRect(layout, goal, hintFrom)), to: center(cellRect(layout, goal, target.number)) };
}

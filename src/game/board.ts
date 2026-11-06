/**
 * What the grid over the open goal shows (FR-004, FR-013, FR-019, FR-024, plan decision 8), as plain data for GoalView.
 * No Phaser here, so the rules have unit tests.
 *
 * The goal is open: a faint grid of the chart over the net, the hint numbers lit in the kit color with dark numbers,
 * and the empty target square outlined. In a shape with two empty squares, the one still to shoot after the target has
 * a faint dashed outline and no number, so the whole shape stays visible (FR-072). Hint numbers show when the parent chose "immer", or from help step 1 with
 * "auf Wunsch". At help steps 1 and 2 an arrow points from the closest hint number to the target (`hintFrom`, from
 * core/match/help.ts). Help step 3 writes the answer in the target square. The square of a missed number is warm
 * orange with its number while `shown` is set. Squares outside the range in a partial first or last row carry no
 * number.
 */
import { cellRect, cellRectAt, center, COLUMNS, numberAt, showNumbers, type ChartLayout } from '../core/chart/layout';
import type { DeepReadonly, Rect, Target } from '../core/types';

/** The inputs of the grid. GoalView redraws the cached grid texture only when `boardKey` of these changes. */
export interface BoardInput {
  layout: ChartLayout;
  goal: Rect;
  target: DeepReadonly<Target> | null;
  /** Hint numbers show ("immer", or help step 1 and later with "auf Wunsch"). */
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

/** What a label looks like: dark ink on a lit hint, white on the shown square, the kit color for the answer. */
export type LabelStyle = 'ink' | 'shown' | 'answer';

export interface Square {
  /** The number, or null outside the range. */
  n: number | null;
  rect: Rect;
  /** The target's outline in the kit color. */
  outlined: boolean;
  /** A faint dashed kit-color outline: an empty square of the shape still to shoot after the target (FR-072). */
  waiting: boolean;
  /** Filled in the kit color: a hint square. */
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

/** Changes exactly when the drawn grid changes; GoalView compares it to skip redrawing (plan decision 9). */
export function boardKey(input: BoardInput): string {
  const t = input.target;
  const target = t ? `${t.number}:${t.hints.join(',')}:${(t.queue ?? []).map((q) => q.number).join(',')}` : '-';
  const { min, max } = input.layout;
  return [min, max, target, input.hintsVisible ? 1 : 0, input.helpStep, input.shown ?? '-', input.hintFrom ?? '-'].join('|');
}

export function buildBoard(input: BoardInput): Board {
  const { layout, goal, target, hintsVisible, helpStep, shown } = input;
  const cellHeight = goal.height / layout.rows;
  const numbersFit = showNumbers(layout, goal);
  const fontSize = numbersFit ? Math.min(34, cellHeight * 0.62) : 13;
  const hints = new Set(target && hintsVisible ? target.hints : []);
  const waiting = new Set((target?.queue ?? []).map((q) => q.number));
  const squares: Square[] = [];

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const n = numberAt(layout, row, col);
      const rect = cellRectAt(layout, goal, row, col);
      if (n === null) {
        squares.push({ n, rect, outlined: false, waiting: false, lit: false, shown: false, label: null });
        continue;
      }
      const isTarget = target?.number === n;
      const isShown = shown === n;
      let label: Square['label'] = null;
      if (hints.has(n)) label = { text: String(n), style: 'ink' };
      if (isTarget && helpStep >= 3) label = { text: String(n), style: 'answer' };
      if (isShown) label = { text: String(n), style: 'shown' };
      const isWaiting = !isTarget && waiting.has(n);
      squares.push({ n, rect, outlined: isTarget, waiting: isWaiting, lit: hints.has(n), shown: isShown, label });
    }
  }
  return { squares, fontSize, numbersFit, arrow: helpArrow(input) };
}

function helpArrow({ layout, goal, target, helpStep, hintFrom }: BoardInput): Arrow | null {
  if (!target || hintFrom === null || helpStep < 1 || helpStep >= 3) return null;
  if (hintFrom < layout.min || hintFrom > layout.max || hintFrom === target.number) return null;
  return { from: center(cellRect(layout, goal, hintFrom)), to: center(cellRect(layout, goal, target.number)) };
}

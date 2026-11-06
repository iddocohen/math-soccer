/**
 * What the grid over the open goal shows (FR-004, FR-013, FR-019, FR-024, plan decision 8), as plain data for GoalView.
 * No Phaser here, so the rules have unit tests.
 *
 * The goal is open: a faint grid of the chart over the net, the hint numbers lit in the kit color with dark numbers,
 * and the empty target square outlined. In a shape with two empty squares, the one still to shoot after the target has
 * a faint dashed outline and no number, so the whole shape stays visible (FR-072). Hint numbers show when the parent chose "immer", or from help step 1 with
 * "auf Wunsch". From help step 1 up to the help chart (step 3) an arrow points from the closest hint number to the target
 * (`hintFrom`, from core/match/help.ts). The target's row lies under a soft band from help step 1 and its column from
 * step 2 (amendment 10, `bands`); where they cross, the target square has a stronger wash. Help step 4 writes the
 * answer in the target square. The square of a missed number is warm
 * orange with its number while `shown` is set. Squares outside the range in a partial first or last row carry no
 * number.
 */
import { cellRect, cellRectAt, center, COLUMNS, numberAt, showNumbers, type ChartLayout } from '../core/chart/layout';
import { ANSWER_STEP, HINT_STEP, rowColumnHelp } from '../core/match/help';
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
  /** The hint number the help arrow starts at (help steps 1 to 3), or null for no arrow. */
  hintFrom: number | null;
  /** The target was just scored (the celebration runs), so the cell panel is gone. False when left out. */
  solved?: boolean;
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
  /** The target square where the row and column bands cross (help step 2 and later). */
  crossing: boolean;
  label: { text: string; style: LabelStyle } | null;
}

export interface Board {
  squares: Square[];
  /** Label font size in world pixels. */
  fontSize: number;
  /** False when squares are too small for numbers (research R4): the labels then sit on a dark badge. */
  numbersFit: boolean;
  arrow: Arrow | null;
  /** The soft bands over the target's row (help step 1 on) and column (help step 2 on), in world pixels. */
  bands: { row: Rect | null; column: Rect | null };
  /** The soft panel of cells shows (`cellPanelVisible`); otherwise the goal shows only the net, the hints and the target. */
  panel: boolean;
}

/**
 * The cell panel (amendment 11, FR-097) shows only while both the row band and the column band are lit for the current
 * target, that is from help step 2, and goes as soon as that target is scored (parent feedback). A new target starts
 * at help step 0, so it starts without the panel.
 */
export function cellPanelVisible(layout: ChartLayout, target: DeepReadonly<Target> | null, helpStep: number, solved = false): boolean {
  if (!target || solved) return false;
  const { litRow, litColumn } = rowColumnHelp(layout, target, helpStep, false, solved);
  return litRow !== null && litColumn !== null;
}

/** Changes exactly when the drawn grid changes; GoalView compares it to skip redrawing (plan decision 9). */
export function boardKey(input: BoardInput): string {
  const t = input.target;
  const target = t ? `${t.number}:${t.hints.join(',')}:${(t.queue ?? []).map((q) => q.number).join(',')}` : '-';
  const { min, max } = input.layout;
  return [min, max, target, input.hintsVisible ? 1 : 0, input.helpStep, input.shown ?? '-', input.hintFrom ?? '-', input.solved ? 1 : 0].join('|');
}

export function buildBoard(input: BoardInput): Board {
  const { layout, goal, target, hintsVisible, helpStep, shown } = input;
  // The bands go with the scales once the target is scored (amendment 14, FR-115).
  const { litRow, litColumn } = rowColumnHelp(layout, target, helpStep, false, input.solved);
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
        squares.push({ n, rect, outlined: false, waiting: false, lit: false, shown: false, crossing: false, label: null });
        continue;
      }
      const isTarget = target?.number === n;
      const isShown = shown === n;
      let label: Square['label'] = null;
      if (hints.has(n)) label = { text: String(n), style: 'ink' };
      if (isTarget && helpStep >= ANSWER_STEP) label = { text: String(n), style: 'answer' };
      if (isShown) label = { text: String(n), style: 'shown' };
      const isWaiting = !isTarget && waiting.has(n);
      const crossing = isTarget && litRow !== null && litColumn !== null;
      squares.push({ n, rect, outlined: isTarget, waiting: isWaiting, lit: hints.has(n), shown: isShown, crossing, label });
    }
  }
  const cellWidth = goal.width / COLUMNS;
  const bands = {
    row: litRow === null ? null : { x: goal.x, y: goal.y + litRow * cellHeight, width: goal.width, height: cellHeight },
    column: litColumn === null ? null : { x: goal.x + litColumn * cellWidth, y: goal.y, width: cellWidth, height: goal.height },
  };
  return { squares, fontSize, numbersFit, arrow: helpArrow(input), bands, panel: cellPanelVisible(layout, target, helpStep, input.solved) };
}

function helpArrow({ layout, goal, target, helpStep, hintFrom }: BoardInput): Arrow | null {
  if (!target || hintFrom === null || helpStep < HINT_STEP || helpStep >= ANSWER_STEP) return null;
  if (hintFrom < layout.min || hintFrom > layout.max || hintFrom === target.number) return null;
  return { from: center(cellRect(layout, goal, hintFrom)), to: center(cellRect(layout, goal, target.number)) };
}

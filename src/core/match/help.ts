/**
 * Help in four steps (FR-024, FR-025, research R9, amendment 10 FR-094), the pure parts. MatchController owns the help
 * step; this file says what each step shows.
 *
 * - Step 1, the row: hint numbers that were hidden ("auf Wunsch") appear, and a short text names the way from the
 *   closest hint number to the target, for example "Von 36 eine Reihe runter: +10". The target's row lights up as a
 *   band with an arrow from the row scale, and the text adds the row, for example "Die Zahl ist in der Reihe 40".
 * - Step 2, the column: the target's column lights up as a band with an arrow from the column scale, and the text adds
 *   "und in der Spalte 6".
 * - Step 3, the help chart: the full chart of the range in a modal, with the target and the last typed number marked.
 * - Step 4, the answer: the target number is written on the target square.
 *
 * The row and column scales (FR-091 to FR-093): each row is labelled with its tens (0, 10 … 90 on 1 to 100, 190 for the
 * row 191 to 200), each column with 1 to 10. Over 20 rows only every fifth row label shows, plus the lit one.
 */
import { cellOf, COLUMNS, type ChartLayout } from '../chart/layout';
import type { Settings } from '../settings/schema';
import { topLevel } from '../progress/levels';
import { MOVE } from '../targets/hints';
import { DIRECTIONS, type DeepReadonly, type Direction, type Target } from '../types';

export const HINT_STEP = 1;
/** The row band and arrow show from this step (FR-094). */
export const ROW_STEP = 1;
/** The column band and arrow show from this step. */
export const COLUMN_STEP = 2;
export const CHART_STEP = 3;
export const ANSWER_STEP = 4;
/** Over this many rows the row scale shows only every fifth label (amendment 10). */
export const ROW_LABELS_ALL_UP_TO = 20;
/** The way from a hint number to the target. `direction` is null when the hint is not a neighbor of the target. */
export interface HelpHint {
  from: number;
  /** Target minus `from`, for example +10. */
  offset: number;
  direction: Direction | null;
}

/** True when hint numbers show on the board: always with "immer", from help step 1 with "auf Wunsch" (FR-013). */
export function hintsVisible(hintDisplay: Settings['hintDisplay'], helpStep: number): boolean {
  return hintDisplay === 'always' || helpStep >= HINT_STEP;
}

/**
 * How the hints of `target` show (FR-013, FR-040). The parent's "auf Wunsch" is the hardest the game may go: with
 * adaptive difficulty on, hints wait for a request only at the hardest level the parent allows ("Schwerste Stufe",
 * amendment 09) and show always on the easier levels; with adaptive off, the parent's choice applies as it is.
 */
export function targetHintDisplay(
  settings: Pick<Settings, 'hintDisplay' | 'adaptive' | 'levels' | 'shapes'>,
  target: Pick<Target, 'level'> | null,
): Settings['hintDisplay'] {
  if (settings.hintDisplay === 'always') return 'always';
  if (!settings.adaptive) return 'onRequest';
  return target !== null && target.level >= topLevel(settings) ? 'onRequest' : 'always';
}

/**
 * The hint for help step 1: the hint number closest to the target on the chart (fewest squares away, then the smaller
 * difference), with the direction from it to the target when it is a neighbor. Null when the target has no hint number
 * inside the range.
 */
export function helpHint(layout: ChartLayout, target: DeepReadonly<Target> | null): HelpHint | null {
  if (!target) return null;
  const to = cellOf(layout, target.number);
  let best: { hint: HelpHint; distance: number } | null = null;
  for (const from of target.hints) {
    if (from < layout.min || from > layout.max || from === target.number) continue;
    const cell = cellOf(layout, from);
    const dRow = to.row - cell.row;
    const dCol = to.col - cell.col;
    const distance = Math.max(Math.abs(dRow), Math.abs(dCol));
    const offset = target.number - from;
    const better = !best || distance < best.distance || (distance === best.distance && Math.abs(offset) < Math.abs(best.hint.offset));
    if (!better) continue;
    const direction = DIRECTIONS.find((d) => MOVE[d][0] === dRow && MOVE[d][1] === dCol) ?? null;
    best = { hint: { from, offset, direction }, distance };
  }
  return best?.hint ?? null;
}

/**
 * The tens label of chart row `row` (FR-091): the row's start without its ones, so 0 for 1 to 10 and 0 to 9, and 190 for
 * 191 to 200. The label is not the row's first number on a chart that starts at 1 (design call in amendment 10).
 */
export function rowLabel(layout: ChartLayout, row: number): number {
  const start = layout.firstRowStart + row * COLUMNS;
  return layout.zeroBased ? start : start - 1;
}

/** The column label of chart column `col`, 1 to 10 from the left (FR-092). */
export function columnLabel(col: number): number {
  return col + 1;
}

/** One label of a scale: its row or column, its text, and whether it is lit by help. */
export interface ScaleLabel {
  index: number;
  text: string;
  lit: boolean;
}

/** What the row and column helper shows for a help step (FR-091 to FR-095). */
export interface RowColumnHelp {
  /** The labels to draw; empty when the parent turned the helper off and no label is lit (FR-095). */
  rows: ScaleLabel[];
  columns: ScaleLabel[];
  /** The target's row, lit as a band from help step 1, or null. */
  litRow: number | null;
  /** The target's column, lit as a band from help step 2, or null. */
  litColumn: number | null;
}

/**
 * The row and column scales and the bands for `helpStep`. The bands show at steps 1 and 2 and stay while the help
 * chart is open (step 3) and with the answer (step 4), so the crossing still points at the target. With the helper off
 * only the lit labels show (FR-095). Over 20 rows only every fifth row label shows, plus the lit one.
 */
export function rowColumnHelp(
  layout: ChartLayout,
  target: Pick<Target, 'number'> | null,
  helpStep: number,
  helperOn: boolean,
): RowColumnHelp {
  const cell = target && target.number >= layout.min && target.number <= layout.max ? cellOf(layout, target.number) : null;
  const litRow = cell && helpStep >= ROW_STEP ? cell.row : null;
  const litColumn = cell && helpStep >= COLUMN_STEP ? cell.col : null;
  const sparse = layout.rows > ROW_LABELS_ALL_UP_TO;
  const rows: ScaleLabel[] = [];
  for (let row = 0; row < layout.rows; row++) {
    const lit = row === litRow;
    const shown = lit || (helperOn && (!sparse || row % 5 === 0));
    if (shown) rows.push({ index: row, text: String(rowLabel(layout, row)), lit });
  }
  const columns: ScaleLabel[] = [];
  for (let col = 0; col < COLUMNS; col++) {
    const lit = col === litColumn;
    if (lit || helperOn) columns.push({ index: col, text: String(columnLabel(col)), lit });
  }
  return { rows, columns, litRow, litColumn };
}

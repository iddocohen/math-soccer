/**
 * Where the row and column helper sits (amendment 10, FR-091 to FR-095), as plain data for HelperView. No Phaser here,
 * so the rules have unit tests.
 *
 * - The row scale stands right of the goal, outside the right post: one label per chart row at the height of its row,
 *   the row's tens (core/match/help.ts `rowColumnHelp`).
 * - The column scale stands above the crossbar: 1 to 10, each above its column.
 * - From help step 1 an arrow comes in from the row scale and points left at the target's row; from step 2 an arrow
 *   comes down from the column scale and points at the target's column. The arrows stop at the chart's edge, so they
 *   never cover a number.
 * - Each scale lies on one calm dark strip in the night color, slightly transparent, so its labels read over the fans
 *   and the grass (FR-101a). One strip per scale, no box per label.
 */
import { COLUMNS, type ChartLayout } from '../core/chart/layout';
import { ROW_LABELS_ALL_UP_TO, rowColumnHelp } from '../core/match/help';
import { CHART_RECT, GOAL_FRAME } from '../core/match/world';
import type { DeepReadonly, Rect, Target } from '../core/types';
import { clamp } from '../core/util';
import type { Arrow } from './board';

/** The strip right of the goal that holds the row scale, its backing and its arrow (HelperView draws it as one texture). */
export const ROW_STRIP: Rect = { x: CHART_RECT.x + CHART_RECT.width - 6, y: CHART_RECT.y - 20, width: 360, height: CHART_RECT.height + 40 };
/** The strip above the crossbar that holds the column scale, its backing and its arrow. */
export const COLUMN_STRIP: Rect = { x: CHART_RECT.x - 30, y: 120, width: CHART_RECT.width + 60, height: CHART_RECT.y - 120 + 2 };

/** The row scale's labels start this far right of the right post's outer edge. */
const ROW_LABEL_GAP = 52;
/** The column scale's labels sit this far above the crossbar's top edge. */
const COLUMN_LABEL_RISE = 52;
/** The arrows stop this far before the chart's edge. */
const ARROW_STOP = 4;
/** Font size of the column labels and the largest row labels, in world pixels. */
const COLUMN_FONT_SIZE = 30;
/** How far a backing strip reaches past its first and last label, and beside them. */
const BACKING_PAD = 12;
/** A digit of the game font is at most this part of the font size wide. */
const DIGIT_WIDTH = 0.62;
/** A lit label is this much larger (HelperView). */
export const LIT_LABEL_SCALE = 1.25;

export interface ScaleText {
  text: string;
  x: number;
  y: number;
  lit: boolean;
}

export interface Scales {
  rowLabels: ScaleText[];
  columnLabels: ScaleText[];
  /** Font sizes of the labels in world pixels: the row labels shrink on charts with many rows. */
  rowFontSize: number;
  columnFontSize: number;
  rowArrow: Arrow | null;
  columnArrow: Arrow | null;
  /** The dark strips behind the row and the column labels (FR-101a); null when the scale shows no labels. */
  rowBacking: Rect | null;
  columnBacking: Rect | null;
}

/** Changes exactly when the drawn scales change; HelperView compares it to skip redrawing. */
export function scalesKey(layout: ChartLayout, target: DeepReadonly<Target> | null, helpStep: number, helperOn: boolean): string {
  const help = rowColumnHelp(layout, target, helpStep, helperOn);
  return [layout.min, layout.max, help.litRow ?? '-', help.litColumn ?? '-', helperOn ? 1 : 0].join('|');
}

export function buildScales(layout: ChartLayout, chart: Rect, target: DeepReadonly<Target> | null, helpStep: number, helperOn: boolean): Scales {
  const help = rowColumnHelp(layout, target, helpStep, helperOn);
  const cellHeight = chart.height / layout.rows;
  const cellWidth = chart.width / COLUMNS;
  const rowX = GOAL_FRAME.x + GOAL_FRAME.width + ROW_LABEL_GAP;
  const columnY = GOAL_FRAME.y - COLUMN_LABEL_RISE;
  const rowY = (row: number) => chart.y + (row + 0.5) * cellHeight;
  const columnX = (col: number) => chart.x + (col + 0.5) * cellWidth;
  // Over 20 rows only every fifth label shows, so the labels may be larger than a row.
  const spacing = layout.rows > ROW_LABELS_ALL_UP_TO ? cellHeight * 5 : cellHeight;
  const rowFontSize = clamp(spacing * 0.75, 14, COLUMN_FONT_SIZE);
  // A lit label between two shown labels hides the neighbors it would overlap.
  const litY = help.litRow === null ? null : rowY(help.litRow);
  const rowLabels = help.rows
    .filter((l) => l.lit || litY === null || Math.abs(rowY(l.index) - litY) >= rowFontSize)
    .map((l) => ({ text: l.text, x: rowX, y: rowY(l.index), lit: l.lit }));
  const columnLabels = help.columns.map((l) => ({ text: l.text, x: columnX(l.index), y: columnY, lit: l.lit }));
  const rowArrow =
    help.litRow === null
      ? null
      : { from: { x: rowX - 12, y: rowY(help.litRow) }, to: { x: chart.x + chart.width + ARROW_STOP, y: rowY(help.litRow) } };
  const columnArrow =
    help.litColumn === null
      ? null
      : { from: { x: columnX(help.litColumn), y: columnY + 22 }, to: { x: columnX(help.litColumn), y: chart.y - ARROW_STOP } };
  const rowBacking = backing(rowLabels, (l) => {
    const size = l.lit ? rowFontSize * LIT_LABEL_SCALE : rowFontSize;
    return { x: l.x - BACKING_PAD, y: l.y - size * 0.75, width: 2 * BACKING_PAD + l.text.length * size * DIGIT_WIDTH, height: size * 1.5 };
  });
  const columnBacking = backing(columnLabels, (l) => ({
    x: l.x - COLUMN_FONT_SIZE,
    y: l.y - COLUMN_FONT_SIZE / 2 - 4,
    width: 2 * COLUMN_FONT_SIZE,
    height: COLUMN_FONT_SIZE + 8,
  }));
  return { rowLabels, columnLabels, rowFontSize, columnFontSize: COLUMN_FONT_SIZE, rowArrow, columnArrow, rowBacking, columnBacking };
}

/** One strip around the room every label needs (`room`), padded at both ends; null without labels. */
function backing(labels: ScaleText[], room: (label: ScaleText) => Rect): Rect | null {
  if (labels.length === 0) return null;
  const rects = labels.map(room);
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y)) - BACKING_PAD / 2;
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height)) + BACKING_PAD / 2;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

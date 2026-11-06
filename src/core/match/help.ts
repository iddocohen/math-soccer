/**
 * Help in three steps (FR-024, FR-025, research R9), the pure parts. MatchController owns the help step; this file
 * says what each step shows.
 *
 * - Step 1, a hint: hint numbers that were hidden ("auf Wunsch") appear, and a short text names the way from the
 *   closest hint number to the target, for example "Von 36 eine Reihe runter: +10".
 * - Step 2, the help chart: the full chart of the range in a modal, with the target and the last typed number marked.
 * - Step 3, the answer: the target number is written on the target square.
 */
import { cellOf, type ChartLayout } from '../chart/layout';
import type { Settings } from '../settings/schema';
import type { Direction, Target } from '../types';

export const HINT_STEP = 1;
export const CHART_STEP = 2;
export const ANSWER_STEP = 3;

/** The way from a hint number to the target. `direction` is null when the hint is not a neighbor of the target. */
export interface HelpHint {
  from: number;
  /** Target minus `from`, for example +10. */
  offset: number;
  direction: Direction | null;
}

/** Row and column steps of each direction; down is a row further on the chart. */
const DIRECTION_STEPS: ReadonlyArray<readonly [Direction, number, number]> = [
  ['right', 0, 1],
  ['left', 0, -1],
  ['down', 1, 0],
  ['up', -1, 0],
  ['downRight', 1, 1],
  ['upLeft', -1, -1],
  ['downLeft', 1, -1],
  ['upRight', -1, 1],
];

/** True when hint numbers show on the board: always with "immer", from help step 1 with "auf Wunsch" (FR-013). */
export function hintsVisible(hintDisplay: Settings['hintDisplay'], helpStep: number): boolean {
  return hintDisplay === 'always' || helpStep >= HINT_STEP;
}

/**
 * The hint for help step 1: the hint number closest to the target on the chart (fewest squares away, then the smaller
 * difference), with the direction from it to the target when it is a neighbor. Null when the target has no hint number
 * inside the range.
 */
export function helpHint(layout: ChartLayout, target: Target | null): HelpHint | null {
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
    const direction = DIRECTION_STEPS.find(([, r, c]) => r === dRow && c === dCol)?.[0] ?? null;
    best = { hint: { from, offset, direction }, distance };
  }
  return best?.hint ?? null;
}

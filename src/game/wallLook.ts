/**
 * Where the defenders of "Freistoß mit Mauer" stand, when they jump and which squares are shaded (amendment 21,
 * FR-142). Pure functions; src/game/WallView.ts draws them.
 *
 * - `defenderSpots(wall)`: the middle of each defender. They stand side by side with a small gap, one DEFENDER_PITCH
 *   apart, centered under the covered columns. A wall beside the child's player moves sideways until it is clear of
 *   him, and the whole wall stays inside the world.
 * - `wallHop(flightMs, blocked)` and `hopOffset(t, hop)`: on every shot all defenders jump together. The top of the
 *   jump comes when the ball reaches the wall: at the end of the flight for a ball the wall stops, about halfway for a
 *   ball that flies past it. Then they land.
 * - `blockedSquareRects(layout, wall)`: the chart squares behind the wall, one rectangle per square with a number.
 */
import { COLUMNS, cellRectAt, chartSquares, type ChartLayout } from '../core/chart/layout';
import { PLAYER_COLUMNS, type Wall } from '../core/match/wall';
import { CHART_RECT, WORLD_WIDTH } from '../core/match/world';
import type { DeepReadonly, Rect } from '../core/types';
import { BODY, KICK_STEP, PLAYER_FEET, PLAYER_SCALE } from './playerPose';

/** From the middle of one defender to the middle of the next, in world pixels. */
export const DEFENDER_PITCH = 110;
/** The free space between two defenders' shoulders. */
export const DEFENDER_GAP = 10;
/** Free space between the wall and the child's player, and between the wall and the world's edge. */
const CLEARANCE = 12;
/** The child's player from his left edge to his right edge at the end of his kick step. */
export const PLAYER_SPAN = {
  left: PLAYER_FEET.x - BODY.halfWidth * PLAYER_SCALE,
  right: PLAYER_FEET.x + BODY.halfWidth * PLAYER_SCALE + KICK_STEP,
} as const;

/** The middle x of each defender of `wall`, left to right. */
export function defenderSpots(wall: DeepReadonly<Wall>): number[] {
  const col = CHART_RECT.width / COLUMNS;
  const bandMiddle = CHART_RECT.x + ((wall.from + wall.to + 1) / 2) * col;
  const width = wall.defenders * DEFENDER_PITCH;
  let left = bandMiddle - width / 2;
  // Beside the player: move away from him until the wall is clear. A band in front of him stays where it is.
  if (wall.to < Math.min(...PLAYER_COLUMNS)) left = Math.min(left, PLAYER_SPAN.left - CLEARANCE - width);
  else if (wall.from > Math.max(...PLAYER_COLUMNS)) left = Math.max(left, PLAYER_SPAN.right + CLEARANCE);
  left = Math.max(CLEARANCE, Math.min(WORLD_WIDTH - CLEARANCE - width, left));
  return Array.from({ length: wall.defenders }, (_, i) => left + DEFENDER_PITCH * (i + 0.5));
}

/** How high the defenders jump, in world pixels, and how long they go up and come down. */
export const HOP_HEIGHT = 34;
export const HOP_UP_MS = 200;
export const HOP_DOWN_MS = 240;
/** The part of the flight after which a ball that is not stopped passes the wall. */
export const PASS_SHARE = 0.45;

export interface Hop {
  /** From the kick until the defenders leave the grass. */
  delay: number;
  /** From the kick until the top of the jump. */
  peak: number;
  /** From the kick until they stand on the grass again. */
  land: number;
}

/** The jump of the wall for a shot that flies `flightMs`; `blocked` when the ball hits the wall. */
export function wallHop(flightMs: number, blocked: boolean): Hop {
  const peak = blocked ? flightMs : Math.round(flightMs * PASS_SHARE);
  const delay = Math.max(0, peak - HOP_UP_MS);
  return { delay, peak: delay + HOP_UP_MS, land: delay + HOP_UP_MS + HOP_DOWN_MS };
}

/** How far above the grass the defenders are `t` ms after the kick: 0 before and after the jump. */
export function hopOffset(t: number, hop: Hop): number {
  if (t <= hop.delay || t >= hop.land) return 0;
  if (t <= hop.peak) {
    const k = (t - hop.delay) / (hop.peak - hop.delay);
    return HOP_HEIGHT * (1 - (1 - k) * (1 - k));
  }
  const k = (t - hop.peak) / (hop.land - hop.peak);
  return HOP_HEIGHT * (1 - k * k);
}

/** The squares of the chart behind `wall`: every square with a number in a covered column. */
export function blockedSquareRects(layout: ChartLayout, wall: DeepReadonly<Wall>): Rect[] {
  return chartSquares(layout)
    .filter(({ col }) => col >= wall.from && col <= wall.to)
    .map(({ row, col }) => cellRectAt(layout, CHART_RECT, row, col));
}

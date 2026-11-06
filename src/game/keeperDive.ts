/**
 * Where the goalkeeper goes on a shot (FR-020, FR-062 to FR-064), as plain data for KeeperView. No Phaser here, so the
 * rules have unit tests.
 *
 * The keeper is drawn around his hips at one fixed size, KEEPER_SCALE, for the whole shot (FR-062): about half as tall
 * as the goal mouth. A pose is the hips' position, the body's tilt (0 upright, positive leaning to the right) and the
 * arms from 0 (the ready stance, gloves out low) to 1 (both arms stretched over the head). With the arms stretched, the
 * gloves sit REACH units from the hips along the body.
 *
 * - Waiting: feet on the goal line (FR-063). He shuffles sideways to a spot where he covers neither the target square
 *   nor a hint square; when no such spot exists he waits in the middle, drawn half transparent (FR-064).
 * - Catch: on a wrong number the keeper jumps or dives so his gloves end on the middle of the ball's square.
 * - Beaten: on the correct number he dives toward the ball and his gloves end well short of it. When the ball's square
 *   is so close to him that any dive toward it would reach it, he guesses the other side and dives that way.
 * - Fallen: after a beaten dive he lands on the grass, lying on his side, before he gets up.
 */
import { center } from '../core/chart/layout';
import { GOAL_FRAME, POST_WIDTH } from '../core/match/world';
import { clamp } from '../core/util';
import type { Rect } from '../core/types';

export interface Point {
  x: number;
  y: number;
}

export interface KeeperPose {
  x: number;
  y: number;
  /** Tilt of the body in radians; positive leans to the right. */
  rotation: number;
  /** 0 the ready stance, 1 both arms over the head. */
  arms: number;
}

/** Hips to gloves with both arms over the head, in unscaled units (see KeeperView's drawing). */
export const REACH = 72;
/** Hips to the top of the head, in unscaled units. */
export const HEAD_ABOVE_HIPS = 69;
/** Hips to the soles, in unscaled units. */
export const FEET_BELOW_HIPS = 34;
/** Soles to the top of the head, in unscaled units. */
export const KEEPER_HEIGHT = HEAD_ABOVE_HIPS + FEET_BELOW_HIPS;

/** The goal line: the bottom edge of the goal frame, where the keeper's feet stand. */
export const GOAL_LINE = GOAL_FRAME.y + GOAL_FRAME.height;
/** The goal mouth's height, from the goal line to the underside of the crossbar. */
export const GOAL_MOUTH_HEIGHT = GOAL_FRAME.height - POST_WIDTH;

/**
 * The one drawing scale of the keeper: half the goal mouth's height (FR-062). A real keeper is about three quarters of
 * the goal's height, but at that size he would cover too many chart squares.
 */
export const KEEPER_SCALE = (GOAL_MOUTH_HEIGHT * 0.5) / KEEPER_HEIGHT;

/** The most the body tilts in a dive: a little past lying flat. */
export const MAX_TILT = 1.75;

/** The opacity of a waiting keeper who cannot stand clear of the target and hint squares (FR-064). */
export const FADED_ALPHA = 0.5;

/** The waiting keeper in the middle of the goal, feet on the goal line. */
export const HOME_POSE: KeeperPose = {
  x: GOAL_FRAME.x + GOAL_FRAME.width / 2,
  y: GOAL_LINE - FEET_BELOW_HIPS * KEEPER_SCALE,
  rotation: 0,
  arms: 0,
};

/**
 * The waiting keeper's outline in unscaled units around his hips, as two rectangles: the body from head to soles, and
 * the arms held out low in the ready stance with the gloves at their ends.
 */
const IDLE_OUTLINE: readonly Rect[] = [
  { x: -18, y: -HEAD_ABOVE_HIPS, width: 36, height: KEEPER_HEIGHT },
  { x: -58, y: -42, width: 116, height: 38 },
];

/** Space kept between the waiting keeper and a square he must not cover, in world pixels. */
const CLEARANCE = 4;
/** The waiting spots are tried this far apart, in world pixels. */
const SPOT_STEP = 4;

/** The rectangles the waiting keeper covers when his hips are at `x` on the goal line. */
export function idleBounds(x: number): Rect[] {
  return IDLE_OUTLINE.map((r) => ({
    x: x + r.x * KEEPER_SCALE,
    y: HOME_POSE.y + r.y * KEEPER_SCALE,
    width: r.width * KEEPER_SCALE,
    height: r.height * KEEPER_SCALE,
  }));
}

function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return a.x < b.x + b.width + margin && b.x < a.x + a.width + margin && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;
}

/** The farthest left and right the waiting keeper's hips go, so his gloves stay inside the posts. */
const SPOT_MIN_X = GOAL_FRAME.x + POST_WIDTH - IDLE_OUTLINE[1]!.x * KEEPER_SCALE;
const SPOT_MAX_X = GOAL_FRAME.x + GOAL_FRAME.width - POST_WIDTH - (IDLE_OUTLINE[1]!.x + IDLE_OUTLINE[1]!.width) * KEEPER_SCALE;

export interface WaitingSpot {
  pose: KeeperPose;
  /** True when he covers none of the squares; false when no spot is free and he is drawn faded. */
  clear: boolean;
}

/**
 * Where the keeper waits so that he covers none of `squares` (the target and hint squares, FR-064): the free spot on
 * the goal line nearest to the middle of the goal. When there is none, the middle, and `clear` is false.
 */
export function waitingSpot(squares: readonly Rect[]): WaitingSpot {
  const free = (x: number) => idleBounds(x).every((k) => squares.every((s) => !overlaps(k, s, CLEARANCE)));
  const mid = HOME_POSE.x;
  for (let d = 0; mid - d >= SPOT_MIN_X || mid + d <= SPOT_MAX_X; d += SPOT_STEP) {
    for (const x of d === 0 ? [mid] : [mid - d, mid + d]) {
      if (x >= SPOT_MIN_X && x <= SPOT_MAX_X && free(x)) return { pose: { ...HOME_POSE, x }, clear: true };
    }
  }
  return { pose: HOME_POSE, clear: false };
}

/** Where the gloves are in `pose` with both arms over the head. */
export function glovesOf(pose: KeeperPose): Point {
  const r = REACH * KEEPER_SCALE;
  return { x: pose.x + Math.sin(pose.rotation) * r, y: pose.y - Math.cos(pose.rotation) * r };
}

/** The leap pose whose gloves end on `glove`, the body leaning from home toward it. */
export function reachingFor(glove: Point, home: KeeperPose = HOME_POSE): KeeperPose {
  const dx = glove.x - home.x;
  const dy = glove.y - home.y;
  const rotation = clamp(Math.atan2(dx, -dy), -MAX_TILT, MAX_TILT);
  const r = REACH * KEEPER_SCALE;
  return { x: glove.x - Math.sin(rotation) * r, y: glove.y + Math.cos(rotation) * r, rotation, arms: 1 };
}

/** The end of the dive at the ball that flies to `square`: on the ball when the keeper catches it, short when beaten. */
export function diveEnd(square: Rect, outcome: 'catch' | 'beaten', home: KeeperPose = HOME_POSE): KeeperPose {
  const ball = center(square);
  if (outcome === 'catch') return reachingFor(ball, home);
  const dx = ball.x - home.x;
  const dy = ball.y - home.y;
  const dist = Math.hypot(dx, dy);
  const cell = Math.max(square.width, square.height);
  // He stops this far before the ball: at least a square and a bit, and more on a long dive.
  const short = Math.max(cell * 1.2, dist * 0.3);
  if (dist - short < cell) {
    // Too close to fall short toward it: he guesses the other side.
    const side = dx >= 0 ? -1 : 1;
    return reachingFor({ x: home.x + side * Math.max(cell * 1.8, 160), y: home.y - REACH * KEEPER_SCALE * 0.6 }, home);
  }
  const k = (dist - short) / dist;
  return reachingFor({ x: home.x + dx * k, y: home.y + dy * k }, home);
}

/** The keeper after a beaten dive: lying on the grass on the side he dived to, or back on his feet after a jump. */
export function fallenPose(dive: KeeperPose, home: KeeperPose = HOME_POSE): KeeperPose {
  if (Math.abs(dive.rotation) < 0.6) return { ...home, x: dive.x, arms: 1 };
  const side = Math.sign(dive.rotation);
  // Lying on his side on the grass inside the goal: his hips half a body's width above the goal line.
  return { x: dive.x + side * 24 * KEEPER_SCALE, y: GOAL_LINE - 18 * KEEPER_SCALE, rotation: side * 1.5, arms: 1 };
}

/** The pose `k` (0 to 1) of the way from `a` to `b`. */
export function mixPose(a: KeeperPose, b: KeeperPose, k: number): KeeperPose {
  const m = (u: number, v: number) => u + (v - u) * k;
  return { x: m(a.x, b.x), y: m(a.y, b.y), rotation: m(a.rotation, b.rotation), arms: m(a.arms, b.arms) };
}

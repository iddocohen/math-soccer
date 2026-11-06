/**
 * Where the goalkeeper goes on a shot (FR-020), as plain data for KeeperView. No Phaser here, so the rules have unit
 * tests.
 *
 * The keeper is drawn around his hips. A pose is the hips' position, the body's tilt (0 upright, positive leaning to
 * the right), the drawing scale, and the arms from 0 (the ready stance, gloves out low) to 1 (both arms stretched
 * over the head). With the arms stretched, the gloves sit REACH units from the hips along the body.
 *
 * - Home: in the middle of the goal, standing low just in front of the goal line, so the keeper stays below the
 *   chart's squares and never hides a hint number while he waits.
 * - Catch: on a wrong number the keeper jumps or dives so his gloves end on the middle of the ball's square.
 * - Beaten: on the correct number he dives toward the ball and his gloves end well short of it. When the ball's square
 *   is so close to him that any dive toward it would reach it, he guesses the other side and dives that way.
 * - Fallen: after a beaten dive he lands on the grass, lying on his side, before he gets up.
 */
import { center } from '../core/chart/layout';
import { CHART_RECT, GOAL_FRAME } from '../core/match/world';
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
  scale: number;
  /** 0 the ready stance, 1 both arms over the head. */
  arms: number;
}

/** Hips to gloves with both arms over the head, in unscaled units (see KeeperView's drawing). */
export const REACH = 72;
/** Hips to the top of the head, in unscaled units. */
export const HEAD_ABOVE_HIPS = 69;
/** Hips to the soles, in unscaled units. */
export const FEET_BELOW_HIPS = 34;

/** The keeper waits small and low; he grows while he leaps toward the ball, as if he came closer. */
export const IDLE_SCALE = 0.7;
export const DIVE_SCALE = 1.25;

/** The most the body tilts in a dive: a little past lying flat. */
export const MAX_TILT = 1.75;

const GOAL_LINE = GOAL_FRAME.y + GOAL_FRAME.height;
/** Space left between the chart's bottom edge and the top of the waiting keeper's head. */
const HEAD_GAP = 1;

/** The waiting keeper: in the middle of the goal, his head just below the chart's bottom row. */
export const HOME_POSE: KeeperPose = {
  x: GOAL_FRAME.x + GOAL_FRAME.width / 2,
  y: CHART_RECT.y + CHART_RECT.height + HEAD_GAP + HEAD_ABOVE_HIPS * IDLE_SCALE,
  rotation: 0,
  scale: IDLE_SCALE,
  arms: 0,
};

/** Where the gloves are in `pose` with both arms over the head. */
export function glovesOf(pose: KeeperPose): Point {
  const r = REACH * pose.scale;
  return { x: pose.x + Math.sin(pose.rotation) * r, y: pose.y - Math.cos(pose.rotation) * r };
}

/** The leap pose whose gloves end on `glove`, the body leaning from home toward it. */
export function reachingFor(glove: Point, home: KeeperPose = HOME_POSE): KeeperPose {
  const dx = glove.x - home.x;
  const dy = glove.y - home.y;
  const rotation = clamp(Math.atan2(dx, -dy), -MAX_TILT, MAX_TILT);
  const r = REACH * DIVE_SCALE;
  return { x: glove.x - Math.sin(rotation) * r, y: glove.y + Math.cos(rotation) * r, rotation, scale: DIVE_SCALE, arms: 1 };
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
    return reachingFor({ x: home.x + side * Math.max(cell * 1.8, 160), y: home.y - REACH * 0.6 }, home);
  }
  const k = (dist - short) / dist;
  return reachingFor({ x: home.x + dx * k, y: home.y + dy * k }, home);
}

/** The keeper after a beaten dive: lying on the grass on the side he dived to, or back on his feet after a jump. */
export function fallenPose(dive: KeeperPose, home: KeeperPose = HOME_POSE): KeeperPose {
  if (Math.abs(dive.rotation) < 0.6) return { ...home, x: dive.x, arms: 1 };
  const side = Math.sign(dive.rotation);
  // Lying on his side, his hips a little above the goal line.
  return { x: dive.x + side * 24, y: GOAL_LINE - 12, rotation: side * 1.5, scale: (IDLE_SCALE + DIVE_SCALE) / 2, arms: 1 };
}

/** The pose `k` (0 to 1) of the way from `a` to `b`. */
export function mixPose(a: KeeperPose, b: KeeperPose, k: number): KeeperPose {
  const m = (u: number, v: number) => u + (v - u) * k;
  return { x: m(a.x, b.x), y: m(a.y, b.y), rotation: m(a.rotation, b.rotation), scale: m(a.scale, b.scale), arms: m(a.arms, b.arms) };
}

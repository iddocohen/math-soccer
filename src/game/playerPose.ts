/**
 * Where the child's player stands and how large he is drawn (amendment 08, FR-082 to FR-084), as plain data for
 * PlayerView. No Phaser here, so the rules have unit tests.
 *
 * - He is seen from behind, closer to the viewer than the keeper: his whole figure is at least 1.3 times the keeper's
 *   drawn height, and the bottom edge of the screen cuts off his lower legs.
 * - He stands to the lower left of the ball, like a penalty taker before the run-up. His head stays below `CHART_RECT`,
 *   so he never covers a chart square (FR-056), and he stays left of the ball and of the help line, the typed number and
 *   the message (`OVERLAY_LEFT`).
 * - On the kick he takes one short step toward the ball and leans into it, then steps back (`KICK_STEP`, `KICK_LEAN`).
 * - After a won cup final he raises both arms and holds the cup from below above his head (`CUP_LIFT`, FR-110, FR-131).
 */
import { CHART_RECT, KICK_SPOT } from '../core/match/world';
import type { Rect } from '../core/types';
import { GOAL_MOUTH_HEIGHT } from './keeperDive';

/** The keeper's drawn height while he stands: half the goal mouth (amendment 04). */
export const KEEPER_DRAWN_HEIGHT = GOAL_MOUTH_HEIGHT * 0.5;

/** The figure as PlayerView draws it before scaling: feet at y 0, hair top at -BODY.height, x from -halfWidth to halfWidth. */
export const BODY = { height: 271, halfWidth: 60 } as const;

/** How much taller the player is drawn than the keeper (FR-082 asks for at least 1.3). */
export const PLAYER_TO_KEEPER = 1.32;

export const PLAYER_SCALE = (KEEPER_DRAWN_HEIGHT * PLAYER_TO_KEEPER) / BODY.height;

/** Half the width of the largest ball at the kick spot (`BALL_SIZE.soccer` in textures.ts, which needs Phaser). */
export const BALL_HALF_WIDTH = 20;

/** Free space between the chart's bottom edge and the top of the player's head. */
const HEAD_CLEARANCE = 6;
/** Free space between the player's right edge, at the end of his kick step, and the ball. */
const BALL_CLEARANCE = 14;

/** The kick: one step toward the ball and a slight lean into it, out and back in about 0.3 s (FR-084). */
export const KICK_STEP = 22;
export const KICK_LEAN = 0.04;
export const KICK_STEP_MS = 150;

/** The point the figure stands on: below the bottom edge of the world, so his lower legs are cut off. */
export const PLAYER_FEET = {
  x: KICK_SPOT.x - BALL_HALF_WIDTH - BALL_CLEARANCE - KICK_STEP - (BODY.halfWidth + BODY.height * KICK_LEAN) * PLAYER_SCALE,
  y: CHART_RECT.y + CHART_RECT.height + HEAD_CLEARANCE + BODY.height * PLAYER_SCALE,
} as const;

/**
 * The cup lift (FR-110, amendment 19 FR-131) in figure units, for the right arm; the left arm mirrors it. Both upper
 * arms go up and out from the shoulders, the forearms come in, and the hands hold the cup's base from below, above the
 * hair top (-BODY.height). The cup stands on the hands: `cupBottom` is the lower edge of its base, `cupHeight` its
 * height from the handles' bowl to the base, and `baseHalfWidth` half the base's width.
 */
export const CUP_LIFT = {
  shoulder: { x: 38, y: -186 },
  elbow: { x: 54, y: -250 },
  hand: { x: 30, y: -304 },
  cupBottom: -308,
  cupHeight: 90,
  baseHalfWidth: 30,
} as const;

export interface PlayerPose {
  /** Step toward the ball, in world pixels. */
  dx: number;
  /** Lean toward the ball, in radians around the feet. */
  lean: number;
}

export const STANDING: PlayerPose = { dx: 0, lean: 0 };
export const KICKING: PlayerPose = { dx: KICK_STEP, lean: KICK_LEAN };

/** The world rectangle around the drawn player in a pose (the corners of his figure, turned around his feet). */
export function playerBounds(pose: PlayerPose): Rect {
  const w = BODY.halfWidth * PLAYER_SCALE;
  const h = BODY.height * PLAYER_SCALE;
  const cos = Math.cos(pose.lean);
  const sin = Math.sin(pose.lean);
  const points: Array<[number, number]> = [
    [-w, 0],
    [w, 0],
    [-w, -h],
    [w, -h],
  ];
  const corners = points.map(([x, y]) => ({ x: PLAYER_FEET.x + pose.dx + x * cos - y * sin, y: PLAYER_FEET.y + x * sin + y * cos }));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

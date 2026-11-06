/**
 * The goal celebrations as pose keyframes (amendment 13, FR-113, FR-114), as plain data for PlayerView and the locker
 * room preview. No Phaser here, so the poses have unit tests.
 *
 * A pose places the figure and its two arms. Units are the figure's own units before scaling (src/game/playerPose.ts
 * BODY: feet at y 0, hair top at y -271), so the same pose works at any drawn size.
 *
 * - `x`, `y`: how far the figure moves from where he stands (y below 0 is up).
 * - `turn`: rotation in radians around the middle of the figure (a positive turn goes clockwise on screen).
 * - `left`, `right`: each arm as two angles from hanging straight down: `up` for the upper arm (0 hangs, PI/2 points
 *   out to the side, PI points up) and `bend` for the forearm, added to `up` (a positive bend folds it toward the head).
 * - `heart`: 0 to 1, the size of the red heart the hands form above the head ("Herz").
 *
 * `poseAt(celebration, t)` blends the keyframes for t from 0 (start) to 1 (end); the time challenge plays the same
 * keyframes in half the time. Every celebration starts and ends in the standing pose, so a skipped or finished
 * celebration returns him to it without a jump.
 */
import type { Celebration } from '../core/rewards/items';
import { BODY } from './playerPose';

export interface ArmPose {
  up: number;
  bend: number;
}

export interface CelebrationPose {
  x: number;
  y: number;
  turn: number;
  left: ArmPose;
  right: ArmPose;
  heart: number;
}

/** How long a celebration lasts (FR-114): about 1.2 s, and 0.6 s in the time challenge so it costs little time. */
export const CELEBRATION_MS = 1200;
export const TIME_CHALLENGE_CELEBRATION_MS = 600;

export function celebrationMs(timeChallenge: boolean): number {
  return timeChallenge ? TIME_CHALLENGE_CELEBRATION_MS : CELEBRATION_MS;
}

const HANG: ArmPose = { up: 0.12, bend: 0 };
const UP: ArmPose = { up: 2.7, bend: 0.15 };
const OUT: ArmPose = { up: Math.PI / 2, bend: 0 };

/** The standing pose: arms hanging, nothing moved. */
export const REST: CelebrationPose = { x: 0, y: 0, turn: 0, left: HANG, right: HANG, heart: 0 };

type Key = { t: number } & Partial<CelebrationPose>;

/** Each celebration's keyframes; fields left out keep the standing pose. The first key is at t 0 and the last at t 1. */
export const KEYFRAMES: Record<Celebration, readonly Key[]> = {
  // Both arms up in a V and two small jumps.
  armsUp: [
    { t: 0 },
    { t: 0.15, left: UP, right: UP },
    { t: 0.3, y: -40, left: UP, right: UP },
    { t: 0.45, left: UP, right: UP },
    { t: 0.6, y: -40, left: UP, right: UP },
    { t: 0.8, left: UP, right: UP },
    { t: 1 },
  ],
  // He drops onto his knees and slides toward the ball, leaning back with the arms spread wide.
  slide: [
    { t: 0 },
    { t: 0.2, x: 30, y: 30, turn: -0.12, left: OUT, right: OUT },
    { t: 0.65, x: 150, y: 50, turn: -0.22, left: { up: 2.2, bend: 0 }, right: { up: 2.2, bend: 0 } },
    { t: 0.85, x: 150, y: 40, turn: -0.1, left: { up: 2.2, bend: 0 }, right: { up: 2.2, bend: 0 } },
    { t: 1 },
  ],
  // Arms out like wings, running a curve and banking into it, then back.
  airplane: [
    { t: 0 },
    { t: 0.15, x: 40, y: -10, turn: 0.2, left: OUT, right: OUT },
    { t: 0.4, x: 140, y: -30, turn: 0.3, left: OUT, right: OUT },
    { t: 0.6, x: 120, y: -20, turn: -0.3, left: OUT, right: OUT },
    { t: 0.85, x: 30, y: -5, turn: -0.2, left: OUT, right: OUT },
    { t: 1 },
  ],
  // A crouch, a high jump with one full turn, and the landing with the arms up.
  backflip: [
    { t: 0 },
    { t: 0.15, y: 20, left: { up: 0.9, bend: 0.6 }, right: { up: 0.9, bend: 0.6 } },
    { t: 0.35, y: -150, turn: -Math.PI * 0.6, left: { up: 2.4, bend: 0.8 }, right: { up: 2.4, bend: 0.8 } },
    { t: 0.55, y: -160, turn: -Math.PI * 1.4, left: { up: 2.4, bend: 0.8 }, right: { up: 2.4, bend: 0.8 } },
    { t: 0.75, y: 0, turn: -Math.PI * 2, left: UP, right: UP },
    { t: 0.9, turn: -Math.PI * 2, left: UP, right: UP },
    { t: 1, turn: -Math.PI * 2 },
  ],
  // Hips sway left and right, one arm up and the other down in turn, with small hops.
  dance: [
    { t: 0 },
    { t: 0.17, x: -20, y: -15, turn: -0.15, left: UP, right: { up: 0.6, bend: 1.2 } },
    { t: 0.34, x: 20, y: 0, turn: 0.15, left: { up: 0.6, bend: 1.2 }, right: UP },
    { t: 0.5, x: -20, y: -15, turn: -0.15, left: UP, right: { up: 0.6, bend: 1.2 } },
    { t: 0.67, x: 20, y: 0, turn: 0.15, left: { up: 0.6, bend: 1.2 }, right: UP },
    { t: 0.84, x: 0, y: -15, left: UP, right: UP },
    { t: 1 },
  ],
  // Both hands above the head, the forearms folded in, and a red heart between them.
  heart: [
    { t: 0 },
    { t: 0.25, left: { up: 2.75, bend: 1.35 }, right: { up: 2.75, bend: 1.35 }, heart: 1 },
    { t: 0.45, y: -12, left: { up: 2.75, bend: 1.35 }, right: { up: 2.75, bend: 1.35 }, heart: 1.25 },
    { t: 0.65, left: { up: 2.75, bend: 1.35 }, right: { up: 2.75, bend: 1.35 }, heart: 1 },
    { t: 0.85, y: -12, left: { up: 2.75, bend: 1.35 }, right: { up: 2.75, bend: 1.35 }, heart: 1.25 },
    { t: 1 },
  ],
};

function full(key: Key): CelebrationPose {
  return {
    x: key.x ?? REST.x,
    y: key.y ?? REST.y,
    turn: key.turn ?? REST.turn,
    left: key.left ?? REST.left,
    right: key.right ?? REST.right,
    heart: key.heart ?? REST.heart,
  };
}

// The ends are exact, so a pose at a keyframe is that keyframe without rounding errors.
const mix = (a: number, b: number, k: number) => (k <= 0 ? a : k >= 1 ? b : a + (b - a) * k);
const mixArm = (a: ArmPose, b: ArmPose, k: number): ArmPose => ({ up: mix(a.up, b.up, k), bend: mix(a.bend, b.bend, k) });

/** The pose of `celebration` at `t` (0 to 1, clamped), eased between the two keyframes around it. */
export function poseAt(celebration: Celebration, t: number): CelebrationPose {
  const keys = KEYFRAMES[celebration];
  const at = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1));
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]!.t <= at) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const span = b.t - a.t;
  const raw = span > 0 ? Math.min(1, Math.max(0, (at - a.t) / span)) : 1;
  const k = raw * raw * (3 - 2 * raw);
  const p = full(a);
  const q = full(b);
  // A whole turn is the same as none: the end of the backflip is the standing pose.
  const turn = mix(p.turn, q.turn, k);
  return {
    x: mix(p.x, q.x, k),
    y: mix(p.y, q.y, k),
    turn: at >= 1 ? 0 : turn,
    left: mixArm(p.left, q.left, k),
    right: mixArm(p.right, q.right, k),
    heart: mix(p.heart, q.heart, k),
  };
}

/** Where the shoulders are, in figure units (just inside the shirt's top corners). */
export const SHOULDER = { x: 40, y: -186 } as const;
export const UPPER_ARM = 44;
export const FOREARM = 44;
/** The middle of the figure, which `turn` rotates around. */
export const TURN_CENTER_Y = -BODY.height / 2;

export interface ArmPoints {
  shoulder: { x: number; y: number };
  elbow: { x: number; y: number };
  hand: { x: number; y: number };
}

/** The shoulder, elbow and hand of one arm (side -1 left, 1 right) in figure units. */
export function armPoints(side: -1 | 1, arm: ArmPose): ArmPoints {
  const shoulder = { x: side * SHOULDER.x, y: SHOULDER.y };
  const dir = (angle: number) => ({ x: side * Math.sin(angle), y: Math.cos(angle) });
  const u = dir(arm.up);
  const elbow = { x: shoulder.x + u.x * UPPER_ARM, y: shoulder.y + u.y * UPPER_ARM };
  const f = dir(arm.up + arm.bend);
  return { shoulder, elbow, hand: { x: elbow.x + f.x * FOREARM, y: elbow.y + f.y * FOREARM } };
}

/** Where the heart of "Herz" sits: above the head, between the hands. */
export const HEART_CENTER = { x: 0, y: -BODY.height - 18 } as const;

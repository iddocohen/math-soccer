/** The classic ball's spin during a flight (amendment 03, FR-058); kept free of Phaser so it can be unit tested. */

import { clamp } from '../core/util';

/** Frames in the ball's rotation sprite (8 by 8). */
export const SPIN_FRAMES = 64;

/**
 * The sprite frame for a flight `progress` from 0 (kick) to 1 (arrival): one full turn through the 64 frames, so the
 * ball starts and ends on frame 0. Values outside 0 to 1 are clamped, and a value that is not a number gives frame 0.
 */
export function spinFrame(progress: number): number {
  const k = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
  return Math.floor(k * SPIN_FRAMES) % SPIN_FRAMES;
}

import { describe, expect, it } from 'vitest';
import { CHART_RECT, KICK_SPOT, OVERLAY_LEFT, WORLD_HEIGHT } from '../core/match/world';
import type { Rect } from '../core/types';
import { KEEPER_HEIGHT, KEEPER_SCALE } from './keeperDive';
import { BALL_HALF_WIDTH, BODY, KICKING, KICK_STEP_MS, KEEPER_DRAWN_HEIGHT, PLAYER_FEET, PLAYER_SCALE, playerBounds, STANDING } from './playerPose';

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

const ball: Rect = { x: KICK_SPOT.x - BALL_HALF_WIDTH, y: KICK_SPOT.y - BALL_HALF_WIDTH, width: 2 * BALL_HALF_WIDTH, height: 2 * BALL_HALF_WIDTH };

describe('the player (amendment 08)', () => {
  it('is drawn at least 1.3 times the keeper height (FR-082)', () => {
    expect(KEEPER_DRAWN_HEIGHT).toBeCloseTo(KEEPER_HEIGHT * KEEPER_SCALE, 6);
    expect(BODY.height * PLAYER_SCALE).toBeGreaterThanOrEqual(1.3 * KEEPER_DRAWN_HEIGHT);
  });

  it('has his feet below the bottom edge, so his lower legs are cut off (FR-082)', () => {
    expect(PLAYER_FEET.y).toBeGreaterThan(WORLD_HEIGHT);
  });

  for (const [name, pose] of [
    ['standing', STANDING],
    ['at the end of his kick step', KICKING],
  ] as const) {
    it(`never covers the chart when ${name} (FR-056, FR-083)`, () => {
      const r = playerBounds(pose);
      expect(overlaps(r, CHART_RECT)).toBe(false);
      expect(r.y).toBeGreaterThanOrEqual(CHART_RECT.y + CHART_RECT.height);
    });

    it(`stands to the lower left of the ball and clear of it when ${name} (FR-083)`, () => {
      const r = playerBounds(pose);
      expect(overlaps(r, ball)).toBe(false);
      expect(r.x + r.width).toBeLessThan(ball.x);
      expect(PLAYER_FEET.y).toBeGreaterThan(KICK_SPOT.y);
    });

    it(`stays left of the help line, the typed number and the message when ${name}`, () => {
      const r = playerBounds(pose);
      expect(r.x + r.width).toBeLessThan(OVERLAY_LEFT);
      expect(ball.x + ball.width).toBeLessThan(OVERLAY_LEFT);
    });
  }

  it('keeps the ball start point (FR-083)', () => {
    expect(KICK_SPOT).toEqual({ x: 860, y: 940 });
  });

  it('steps toward the ball on the kick, out and back in about 0.3 s (FR-084)', () => {
    expect(KICKING.dx).toBeGreaterThan(0);
    expect(KICKING.lean).toBeGreaterThan(0);
    expect(2 * KICK_STEP_MS).toBeGreaterThanOrEqual(250);
    expect(2 * KICK_STEP_MS).toBeLessThanOrEqual(350);
  });
});

/**
 * The flashing target square, its countdown ring and the opponent's rolling ball of "Selbst ins Tor" (amendment 21,
 * FR-143, FR-144).
 */
import { describe, expect, it, vi } from 'vitest';
import { cellRect, center, layoutChart } from '../core/chart/layout';
import { CHART_RECT, GOAL_FRAME, KICK_SPOT } from '../core/match/world';
import { rollPoint } from './BallView';
import { flashAlpha, ringRadius } from './ShotView';

vi.mock('phaser', () => ({ default: {} }));

describe('the target square of the opponent\'s shot', () => {
  it('flashes between light and strong, never invisible', () => {
    const samples = Array.from({ length: 50 }, (_, i) => flashAlpha(i * 37));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.4);
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.9);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.3);
  });

  it('the countdown ring lies just outside the square', () => {
    const rect = cellRect(layoutChart(1, 100), CHART_RECT, 45);
    expect(ringRadius(rect)).toBeGreaterThan(Math.hypot(rect.width, rect.height) / 2);
  });
});

describe('the opponent\'s ball rolls toward the square (FR-144)', () => {
  it('starts at the kick spot and never rolls past the goal line, so it covers no square', () => {
    const layout = layoutChart(1, 100);
    for (const n of [1, 10, 45, 91, 100]) {
      const to = center(cellRect(layout, CHART_RECT, n));
      expect(rollPoint(to, 0)).toMatchObject({ x: KICK_SPOT.x, y: KICK_SPOT.y, scale: 1 });
      for (const k of [0.25, 0.5, 1]) {
        const p = rollPoint(to, k);
        expect(p.y).toBeGreaterThan(GOAL_FRAME.y + GOAL_FRAME.height);
        expect(p.y).toBeLessThan(KICK_SPOT.y);
      }
      // It heads for the square's side.
      expect(Math.sign(rollPoint(to, 1).x - KICK_SPOT.x)).toBe(Math.sign(to.x - KICK_SPOT.x));
    }
  });
});

import { describe, expect, it } from 'vitest';
import { cellRect, layoutChart } from '../core/chart/layout';
import { CHART_RECT, GOAL_FRAME } from '../core/match/world';
import { diveEnd, fallenPose, glovesOf, HEAD_ABOVE_HIPS, HOME_POSE, MAX_TILT, mixPose } from './keeperDive';

const chart = layoutChart(1, 100);
const square = (n: number) => cellRect(chart, CHART_RECT, n);
const middle = (n: number) => {
  const r = square(n);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the waiting keeper (FR-019)', () => {
  it('stands in the middle of the goal, his head below the chart, so no hint number is hidden', () => {
    expect(HOME_POSE.x).toBe(GOAL_FRAME.x + GOAL_FRAME.width / 2);
    expect(HOME_POSE.y - HEAD_ABOVE_HIPS * HOME_POSE.scale).toBeGreaterThanOrEqual(CHART_RECT.y + CHART_RECT.height);
    expect(HOME_POSE.rotation).toBe(0);
  });
});

describe('diveEnd (FR-020)', () => {
  it('on a wrong number the gloves end on the ball in every square of 1 to 100', () => {
    for (let n = 1; n <= 100; n++) {
      const end = diveEnd(square(n), 'catch');
      expect(distance(glovesOf(end), middle(n))).toBeLessThan(0.001);
      expect(Math.abs(end.rotation)).toBeLessThanOrEqual(MAX_TILT);
    }
  });

  it('on the correct number the gloves end more than a square away from the ball, in every square of 1 to 100', () => {
    for (let n = 1; n <= 100; n++) {
      const end = diveEnd(square(n), 'beaten');
      expect(distance(glovesOf(end), middle(n))).toBeGreaterThan(square(n).width);
    }
  });

  it('dives toward a far ball: the body leans to the side of the ball', () => {
    expect(diveEnd(square(1), 'beaten').rotation).toBeLessThan(-0.3);
    expect(diveEnd(square(10), 'beaten').rotation).toBeGreaterThan(0.3);
    expect(diveEnd(square(1), 'catch').rotation).toBeLessThan(-0.3);
  });

  it('jumps straight up for a high ball in the middle', () => {
    expect(Math.abs(diveEnd(square(5), 'catch').rotation)).toBeLessThan(0.3);
  });

  it('keeps the gloves on the ball for small squares of a large chart too', () => {
    const big = layoutChart(200, 500);
    for (const n of [200, 205, 350, 499, 500]) {
      const r = cellRect(big, CHART_RECT, n);
      expect(distance(glovesOf(diveEnd(r, 'catch')), { x: r.x + r.width / 2, y: r.y + r.height / 2 })).toBeLessThan(0.001);
    }
  });
});

describe('fallenPose and mixPose', () => {
  it('a sideways dive ends lying on the grass on the same side', () => {
    const dive = diveEnd(square(10), 'beaten');
    const fallen = fallenPose(dive);
    expect(fallen.rotation).toBeGreaterThan(1);
    expect(fallen.y).toBeGreaterThan(CHART_RECT.y + CHART_RECT.height);
  });

  it('mixes two poses', () => {
    const a = HOME_POSE;
    const b = { x: 0, y: 0, rotation: 1, scale: 1, arms: 1 };
    expect(mixPose(a, b, 0)).toEqual(a);
    expect(mixPose(a, b, 1)).toEqual(b);
    expect(mixPose(a, b, 0.5).arms).toBe(0.5);
  });
});

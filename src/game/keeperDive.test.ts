import { describe, expect, it } from 'vitest';
import { cellRect, layoutChart } from '../core/chart/layout';
import { CHART_RECT, GOAL_FRAME, POST_WIDTH } from '../core/match/world';
import type { Rect } from '../core/types';
import {
  diveEnd,
  fallenPose,
  FEET_BELOW_HIPS,
  glovesOf,
  GOAL_LINE,
  GOAL_MOUTH_HEIGHT,
  HOME_POSE,
  idleBounds,
  KEEPER_HEIGHT,
  KEEPER_SCALE,
  MAX_TILT,
  mixPose,
  squaresToKeepClear,
  waitingSpot,
} from './keeperDive';

const chart = layoutChart(1, 100);
const square = (n: number) => cellRect(chart, CHART_RECT, n);
const middle = (n: number) => {
  const r = square(n);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the keeper has one size (FR-062, FR-063)', () => {
  it('is between 45% and 55% of the goal mouth height', () => {
    expect(GOAL_MOUTH_HEIGHT).toBe(GOAL_FRAME.height - POST_WIDTH);
    const ratio = (KEEPER_HEIGHT * KEEPER_SCALE) / GOAL_MOUTH_HEIGHT;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });

  it('no pose carries a scale: waiting, diving, catching, fallen and in between', () => {
    const poses = [HOME_POSE, diveEnd(square(1), 'catch'), diveEnd(square(10), 'beaten'), fallenPose(diveEnd(square(10), 'beaten'))];
    poses.push(mixPose(poses[0]!, poses[1]!, 0.5));
    for (const pose of poses) expect(Object.keys(pose).sort()).toEqual(['arms', 'rotation', 'x', 'y']);
  });

  it('waits with his feet on the goal line in the middle of the goal', () => {
    expect(HOME_POSE.x).toBe(GOAL_FRAME.x + GOAL_FRAME.width / 2);
    expect(HOME_POSE.y + FEET_BELOW_HIPS * KEEPER_SCALE).toBeCloseTo(GOAL_LINE, 6);
    expect(HOME_POSE.rotation).toBe(0);
  });
});

describe('waitingSpot (FR-064)', () => {
  it('stays in the middle when nothing is near him', () => {
    const spot = waitingSpot([square(5), square(4), square(6), square(15)]);
    expect(spot).toEqual({ pose: HOME_POSE, clear: true });
  });

  it('never covers the target or a hint square when a free spot exists, for every target with its four neighbors', () => {
    for (let n = 1; n <= 100; n++) {
      const squares = [n, n - 1, n + 1, n - 10, n + 10].filter((m) => m >= 1 && m <= 100).map(square);
      const spot = waitingSpot(squares);
      expect(spot.clear).toBe(true);
      for (const k of idleBounds(spot.pose.x)) for (const s of squares) expect(overlap(k, s)).toBe(false);
      // Feet on the goal line, gloves inside the posts.
      expect(spot.pose.y).toBe(HOME_POSE.y);
      for (const k of idleBounds(spot.pose.x)) {
        expect(k.x).toBeGreaterThanOrEqual(GOAL_FRAME.x + POST_WIDTH);
        expect(k.x + k.width).toBeLessThanOrEqual(GOAL_FRAME.x + GOAL_FRAME.width - POST_WIDTH);
      }
    }
  });

  it('moves aside for a target in the bottom row in the middle', () => {
    const spot = waitingSpot([square(95), square(94), square(96), square(85)]);
    expect(spot.clear).toBe(true);
    expect(spot.pose.x).not.toBe(HOME_POSE.x);
  });

  it('waits in the middle and reports no free spot when the squares fill the bottom row', () => {
    const spot = waitingSpot([91, 92, 93, 94, 95, 96, 97, 98, 99, 100].map(square));
    expect(spot).toEqual({ pose: HOME_POSE, clear: false });
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

  it('dives from his waiting spot: the gloves still end on a caught ball and short of a goal', () => {
    const home = waitingSpot([square(95), square(94), square(96), square(85)]).pose;
    for (const n of [1, 10, 55, 95, 100]) {
      expect(distance(glovesOf(diveEnd(square(n), 'catch', home)), middle(n))).toBeLessThan(0.001);
      expect(distance(glovesOf(diveEnd(square(n), 'beaten', home)), middle(n))).toBeGreaterThan(square(n).width);
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
  it('a sideways dive ends lying on the grass on the same side, inside the goal', () => {
    const dive = diveEnd(square(10), 'beaten');
    const fallen = fallenPose(dive);
    expect(fallen.rotation).toBeGreaterThan(1);
    // Hips half a body's width above the goal line: he lies on the grass, not in the air.
    expect(GOAL_LINE - fallen.y).toBeCloseTo(18 * KEEPER_SCALE, 6);
  });

  it('mixes two poses', () => {
    const a = HOME_POSE;
    const b = { x: 0, y: 0, rotation: 1, arms: 1 };
    expect(mixPose(a, b, 0)).toEqual(a);
    expect(mixPose(a, b, 1)).toEqual(b);
    expect(mixPose(a, b, 0.5).arms).toBe(0.5);
  });
});

describe('the waiting keeper keeps the shape squares clear (FR-064, amendment 06)', () => {
  it('lists the target, the hints and the waiting empty squares of a shape', () => {
    const target = {
      number: 45,
      hints: [44, 35],
      directions: [],
      level: 4 as const,
      pattern: 'shape' as const,
      queue: [{ number: 46, directions: [] }],
    };
    expect(squaresToKeepClear(target)).toEqual([45, 44, 35, 46]);
  });

  it('lists only the target and hints when nothing waits', () => {
    expect(squaresToKeepClear({ number: 12, hints: [11], directions: [], level: 1, pattern: 'shape' as const })).toEqual([12, 11]);
  });
});

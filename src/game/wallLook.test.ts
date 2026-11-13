/**
 * The wall's look (amendment 21, FR-142, parent feedback "the wall looks a bit strange"): the jump on every shot, the
 * shade on only the blocked squares, and defenders that stand apart and clear of the child's player.
 */
import { describe, expect, it } from 'vitest';
import { cellOf, cellRect, layoutChart } from '../core/chart/layout';
import { PLAYER_COLUMNS, wallBlocks, type Wall } from '../core/match/wall';
import { CHART_RECT, WORLD_WIDTH } from '../core/match/world';
import {
  blockedSquareRects,
  DEFENDER_GAP,
  DEFENDER_PITCH,
  defenderSpots,
  HOP_DOWN_MS,
  HOP_HEIGHT,
  HOP_UP_MS,
  hopOffset,
  PLAYER_SPAN,
  wallHop,
} from './wallLook';

const FLIGHT = 800;

describe('wallHop and hopOffset', () => {
  it('a ball the wall stops reaches it at the top of the jump, at the end of the flight', () => {
    const hop = wallHop(FLIGHT, true);
    expect(hop.peak).toBe(FLIGHT);
    expect(hop.delay).toBe(FLIGHT - HOP_UP_MS);
    expect(hop.land).toBe(FLIGHT + HOP_DOWN_MS);
    expect(hopOffset(hop.peak, hop)).toBeCloseTo(HOP_HEIGHT);
  });

  it('a ball that flies past the wall passes at the top of the jump, before it reaches the goal', () => {
    const hop = wallHop(FLIGHT, false);
    expect(hop.peak).toBeLessThan(FLIGHT);
    expect(hop.peak).toBeGreaterThan(0);
    expect(hop.land - hop.peak).toBe(HOP_DOWN_MS);
    expect(hopOffset(hop.peak, hop)).toBeCloseTo(HOP_HEIGHT);
  });

  it('the defenders stand on the grass before the jump and after they land, and rise then fall in between', () => {
    for (const blocked of [true, false]) {
      const hop = wallHop(FLIGHT, blocked);
      expect(hopOffset(0, hop)).toBe(0);
      expect(hopOffset(hop.delay, hop)).toBe(0);
      expect(hopOffset(hop.land, hop)).toBe(0);
      expect(hopOffset(hop.land + 500, hop)).toBe(0);
      const rising = hopOffset(hop.delay + HOP_UP_MS / 2, hop);
      const falling = hopOffset(hop.peak + HOP_DOWN_MS / 2, hop);
      expect(rising).toBeGreaterThan(0);
      expect(rising).toBeLessThan(HOP_HEIGHT);
      expect(falling).toBeGreaterThan(0);
      expect(falling).toBeLessThan(HOP_HEIGHT);
    }
  });
});

describe('blockedSquareRects', () => {
  const key = (r: { x: number; y: number }) => `${Math.round(r.x)},${Math.round(r.y)}`;

  for (const [min, max] of [
    [1, 100],
    [0, 20],
    [1, 45],
  ] as const) {
    it(`shades exactly the squares a shot hits the wall at, chart ${min} to ${max}`, () => {
      const layout = layoutChart(min, max);
      const wall: Wall = { from: 5, to: 7, defenders: 4 };
      const shaded = new Set(blockedSquareRects(layout, wall).map(key));
      const blocked = new Set<string>();
      for (let n = min; n <= max; n++) if (wallBlocks(layout, wall, n)) blocked.add(key(cellRect(layout, CHART_RECT, n)));
      expect(shaded).toEqual(blocked);
      // One rectangle per square, none above the chart's top row: no band up to the crossbar.
      expect(blockedSquareRects(layout, wall)).toHaveLength(blocked.size);
      for (const r of blockedSquareRects(layout, wall)) expect(r.y).toBeGreaterThanOrEqual(CHART_RECT.y);
    });
  }

  it('leaves the target and hint columns unshaded', () => {
    const layout = layoutChart(1, 100);
    const wall: Wall = { from: 0, to: 2, defenders: 3 };
    for (const n of [45, 44, 46, 35, 55]) {
      const r = key(cellRect(layout, CHART_RECT, n));
      expect(cellOf(layout, n).col).toBeGreaterThan(2);
      expect(blockedSquareRects(layout, wall).map(key)).not.toContain(r);
    }
  });
});

describe('defenderSpots', () => {
  const walls: Wall[] = [];
  for (let defenders = 3; defenders <= 5; defenders++) {
    for (let width = 1; width <= defenders - 1; width++) {
      for (let from = 0; from + width - 1 <= 9; from++) walls.push({ from, to: from + width - 1, defenders });
    }
  }

  it('one spot per defender, a full pitch apart, so they stand with a gap between them', () => {
    expect(DEFENDER_GAP).toBeGreaterThan(0);
    for (const wall of walls) {
      const xs = defenderSpots(wall);
      expect(xs).toHaveLength(wall.defenders);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(DEFENDER_PITCH);
    }
  });

  it('stays inside the world', () => {
    for (const wall of walls) {
      const xs = defenderSpots(wall);
      expect(xs[0]! - DEFENDER_PITCH / 2).toBeGreaterThanOrEqual(0);
      expect(xs[xs.length - 1]! + DEFENDER_PITCH / 2).toBeLessThanOrEqual(WORLD_WIDTH);
    }
  });

  it('a wall beside the child player stands clear of him', () => {
    for (const wall of walls) {
      if (PLAYER_COLUMNS.some((c) => c >= wall.from && c <= wall.to)) continue;
      const xs = defenderSpots(wall);
      const left = xs[0]! - DEFENDER_PITCH / 2;
      const right = xs[xs.length - 1]! + DEFENDER_PITCH / 2;
      expect(right <= PLAYER_SPAN.left || left >= PLAYER_SPAN.right).toBe(true);
    }
  });
});

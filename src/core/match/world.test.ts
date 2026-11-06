import { describe, expect, it } from 'vitest';
import { cellRect, layoutChart } from '../chart/layout';
import type { Rect } from '../types';
import { CHART_RECT, GOAL_FRAME, KICK_SPOT, POST_WIDTH } from './world';

const EPS = 1e-6;

function inside(r: Rect, outer: Rect): boolean {
  return r.x >= outer.x - EPS && r.y >= outer.y - EPS && r.x + r.width <= outer.x + outer.width + EPS && r.y + r.height <= outer.y + outer.height + EPS;
}

describe('goal frame and chart area (amendment 02)', () => {
  it('matches the amendment layout', () => {
    expect(GOAL_FRAME).toEqual({ x: 260, y: 200, width: 1080, height: 600 });
    expect(POST_WIDTH).toBe(22);
    expect(CHART_RECT).toEqual({ x: 340, y: 265, width: 920, height: 485 });
  });

  it('places the chart inside the goal mouth with at least 6% of the goal width as margin at the sides and the top (FR-054)', () => {
    const mouth: Rect = { x: GOAL_FRAME.x + POST_WIDTH, y: GOAL_FRAME.y + POST_WIDTH, width: GOAL_FRAME.width - 2 * POST_WIDTH, height: GOAL_FRAME.height - POST_WIDTH };
    expect(inside(CHART_RECT, mouth)).toBe(true);
    const side = 0.06 * GOAL_FRAME.width;
    expect(CHART_RECT.x - GOAL_FRAME.x).toBeGreaterThanOrEqual(side);
    expect(GOAL_FRAME.x + GOAL_FRAME.width - (CHART_RECT.x + CHART_RECT.width)).toBeGreaterThanOrEqual(side);
    expect(CHART_RECT.y - GOAL_FRAME.y).toBeGreaterThanOrEqual(side);
    // The net also shows below the panel, above the goal line.
    expect(CHART_RECT.y + CHART_RECT.height).toBeLessThan(GOAL_FRAME.y + GOAL_FRAME.height);
  });

  it('puts every chart square inside CHART_RECT', () => {
    for (const [min, max] of [[1, 100], [0, 1000], [205, 480], [0, 9], [1, 20], [37, 912]] as Array<[number, number]>) {
      const layout = layoutChart(min, max);
      for (let n = min; n <= max; n++) expect(inside(cellRect(layout, CHART_RECT, n), CHART_RECT)).toBe(true);
    }
  });

  it('keeps the kick spot below the goal line, clear of the chart (FR-056)', () => {
    expect(KICK_SPOT.y - 60).toBeGreaterThan(GOAL_FRAME.y + GOAL_FRAME.height);
  });
});

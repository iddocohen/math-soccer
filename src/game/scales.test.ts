/** Where the row and column helper sits (T096, amendment 10, FR-091 to FR-095). */
import { describe, expect, it } from 'vitest';
import { cellRect, layoutChart } from '../core/chart/layout';
import { CHART_RECT, GOAL_FRAME } from '../core/match/world';
import type { Rect, Target } from '../core/types';
import { buildScales, COLUMN_STRIP, ROW_STRIP, scalesKey } from './scales';

const target: Target = { number: 46, hints: [36], directions: ['down'], level: 1, pattern: 'neighbors' };
const layout = layoutChart(1, 100);
const cell = cellRect(layout, CHART_RECT, 46);

describe('buildScales', () => {
  it('shows no scale, strip or arrow without help (amendment 14, FR-115)', () => {
    expect(buildScales(layout, CHART_RECT, target, 0, true)).toMatchObject({
      rowLabels: [],
      columnLabels: [],
      rowArrow: null,
      columnArrow: null,
      rowBacking: null,
      columnBacking: null,
    });
  });

  it('shows the row scale from step 1, the column scale from step 2, and none once the target is scored (FR-115)', () => {
    const one = buildScales(layout, CHART_RECT, target, 1, true);
    expect(one.rowLabels).toHaveLength(10);
    expect(one.columnLabels).toEqual([]);
    expect(one.columnBacking).toBeNull();
    for (const step of [2, 3, 4]) {
      const s = buildScales(layout, CHART_RECT, target, step, true);
      expect(s.rowLabels).toHaveLength(10);
      expect(s.columnLabels).toHaveLength(10);
    }
    for (const step of [1, 2, 4]) {
      expect(buildScales(layout, CHART_RECT, target, step, true, true)).toMatchObject({ rowLabels: [], columnLabels: [], rowArrow: null, columnArrow: null });
    }
  });

  it('puts a row label at the height of each row, right of the right post, and 1 to 10 above the crossbar', () => {
    const s = buildScales(layout, CHART_RECT, target, 2, true);
    expect(s.rowLabels.map((l) => l.text)).toEqual(['0', '10', '20', '30', '40', '50', '60', '70', '80', '90']);
    expect(s.rowLabels.every((l) => l.x > GOAL_FRAME.x + GOAL_FRAME.width)).toBe(true);
    expect(s.rowLabels[4]!.y).toBeCloseTo(cell.y + cell.height / 2);
    expect(s.columnLabels.map((l) => l.text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(s.columnLabels.every((l) => l.y < GOAL_FRAME.y)).toBe(true);
    expect(s.columnLabels[5]!.x).toBeCloseTo(cell.x + cell.width / 2);
  });

  it('points an arrow from the row scale at the target row from step 1, and from the column scale from step 2', () => {
    const one = buildScales(layout, CHART_RECT, target, 1, true);
    expect(one.rowArrow!.from.y).toBeCloseTo(cell.y + cell.height / 2);
    expect(one.rowArrow!.to.x).toBeLessThan(one.rowArrow!.from.x);
    expect(one.rowArrow!.to.x).toBeGreaterThanOrEqual(CHART_RECT.x + CHART_RECT.width);
    expect(one.columnArrow).toBeNull();
    expect(one.rowLabels.filter((l) => l.lit).map((l) => l.text)).toEqual(['40']);
    const two = buildScales(layout, CHART_RECT, target, 2, true);
    expect(two.columnArrow!.from.x).toBeCloseTo(cell.x + cell.width / 2);
    expect(two.columnArrow!.to.y).toBeGreaterThan(two.columnArrow!.from.y);
    expect(two.columnArrow!.to.y).toBeLessThanOrEqual(CHART_RECT.y);
    expect(two.columnLabels.filter((l) => l.lit).map((l) => l.text)).toEqual(['6']);
  });

  it('with the helper off shows only the lit labels and still the arrows (FR-095)', () => {
    const s = buildScales(layout, CHART_RECT, target, 2, false);
    expect(s.rowLabels.map((l) => l.text)).toEqual(['40']);
    expect(s.columnLabels.map((l) => l.text)).toEqual(['6']);
    expect(s.rowArrow).not.toBeNull();
    expect(s.columnArrow).not.toBeNull();
    expect(buildScales(layout, CHART_RECT, target, 0, false)).toMatchObject({ rowLabels: [], columnLabels: [] });
  });

  it('on 0 to 1000 shows every fifth row label, the lit one, and hides the shown neighbors it would overlap', () => {
    const big = layoutChart(0, 1000);
    const s = buildScales(big, CHART_RECT, { ...target, number: 463 }, 1, true);
    const texts = s.rowLabels.map((l) => l.text);
    expect(texts).toContain('460');
    expect(texts).toContain('0');
    expect(texts).toContain('1000');
    expect(texts).not.toContain('470');
    for (const l of s.rowLabels.filter((r) => !r.lit)) {
      expect(Math.abs(l.y - s.rowLabels.find((r) => r.lit)!.y)).toBeGreaterThanOrEqual(s.rowFontSize);
    }
    expect(s.rowFontSize).toBeGreaterThanOrEqual(14);
  });

  it('puts each scale on one dark strip that holds all its labels and fits its texture (FR-101a)', () => {
    const inside = (r: Rect, outer: Rect) => r.x >= outer.x && r.y >= outer.y && r.x + r.width <= outer.x + outer.width && r.y + r.height <= outer.y + outer.height;
    for (const [chart, n] of [
      [layout, 46],
      [layoutChart(0, 1000), 463],
      [layoutChart(0, 9), 4],
    ] as const) {
      for (const step of [2, 3, 4]) {
        const s = buildScales(chart, CHART_RECT, { ...target, number: n }, step, true);
        const row = s.rowBacking!;
        const column = s.columnBacking!;
        expect(inside(row, ROW_STRIP)).toBe(true);
        expect(inside(column, COLUMN_STRIP)).toBe(true);
        for (const l of s.rowLabels) expect(l.x > row.x && l.x < row.x + row.width && l.y > row.y && l.y < row.y + row.height).toBe(true);
        for (const l of s.columnLabels) expect(l.x > column.x && l.x < column.x + column.width && l.y > column.y && l.y < column.y + column.height).toBe(true);
        // The strips stay out of the chart.
        expect(row.x).toBeGreaterThanOrEqual(CHART_RECT.x + CHART_RECT.width);
        expect(column.y + column.height).toBeLessThanOrEqual(CHART_RECT.y);
      }
    }
  });

  it('shows no strip for a scale without labels, and a short one around a single lit label', () => {
    expect(buildScales(layout, CHART_RECT, target, 0, false)).toMatchObject({ rowBacking: null, columnBacking: null });
    const s = buildScales(layout, CHART_RECT, target, 2, false);
    expect(s.columnBacking!.width).toBeLessThan(CHART_RECT.width / 5);
    expect(s.rowBacking!.height).toBeLessThan(CHART_RECT.height / 5);
  });

  it('the key changes with the lit row and column and the switch, not with the help step past 2', () => {
    const key = (step: number, on = true) => scalesKey(layout, target, step, on);
    expect(key(0)).not.toBe(key(1));
    expect(key(1)).not.toBe(key(2));
    expect(key(2)).toBe(key(3));
    expect(key(2)).not.toBe(key(2, false));
    // Scoring the target takes the scales away (FR-115).
    expect(scalesKey(layout, target, 2, true, true)).not.toBe(key(2));
  });
});

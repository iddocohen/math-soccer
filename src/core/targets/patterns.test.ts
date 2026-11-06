import { describe, expect, it } from 'vitest';
import { cellOf, layoutChart } from '../chart/layout';
import { DIRECTIONS, HINT_DISTANCES } from '../types';
import { placeAt, placements, ROW_GIVEN, type PatternChoice } from './patterns';
import { MOVE } from './hints';

const chart = layoutChart(1, 100);

describe('hint patterns from the amendment table, target 46 (FR-065)', () => {
  it('Nachbarn: the four direct neighbors', () => {
    expect(placeAt(chart, { pattern: 'neighbors', distance: 'direct' }, 46)).toEqual({
      number: 46,
      hints: [45, 47, 36, 56],
      directions: ['right', 'left', 'down', 'up'],
    });
  });

  it('Mitte: the target is the middle across, down and diagonal', () => {
    expect(placeAt(chart, { pattern: 'middle', direction: 'right' }, 46)?.hints).toEqual([45, 47]);
    expect(placeAt(chart, { pattern: 'middle', direction: 'down' }, 46)?.hints).toEqual([36, 56]);
    expect(placeAt(chart, { pattern: 'middle', direction: 'downRight' }, 46)?.hints).toEqual([35, 57]);
    expect(placeAt(chart, { pattern: 'middle', direction: 'right' }, 46)?.directions).toEqual(['right', 'left']);
    expect(placeAt(chart, { pattern: 'middle', direction: 'downLeft' }, 46)?.directions).toEqual(['downLeft', 'upRight']);
  });

  it('Reihe: the target continues the row of two or three squares', () => {
    expect(placeAt(chart, { pattern: 'row', direction: 'down', given: 3 }, 46)).toEqual({ number: 46, hints: [16, 26, 36], directions: ['down'] });
    expect(placeAt(chart, { pattern: 'row', direction: 'downRight', given: 3 }, 46)?.hints).toEqual([13, 24, 35]);
    expect(placeAt(chart, { pattern: 'row', direction: 'down', given: 2 }, 46)?.hints).toEqual([26, 36]);
    // Backward: the row runs up to the target.
    expect(placeAt(chart, { pattern: 'row', direction: 'up', given: 3 }, 46)).toEqual({ number: 46, hints: [76, 66, 56], directions: ['up'] });
    expect(placeAt(chart, { pattern: 'row', direction: 'left', given: 2 }, 46)?.directions).toEqual(['left']);
  });
});

describe('placements stay on the chart (FR-065)', () => {
  const choices: PatternChoice[] = [
    ...HINT_DISTANCES.map((distance) => ({ pattern: 'neighbors' as const, distance })),
    ...DIRECTIONS.map((direction) => ({ pattern: 'middle' as const, direction })),
    ...DIRECTIONS.flatMap((direction) => ROW_GIVEN.map((given) => ({ pattern: 'row' as const, direction, given }))),
  ];

  for (const layout of [chart, layoutChart(0, 1000), layoutChart(5, 23), layoutChart(40, 49)]) {
    it(`every hint and target lies in ${layout.min} to ${layout.max}, without wrapping a row edge`, () => {
      for (const choice of choices) {
        for (const p of placements(layout, choice)) {
          expect(p.number).toBeGreaterThanOrEqual(layout.min);
          expect(p.number).toBeLessThanOrEqual(layout.max);
          for (const h of p.hints) {
            expect(h).toBeGreaterThanOrEqual(layout.min);
            expect(h).toBeLessThanOrEqual(layout.max);
            expect(h).not.toBe(p.number);
          }
          if (choice.pattern === 'middle' || choice.pattern === 'row') {
            // Every hint is a whole number of steps along the direction, in row and column space.
            const t = cellOf(layout, p.number);
            const [dRow, dCol] = MOVE[choice.direction];
            for (const h of p.hints) {
              const c = cellOf(layout, h);
              const k = dRow !== 0 ? (c.row - t.row) / dRow : (c.col - t.col) / dCol;
              expect(c.row - t.row === dRow * k && c.col - t.col === dCol * k).toBe(true);
            }
          }
        }
      }
    });
  }

  it('places the target where the pattern says: the middle of a Mitte, the end of a Reihe', () => {
    for (const direction of DIRECTIONS) {
      for (const p of placements(chart, { pattern: 'middle', direction })) {
        expect(p.hints[0]! + p.hints[1]!).toBe(2 * p.number);
      }
      for (const given of ROW_GIVEN) {
        for (const p of placements(chart, { pattern: 'row', direction, given })) {
          expect(p.hints).toHaveLength(given);
          const step = p.number - p.hints[p.hints.length - 1]!;
          p.hints.forEach((h, i) => expect(p.number - h).toBe(step * (given - i)));
          expect(p.directions).toEqual([direction]);
        }
      }
    }
  });

  it('has no Mitte or Reihe down on a chart of one row, and no diagonal row on its edges', () => {
    // 40 to 49 lies on two rows of the chart: 40 ends the row of 31 to 40, 41 to 49 start the next.
    const oneRow = layoutChart(40, 49);
    expect(placements(oneRow, { pattern: 'middle', direction: 'down' })).toEqual([]);
    expect(placements(oneRow, { pattern: 'row', direction: 'down', given: 2 })).toEqual([]);
    expect(placements(oneRow, { pattern: 'middle', direction: 'right' }).map((p) => p.number)).toEqual([42, 43, 44, 45, 46, 47, 48]);
    expect(placements(chart, { pattern: 'row', direction: 'downRight', given: 3 }).every((p) => p.number % 10 >= 4 || p.number % 10 === 0)).toBe(true);
  });

  it('a Nachbarn target with direct neighbors keeps at least two hints; with a direction, every placement trains it', () => {
    for (const p of placements(chart, { pattern: 'neighbors', distance: 'direct' })) expect(p.hints.length).toBeGreaterThanOrEqual(2);
    for (const p of placements(chart, { pattern: 'neighbors', distance: 'direct' }, 'up')) expect(p.directions).toContain('up');
  });
});

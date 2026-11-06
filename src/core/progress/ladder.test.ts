import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { nextTarget, NO_PROGRESS } from '../targets/nextTarget';
import { placeAt, type PatternChoice } from '../targets/patterns';
import { DIRECTIONS, type Direction } from '../types';
import { adaptiveChoice, choicesForStep, MAX_STEP, randomChoice, STEP_COUNT, stepChoices, stepOfChoice } from './ladder';

const chart = layoutChart(1, 100);
const settings = (extra: Partial<Settings> = {}): Settings => ({ ...defaultSettings(), ...extra });
const onlyPatterns = (...on: Array<keyof Settings['patterns']>): Settings['patterns'] => ({
  neighbors: on.includes('neighbors'),
  middle: on.includes('middle'),
  row: on.includes('row'),
  shape: on.includes('shape'),
});
const onlyDirections = (...on: Direction[]): Settings['directions'] =>
  Object.fromEntries(DIRECTIONS.map((d) => [d, on.includes(d)])) as Settings['directions'];
const atStep = (step: number) => ({ mastered: [] as Direction[], steps: Object.fromEntries(DIRECTIONS.map((d) => [d, step])) });
const label = (c: PatternChoice) => (c.pattern === 'neighbors' ? `neighbors ${c.distance}` : `${c.pattern} ${c.direction}`);

describe('the ladder order of FR-067', () => {
  it('has eight steps, from Nachbarn to hints on request', () => {
    expect(STEP_COUNT).toBe(8);
    expect(MAX_STEP).toBe(7);
  });

  it('offers the patterns of each step for the directions they train', () => {
    const s = settings();
    const at = (step: number, d: Direction) => [...new Set(stepChoices(step, d, s).map(label))];
    expect(at(0, 'right')).toEqual(['neighbors direct']);
    expect(at(0, 'down')).toEqual(['neighbors direct', 'neighbors vertical']);
    expect(at(0, 'downRight')).toEqual(['neighbors diagonal']);
    expect(at(1, 'right')).toEqual(['middle right']);
    expect(at(1, 'down')).toEqual([]);
    expect(at(2, 'down')).toEqual(['middle down']);
    expect(at(3, 'down')).toEqual(['row down']);
    expect(at(4, 'downLeft')).toEqual(['middle downLeft', 'row downLeft']);
    expect(at(5, 'right')).toEqual([]);
    expect(at(6, 'up')).toEqual(['neighbors far']);
    expect(at(7, 'up')).toEqual(['neighbors far']);
  });

  it('falls back to the next lower step: Formen (step 5) gives Reihe for down, Mitte or Reihe for a diagonal', () => {
    const s = settings();
    expect(choicesForStep(5, 'down', s).map(label)).toEqual(['row down', 'row down']);
    expect([...new Set(choicesForStep(5, 'downRight', s).map(label))]).toEqual(['middle downRight', 'row downRight']);
    // A diagonal has no Nachbarn two squares away: step 6 falls back to step 4 too.
    expect([...new Set(choicesForStep(6, 'downRight', s).map(label))]).toEqual(['middle downRight', 'row downRight']);
  });

  it('stays within the parent choices: no Mitte when Mitte is off, no Nachbarn distance that is off', () => {
    const s = settings({ patterns: onlyPatterns('neighbors', 'row'), hintDistance: { direct: true, vertical: false, diagonal: true, far: false } });
    for (let step = 0; step <= MAX_STEP; step++) {
      for (const d of DIRECTIONS) {
        for (const c of choicesForStep(step, d, s)) {
          expect(c.pattern).not.toBe('middle');
          if (c.pattern === 'neighbors') expect(['direct', 'diagonal']).toContain(c.distance);
        }
      }
    }
  });

  it('records the lowest step that offers a choice', () => {
    const s = settings();
    expect(stepOfChoice({ pattern: 'middle', direction: 'down' }, 'down', s)).toBe(2);
    expect(stepOfChoice({ pattern: 'neighbors', distance: 'far' }, 'right', s)).toBe(6);
    expect(stepOfChoice({ pattern: 'row', direction: 'upRight', given: 2 }, 'upRight', s)).toBe(4);
  });
});

describe('adaptiveChoice (FR-067)', () => {
  it('picks only allowed directions and the patterns of their step', () => {
    const s = settings({ directions: onlyDirections('down') });
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      expect(adaptiveChoice(chart, s, atStep(2), rng)).toMatchObject({ direction: 'down', choice: { pattern: 'middle', direction: 'down' }, step: 2 });
      expect(adaptiveChoice(chart, s, atStep(3), rng).choice.pattern).toBe('row');
    }
  });

  it('weights unmastered directions twice', () => {
    const s = settings({ directions: onlyDirections('right', 'down') });
    const rng = createRng(2024);
    const counts: Record<string, number> = { right: 0, down: 0 };
    for (let i = 0; i < 20_000; i++) counts[adaptiveChoice(chart, s, { mastered: ['right'], steps: {} }, rng).direction]!++;
    const ratio = counts.down! / counts.right!;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  it('falls back to a lower step when the chart cannot place the step pattern: Reihe down on a chart of two rows', () => {
    const twoRows = layoutChart(1, 20);
    const s = settings({ directions: onlyDirections('down') });
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) expect(adaptiveChoice(twoRows, s, atStep(3), rng).choice.pattern).toBe('neighbors');
  });

  it('uses across with direct neighbors when no allowed direction fits the chart', () => {
    const oneRow = layoutChart(1, 10);
    const s = settings({ directions: onlyDirections('down'), patterns: onlyPatterns('middle') });
    expect(adaptiveChoice(oneRow, s, NO_PROGRESS, createRng(1))).toEqual({ direction: 'right', choice: { pattern: 'neighbors', distance: 'direct' }, step: 0 });
  });
});

describe('randomChoice with adaptive off (FR-067)', () => {
  it('draws each allowed pattern with about equal weight, whatever the step', () => {
    const s = settings({ adaptive: false, patterns: onlyPatterns('neighbors', 'middle', 'row') });
    const rng = createRng(77);
    const counts: Record<string, number> = { neighbors: 0, middle: 0, row: 0 };
    const runs = 30_000;
    for (let i = 0; i < runs; i++) counts[randomChoice(chart, s, rng).choice.pattern]!++;
    for (const n of Object.values(counts)) expect(Math.abs(n / runs - 1 / 3)).toBeLessThan(0.02);
  });

  it('draws the directions a pattern can train with about equal weight', () => {
    const s = settings({ adaptive: false, patterns: onlyPatterns('row'), directions: onlyDirections('right', 'down', 'downRight', 'downLeft') });
    const rng = createRng(5);
    const counts: Record<string, number> = {};
    const runs = 20_000;
    for (let i = 0; i < runs; i++) {
      const d = randomChoice(chart, s, rng).direction;
      counts[d] = (counts[d] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['down', 'downLeft', 'downRight', 'right']);
    for (const n of Object.values(counts)) expect(Math.abs(n / runs - 1 / 4)).toBeLessThan(0.02);
  });

  it('turns "Formen" into Reihe until shapes exist', () => {
    const s = settings({ adaptive: false, patterns: onlyPatterns('shape') });
    const rng = createRng(9);
    for (let i = 0; i < 50; i++) expect(randomChoice(chart, s, rng).choice.pattern).toBe('row');
  });
});

describe('goalkeeper targets from the ladder (FR-065, FR-067)', () => {
  it('every target fits its pattern on the chart, trains the picked direction and records its pattern', () => {
    const rng = createRng(13);
    for (const adaptive of [true, false]) {
      for (let step = 0; step <= MAX_STEP; step++) {
        for (let i = 0; i < 30; i++) {
          const t = nextTarget({ layout: chart, mode: 'keeper', settings: settings({ adaptive }), progress: atStep(step), rng });
          expect(['neighbors', 'middle', 'row']).toContain(t.pattern);
          for (const n of [t.number, ...t.hints]) {
            expect(n).toBeGreaterThanOrEqual(1);
            expect(n).toBeLessThanOrEqual(100);
          }
          expect(t.directions.length).toBeGreaterThan(0);
          expect(t.patchedHoles).toEqual([]);
        }
      }
    }
  });

  it('a Mitte target has the target in the middle; a Reihe target continues the row', () => {
    const rng = createRng(21);
    const middleOnly = settings({ adaptive: false, patterns: onlyPatterns('middle') });
    const rowOnly = settings({ adaptive: false, patterns: onlyPatterns('row') });
    for (let i = 0; i < 100; i++) {
      const m = nextTarget({ layout: chart, mode: 'keeper', settings: middleOnly, progress: NO_PROGRESS, rng });
      expect(m.hints).toHaveLength(2);
      expect(m.hints[0]! + m.hints[1]!).toBe(2 * m.number);
      const r = nextTarget({ layout: chart, mode: 'keeper', settings: rowOnly, progress: NO_PROGRESS, rng });
      const step = r.number - r.hints[r.hints.length - 1]!;
      r.hints.forEach((h, k) => expect(r.number - h).toBe(step * (r.hints.length - k)));
      expect(r.directions).toHaveLength(1);
    }
  });

  it('the same seed gives the same target, and a placement equals placeAt for its choice', () => {
    const make = () => nextTarget({ layout: chart, mode: 'keeper', settings: settings(), progress: atStep(3), rng: createRng(42) });
    expect(make()).toEqual(make());
    const p = placeAt(chart, { pattern: 'row', direction: 'down', given: 3 }, 46)!;
    expect(p.hints).toEqual([16, 26, 36]);
  });
});

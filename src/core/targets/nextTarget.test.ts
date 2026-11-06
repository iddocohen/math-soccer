import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { DIRECTIONS, type HintDistance } from '../types';
import { hintsFor } from './hints';
import { NO_PROGRESS, nextTarget, pickDirection, UNMASTERED_WEIGHT } from './nextTarget';

const chart = layoutChart(1, 100);

function only(distance: HintDistance, base: Settings = defaultSettings()): Settings {
  return { ...base, hintDistance: { direct: false, vertical: false, diagonal: false, far: false, [distance]: true } };
}

describe('nextTarget', () => {
  it('keeps targets and hints on the chart of a partial range (205 to 480)', () => {
    const partial = layoutChart(205, 480);
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const t = nextTarget({ layout: partial, settings: defaultSettings(), progress: NO_PROGRESS, rng });
      for (const n of [t.number, ...t.hints]) {
        expect(n).toBeGreaterThanOrEqual(205);
        expect(n).toBeLessThanOrEqual(480);
      }
      expect(t.hints).not.toContain(t.number);
      expect(t.directions.length).toBeGreaterThan(0);
    }
  });

  it('gives the same target for the same seed', () => {
    const make = () => nextTarget({ layout: chart, settings: defaultSettings(), progress: NO_PROGRESS, rng: createRng(42) });
    expect(make()).toEqual(make());
  });

  it('does not repeat the previous target number', () => {
    const rng = createRng(9);
    let previous: number | undefined;
    for (let i = 0; i < 200; i++) {
      const t = nextTarget({ layout: chart, settings: defaultSettings(), progress: NO_PROGRESS, rng, avoid: previous });
      expect(t.number).not.toBe(previous);
      previous = t.number;
    }
  });

  it('gives targets on a chart of one row, training only across', () => {
    const oneRow = layoutChart(1, 10);
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const t = nextTarget({ layout: oneRow, settings: defaultSettings(), progress: NO_PROGRESS, rng });
      expect(t.hints.length).toBeGreaterThanOrEqual(1);
      expect(t.directions.every((d) => d === 'right' || d === 'left')).toBe(true);
    }
  });

  it('never goes beyond the parent settings: steps 2 and 6 with only Nachbarn and direct hints allowed still give direct hints', () => {
    const rng = createRng(8);
    const settings: Settings = { ...only('direct'), patterns: { neighbors: true, middle: false, row: false, shape: false } };
    for (const step of [2, 6]) {
      const steps = Object.fromEntries(DIRECTIONS.map((d) => [d, step]));
      for (let i = 0; i < 50; i++) {
        const t = nextTarget({ layout: chart, settings, progress: { mastered: [], steps }, rng });
        expect(t.hints).toEqual(hintsFor(chart, t.number, 'direct'));
        expect(t.pattern).toBe('neighbors');
      }
    }
  });
});

describe('pickDirection', () => {
  it('picks unmastered directions about twice as often as mastered ones', () => {
    const rng = createRng(2024);
    const counts: Record<string, number> = { down: 0, right: 0 };
    const runs = 30_000;
    for (let i = 0; i < runs; i++) counts[pickDirection(['down', 'right'], ['right'], rng)]!++;
    const ratio = counts.down! / counts.right!;
    expect(ratio).toBeGreaterThan(UNMASTERED_WEIGHT * 0.9);
    expect(ratio).toBeLessThan(UNMASTERED_WEIGHT * 1.1);
  });
});

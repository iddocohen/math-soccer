import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { DIRECTIONS, type Direction, type HintDistance } from '../types';
import { hintsFor } from './hints';
import { NO_PROGRESS, nextTarget, pickDirection, UNMASTERED_WEIGHT } from './nextTarget';

const chart = layoutChart(1, 100);

function only(distance: HintDistance, base: Settings = defaultSettings()): Settings {
  return { ...base, hintDistance: { direct: false, vertical: false, diagonal: false, far: false, [distance]: true } };
}

describe('nextTarget', () => {
  it('always gives hole targets at least one hint, and two for direct', () => {
    for (const distance of ['direct', 'vertical', 'diagonal', 'far'] as const) {
      const rng = createRng(11);
      for (let i = 0; i < 300; i++) {
        const t = nextTarget({ layout: chart, mode: 'holes', settings: only(distance), progress: NO_PROGRESS, rng });
        expect(t.hints.length).toBeGreaterThanOrEqual(distance === 'direct' ? 2 : 1);
        expect(t.hints).toEqual(hintsFor(chart, t.number, distance));
        expect(t.directions.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps targets, hints and patched holes on the chart of a partial range (205 to 480)', () => {
    const partial = layoutChart(205, 480);
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const t = nextTarget({ layout: partial, mode: 'holes', settings: defaultSettings(), progress: NO_PROGRESS, rng });
      for (const n of [t.number, ...t.hints, ...t.patchedHoles]) {
        expect(n).toBeGreaterThanOrEqual(205);
        expect(n).toBeLessThanOrEqual(480);
      }
      expect(t.patchedHoles).not.toContain(t.number);
      for (const h of t.hints) expect(t.patchedHoles).not.toContain(h);
    }
  });

  it('gives the same target for the same seed', () => {
    const make = () => nextTarget({ layout: chart, mode: 'holes', settings: defaultSettings(), progress: NO_PROGRESS, rng: createRng(42) });
    expect(make()).toEqual(make());
  });

  it('gives patched holes in hole mode only', () => {
    const rng = createRng(5);
    let patched = 0;
    for (let i = 0; i < 50; i++) {
      patched += nextTarget({ layout: chart, mode: 'holes', settings: defaultSettings(), progress: NO_PROGRESS, rng }).patchedHoles.length;
      expect(nextTarget({ layout: chart, mode: 'keeper', settings: defaultSettings(), progress: NO_PROGRESS, rng }).patchedHoles).toEqual([]);
    }
    expect(patched).toBeGreaterThan(0);
  });

  it('does not repeat the previous target number', () => {
    const rng = createRng(9);
    let previous: number | undefined;
    for (let i = 0; i < 200; i++) {
      const t = nextTarget({ layout: chart, mode: 'holes', settings: defaultSettings(), progress: NO_PROGRESS, rng, avoid: previous });
      expect(t.number).not.toBe(previous);
      previous = t.number;
    }
  });

  it('falls back to across on a chart of one row, even when only vertical hints are allowed', () => {
    const oneRow = layoutChart(1, 10);
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const t = nextTarget({ layout: oneRow, mode: 'holes', settings: only('vertical'), progress: NO_PROGRESS, rng });
      expect(t.hints.length).toBeGreaterThanOrEqual(2);
      expect(t.directions.every((d) => d === 'right' || d === 'left')).toBe(true);
    }
  });

  it('follows the adaptive step: step 0 gives direct hints, step 2 gives far hints, within the allowed distances', () => {
    const rng = createRng(4);
    const atStep = (step: number): Partial<Record<Direction, number>> => Object.fromEntries(DIRECTIONS.map((d) => [d, step]));
    // Without diagonal hints every trained direction is one that direct hints also train.
    const settings: Settings = { ...defaultSettings(), hintDistance: { direct: true, vertical: true, diagonal: false, far: true } };
    for (let i = 0; i < 50; i++) {
      const easy = nextTarget({ layout: chart, mode: 'holes', settings, progress: { mastered: [], steps: atStep(0) }, rng });
      expect(easy.difficultyStep).toBe(0);
      expect(easy.hints).toEqual(hintsFor(chart, easy.number, 'direct'));
      const far = nextTarget({ layout: chart, mode: 'holes', settings, progress: { mastered: [], steps: atStep(2) }, rng });
      expect(far.hints).toEqual(hintsFor(chart, far.number, 'far'));
    }
  });

  it('never goes beyond the parent settings: steps 2 and 6 with only Nachbarn and direct hints allowed still give direct hints', () => {
    const rng = createRng(8);
    const settings: Settings = { ...only('direct'), patterns: { neighbors: true, middle: false, row: false, shape: false } };
    for (const step of [2, 6]) {
      const steps = Object.fromEntries(DIRECTIONS.map((d) => [d, step]));
      for (let i = 0; i < 50; i++) {
        const t = nextTarget({ layout: chart, mode: 'keeper', settings, progress: { mastered: [], steps }, rng });
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

  it('shows the weighting in nextTarget too: an unmastered direction among mastered ones is trained about twice as often', () => {
    // With vertical hints only, the trained direction is down or up; a target at the top or bottom row trains only one.
    const rng = createRng(77);
    let downOnly = 0;
    let upOnly = 0;
    for (let i = 0; i < 20_000; i++) {
      const t = nextTarget({ layout: chart, mode: 'holes', settings: only('vertical'), progress: { mastered: ['up'], steps: {} }, rng });
      if (t.directions.length === 1 && t.directions[0] === 'down') downOnly++;
      if (t.directions.length === 1 && t.directions[0] === 'up') upOnly++;
    }
    // Targets in the bottom row train only down, those in the top row only up; each is 1 of 9 numbers a direction offers.
    const ratio = downOnly / upOnly;
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.5);
  });
});

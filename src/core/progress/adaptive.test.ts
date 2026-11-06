// Adapted from math-tank src/core/progress/adaptive.test.ts and mastery.test.ts, with `skill` renamed to `direction`.
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { emptyProgress, type AttemptRecord, type DirectionState, type Outcome, type Progress } from '../storage/schemas';
import type { Direction } from '../types';
import { directionKey, emptyDirectionState, MAX_ATTEMPTS, recordAttempt, rowToRaise, targetProgress } from './adaptive';
import { stepDown, stepUp, topStep } from './ladder';
import { isMastered } from './mastery';

type Kind = 'independent' | 'assisted' | 'unsolved' | 'guess';

function attempt(kind: Kind, directions: Direction[] = ['down'], extra: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    at: '2026-11-06T12:00:00.000Z',
    mode: 'holes',
    min: 1,
    max: 100,
    target: 46,
    directions,
    hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
    hintDisplay: 'always',
    difficultyStep: 0,
    solved: kind !== 'unsolved',
    helpStep: kind === 'unsolved' ? 3 : kind === 'assisted' ? 1 : 0,
    misses: 0,
    responseMs: kind === 'guess' ? 800 : 4000,
    guess: kind === 'guess',
    ...extra,
  };
}

function settings(extra: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...extra };
}

function play(p: Progress, kinds: Kind[], s: Settings, directions: Direction[] = ['down']): Progress {
  return kinds.reduce((acc, k) => recordAttempt(acc, attempt(k, directions), s), p);
}

function ds(p: Progress, direction: Direction = 'down'): DirectionState {
  const found = p.directions[directionKey('holes', direction)];
  if (!found) throw new Error(`no progress for ${direction}`);
  return found;
}

const I: Outcome = 'independent';
const A: Outcome = 'assisted';
const U: Outcome = 'unsolved';

describe('ladder (FR-040): 0 direct, 1 vertical or diagonal, 2 far, 3 on request, clamped to the settings', () => {
  it('climbs 0, 1, 2 for down with hints always, and to 3 only with "auf Wunsch"', () => {
    const s = settings();
    expect([stepUp('down', 0, s), stepUp('down', 1, s), stepUp('down', 2, s)]).toEqual([1, 2, 2]);
    expect(topStep('down', s)).toBe(2);
    const onRequest = settings({ hintDisplay: 'onRequest' });
    expect(stepUp('down', 2, onRequest)).toBe(3);
    expect(topStep('down', onRequest)).toBe(3);
  });

  it('skips steps the parent turned off: without vertical and diagonal, down goes from 0 to 2', () => {
    const s = settings({ hintDistance: { direct: true, vertical: false, diagonal: false, far: true } });
    expect(stepUp('down', 0, s)).toBe(2);
    // As math-tank: down to the nearest step that looks different; step 1 falls back to direct hints like step 0.
    expect(stepDown('down', 2, s)).toBe(1);
    expect(stepUp('down', 1, s)).toBe(2);
  });

  it('never rises with only direct hints allowed', () => {
    const s = settings({ hintDistance: { direct: true, vertical: false, diagonal: false, far: false } });
    expect(topStep('right', s)).toBe(0);
    expect(stepUp('right', 0, s)).toBe(0);
  });
});

describe('recordAttempt (FR-037, FR-040)', () => {
  it('starts at step 0 and rises one step after 3 independent targets in a row', () => {
    const s = settings();
    const p = play(emptyProgress(), ['independent', 'independent'], s);
    expect(ds(p).step).toBe(0);
    expect(rowToRaise(ds(p), 'down', s)).toBe(1);
    const raised = play(p, ['independent'], s);
    expect(ds(raised).step).toBe(1);
    expect(ds(raised).recent).toEqual([]);
  });

  it('goes down one step when 2 of the last 3 needed help', () => {
    const s = settings();
    const start = play(emptyProgress(), ['independent', 'independent', 'independent'], s);
    expect(ds(start).step).toBe(1);
    const lowered = play(start, ['assisted', 'independent', 'unsolved'], s);
    expect(ds(lowered).step).toBe(0);
  });

  it('counts guesses without letting them into the row or the windows', () => {
    const s = settings();
    const p = play(emptyProgress(), ['independent', 'independent', 'guess', 'guess'], s);
    expect(ds(p)).toMatchObject({ attempts: 4, guesses: 2, independent: 2, step: 0, recent: [I, I] });
  });

  it('keeps the step with adaptive difficulty off', () => {
    const s = settings({ adaptive: false });
    const p = play(emptyProgress(), ['independent', 'independent', 'independent', 'independent'], s);
    expect(ds(p).step).toBe(0);
    expect(rowToRaise(ds(p), 'down', s)).toBeNull();
  });

  it('updates each direction of the attempt, by mode', () => {
    const p = play(emptyProgress(), ['assisted'], settings(), ['down', 'right']);
    expect(ds(p, 'down')).toMatchObject({ attempts: 1, assisted: 1 });
    expect(ds(p, 'right')).toMatchObject({ attempts: 1, assisted: 1 });
    expect(p.directions[directionKey('keeper', 'down')]).toBeUndefined();
  });

  it(`keeps only the newest ${MAX_ATTEMPTS} attempts, while the counters keep the totals`, () => {
    const s = settings({ adaptive: false });
    let p = emptyProgress();
    for (let i = 0; i < MAX_ATTEMPTS + 5; i++) p = recordAttempt(p, attempt('assisted', ['down'], { target: i }), s);
    expect(p.attempts).toHaveLength(MAX_ATTEMPTS);
    expect(p.attempts[0]!.target).toBe(5);
    expect(ds(p).attempts).toBe(MAX_ATTEMPTS + 5);
  });
});

describe('isMastered (FR-039): 10 independent attempts and 8 of the last 10 independent', () => {
  const state = (extra: Partial<DirectionState>): DirectionState => ({ ...emptyDirectionState(), ...extra });

  it('is mastered with 10 independent and 8 of a full window of 10', () => {
    expect(isMastered(state({ independent: 10, masteryWindow: [A, U, I, I, I, I, I, I, I, I] }))).toBe(true);
  });

  it('is not mastered with 9 independent, a short window or 7 of 10', () => {
    expect(isMastered(state({ independent: 9, masteryWindow: Array<Outcome>(10).fill(I) }))).toBe(false);
    expect(isMastered(state({ independent: 12, masteryWindow: Array<Outcome>(9).fill(I) }))).toBe(false);
    expect(isMastered(state({ independent: 12, masteryWindow: [A, A, U, I, I, I, I, I, I, I] }))).toBe(false);
  });
});

describe('targetProgress', () => {
  it('lists mastered directions and clamps steps to what the settings allow now', () => {
    const p = emptyProgress();
    p.directions[directionKey('holes', 'down')] = { ...emptyDirectionState(), step: 3, independent: 10, masteryWindow: Array<Outcome>(10).fill(I) };
    p.directions[directionKey('holes', 'right')] = { ...emptyDirectionState(), step: 1 };
    const tp = targetProgress(p, 'holes', settings());
    expect(tp.mastered).toEqual(['down']);
    expect(tp.steps).toEqual({ right: 1, down: 2 });
    expect(targetProgress(p, 'keeper', settings())).toEqual({ mastered: [], steps: {} });
  });
});

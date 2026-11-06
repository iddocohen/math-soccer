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
    mode: 'keeper',
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
  const found = p.directions[directionKey('keeper', direction)];
  if (!found) throw new Error(`no progress for ${direction}`);
  return found;
}

const I: Outcome = 'independent';
const A: Outcome = 'assisted';
const U: Outcome = 'unsolved';

describe('ladder steps per direction (FR-067), clamped to the settings', () => {
  it('right climbs Nachbarn 0, Mitte across 1, Reihe 3, Nachbarn two away 6, and 7 only with "auf Wunsch"', () => {
    const s = settings();
    expect([stepUp('right', 0, s), stepUp('right', 1, s), stepUp('right', 3, s)]).toEqual([1, 3, 6]);
    expect(topStep('right', s)).toBe(6);
    const onRequest = settings({ hintDisplay: 'onRequest' });
    expect(stepUp('right', 6, onRequest)).toBe(7);
    expect(topStep('right', onRequest)).toBe(7);
  });

  it('down skips Mitte across: Nachbarn 0, Mitte down 2, Reihe down 3', () => {
    const s = settings();
    expect([stepUp('down', 0, s), stepUp('down', 2, s)]).toEqual([2, 3]);
    // As math-tank: down to the nearest step that looks different; step 1 falls back to Nachbarn like step 0.
    expect(stepDown('down', 2, s)).toBe(1);
  });

  it('a diagonal goes from its Nachbarn straight to Mitte or Reihe diagonal', () => {
    expect(stepUp('downRight', 0, settings())).toBe(4);
  });

  it('skips patterns the parent turned off: without Mitte, right goes from 0 to Reihe at 3', () => {
    const s = settings({ patterns: { neighbors: true, middle: false, row: true, shape: true } });
    expect(stepUp('right', 0, s)).toBe(3);
  });

  it('never rises with only Nachbarn and only direct hints allowed', () => {
    const s = settings({
      patterns: { neighbors: true, middle: false, row: false, shape: false },
      hintDistance: { direct: true, vertical: false, diagonal: false, far: false },
    });
    expect(topStep('right', s)).toBe(0);
    expect(stepUp('right', 0, s)).toBe(0);
  });
});

describe('recordAttempt (FR-037, FR-040)', () => {
  it('starts at step 0 and rises one step after 3 independent targets in a row', () => {
    const s = settings();
    const p = play(emptyProgress(), ['independent', 'independent'], s, ['right']);
    expect(ds(p, 'right').step).toBe(0);
    expect(rowToRaise(ds(p, 'right'), 'right', s)).toBe(1);
    const raised = play(p, ['independent'], s, ['right']);
    expect(ds(raised, 'right').step).toBe(1);
    expect(ds(raised, 'right').recent).toEqual([]);
  });

  it('goes down one step when 2 of the last 3 needed help', () => {
    const s = settings();
    const start = play(emptyProgress(), ['independent', 'independent', 'independent'], s, ['right']);
    expect(ds(start, 'right').step).toBe(1);
    const lowered = play(start, ['assisted', 'independent', 'unsolved'], s, ['right']);
    expect(ds(lowered, 'right').step).toBe(0);
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
    expect(p.directions[directionKey('holes', 'down')]).toBeUndefined();
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
    p.directions[directionKey('keeper', 'down')] = { ...emptyDirectionState(), step: 7, independent: 10, masteryWindow: Array<Outcome>(10).fill(I) };
    p.directions[directionKey('keeper', 'right')] = { ...emptyDirectionState(), step: 1 };
    const tp = targetProgress(p, settings());
    expect(tp.mastered).toEqual(['down']);
    // With hints always shown, step 7 looks like step 6 (Nachbarn two squares away), so down is clamped to 6.
    expect(tp.steps).toEqual({ right: 1, down: 6 });
  });

  it('does not read the progress of the removed hole and line modes (amendment 05)', () => {
    const p = emptyProgress();
    p.directions[directionKey('holes', 'down')] = { ...emptyDirectionState(), step: 7, independent: 10, masteryWindow: Array<Outcome>(10).fill(I) };
    p.directions[directionKey('lines', 'right')] = { ...emptyDirectionState(), step: 3 };
    expect(targetProgress(p, settings())).toEqual({ mastered: [], steps: {} });
  });
});

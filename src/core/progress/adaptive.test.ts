// Adapted from math-tank src/core/progress/adaptive.test.ts and mastery.test.ts, with `skill` renamed to `direction` and
// one difficulty level for the child (amendment 09).
import { describe, expect, it } from 'vitest';
import { defaultSettings, type Level } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { emptyProgress, type AttemptRecord, type DirectionState, type Outcome, type Progress } from '../storage/schemas';
import type { Direction } from '../types';
import { directionKey, emptyDirectionState, levelRaised, MAX_ATTEMPTS, recordAttempt, rowToRaise, targetProgress } from './adaptive';
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
    level: 1,
    solved: kind !== 'unsolved',
    helpStep: kind === 'unsolved' ? 4 : kind === 'assisted' ? 1 : 0,
    misses: 0,
    responseMs: kind === 'guess' ? 800 : 4000,
    guess: kind === 'guess',
    ...extra,
  };
}

function settings(extra: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...extra };
}

function range(start: Level, hardest: Level, extra: Partial<Settings> = {}): Settings {
  return settings({ levels: { start, hardest }, ...extra });
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
const THREE: Kind[] = ['independent', 'independent', 'independent'];

describe('recordAttempt: the difficulty level (FR-087)', () => {
  it('starts at the start level and rises one level after 3 targets in a row solved alone', () => {
    const s = settings();
    const p = play(emptyProgress(), ['independent', 'independent'], s);
    expect(p.level).toBe(1);
    expect(rowToRaise(p, s)).toBe(1);
    const raised = play(p, ['independent'], s);
    expect(raised.level).toBe(2);
    expect(raised.levelRecent).toEqual([]);
    expect(levelRaised(p, raised, s)).toBe(2);
  });

  it('goes down one level when 2 of the last 3 needed help, and a level going down is not a level up', () => {
    const s = settings();
    const start = play(emptyProgress(), [...THREE, ...THREE], s);
    expect(start.level).toBe(3);
    const lowered = play(start, ['assisted', 'independent'], s);
    expect(lowered.level).toBe(3);
    const down = play(lowered, ['unsolved'], s);
    expect(down.level).toBe(2);
    expect(levelRaised(lowered, down, s)).toBeNull();
  });

  it('stays within the parent range: never below the start level, never above the hardest level', () => {
    const s = range(2, 3);
    const p = play(emptyProgress(), ['assisted', 'assisted', 'assisted'], s);
    expect(p.level).toBe(2);
    const top = play(p, [...THREE, ...THREE, ...THREE], s);
    expect(top.level).toBe(3);
    expect(rowToRaise(top, s)).toBeNull();
  });

  it('a stored level outside a narrowed range is clamped when it is used', () => {
    const p = { ...emptyProgress(), level: 5 as const };
    expect(targetProgress(p, range(1, 2)).level).toBe(2);
    expect(targetProgress({ ...emptyProgress(), level: 1 }, range(3, 5)).level).toBe(3);
  });

  it('is kept across rounds: the stored level is where the next round starts (FR-086)', () => {
    const s = settings();
    const afterRound = play(emptyProgress(), [...THREE, ...THREE], s);
    // A new round reads the same stored progress.
    expect(targetProgress(afterRound, s).level).toBe(3);
    expect(targetProgress(emptyProgress(), s).level).toBe(1);
    expect(targetProgress(emptyProgress(), range(2, 5)).level).toBe(2);
  });

  it('skips levels 3 and 4 when every shape is off', () => {
    const noShapes = settings({ shapes: { I: false, O: false, T: false, L: false, J: false, S: false, Z: false } });
    const p = play(emptyProgress(), [...THREE, ...THREE], noShapes);
    expect(p.level).toBe(5);
    const down = play(p, ['assisted', 'assisted'], noShapes);
    expect(down.level).toBe(2);
  });

  it('counts guesses without letting them into the row or the windows', () => {
    const s = settings();
    const p = play(emptyProgress(), ['independent', 'independent', 'guess', 'guess'], s);
    expect(ds(p)).toMatchObject({ attempts: 4, guesses: 2, independent: 2, masteryWindow: [I, I] });
    expect(p.levelRecent).toEqual([I, I]);
    expect(p.levels['1']).toEqual({ independent: 2, assisted: 0, guesses: 2 });
  });

  it('keeps the start level with adaptive difficulty off', () => {
    const s = settings({ adaptive: false, levels: { start: 2, hardest: 5 } });
    const p = play(emptyProgress(), [...THREE, ...THREE], s);
    expect(targetProgress(p, s).level).toBe(2);
    expect(rowToRaise(p, s)).toBeNull();
  });

  it('counts targets per level, alone and with help (FR-090)', () => {
    const s = settings();
    let p = recordAttempt(emptyProgress(), attempt('independent', ['downRight'], { level: 2 }), s);
    p = recordAttempt(p, attempt('unsolved', ['downRight'], { level: 2 }), s);
    expect(p.levels['2']).toEqual({ independent: 1, assisted: 1, guesses: 0 });
  });

  it('gives the X shape two empty squares after 2 targets solved alone at level 5', () => {
    const s = range(5, 5);
    const one = play(emptyProgress(), ['independent'], s, ['downRight']);
    expect(targetProgress(one, s).xTwoEmpties).toBe(false);
    const two = play(one, ['independent'], s, ['downRight']);
    expect(targetProgress(two, s).xTwoEmpties).toBe(true);
    // Never with adaptive difficulty off.
    expect(targetProgress(two, { ...s, adaptive: false }).xTwoEmpties).toBe(false);
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
  it('lists mastered directions of the goalkeeper game only (amendment 05)', () => {
    const p = emptyProgress();
    p.directions[directionKey('keeper', 'down')] = { ...emptyDirectionState(), independent: 10, masteryWindow: Array<Outcome>(10).fill(I) };
    p.directions[directionKey('holes', 'right')] = { ...emptyDirectionState(), independent: 10, masteryWindow: Array<Outcome>(10).fill(I) };
    expect(targetProgress(p, settings())).toEqual({ mastered: ['down'], level: 1, xTwoEmpties: false });
  });
});

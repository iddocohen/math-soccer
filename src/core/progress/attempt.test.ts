import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { emptyRecords, emptyProgress } from '../storage/schemas';
import type { Target } from '../types';
import { directionKey, emptyDirectionState, recordAttempt } from './adaptive';
import { makeAttemptRecord, type FinishedTarget } from './attempt';
import { parseRecordKey, summarize } from './summarize';

const target: Target = { number: 46, hints: [36, 45], directions: ['down', 'right'], level: 1, pattern: 'neighbors' };

function finished(extra: Partial<FinishedTarget> = {}): FinishedTarget {
  return {
    min: 1,
    max: 100,
    target,
    settings: defaultSettings(),
    solved: true,
    helpStep: 0,
    misses: 0,
    startedAt: 10_000,
    endedAt: 14_000,
    missTimes: [],
    now: new Date('2026-11-06T12:00:00.000Z'),
    ...extra,
  };
}

describe('makeAttemptRecord (T043, FR-037)', () => {
  it('has every field of data-model "AttemptRecord"', () => {
    expect(makeAttemptRecord(finished({ misses: 1, helpStep: 1, missTimes: [12_000] }))).toEqual({
      at: '2026-11-06T12:00:00.000Z',
      mode: 'keeper',
      min: 1,
      max: 100,
      target: 46,
      directions: ['down', 'right'],
      hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
      hintDisplay: 'always',
      level: 1,
      solved: true,
      helpStep: 1,
      misses: 1,
      responseMs: 4000,
      guess: false,
    });
  });

  it('marks a quick goal as a guess', () => {
    expect(makeAttemptRecord(finished({ endedAt: 11_000 })).guess).toBe(true);
  });
});

describe('attempt directions (FR-038)', () => {
  const attemptDirections = (target: Target, settings: Settings, helpStep: number) =>
    makeAttemptRecord(finished({ target, settings, helpStep })).directions;

  it('counts toward the directions the hints point from', () => {
    expect(attemptDirections(target, defaultSettings(), 0)).toEqual(['down', 'right']);
  });

  it('counts a target whose hints never showed toward every direction of its level (amendment 09)', () => {
    const s = { ...defaultSettings(), adaptive: false, hintDisplay: 'onRequest' as const };
    expect(attemptDirections(target, s, 0)).toEqual(['right', 'left', 'down', 'up']);
    const diagonalMiddle: Target = { number: 46, hints: [35, 57], directions: ['downRight'], level: 2, pattern: 'middle' };
    expect(attemptDirections(diagonalMiddle, s, 0)).toEqual(['downRight', 'upLeft', 'downLeft', 'upRight']);
    // The big plus of level 2 trains straight directions, so it counts toward them (amendment 15, FR-122).
    const bigPlus: Target = { number: 46, hints: [44, 48, 26, 66], directions: ['right', 'left', 'down', 'up'], level: 2, pattern: 'neighbors' };
    expect(attemptDirections(bigPlus, s, 0)).toEqual(['right', 'left', 'down', 'up']);
    // After help step 1 the hints showed, so the target's own directions count.
    expect(attemptDirections(target, s, 1)).toEqual(['down', 'right']);
  });
});

describe('summarize (FR-039)', () => {
  it('gives one row per direction with attempts, with the counters and mastery, and the levels (FR-090)', () => {
    const s = defaultSettings();
    let p = emptyProgress();
    p = recordAttempt(p, makeAttemptRecord(finished()), s);
    p = recordAttempt(p, makeAttemptRecord(finished({ helpStep: 2 })), s);
    p.directions[directionKey('keeper', 'up')] = emptyDirectionState();
    const summary = summarize(p, emptyRecords(), s);
    expect(summary.directions.map((r) => r.direction)).toEqual(['right', 'down']);
    expect(summary.directions[1]).toMatchObject({ attempts: 2, independent: 1, withHelp: 1, mastered: false });
    expect(summary.level).toEqual({ level: 1, toRaise: 3 });
    expect(summary.levels[0]).toEqual({ level: 1, independent: 1, withHelp: 1, guesses: 0 });
    expect(summary.levels.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(summary.directions[0]).toMatchObject({ attempts: 2 });
  });

  it('lists the personal bests and skips keys it cannot read', () => {
    const records = emptyRecords();
    records.bests['1-100|keeper|untilHearts'] = { goals: 3, timeMs: 100_000, at: '2026-11-06T12:00:00.000Z' };
    records.bests['1-100|holes|untilHearts'] = { goals: 8, timeMs: 340_000, at: '2026-11-06T12:00:00.000Z' };
    records.bests['broken'] = { goals: 1, timeMs: 1, at: '' };
    const summary = summarize(emptyProgress(), records);
    expect(summary.bests).toEqual([{ min: 1, max: 100, mode: 'keeper', roundType: 'untilHearts', challengeMinutes: null, goals: 3, timeMs: 100_000 }]);
  });

  it('parses record keys', () => {
    expect(parseRecordKey('200-500|keeper|goalCount')).toEqual({ min: 200, max: 500, mode: 'keeper', roundType: 'goalCount', challengeMinutes: null });
    expect(parseRecordKey('1-100|holes|untilHearts')).toBeNull();
    expect(parseRecordKey('1-100|keeper|time|2')).toEqual({ min: 1, max: 100, mode: 'keeper', roundType: 'time', challengeMinutes: 2 });
    expect(parseRecordKey('1-100|keeper|time')).toBeNull();
    expect(parseRecordKey('1-100|tank|goalCount')).toBeNull();
  });
});

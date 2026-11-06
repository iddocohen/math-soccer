import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { emptyRecords, emptyProgress } from '../storage/schemas';
import type { Target } from '../types';
import { directionKey, emptyDirectionState, recordAttempt } from './adaptive';
import { attemptDirections, makeAttemptRecord, type FinishedTarget } from './attempt';
import { parseRecordKey, summarize } from './summarize';

const target: Target = { mode: 'holes', number: 46, hints: [36, 45], patchedHoles: [], directions: ['down', 'right'], difficultyStep: 0 };

function finished(extra: Partial<FinishedTarget> = {}): FinishedTarget {
  return {
    mode: 'holes',
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
      mode: 'holes',
      min: 1,
      max: 100,
      target: 46,
      directions: ['down', 'right'],
      hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
      hintDisplay: 'always',
      difficultyStep: 0,
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

describe('attemptDirections (FR-038)', () => {
  it('counts toward the directions the hints point from', () => {
    expect(attemptDirections(target, defaultSettings(), 0)).toEqual(['down', 'right']);
  });

  it('counts a target whose hints never showed toward every direction its hint distances offer', () => {
    const s = { ...defaultSettings(), adaptive: false, hintDisplay: 'onRequest' as const };
    s.hintDistance = { direct: false, vertical: true, diagonal: false, far: false };
    expect(attemptDirections(target, s, 0)).toEqual(['down', 'up']);
    // After help step 1 the hints showed, so the target's own directions count.
    expect(attemptDirections(target, s, 1)).toEqual(['down', 'right']);
  });
});

describe('summarize (FR-039)', () => {
  it('gives one row per direction and mode with attempts, alone, with help, step and mastery', () => {
    const s = defaultSettings();
    let p = emptyProgress();
    p = recordAttempt(p, makeAttemptRecord(finished()), s);
    p = recordAttempt(p, makeAttemptRecord(finished({ helpStep: 2 })), s);
    p.directions[directionKey('keeper', 'up')] = emptyDirectionState();
    const records = emptyRecords();
    records.bests['1-100|holes|untilHearts'] = { goals: 8, timeMs: 340_000, at: '2026-11-06T12:00:00.000Z' };
    records.bests['broken'] = { goals: 1, timeMs: 1, at: '' };
    const summary = summarize(p, records, s);
    expect(summary.directions.map((r) => `${r.mode}|${r.direction}`)).toEqual(['holes|right', 'holes|down']);
    expect(summary.directions[1]).toMatchObject({ attempts: 2, independent: 1, withHelp: 1, step: 0, stepCount: 4, toRaise: 3, mastered: false });
    expect(summary.bests).toEqual([{ min: 1, max: 100, mode: 'holes', roundType: 'untilHearts', goals: 8, timeMs: 340_000 }]);
  });

  it('parses record keys', () => {
    expect(parseRecordKey('200-500|keeper|goalCount')).toEqual({ min: 200, max: 500, mode: 'keeper', roundType: 'goalCount' });
    expect(parseRecordKey('1-100|tank|goalCount')).toBeNull();
  });
});

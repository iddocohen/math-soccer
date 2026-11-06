// Copied from math-tank src/core/records/records.test.ts and adapted to goals, modes and round types.
import { describe, expect, it } from 'vitest';
import { emptyRecords, recordKey, recordsSchema, submitResult, type Records } from './records';

describe('recordKey (data-model "PersonalBest")', () => {
  it('names the range, the mode and the round type', () => {
    expect(recordKey(1, 100, 'holes', 'untilHearts')).toBe('1-100|holes|untilHearts');
    expect(recordKey(0, 1000, 'keeper', 'goalCount')).toBe('0-1000|keeper|goalCount');
  });

  it('differs when any part differs', () => {
    const base = recordKey(1, 100, 'holes', 'untilHearts');
    expect(recordKey(1, 101, 'holes', 'untilHearts')).not.toBe(base);
    expect(recordKey(0, 100, 'holes', 'untilHearts')).not.toBe(base);
    expect(recordKey(1, 100, 'lines', 'untilHearts')).not.toBe(base);
    expect(recordKey(1, 100, 'holes', 'goalCount')).not.toBe(base);
  });
});

describe('submitResult (FR-028)', () => {
  const key = '1-100|holes|untilHearts';
  const result = (goals: number, timeMs = 60_000, at = '2026-11-06T10:00:00.000Z') => ({ goals, timeMs, at });

  it('the first result with at least one goal is a new record and is stored', () => {
    const r = submitResult(emptyRecords(), key, result(3, 90_000));
    expect(r.newRecord).toBe(true);
    expect(r.best).toEqual(result(3, 90_000));
    expect(r.records.bests[key]).toEqual(result(3, 90_000));
  });

  it('fewer goals, or as many goals in the same or more time, are not a new record and keep the stored best', () => {
    const first = submitResult(emptyRecords(), key, result(3, 90_000)).records;
    const fewer = submitResult(first, key, result(2, 10_000));
    expect(fewer.newRecord).toBe(false);
    expect(fewer.best).toEqual(result(3, 90_000));
    expect(fewer.records).toEqual(first);
    expect(submitResult(first, key, result(3, 90_000)).newRecord).toBe(false);
    expect(submitResult(first, key, result(3, 120_000)).newRecord).toBe(false);
  });

  it('more goals are a new record, and so are as many goals in less time', () => {
    const first = submitResult(emptyRecords(), key, result(3)).records;
    expect(submitResult(first, key, result(4, 200_000)).newRecord).toBe(true);
    const faster = submitResult(first, key, result(3, 30_000));
    expect(faster.newRecord).toBe(true);
    expect(faster.best).toEqual(result(3, 30_000));
  });

  it('0 goals is never a new record and stores nothing', () => {
    const r = submitResult(emptyRecords(), key, result(0));
    expect(r.newRecord).toBe(false);
    expect(r.best).toBeNull();
    expect(r.records).toEqual(emptyRecords());
  });

  it('keeps the bests of other keys and does not change its input', () => {
    const input: Records = { version: 1, bests: { other: result(7) } };
    const copy = structuredClone(input);
    const r = submitResult(input, key, result(2));
    expect(input).toEqual(copy);
    expect(r.records.bests).toEqual({ other: result(7), [key]: result(2) });
  });

  it('the stored shape passes the records schema', () => {
    const r = submitResult(emptyRecords(), key, result(2));
    expect(recordsSchema.safeParse(r.records).success).toBe(true);
    expect(recordsSchema.safeParse({ version: 1, bests: { k: { goals: -1, timeMs: 0, at: 'x' } } }).success).toBe(false);
  });
});

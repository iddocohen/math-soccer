// Copied from math-tank src/core/records/records.test.ts and adapted to goals and round types.
import { describe, expect, it } from 'vitest';
import { emptyRecords, recordKey, recordsSchema, submitResult, submitShootout, type Records } from './records';

describe('recordKey (data-model "PersonalBest")', () => {
  it('names the range, the goalkeeper game and the round type', () => {
    expect(recordKey(1, 100, 'untilHearts')).toBe('1-100|keeper|untilHearts');
    expect(recordKey(0, 1000, 'goalCount')).toBe('0-1000|keeper|goalCount');
  });

  it('differs when any part differs', () => {
    const base = recordKey(1, 100, 'untilHearts');
    expect(recordKey(1, 101, 'untilHearts')).not.toBe(base);
    expect(recordKey(0, 100, 'untilHearts')).not.toBe(base);
    expect(recordKey(1, 100, 'goalCount')).not.toBe(base);
  });
});

describe('time challenge bests (amendment 07, FR-080)', () => {
  it('are kept per range and challenge time, apart from normal rounds', () => {
    expect(recordKey(1, 100, 'time', 2)).toBe('1-100|keeper|time|2');
    expect(recordKey(1, 100, 'time', 1)).not.toBe(recordKey(1, 100, 'time', 2));
    expect(recordKey(0, 1000, 'time', 2)).not.toBe(recordKey(1, 100, 'time', 2));
    expect(recordKey(1, 100, 'time', 2)).not.toBe(recordKey(1, 100, 'untilHearts'));
  });

  it('more goals in the same challenge time is a new record; as many goals is not', () => {
    const key = recordKey(1, 100, 'time', 1);
    const first = submitResult(emptyRecords(), key, { goals: 4, timeMs: 60_000, at: '2026-11-06T10:00:00.000Z' });
    expect(first.newRecord).toBe(true);
    expect(submitResult(first.records, key, { goals: 4, timeMs: 60_000, at: '2026-11-06T11:00:00.000Z' }).newRecord).toBe(false);
    expect(submitResult(first.records, key, { goals: 5, timeMs: 60_000, at: '2026-11-06T11:00:00.000Z' }).newRecord).toBe(true);
    // A best of another challenge time is not compared.
    expect(submitResult(first.records, recordKey(1, 100, 'time', 2), { goals: 1, timeMs: 120_000, at: 'x' }).newRecord).toBe(true);
  });
});

describe('submitResult (FR-028)', () => {
  const key = '1-100|keeper|untilHearts';
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

describe('the best of "Elfmeterschießen" (amendment 21 part 3): shootouts won', () => {
  const key = recordKey(1, 100, 'untilHearts', null, 'shootout');

  it('each win adds one; a loss leaves the records as they are', () => {
    const one = submitShootout(emptyRecords(), key, true, 'a');
    expect(one.best).toEqual({ goals: 1, timeMs: 0, at: 'a' });
    expect(one.newRecord).toBe(false);
    const lost = submitShootout(one.records, key, false, 'b');
    expect(lost.records).toBe(one.records);
    expect(lost.best).toEqual({ goals: 1, timeMs: 0, at: 'a' });
    const two = submitShootout(lost.records, key, true, 'c');
    expect(two.best?.goals).toBe(2);
    expect(recordsSchema.safeParse(two.records).success).toBe(true);
  });

  it('a loss before any win shows no best', () => {
    expect(submitShootout(emptyRecords(), key, false, 'a')).toEqual({ records: emptyRecords(), newRecord: false, best: null });
  });
});

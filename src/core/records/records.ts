// Copied from math-tank src/core/records/records.ts; the key and the stored value follow data-model "PersonalBest".
/**
 * Personal bests (FR-028, data-model "PersonalBest"). Pure functions; storage.ts keeps them under
 * `mathsoccer.records.v1`, and the export file carries them.
 *
 * One best per number range and round type of the goalkeeper game. Bests of the removed hole and line modes stay in
 * storage under their own keys and show as "früher" on the progress page; new rounds are not compared with them
 * (amendment 05, FR-070). A best is the most goals in one round, with the time of that round. With the same number of
 * goals a faster round is better, so a "Feste Zahl an Toren" round, where every finished round has the same goals,
 * keeps its fastest time. A round with no goal is never a record.
 */
import { emptyRecords, recordsSchema, type Records } from '../storage/schemas';
import { PLAYED_MODE } from '../types';

export { emptyRecords, recordsSchema, type Records };

/** Goals, time played in milliseconds, and when the best was set (ISO 8601). */
export interface BestResult {
  goals: number;
  timeMs: number;
  at: string;
}

/** `${min}-${max}|keeper|${roundType}` (data-model "PersonalBest"). */
export function recordKey(min: number, max: number, roundType: 'untilHearts' | 'goalCount'): string {
  return `${min}-${max}|${PLAYED_MODE}|${roundType}`;
}

export interface SubmitOutcome {
  records: Records;
  /** The result beat the stored best (or there was none) with at least one goal. */
  newRecord: boolean;
  /** The best for the key after this result, or null when there is none. */
  best: BestResult | null;
}

/** True when `result` beats `stored`: more goals, or as many goals in less time. */
function beats(result: BestResult, stored: BestResult | null): boolean {
  if (result.goals < 1) return false;
  if (stored === null) return true;
  return result.goals > stored.goals || (result.goals === stored.goals && result.timeMs < stored.timeMs);
}

/** Compares a finished round with the stored best and returns new records; `records` itself is not changed. */
export function submitResult(records: Records, key: string, result: BestResult): SubmitOutcome {
  const stored = records.bests[key] ?? null;
  const newRecord = beats(result, stored);
  if (!newRecord) return { records, newRecord, best: stored };
  const best = { ...result };
  return { records: { ...records, bests: { ...records.bests, [key]: best } }, newRecord, best };
}

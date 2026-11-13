// Copied from math-tank src/core/records/records.ts; the key and the stored value follow data-model "PersonalBest".
/**
 * Personal bests (FR-028, data-model "PersonalBest"). Pure functions; storage.ts keeps them under
 * `mathsoccer.records.v1`, and the export file carries them.
 *
 * One best per number range and round type of the goalkeeper game. A best is the most goals in one round, with the time of that round. With the same number of
 * goals a faster round is better, so a "Feste Zahl an Toren" round, where every finished round has the same goals,
 * keeps its fastest time. A round with no goal is never a record.
 *
 * Time challenges (amendment 07, FR-080) have their own bests per range and challenge time, apart from normal rounds:
 * every challenge of the same length has the same time, so the best is the most goals.
 */
import { emptyRecords, recordsSchema, type Records } from '../storage/schemas';
import { MODE_INFO, type MatchMode } from '../match/rounds';
import { PLAYED_MODE, type RoundType } from '../types';

export { emptyRecords, recordsSchema, type Records };

/** Goals, time played in milliseconds, and when the best was set (ISO 8601). */
export interface BestResult {
  goals: number;
  timeMs: number;
  at: string;
}

/**
 * `${min}-${max}|keeper|${roundType}` (data-model "PersonalBest"); a time challenge adds its minutes:
 * `${min}-${max}|keeper|time|${minutes}`. A round of "Freistoß mit Mauer" (amendment 21) adds `|wall`, so its bests
 * stay apart from those of "Spielen" with the same round type. "Selbst ins Tor" and "Elfmeterschießen" do not follow the
 * round type, so their keys name only the mode: `${min}-${max}|keeper|keeper` and `${min}-${max}|keeper|shootout`. So do
 * "Torwandschießen" (`|torwand`) and "Papa gegen Kind" (`|family`, amendment 23).
 */
export function recordKey(min: number, max: number, roundType: RoundType, challengeMinutes: number | null = null, mode: MatchMode = 'normal'): string {
  if (MODE_INFO[mode].ownRecordKey) return `${min}-${max}|${PLAYED_MODE}|${mode}`;
  const base = `${min}-${max}|${PLAYED_MODE}|${roundType}`;
  const key = roundType === 'time' ? `${base}|${challengeMinutes ?? 0}` : base;
  return mode === 'normal' ? key : `${key}|${mode}`;
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

/**
 * The best of "Elfmeterschießen" (amendment 21 part 3) is the number of shootouts won (`goals`, with `timeMs` 0). A won
 * shootout adds one; a lost one leaves the records as they are. `newRecord` stays false, since every win counts up.
 * "Papa gegen Kind" (amendment 23) counts the child's wins the same way.
 */
export function submitShootout(records: Records, key: string, won: boolean, at: string): SubmitOutcome {
  const stored = records.bests[key] ?? null;
  if (!won) return { records, newRecord: false, best: stored };
  const best: BestResult = { goals: (stored?.goals ?? 0) + 1, timeMs: 0, at };
  return { records: { ...records, bests: { ...records.bests, [key]: best } }, newRecord: false, best };
}

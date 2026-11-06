// Structure adapted from math-tank src/app/RoundEnd.tsx.
/**
 * Round end (FR-028, contracts/screens.md "Round end"): an encouraging line, the result "8 Tore in 5:40", and the
 * personal best for the same range, mode and round type: "Neuer Rekord!", or the record in small neutral text. With
 * "Bis die Bälle weg sind" the record names its goals ("Dein Rekord: 9"); with a fixed number of goals every round has
 * the same goals, so the record names its time as well ("Dein Rekord: 2 Tore in 0:41"). Nothing compares the numbers
 * and nothing says "verloren". `record` is null when the parent turned off "Rekorde zeigen".
 * "Nochmal" (or Enter or Space, handled by the app's keyboard listener) starts a new round without a page reload;
 * "Zurück" goes back to the start screen.
 * With the locker room on, the stars earned in the round show as "+6 Sterne" (`data-testid="round-stars"`).
 */
import type { BestResult } from '../core/records/records';
import { t } from '../i18n';

export interface RoundRecord {
  newRecord: boolean;
  best: BestResult | null;
}

interface Props {
  goals: number;
  elapsedMs: number;
  roundType: 'untilHearts' | 'goalCount';
  /** The personal best after this round, or null when records are not shown. */
  record: RoundRecord | null;
  /** Stars earned in the round, or null when the locker room is off (FR-044). */
  stars?: number | null;
  onAgain: () => void;
  onBack: () => void;
}

export function RoundEnd({ goals, elapsedMs, roundType, record, stars = null, onAgain, onBack }: Props) {
  const text = t().roundEnd;
  return (
    <div className="round-end" data-testid="round-end" role="dialog" aria-modal="true" aria-label={text.cheer}>
      <h2>{text.cheer}</h2>
      <p className="round-result" data-testid="round-result">
        {text.summary(goals, elapsedMs)}
      </p>
      {stars !== null && (
        <p className="round-stars" data-testid="round-stars">
          {text.stars(stars)}
        </p>
      )}
      {record?.newRecord ? (
        <p className="new-record" data-testid="new-record">
          {text.newRecord}
        </p>
      ) : record?.best ? (
        <p className="record" data-testid="record">
          {roundType === 'goalCount' ? text.recordTime(record.best.goals, record.best.timeMs) : text.record(record.best.goals)}
        </p>
      ) : null}
      <div className="round-end-buttons">
        <button type="button" className="primary" onClick={onAgain}>
          {text.again}
        </button>
        <button type="button" onClick={onBack}>
          {text.back}
        </button>
      </div>
    </div>
  );
}

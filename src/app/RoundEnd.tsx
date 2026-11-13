// Structure adapted from math-tank src/app/RoundEnd.tsx.
/**
 * Round end (FR-028, contracts/screens.md "Round end"): an encouraging line, the result "8 Tore in 5:40", and the
 * personal best for the same range, mode and round type: "Neuer Rekord!", or the record in small neutral text. With
 * "Bis die Bälle weg sind" the record names its goals ("Dein Rekord: 9"); with a fixed number of goals every round has
 * the same goals, so the record names its time as well ("Dein Rekord: 2 Tore in 0:41"). Nothing compares the numbers
 * and nothing says "verloren". `record` is null when the parent turned off "Rekorde zeigen".
 * "Nochmal" (or Enter or Space, handled by the app's keyboard listener) starts a new round without a page reload;
 * "Zurück" goes back to the start screen.
 * A time challenge (amendment 07, FR-080) shows "2 Tore in 1 Minute" and its record by goals ("Dein Rekord: 9"), per
 * range and challenge time.
 * A cup match (amendment 13, FR-108) shows its outcome instead of a record (`data-testid="cup-result"`, `data-cup-won`):
 * "Gewonnen! Weiter ins Halbfinale", or "Knapp! Noch mal gegen Adler 09?" (T102). After a win the one button "Weiter"
 * (Enter or Space) goes back to the bracket; after a loss "Nochmal" replays the match and "Zurück" goes to the bracket
 * (App.tsx passes the bracket as `onBack`). A won final sits low on the screen (`cup-final-won`), so the confetti,
 * the fireworks and the cup lift stay in view.
 * The other modes pass `outcome` (`RoundOutcome`).
 * "Selbst ins Tor" (amendment 21, FR-146): with `saves` the result reads "7 von 10 gehalten" and the record
 * "Dein Rekord: 8 gehalten"; `goals` are the saves.
 * "Elfmeterschießen" (amendment 21 part 3, FR-148): with `shootout` against the opponent team the heading is "Elfmeter-Sieger!" after a win
 * (placed low like a won cup final, so the confetti stays in view) or "Knapp! Noch mal?" after a loss, the
 * result reads "4:3 gegen FC Blitz", and the record line counts the shootouts won (`data-shootout-won`).
 * "Torwandschießen" (amendment 23, FR-157): with `hits` the result reads "7 von 10 Treffern" and the record
 * "Dein Rekord: 8 von 10 Treffern".
 * "Papa gegen Kind" (amendment 23, FR-160): with `shootout` against the grown-up the heading names the winner ("Leo gewinnt!" or "Papa
 * gewinnt!"), placed low like a won final so the confetti stays in view; when the grown-up won, "Knapp! Revanche?"
 * follows (`data-testid="family-lost"`). The result reads "Leo 4:3 Papa" and the record line counts the child's wins
 * (`data-family-winner`: `child` or `grownup`).
 * With the locker room on, the stars earned in the round show as "+6 Sterne" (`data-testid="round-stars"`).
 * Amendment 12 (FR-103): when a new version waits, a short neutral line "Neue Version, startet gleich" shows
 * (`data-testid="update-note"`); "Zurück" and "Nochmal" then apply it (App.tsx, swUpdate.ts).
 */
import type { BestResult } from '../core/records/records';
import { t } from '../i18n';
import type { RoundType } from '../core/types';

/** The outcome of a cup match for the round end; `line` is the German text. */
export interface CupRoundResult {
  won: boolean;
  line: string;
  /** The match won the final, and with it the cup (FR-110, FR-111). */
  cupWon?: boolean;
  /** The cup was replaced during the match, so its result counts for nothing; "Weiter" goes to the bracket. */
  replaced?: boolean;
}

/**
 * The end of a shootout: who took the kicks of side 1 (the opponent team in "Elfmeterschießen", the grown-up in "Papa
 * gegen Kind"), whether the child won, the names of both sides (the child's first) and the score (the child's goals
 * first).
 */
export interface ShootoutResult {
  kicks: 'opponent' | 'grownup';
  childWon: boolean;
  names: readonly [string, string];
  score: readonly [number, number];
}

/**
 * What the round end tells besides the goals:
 * - `goals`: the usual result;
 * - `cup`: the outcome of a cup match;
 * - `saves`: "Selbst ins Tor", the shots of the round (`goals` are the saves);
 * - `hits`: "Torwandschießen", the shots of the round (`goals` are the hits);
 * - `shootout`: how a shootout ended.
 */
export type RoundOutcome =
  | { kind: 'goals' }
  | { kind: 'cup'; cup: CupRoundResult }
  | { kind: 'saves'; shots: number }
  | { kind: 'hits'; shots: number }
  | { kind: 'shootout'; result: ShootoutResult };

export interface RoundRecord {
  newRecord: boolean;
  best: BestResult | null;
}

interface Props {
  goals: number;
  elapsedMs: number;
  roundType: RoundType;
  /** The challenge time of a time challenge; null for the other round types. */
  challengeMinutes?: number | null;
  /** The personal best after this round, or null when records are not shown. */
  record: RoundRecord | null;
  /** Stars earned in the round, or null when the locker room is off (FR-044). */
  stars?: number | null;
  /** A new version waits and applies on "Zurück" or "Nochmal" (FR-103). */
  updateWaiting?: boolean;
  /** What the round end tells besides the goals; the usual result without it. */
  outcome?: RoundOutcome;
  onAgain: () => void;
  onBack: () => void;
}

const GOALS: RoundOutcome = { kind: 'goals' };

export function RoundEnd({ goals, elapsedMs, roundType, challengeMinutes = null, record, stars = null, updateWaiting = false, outcome = GOALS, onAgain, onBack }: Props) {
  const text = t().roundEnd;
  const cup = outcome.kind === 'cup' ? outcome.cup : null;
  const shootout = outcome.kind === 'shootout' ? outcome.result : null;
  const family = shootout?.kicks === 'grownup';
  let result = challengeMinutes !== null ? text.challengeSummary(goals, challengeMinutes) : text.summary(goals, elapsedMs);
  if (outcome.kind === 'saves') result = text.keeperSummary(goals, outcome.shots);
  if (outcome.kind === 'hits') result = text.torwandSummary(goals, outcome.shots);
  if (shootout !== null) {
    const [child, other] = shootout.names;
    const [a, b] = shootout.score;
    result = family ? text.familySummary(child, a, other, b) : text.shootoutSummary(a, b, other);
  }
  let heading = text.cheer;
  if (shootout !== null && family) heading = text.familyWinner(shootout.names[shootout.childWon ? 0 : 1]);
  else if (shootout !== null) heading = shootout.childWon ? text.shootoutWon : text.shootoutLost;
  const best = record?.best ?? null;
  let bestLine = '';
  if (best !== null) {
    if (outcome.kind === 'saves') bestLine = text.keeperRecord(best.goals);
    else if (outcome.kind === 'hits') bestLine = text.torwandRecord(best.goals);
    else if (shootout !== null) bestLine = family ? text.familyRecord(best.goals) : text.shootoutRecord(best.goals);
    else bestLine = roundType === 'goalCount' ? text.recordTime(best.goals, best.timeMs) : text.record(best.goals);
  }
  return (
    <div
      className={cup?.cupWon || shootout?.childWon || family ? 'round-end cup-final-won' : 'round-end'}
      data-testid="round-end"
      data-shootout-won={shootout === null || family ? undefined : shootout.childWon}
      data-family-winner={family ? (shootout.childWon ? 'child' : 'grownup') : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <h2>{heading}</h2>
      {family && !shootout.childWon && (
        <p className="family-lost" data-testid="family-lost">
          {text.familyLost}
        </p>
      )}
      <p className="round-result" data-testid="round-result">
        {result}
      </p>
      {cup && (
        <p className="cup-result" data-testid="cup-result" data-cup-won={cup.won}>
          {cup.line}
        </p>
      )}
      {stars !== null && (
        <p className="round-stars" data-testid="round-stars">
          {text.stars(stars)}
        </p>
      )}
      {cup ? null : record?.newRecord ? (
        <p className="new-record" data-testid="new-record">
          {text.newRecord}
        </p>
      ) : best ? (
        <p className="record" data-testid="record">
          {bestLine}
        </p>
      ) : null}
      {updateWaiting && (
        <p className="update-note" data-testid="update-note">
          {text.updateWaiting}
        </p>
      )}
      <div className="round-end-buttons">
        {cup?.won || cup?.replaced ? (
          // A won cup match, or one whose cup was replaced, goes on to the bracket (Enter or Space as well).
          <button type="button" className="primary" onClick={onBack}>
            {t().cup.next}
          </button>
        ) : (
          <>
            <button type="button" className="primary" onClick={onAgain}>
              {text.again}
            </button>
            <button type="button" onClick={onBack}>
              {text.back}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

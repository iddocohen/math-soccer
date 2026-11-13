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
 * "Selbst ins Tor" (amendment 21, FR-146): with `keeperShots` the result reads "7 von 10 gehalten" and the record
 * "Dein Rekord: 8 gehalten"; `goals` are the saves.
 * "Elfmeterschießen" (amendment 21 part 3, FR-148): with `shootout` the heading is "Elfmeter-Sieger!" after a win
 * (placed low like a won cup final, so the confetti stays in view) or "Knapp! Noch mal?" after a loss, the
 * result reads "4:3 gegen FC Blitz", and the record line counts the shootouts won (`data-shootout-won`).
 * "Torwandschießen" (amendment 23, FR-157): with `torwandShots` the result reads "7 von 10 Treffern" and the record
 * "Dein Rekord: 8 von 10 Treffern".
 * "Papa gegen Kind" (amendment 23, FR-160): with `family` the heading names the winner ("Leo gewinnt!" or "Papa
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

/** The end of a shootout: won or not, the score (the child's goals first) and the opponent team's name. */
export interface ShootoutResult {
  won: boolean;
  score: readonly [number, number];
  opponent: string;
}

/** The end of "Papa gegen Kind": who won, the names and the score (the child's goals first). */
export interface FamilyResult {
  winner: 'child' | 'grownup';
  child: string;
  grownup: string;
  score: readonly [number, number];
}

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
  /** The outcome of a cup match; null for the other round types. */
  cup?: CupRoundResult | null;
  /** A new version waits and applies on "Zurück" or "Nochmal" (FR-103). */
  updateWaiting?: boolean;
  /** "Selbst ins Tor": the shots of the round, and `goals` are the saves; null for the other modes. */
  keeperShots?: number | null;
  /** "Elfmeterschießen": how it ended; null for the other modes. */
  shootout?: ShootoutResult | null;
  /** "Torwandschießen": the shots of the round, and `goals` are the hits; null for the other modes. */
  torwandShots?: number | null;
  /** "Papa gegen Kind": how it ended; null for the other modes. */
  family?: FamilyResult | null;
  onAgain: () => void;
  onBack: () => void;
}

export function RoundEnd({ goals, elapsedMs, roundType, challengeMinutes = null, record, stars = null, cup = null, updateWaiting = false, keeperShots = null, shootout = null, torwandShots = null, family = null, onAgain, onBack }: Props) {
  const text = t().roundEnd;
  let result = challengeMinutes !== null ? text.challengeSummary(goals, challengeMinutes) : text.summary(goals, elapsedMs);
  if (keeperShots !== null) result = text.keeperSummary(goals, keeperShots);
  if (shootout !== null) result = text.shootoutSummary(shootout.score[0], shootout.score[1], shootout.opponent);
  if (torwandShots !== null) result = text.torwandSummary(goals, torwandShots);
  if (family !== null) result = text.familySummary(family.child, family.score[0], family.grownup, family.score[1]);
  let heading = text.cheer;
  if (shootout !== null) heading = shootout.won ? text.shootoutWon : text.shootoutLost;
  if (family !== null) heading = text.familyWinner(family.winner === 'child' ? family.child : family.grownup);
  const best = record?.best ?? null;
  let bestLine = '';
  if (best !== null) {
    if (keeperShots !== null) bestLine = text.keeperRecord(best.goals);
    else if (shootout !== null) bestLine = text.shootoutRecord(best.goals);
    else if (torwandShots !== null) bestLine = text.torwandRecord(best.goals);
    else if (family !== null) bestLine = text.familyRecord(best.goals);
    else bestLine = roundType === 'goalCount' ? text.recordTime(best.goals, best.timeMs) : text.record(best.goals);
  }
  return (
    <div
      className={cup?.cupWon || shootout?.won || family !== null ? 'round-end cup-final-won' : 'round-end'}
      data-testid="round-end"
      data-shootout-won={shootout === null ? undefined : shootout.won}
      data-family-winner={family?.winner}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <h2>{heading}</h2>
      {family?.winner === 'grownup' && (
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

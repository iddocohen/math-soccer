/**
 * The bracket screen of the cup (amendment 13, FR-106; contracts/screens.md "Bracket"). "Pokal" (or P) on the start
 * screen opens it. The five matches of the cup stand from left to right: Gruppenspiel 1, Gruppenspiel 2, Viertelfinale,
 * Halbfinale, Finale. Each shows its opponent with the team colors; won matches show a check mark and the score, the
 * next match is highlighted with "Los!". Enter, Space (the app's keyboard listener) or a tap on the highlighted match
 * starts it; "Zurück" or Escape goes back to the start screen. Matches after the next one cannot be started.
 *
 * For tests: `data-testid="cup-bracket"` with `data-cup-number` and `data-cup-stage`; each match is
 * `data-testid="bracket-match"` with `data-stage` (0 to 4), `data-team` and `data-state` (`won`, `next` or `later`).
 */
import type { ReactElement } from 'react';
import { CUP_STAGES, teamOf } from '../core/cup/cup';
import type { Cup } from '../core/storage/schemas';
import { t } from '../i18n';

/** A gold cup drawn as SVG, for the bracket title and the trophy shelf. */
export function TrophyIcon({ size = 48 }: { size?: number }): ReactElement {
  return (
    <svg className="trophy-icon" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M10 8 h28 v8 a14 14 0 0 1 -28 0 z" fill="#f2c230" />
      <path d="M10 11 a7 7 0 0 0 0 12 M38 11 a7 7 0 0 1 0 12" fill="none" stroke="#f2c230" strokeWidth="3.5" />
      <rect x="21" y="29" width="6" height="8" fill="#c9971a" />
      <rect x="14" y="37" width="20" height="6" rx="2" fill="#c9971a" />
      <rect x="14" y="11" width="4" height="12" rx="2" fill="#fff" opacity="0.45" />
    </svg>
  );
}

interface Props {
  cup: Cup;
  onPlay: () => void;
  onBack: () => void;
}

export function CupBracket({ cup, onPlay, onBack }: Props): ReactElement {
  const text = t().cup;
  return (
    <main className="cup-bracket" lang="de" data-testid="cup-bracket" data-cup-number={cup.cup} data-cup-stage={cup.stage}>
      <header className="cup-bracket-header">
        <h1>
          <TrophyIcon size={40} />
          {text.title(cup.cup)}
        </h1>
        <button type="button" onClick={onBack} aria-keyshortcuts="Escape">
          {text.back}
        </button>
      </header>
      <ol className="bracket">
        {CUP_STAGES.map((stage, i) => {
          const team = teamOf(cup.cup, i);
          const score = cup.scores[i];
          const state = i < cup.stage ? 'won' : i === cup.stage ? 'next' : 'later';
          const content = (
            <>
              <span className="bracket-stage">{text.stages[stage]}</span>
              <span className="bracket-team">
                <span className="bracket-colors" style={{ background: team.color, borderColor: team.trim }} aria-hidden="true" />
                {team.name}
              </span>
              {state === 'won' && score && (
                <span className="bracket-score" aria-label={text.wonLabel(text.score(score.goals, score.against))}>
                  <span aria-hidden="true">✓ </span>
                  {text.score(score.goals, score.against)}
                </span>
              )}
              {state === 'next' && (
                <span className="bracket-play">
                  {text.play}
                  <span className="start-key" aria-hidden="true">
                    {' '}
                    Enter
                  </span>
                </span>
              )}
            </>
          );
          return (
            <li key={stage} className={`bracket-match bracket-${state}${stage === 'final' ? ' bracket-final' : ''}`} data-testid="bracket-match" data-stage={i} data-team={team.id} data-state={state}>
              {state === 'next' ? (
                <button type="button" className="bracket-card" aria-keyshortcuts="Enter Space" aria-label={`${text.nextLabel}: ${text.intro(text.stages[stage], team.name)}`} onClick={onPlay}>
                  {content}
                </button>
              ) : (
                <div className="bracket-card">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/** The short card before a cup match: "Gruppenspiel 1 gegen FC Blitz" (about 1.5 s; Enter or a tap skips it). */
export function CupIntro({ stage, team, onSkip }: { stage: number; team: { name: string; color: string; trim: string }; onSkip: () => void }): ReactElement {
  const text = t().cup;
  const name = text.stages[CUP_STAGES[stage]!];
  return (
    <div className="cup-intro" data-testid="cup-intro" role="status" onPointerDown={onSkip}>
      <div className="cup-intro-card" style={{ borderColor: team.color }}>
        <span className="bracket-colors big" style={{ background: team.color, borderColor: team.trim }} aria-hidden="true" />
        <p>{text.intro(name, team.name)}</p>
      </div>
    </div>
  );
}

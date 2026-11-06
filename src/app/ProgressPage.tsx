// Structure adapted from math-tank src/app/ProgressPage.tsx: rows per direction, no sessions and no garage.
/**
 * Parent progress page (FR-039, contracts/screens.md "Progress"). Opened from the parent menu, so it sits behind the
 * same gate as the settings. It shows the child's current difficulty level (with how many more targets alone raise it)
 * and per level the targets solved alone and with help (FR-090). Then per direction the attempts, the targets solved
 * alone and with help in separate columns and whether the direction is mastered, all from the goalkeeper game, and in a "früher" column the attempts of the removed hole and line modes (amendment 05,
 * FR-070). Then the personal bests as a plain list, and the bests of the removed modes under "Früher". "Fortschritt zurücksetzen" asks first and then empties the
 * progress; the personal bests and the stars stay. "Alles zurücksetzen" (amendment 01, FR-051, as math-tank amendment 24)
 * asks first, reminding the parent to save the data before, then clears progress, personal bests, stars and the locker
 * room together or not at all; the settings stay.
 */
import { useMemo, useState } from 'react';
import { summarize } from '../core/progress/summarize';
import { t } from '../i18n';
import type { Persistence } from './persistence';

interface Props {
  persistence: Pick<Persistence, 'progress' | 'records' | 'settings' | 'resetProgress' | 'resetAll'>;
  onClose: () => void;
}

export function ProgressPage({ persistence, onClose }: Props) {
  const m = t();
  const P = m.progressPage;
  const [progress, setProgress] = useState(() => persistence.progress());
  const [resetNote, setResetNote] = useState<'ok' | 'failed' | null>(null);
  const [allNote, setAllNote] = useState<'ok' | 'failed' | 'partial' | null>(null);
  const [records, setRecords] = useState(() => persistence.records());
  const settings = persistence.settings();
  const summary = useMemo(() => summarize(progress, records, settings), [progress, records, settings]);

  const reset = () => {
    const ok = persistence.resetProgress().ok;
    setProgress(persistence.progress());
    setResetNote(ok ? 'ok' : 'failed');
  };

  const resetAll = () => {
    const r = persistence.resetAll();
    setProgress(persistence.progress());
    setRecords(persistence.records());
    setAllNote(r.ok ? 'ok' : r.partial ? 'partial' : 'failed');
  };

  const askedReset = () => {
    setResetNote(null);
    setAllNote(null);
  };

  return (
    <div className="settings-page progress-page" role="dialog" aria-modal="true" aria-label={P.title} data-testid="progress-page" lang="de">
      <header className="settings-header">
        <h2>{P.title}</h2>
        <div className="settings-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {P.close}
          </button>
        </div>
      </header>

      <div className="settings-notices" role="status" aria-live="polite">
        {resetNote === 'ok' && <p className="notice ok">{P.resetDone}</p>}
        {resetNote === 'failed' && <p className="notice warn">{P.resetFailed}</p>}
        {allNote === 'ok' && <p className="notice ok">{P.resetAllDone}</p>}
        {allNote === 'failed' && <p className="notice warn">{P.resetAllFailed}</p>}
        {allNote === 'partial' && <p className="notice warn">{P.resetAllPartial}</p>}
      </div>

      {summary.level && (
        <section className="progress-section" data-testid="progress-level" data-level={summary.level.level}>
          <p>
            {P.currentLevel(m.levels.label(summary.level.level, m.levels.names[summary.level.level]))}
            {summary.level.toRaise !== null && <span className="hint step-hint">{P.toRaise(summary.level.toRaise)}</span>}
          </p>
          <table className="progress-table" data-testid="progress-levels">
            <thead>
              <tr>
                <th scope="col">{P.levelColumn}</th>
                <th scope="col">{P.columns.alone}</th>
                <th scope="col">{P.columns.withHelp}</th>
              </tr>
            </thead>
            <tbody>
              {summary.levels.map((r) => (
                <tr key={r.level} data-level={r.level}>
                  <th scope="row">{m.levels.label(r.level, m.levels.names[r.level])}</th>
                  <td>{r.independent}</td>
                  <td>{r.withHelp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="progress-section">
        {summary.directions.length === 0 ? (
          <p className="hint">{P.empty}</p>
        ) : (
          <table className="progress-table" data-testid="progress-table">
            <thead>
              <tr>
                <th scope="col">{P.columns.direction}</th>
                <th scope="col">{P.columns.attempts}</th>
                <th scope="col">{P.columns.alone}</th>
                <th scope="col">{P.columns.withHelp}</th>
                <th scope="col">{P.columns.mastered}</th>
                <th scope="col">{P.columns.earlier}</th>
              </tr>
            </thead>
            <tbody>
              {summary.directions.map((r) => (
                <tr key={r.direction} data-direction={r.direction}>
                  <th scope="row">{P.directions[r.direction]}</th>
                  <td>{r.attempts}</td>
                  <td>{r.independent}</td>
                  <td>{r.withHelp}</td>
                  <td>{r.mastered ? P.masteredYes : P.masteredNo}</td>
                  <td data-testid="progress-earlier">{r.earlier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="progress-section">
        <h3>{P.bests}</h3>
        {summary.bests.length === 0 ? (
          <p className="hint">{P.noBests}</p>
        ) : (
          <ul className="progress-bests" data-testid="progress-bests">
            {summary.bests.map((b) => (
              <li key={`${b.min}-${b.max}|${b.roundType}|${b.challengeMinutes ?? ''}`}>
                {P.range(b.min, b.max)}, {P.roundTypes[b.roundType]}:{' '}
                {b.challengeMinutes === null ? P.bestLine(b.goals, b.timeMs) : P.challengeBestLine(b.goals, b.challengeMinutes)}
              </li>
            ))}
          </ul>
        )}
        {summary.earlierBests.length > 0 && (
          <>
            <h4>{P.earlierBests}</h4>
            <ul className="progress-bests" data-testid="progress-earlier-bests">
              {summary.earlierBests.map((b) => (
                <li key={`${b.min}-${b.max}|${b.mode}|${b.roundType}`}>
                  {P.range(b.min, b.max)}, {P.earlierModes[b.mode]}, {P.roundTypes[b.roundType]}: {P.bestLine(b.goals, b.timeMs)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="progress-section">
        <ConfirmReset label={P.reset} question={P.resetConfirm} yes={P.resetYes} no={P.resetNo} onAsk={askedReset} onConfirm={reset} />
        <ConfirmReset label={P.resetAll} question={P.resetAllConfirm} yes={P.resetAllYes} no={P.resetNo} onAsk={askedReset} onConfirm={resetAll} />
      </section>
    </div>
  );
}

/**
 * A reset button that asks first (as math-tank): the button opens the question with "yes" and "no", and "yes" calls
 * onConfirm. onAsk runs when the question opens, so an earlier note goes away.
 */
function ConfirmReset({ label, question, yes, no, onAsk, onConfirm }: { label: string; question: string; yes: string; no: string; onAsk: () => void; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="progress-reset" role="alertdialog" aria-label={label}>
        <p>{question}</p>
        <div className="data-buttons">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onConfirm();
              setConfirming(false);
            }}
          >
            {yes}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
            {no}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="data-buttons">
      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          onAsk();
          setConfirming(true);
        }}
      >
        {label}
      </button>
    </div>
  );
}

/**
 * The React overlay over the match scene (contracts/screens.md "Match"): the goal counter, the hearts as three balls
 * (with "Bis die Bälle weg sind"), the clock when the parent turned it on, the help button and the pause button at the
 * top; the typed number (`data-testid="entry"`) and the message line (`data-testid="message"`) at the bottom.
 *
 * For the end-to-end tests, `data-testid="match"` carries the controller state: `data-target`, `data-phase`,
 * `data-help`, `data-help-chart`, `data-goals`, `data-hearts`, plus `data-rows` (chart rows), `data-ball` (the ball design
 * from the locker room, for example `ball.gold`), `data-ball-kind` (soccer, tennis or pingpong, from the chart size) and,
 * in line mode, `data-line` (the line's numbers) and `data-line-index` (the target's place in it), and in goalkeeper
 * mode `data-keeper` (the keeper's phase from the scene: `idle`, `diving`, `caught` or `beaten`).
 *
 * Help (T040, FR-024): from help step 1 a line above the typed number (`data-testid="help-text"`) names the way from
 * the closest hint number to the target ("Von 36 eine Reihe runter: +10"); at step 3 it says the answer.
 * The overlay lets taps through to the canvas except on its buttons.
 */
import type { ReactNode } from 'react';
import { ballKind, layoutChart } from '../core/chart/layout';
import { START_HEARTS, type MatchMessage, type MatchState } from '../core/match/MatchController';
import { ANSWER_STEP, HINT_STEP, helpHint } from '../core/match/help';
import { STARTER } from '../core/rewards/items';
import type { Settings } from '../core/settings/schema';
import type { KeeperPhase } from '../game/KeeperView';
import { t } from '../i18n';

/** German text of a match message. */
export function messageText(message: MatchMessage | null): string {
  const f = t().feedback;
  if (message === null) return '';
  switch (message.kind) {
    case 'outOfRange':
      return f.outOfRange(message.min, message.max);
    case 'goal':
      return f.goal;
    case 'correctSquare':
      return f.correctSquare;
    case 'miss':
      return f.miss(message.number);
    case 'heartLost':
      return f.heartLost;
  }
}

/** The help line for the help step: the hint from step 1, the answer at step 3, or '' without help. */
export function helpText(state: Pick<MatchState, 'helpStep' | 'target' | 'min' | 'max'>): string {
  const h = t().help;
  const target = state.target;
  if (!target || state.helpStep < HINT_STEP) return '';
  if (state.helpStep >= ANSWER_STEP) return h.answer(target.number);
  const hint = helpHint(layoutChart(state.min, state.max), target);
  if (!hint) return '';
  return hint.direction ? h.fromNeighbor(hint.from, h.direction[hint.direction]) : h.fromHint(hint.from, hint.offset);
}

/** Minutes and two-digit seconds, "5:40". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

interface Props {
  state: MatchState;
  /** The keeper's phase from the scene; shown in goalkeeper mode only. */
  keeper?: KeeperPhase;
  /** The chosen ball design id from the locker room (`data-ball`). */
  ball?: string;
  settings: Pick<Settings, 'goalsPerRound' | 'showClock'>;
  /** The parent gate's gear (T041), at the end of the top buttons. */
  gear?: ReactNode;
  onHelp: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function MatchOverlay({ state, keeper = 'idle', ball = STARTER.ball, settings, gear, onHelp, onPause, onResume }: Props) {
  const text = t();
  const layout = layoutChart(state.min, state.max);
  const help = helpText(state);
  const goals = state.roundType === 'goalCount' ? text.match.goalsOf(state.goals, settings.goalsPerRound) : text.match.goals(state.goals);
  return (
    <div
      className="overlay"
      data-testid="match"
      data-target={state.target?.number ?? ''}
      data-phase={state.phase}
      data-help={state.helpStep}
      data-help-chart={state.helpChartOpen ? 'open' : 'closed'}
      data-goals={state.goals}
      data-hearts={state.hearts}
      data-rows={layout.rows}
      data-ball={ball}
      data-ball-kind={ballKind(layout)}
      data-line={state.line?.squares.join(',') ?? ''}
      data-line-index={state.line?.index ?? ''}
      data-keeper={state.mode === 'keeper' ? keeper : undefined}
    >
      <div className="overlay-top">
        <div className="overlay-status">
          <span className="goal-count" data-testid="goal-count">
            {goals}
          </span>
          {state.roundType === 'untilHearts' && (
            <span className="hearts" data-testid="hearts" role="img" aria-label={text.match.hearts(state.hearts)}>
              {Array.from({ length: START_HEARTS }, (_, i) => (
                <span key={i} className={i < state.hearts ? 'heart' : 'heart heart-gone'} aria-hidden="true" />
              ))}
            </span>
          )}
          {settings.showClock && (
            <span className="clock" data-testid="clock">
              {formatClock(state.elapsedMs)}
            </span>
          )}
        </div>
        <div className="overlay-buttons">
          <button type="button" className="icon-button" aria-label={text.match.help} data-testid="help-button" onClick={onHelp}>
            ?
          </button>
          {state.paused ? (
            <button type="button" className="icon-button" aria-label={text.match.resume} onClick={onResume}>
              <span aria-hidden="true">▶</span>
            </button>
          ) : (
            <button type="button" className="icon-button" aria-label={text.match.pause} onClick={onPause}>
              <span aria-hidden="true">❚❚</span>
            </button>
          )}
          {gear}
        </div>
      </div>
      <div className="overlay-bottom">
        {help !== '' && (
          <p className="help-text" data-testid="help-text" aria-live="polite">
            {help}
          </p>
        )}
        <output className="entry" data-testid="entry" aria-label={text.match.entryLabel}>
          {state.entry}
        </output>
        <p className="message" data-testid="message" aria-live="polite">
          {state.paused ? text.match.paused : messageText(state.message)}
        </p>
      </div>
    </div>
  );
}

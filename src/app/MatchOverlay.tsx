/**
 * The React overlay over the match scene (contracts/screens.md "Match"): the goal counter, the hearts as three balls
 * (with "Bis die Bälle weg sind"), the clock when the parent turned it on (in a time challenge the countdown instead), the help button and the pause button at the
 * top; the typed number (`data-testid="entry"`) and the message line (`data-testid="message"`) at the bottom.
 *
 * For the end-to-end tests, `data-testid="match"` carries the controller state: `data-target`, `data-phase`,
 * `data-help`, `data-help-chart`, `data-goals`, `data-hearts`, `data-pattern` (the target's hint pattern), `data-level`
 * (the target's difficulty level, amendment 09) and
 * `data-hints` (its hint numbers), `data-queue` (the empty squares of a shape still to shoot after it), plus
 * `data-round-type` (untilHearts, goalCount or time), `data-rows` (chart rows), `data-ball` (the ball design from the locker room, for example `ball.gold`), `data-ball-kind` (soccer, tennis or pingpong, from the chart size) and `data-keeper` (the
 * keeper's phase from the scene: `idle`, `diving`, `caught` or `beaten`).
 *
 * Help (T040, T096, FR-024, FR-094): from help step 1 a line above the typed number (`data-testid="help-text"`) names
 * the way from the closest hint number to the target ("Von 36 eine Reihe runter: +10") and the target's row ("Die Zahl
 * ist in der Reihe 40"); from step 2 also its column ("und in der Spalte 6"); at step 4 it says the answer.
 * `data-help-row` and `data-help-col` carry the lit row and column labels, empty while none is lit.
 * The overlay lets taps through to the canvas except on its buttons.
 *
 * Locker room from the match (amendment 01, FR-049, as math-tank amendment 23): with `onLockerRoom` (the locker room is
 * on) a shirt icon with the accessible name "Kabine" sits next to the gear, at the same size. One tap opens the locker
 * room over the match. The icon never takes focus, so keys cannot press it, and it does not show on the round end.
 * `data-shirt` carries the chosen shirt color id for tests.
 *
 * Polish (T061 to T063): with `pad` the on-screen number pad (NumberPad.tsx, FR-031) shows at the bottom and
 * `data-number-pad` is true. With `onSpeak` ("Vorlesen" on and a German voice, FR-032) a speaker icon reads the task
 * again. The fullscreen icon (FR-033) shows where the browser lets a page use fullscreen. Like the locker room icon,
 * these icons never take focus, so Enter and Space keep shooting.
 */
import { memo, type ReactNode } from 'react';
import { ballKind, cellOf, layoutChart } from '../core/chart/layout';
import { START_HEARTS, type MatchMessage, type MatchView } from '../core/match/MatchController';
import { ANSWER_STEP, columnLabel, COLUMN_STEP, HINT_STEP, helpHint, rowColumnHelp, rowLabel } from '../core/match/help';
import { STARTER } from '../core/rewards/items';
import type { Settings } from '../core/settings/schema';
import type { Digit } from '../core/match/entry';
import type { KeeperPhase } from '../game/KeeperView';
import { t } from '../i18n';
import { noFocus } from './noFocus';
import { NumberPad } from './NumberPad';
import { useElapsedMs, type ClockSource } from './useController';
import { requestFullscreen } from './StartScreen';


/** German text of a match message. */
export function messageText(message: MatchMessage | null): string {
  const f = t().feedback;
  if (message === null) return '';
  switch (message.kind) {
    case 'outOfRange':
      return f.outOfRange(message.min, message.max);
    case 'goal':
      return f.goal;
    case 'levelUp':
      return f.levelUp(t().levels.names[message.level]);
    case 'miss':
      return f.miss(message.number);
    case 'heartLost':
      return f.heartLost;
  }
}

/**
 * The help line for the help step: from step 1 the hint and the row, from step 2 also the column, the answer at step 4,
 * or '' without help.
 */
export function helpText(state: Pick<MatchView, 'helpStep' | 'target' | 'min' | 'max'>): string {
  const h = t().help;
  const target = state.target;
  if (!target || state.helpStep < HINT_STEP) return '';
  if (state.helpStep >= ANSWER_STEP) return h.answer(target.number);
  const layout = layoutChart(state.min, state.max);
  const hint = helpHint(layout, target);
  const way = hint ? (hint.direction ? h.fromNeighbor(hint.from, h.direction[hint.direction]) : h.fromHint(hint.from, hint.offset)) : '';
  const { row, col } = cellOf(layout, target.number);
  const place = state.helpStep >= COLUMN_STEP ? h.inRowAndColumn(rowLabel(layout, row), columnLabel(col)) : h.inRow(rowLabel(layout, row));
  return way ? `${way}. ${place}.` : `${place}.`;
}

/** The lit row and column labels for `data-help-row` and `data-help-col`; '' while none is lit. */
export function litLabels(state: Pick<MatchView, 'helpStep' | 'target' | 'min' | 'max'>): { row: string; col: string } {
  const target = state.target;
  if (!target) return { row: '', col: '' };
  const layout = layoutChart(state.min, state.max);
  const { litRow, litColumn } = rowColumnHelp(layout, target, state.helpStep, false);
  return {
    row: litRow === null ? '' : String(rowLabel(layout, litRow)),
    col: litColumn === null ? '' : String(columnLabel(litColumn)),
  };
}

/** Minutes and two-digit seconds, "5:40". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

interface Props {
  state: MatchView;
  /** The help line of `state` when the caller already has it; computed from `state` otherwise. */
  help?: string;
  /** Where the clock reads the time played, so a tick re-renders only the clock; `state.elapsedMs` otherwise. */
  clock?: ClockSource;
  /** The keeper's phase from the scene; shown in goalkeeper mode only. */
  keeper?: KeeperPhase;
  /** The chosen ball design id from the locker room (`data-ball`). */
  ball?: string;
  settings: Pick<Settings, 'goalsPerRound' | 'showClock'>;
  /** The chosen shirt color id from the locker room (`data-shirt`). */
  shirt?: string;
  /** The parent gate's gear (T041), at the end of the top buttons. */
  gear?: ReactNode;
  /** Opens the locker room over the match (FR-049); the icon shows only when this is given. */
  onLockerRoom?: () => void;
  /** The on-screen number pad's keys; the pad shows only when this is given (FR-031). */
  pad?: { onDigit: (d: Digit) => void; onBackspace: () => void; onShoot: () => void };
  /** Reads the task aloud again; the speaker icon shows only when this is given (FR-032). */
  onSpeak?: () => void;
  onHelp: () => void;
  onPause: () => void;
  onResume: () => void;
}

export const MatchOverlay = memo(function MatchOverlay({
  state,
  help = helpText(state),
  clock,
  keeper = 'idle',
  ball = STARTER.ball,
  shirt = STARTER.shirt,
  settings,
  gear,
  onLockerRoom,
  pad,
  onSpeak,
  onHelp,
  onPause,
  onResume,
}: Props) {
  const text = t();
  const canFullscreen = document.fullscreenEnabled === true;
  const layout = layoutChart(state.min, state.max);
  const lit = litLabels(state);
  const goals = state.roundType === 'goalCount' ? text.match.goalsOf(state.goals, settings.goalsPerRound) : text.match.goals(state.goals);
  return (
    <div
      className="overlay"
      data-testid="match"
      data-target={state.target?.number ?? ''}
      data-phase={state.phase}
      data-help={state.helpStep}
      data-help-chart={state.helpChartOpen ? 'open' : 'closed'}
      data-help-row={lit.row}
      data-help-col={lit.col}
      data-goals={state.goals}
      data-hearts={state.hearts}
      data-rows={layout.rows}
      data-ball={ball}
      data-shirt={shirt}
      data-ball-kind={ballKind(layout)}
      data-pattern={state.target?.pattern ?? ''}
      data-level={state.target?.level ?? ''}
      data-hints={state.target?.hints.join(',') ?? ''}
      data-round-type={state.roundType}
      data-queue={state.target?.queue?.map((q) => q.number).join(',') ?? ''}
      data-keeper={keeper}
      data-number-pad={pad !== undefined}
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
          {state.challengeMinutes !== null ? (
            <Countdown totalMs={state.challengeMinutes * 60_000} source={clock ?? { subscribe: noSubscribe, elapsedMs: () => state.elapsedMs }} />
          ) : (
            settings.showClock && <Clock source={clock ?? { subscribe: noSubscribe, elapsedMs: () => state.elapsedMs }} />
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
          {onSpeak && (
            <button type="button" className="icon-button" data-testid="speaker-button" aria-label={text.match.speaker} title={text.match.speaker} {...noFocus} onClick={onSpeak}>
              <span aria-hidden="true">🔊</span>
            </button>
          )}
          {canFullscreen && (
            <button
              type="button"
              className="icon-button"
              data-testid="match-fullscreen"
              aria-label={text.match.fullscreen}
              title={text.match.fullscreen}
              {...noFocus}
              onClick={requestFullscreen}
            >
              <span aria-hidden="true">⛶</span>
            </button>
          )}
          {onLockerRoom && state.phase !== 'roundOver' && (
            <button
              type="button"
              className="icon-button locker-room-button"
              data-testid="match-locker-room"
              aria-label={text.match.lockerRoom}
              title={text.match.lockerRoom}
              {...noFocus}
              onClick={onLockerRoom}
            >
              <ShirtIcon />
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
      {pad && <NumberPad disabled={state.paused || state.phase !== 'aiming'} onDigit={pad.onDigit} onBackspace={pad.onBackspace} onShoot={pad.onShoot} />}
    </div>
  );
});

const noSubscribe = () => () => {};

/** The time played; it re-renders on its own when the source ticks. */
function Clock({ source }: { source: ClockSource }) {
  return (
    <span className="clock" data-testid="clock">
      {formatClock(useElapsedMs(source))}
    </span>
  );
}

/** The countdown shows its last seconds in kit yellow, with a gentle pulse (FR-081). */
export const LAST_SECONDS_MS = 10_000;

/**
 * The countdown of a time challenge (FR-077, FR-081): the time left, rounded up to whole seconds, so it shows 0:00
 * only at the end. In the last 10 seconds it turns kit yellow and pulses gently (`data-last="true"`); no red, no sound.
 */
function Countdown({ totalMs, source }: { totalMs: number; source: ClockSource }) {
  const left = Math.max(0, totalMs - useElapsedMs(source));
  const last = left <= LAST_SECONDS_MS;
  return (
    <span className={last ? 'clock countdown countdown-last' : 'clock countdown'} data-testid="countdown" data-last={last} data-left={Math.ceil(left / 1000)}>
      {formatClock(Math.ceil(left / 1000) * 1000)}
    </span>
  );
}

/** A plain shirt outline for the locker room button. */
function ShirtIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11 4 L4 8 L7 14 L10 12 L10 28 L22 28 L22 12 L25 14 L28 8 L21 4 Q16 9 11 4 Z" fill="currentColor" />
    </svg>
  );
}

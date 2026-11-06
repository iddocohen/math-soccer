/**
 * The React overlay over the match scene (contracts/screens.md "Match"): the goal counter, the hearts as three balls
 * (with "Bis die Bälle weg sind"), the clock when the parent turned it on (in a time challenge the countdown instead), the help button and the pause button at the
 * top; the typed number (`data-testid="entry"`) and the message line (`data-testid="message"`) at the bottom, right of
 * the ball at the kick spot, so they never lie over the player standing to its lower left (amendment 08). Before the
 * child types, the number box shows a faint "?" (FR-100).
 *
 * For the end-to-end tests, `data-testid="match"` carries the controller state: `data-target`, `data-phase`,
 * `data-help`, `data-help-chart`, `data-goals`, `data-hearts`, `data-pattern` (the target's hint pattern), `data-level`
 * (the target's difficulty level, amendment 09) and
 * `data-hints` (its hint numbers), `data-queue` (the empty squares of a shape still to shoot after it), plus
 * `data-round-type` (untilHearts, goalCount or time), `data-rows` (chart rows), `data-ball` (the ball design from the locker room, for example `ball.gold`), `data-ball-kind` (soccer, tennis or pingpong, from the chart size) and `data-keeper` (the
 * keeper's phase from the scene: `idle`, `diving`, `caught` or `beaten`).
 *
 * Help (T040, T096, FR-024, FR-094): the overlay shows no help sentence (amendment 14, FR-119); help shows in the scene
 * as arrows, bands, scales, the hint arrow and the answer, and in the help chart.
 * `data-help-row` and `data-help-col` carry the lit row and column labels, empty while none is lit. `data-scales` says
 * which scales the scene draws (amendment 14, FR-115): `none`, `row` or `both`.
 * The overlay lets taps through to the canvas except on its buttons.
 *
 * Locker room from the match (amendment 01, FR-049, as math-tank amendment 23): with `onLockerRoom` (the locker room is
 * on) a shirt icon with the accessible name "Kabine" sits next to the gear, at the same size. One tap opens the locker
 * room over the match. The icon never takes focus, so keys cannot press it, and it does not show on the round end.
 * `data-shirt` carries the chosen shirt color id for tests.
 *
 * Home (amendment 14, FR-116): with `onHome` a house icon with the accessible name "Zum Start" sits next to pause. One
 * tap pauses the round and the app asks "Runde beenden?" (PauseScreen.tsx). The icon never takes focus.
 *
 * Polish (T061 to T063): with `pad` the on-screen number pad (NumberPad.tsx, FR-031) shows at the bottom and
 * `data-number-pad` is true. With `onSpeak` ("Vorlesen" on and a German voice, FR-032) a speaker icon reads the task
 * again. The fullscreen icon (FR-033) shows where the browser lets a page use fullscreen. Like the locker room icon,
 * these icons never take focus, so Enter and Space keep shooting.
 */
import { memo, type CSSProperties, type ReactNode } from 'react';
import { ballKind, layoutChart } from '../core/chart/layout';
import { START_HEARTS, type MatchMessage, type MatchView } from '../core/match/MatchController';
import { columnLabel, rowColumnHelp, rowLabel, scalesShown } from '../core/match/help';
import { STARTER } from '../core/rewards/items';
import type { Settings } from '../core/settings/schema';
import type { Digit } from '../core/match/entry';
import type { KeeperPhase } from '../game/KeeperView';
import { t } from '../i18n';
import { noFocus } from './noFocus';
import { NumberPad } from './NumberPad';
import { useElapsedMs, type ClockSource } from './useController';
import { requestFullscreen } from './StartScreen';
import { OVERLAY_LEFT, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';

/**
 * The world size and where the bottom lines start, for the CSS that places them right of the ball and the player
 * (amendment 08): `.overlay-bottom` turns world x into screen pixels with the canvas scale.
 */
const WORLD_STYLE = {
  '--world-w': WORLD_WIDTH,
  '--world-h': WORLD_HEIGHT,
  '--overlay-left': OVERLAY_LEFT - WORLD_WIDTH / 2,
} as CSSProperties;

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

/** True once the ball scored the current target, while the goal is celebrated: the scales are gone (FR-115). */
export function targetSolved(state: Pick<MatchView, 'ball'>): boolean {
  return state.ball?.outcome === 'goal';
}

/** The lit row and column labels for `data-help-row` and `data-help-col`; '' while none is lit. */
export function litLabels(state: Pick<MatchView, 'helpStep' | 'target' | 'min' | 'max' | 'ball'>): { row: string; col: string } {
  const target = state.target;
  if (!target) return { row: '', col: '' };
  const layout = layoutChart(state.min, state.max);
  const { litRow, litColumn } = rowColumnHelp(layout, target, state.helpStep, false, targetSolved(state));
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
  /** The home button (FR-116): pauses and asks "Runde beenden?"; the button shows only when this is given. */
  onHome?: () => void;
}

export const MatchOverlay = memo(function MatchOverlay({
  state,
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
  onHome,
}: Props) {
  const text = t();
  const canFullscreen = document.fullscreenEnabled === true;
  const layout = layoutChart(state.min, state.max);
  const lit = litLabels(state);
  const goals = state.roundType === 'goalCount' ? text.match.goalsOf(state.goals, settings.goalsPerRound) : text.match.goals(state.goals);
  return (
    <div
      className="overlay"
      style={WORLD_STYLE}
      data-testid="match"
      data-target={state.target?.number ?? ''}
      data-phase={state.phase}
      data-help={state.helpStep}
      data-help-chart={state.helpChartOpen ? 'open' : 'closed'}
      data-help-row={lit.row}
      data-help-col={lit.col}
      data-scales={scalesShown(state.helpStep, targetSolved(state))}
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
          {onHome && state.phase !== 'roundOver' && (
            <button type="button" className="icon-button" data-testid="home-button" aria-label={text.match.home} title={text.match.home} {...noFocus} onClick={onHome}>
              <HouseIcon />
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
        <div className="shot-line">
          {/* Empty, the box shows a faint "?" from the CSS (FR-100). */}
          <output className="entry" data-testid="entry" aria-label={text.match.entryLabel}>
            {state.entry}
          </output>
          <p className="message" data-testid="message" aria-live="polite">
            {state.paused ? text.match.paused : messageText(state.message)}
          </p>
        </div>
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

/** A plain house for the home button (FR-116). */
function HouseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 4 L3 15 L7 15 L7 28 L13 28 L13 20 L19 20 L19 28 L25 28 L25 15 L29 15 Z" fill="currentColor" />
    </svg>
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

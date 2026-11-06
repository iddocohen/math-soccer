// Structure adapted from math-tank src/app/App.tsx.
/**
 * The app shell (T022): the start screen, the match with the Phaser canvas under a React overlay, and the round end
 * over the match. The screens here are placeholders that US1 replaces: StartScreen.tsx and MatchOverlay.tsx (T034),
 * RoundEnd.tsx (T035) and MatchScene.ts (T033).
 *
 * Phaser loads in its own chunk when a match starts, so the start screen shows quickly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSfx } from '../audio/sfx';
import { MatchController, type MatchMessage } from '../core/match/MatchController';
import type { Settings } from '../core/settings/schema';
import { localStorageKeyValue } from '../core/storage/keyValue';
import { loadSettings } from '../core/storage/storage';
import { MODES, type Mode } from '../core/types';
import { t } from '../i18n';
import type { GameHandle } from '../game/createGame';
import type { KeyAction, KeyScreen } from './keyboard';
import { useMatchState } from './useController';
import { applyMatchAction, useKeyboard } from './useKeyboard';

type Screen = 'start' | 'match';

/** Placeholder timings until MatchScene drives the ball and the celebration (T033). */
const FLIGHT_MS = 800;
const CELEBRATION_MS = 1400;

function loadGame(): Promise<typeof import('../game/createGame')> {
  return import('../game/createGame');
}

function createApp() {
  // The settings page (US3) will replace this snapshot when the parent saves.
  const settings: Settings = loadSettings(localStorageKeyValue()).value;
  const controller = new MatchController({ settings: () => settings });
  const sfx = createSfx({ sound: () => settings.sound });
  return { controller, sfx, settings: () => settings };
}

/** German text of a match message. */
function messageText(message: MatchMessage | null): string {
  const f = t().feedback;
  if (message === null) return '';
  switch (message.kind) {
    case 'outOfRange':
      return f.outOfRange(message.min, message.max);
    case 'goal':
      return f.goal;
    case 'miss':
      return f.miss(message.number);
  }
}

export function App() {
  const [{ controller, sfx, settings }] = useState(createApp);
  const [screen, setScreen] = useState<Screen>('start');
  const state = useMatchState(controller);
  const gameParent = useRef<HTMLDivElement>(null);
  const offered: Mode[] = MODES.filter((m) => settings().modes[m]);
  const text = t();

  // Sound starts after the first key or tap (spec edge case "Sound blocked by the browser").
  useEffect(() => sfx.installUnlock(document), [sfx]);

  useEffect(() => {
    const parent = gameParent.current;
    if (screen !== 'match' || !parent) return;
    let handle: GameHandle | null = null;
    let left = false;
    loadGame().then(
      ({ createGame }) => {
        if (!left) handle = createGame(parent);
      },
      // Without the game chunk no ball can fly, so the round could not go on: back to the start screen.
      () => {
        if (!left) setScreen('start');
      },
    );
    return () => {
      left = true;
      handle?.destroy();
    };
  }, [screen]);

  // Placeholder for MatchScene (T033): the ball lands and the celebration ends after fixed times.
  useEffect(() => {
    if (screen !== 'match' || state.paused) return;
    if (state.phase === 'ballInFlight') {
      const id = window.setTimeout(() => controller.ballLanded(), FLIGHT_MS);
      return () => window.clearTimeout(id);
    }
    if (state.phase === 'celebrating') {
      const id = window.setTimeout(() => controller.celebrationDone(), CELEBRATION_MS);
      return () => window.clearTimeout(id);
    }
  }, [screen, state.phase, state.paused, controller]);

  const startMatch = useCallback(
    (mode: Mode) => {
      controller.start(mode);
      setScreen('match');
    },
    [controller],
  );

  const roundOver = screen === 'match' && state.phase === 'roundOver';
  const keyScreen: KeyScreen = screen === 'start' ? 'start' : roundOver ? 'roundEnd' : state.paused ? 'paused' : 'match';

  const onAction = (action: KeyAction) => {
    if (action.type === 'start') startMatch(action.mode);
    else if (action.type === 'again') startMatch(state.mode);
    else if (action.type !== 'lockerRoom') applyMatchAction(controller, action);
  };
  useKeyboard({ screen: keyScreen, modes: offered, lockerRoom: settings().lockerRoom, onAction });

  if (screen === 'start') {
    return (
      <main className="start" lang="de" data-testid="start">
        <h1 className="start-title">{text.appName}</h1>
        <div className="start-modes">
          {offered.map((mode) => (
            <button key={mode} type="button" className="mode-button" data-mode={mode} onClick={() => startMatch(mode)}>
              <span className="mode-key">{MODES.indexOf(mode) + 1}</span>
              {text.start.modes[mode]}
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="match" lang="de">
      <div className="game-parent" ref={gameParent} />
      <div
        className="overlay"
        data-testid="match"
        data-target={state.target?.number ?? ''}
        data-phase={state.phase}
        data-help={state.helpStep}
        data-goals={state.goals}
        data-hearts={state.hearts}
      >
        <div className="overlay-top">
          <span className="goal-count">{text.match.goals(state.goals)}</span>
        </div>
        <div className="overlay-bottom">
          <output className="entry" data-testid="entry" aria-label={text.match.entryLabel}>
            {state.entry}
          </output>
          <p className="message" data-testid="message" aria-live="polite">
            {state.paused ? text.match.paused : messageText(state.message)}
          </p>
        </div>
      </div>
      {roundOver && (
        <div className="round-end" data-testid="round-end">
          <h2>{text.roundEnd.cheer}</h2>
          <p>{text.roundEnd.summary(state.goals, state.elapsedMs)}</p>
          <div className="round-end-buttons">
            <button type="button" className="primary" onClick={() => startMatch(state.mode)}>
              {text.roundEnd.again}
            </button>
            <button type="button" onClick={() => setScreen('start')}>
              {text.roundEnd.back}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

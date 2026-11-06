// Structure adapted from math-tank src/app/App.tsx.
/**
 * The app shell (T022): the start screen (StartScreen.tsx), the match with the Phaser canvas (MatchScene.ts) under a
 * React overlay (MatchOverlay.tsx), and the round end over the match (RoundEnd.tsx). The scene tells the controller
 * when the ball lands and when the celebration ends. When a round ends, its result goes to the personal bests (FR-028).
 *
 * Phaser loads in its own chunk when a match starts, so the start screen shows quickly. A round stored before a refresh
 * continues on load (T029). Test query parameters: `?mode=` makes Enter and Space start that mode, `?seed=` fixes the
 * round seed (contracts/screens.md).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSfx } from '../audio/sfx';
import { MatchController, type MatchState, type RoundStore } from '../core/match/MatchController';
import { recordKey, submitResult } from '../core/records/records';
import type { Settings } from '../core/settings/schema';
import { localStorageKeyValue, type KeyValue } from '../core/storage/keyValue';
import { clearRound, loadRecords, loadRound, loadSettings, saveRecords, saveRound } from '../core/storage/storage';
import { MODES, type Mode } from '../core/types';
import type { GameHandle } from '../game/createGame';
import type { KeyAction, KeyScreen } from './keyboard';
import { MatchOverlay } from './MatchOverlay';
import { RoundEnd, type RoundRecord } from './RoundEnd';
import { StartScreen } from './StartScreen';
import { useMatchState } from './useController';
import { applyMatchAction, useKeyboard } from './useKeyboard';

type Screen = 'start' | 'match';

function loadGame(): Promise<typeof import('../game/createGame')> {
  return import('../game/createGame');
}

/**
 * How often the app adds time played to the round (FR-029). Every tick is a new state and a React render, so the
 * clock ticks four times a second, not every frame.
 */
const TICK_MS = 250;

/** The `seed` query parameter as a non-negative integer, or undefined (as math-tank). */
export function seedFromUrl(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^\d{1,10}$/.test(raw)) return undefined;
  return Number(raw) >>> 0;
}

/** The `mode` query parameter when it names a mode, or undefined. */
export function modeFromUrl(search: string): Mode | undefined {
  const raw = new URLSearchParams(search).get('mode');
  return MODES.find((m) => m === raw);
}

function createApp() {
  const kv = localStorageKeyValue();
  // The settings page (US3) will replace this snapshot when the parent saves.
  const settings: Settings = loadSettings(kv).value;
  const store: RoundStore = {
    load: () => loadRound(kv).value,
    save: (round) => void saveRound(kv, round),
    clear: () => void clearRound(kv),
  };
  const seed = seedFromUrl(window.location.search);
  const controller = new MatchController({ settings: () => settings, store, newSeed: seed === undefined ? undefined : () => seed });
  const sfx = createSfx({ sound: () => settings.sound });
  // A round stored before a refresh continues (T029); one that no longer fits the settings is discarded (FR-036a).
  const restored = controller.restore();
  return { kv, controller, sfx, settings: () => settings, restored };
}

/** Stores the result of a finished round with the personal bests; null when the parent hides records (FR-028). */
function recordRound(kv: KeyValue, s: MatchState, showRecords: boolean): RoundRecord | null {
  const key = recordKey(s.min, s.max, s.mode, s.roundType);
  const outcome = submitResult(loadRecords(kv).value, key, { goals: s.goals, timeMs: s.elapsedMs, at: new Date().toISOString() });
  if (outcome.newRecord) saveRecords(kv, outcome.records);
  return showRecords ? { newRecord: outcome.newRecord, best: outcome.best } : null;
}

export function App() {
  const [{ kv, controller, sfx, settings, restored }] = useState(createApp);
  const [screen, setScreen] = useState<Screen>(restored ? 'match' : 'start');
  const state = useMatchState(controller);
  const gameParent = useRef<HTMLDivElement>(null);
  const offered: Mode[] = MODES.filter((m) => settings().modes[m]);
  const [record, setRecord] = useState<RoundRecord | null>(null);
  const lastPhase = useRef(state.phase);

  // Sound starts after the first key or tap (spec edge case "Sound blocked by the browser").
  useEffect(() => sfx.installUnlock(document), [sfx]);

  useEffect(() => {
    const parent = gameParent.current;
    if (screen !== 'match' || !parent) return;
    let handle: GameHandle | null = null;
    let left = false;
    loadGame().then(
      ({ createGame }) => {
        if (!left) handle = createGame(parent, controller, { sounds: sfx, settings });
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
  }, [screen, controller, sfx, settings]);

  // A round that just ended goes to the personal bests, once (FR-028).
  useEffect(() => {
    const before = lastPhase.current;
    lastPhase.current = state.phase;
    if (state.phase !== 'roundOver' || before === 'roundOver' || !state.started) return;
    setRecord(recordRound(kv, controller.getState(), settings().showRecords));
  }, [state.phase, state.started, kv, controller, settings]);

  // Time played runs while the match shows and the tab is visible (FR-029); the controller stops it while paused.
  useEffect(() => {
    if (screen !== 'match') return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden) controller.tick(now - last);
      last = now;
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [screen, controller]);

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
  useKeyboard({ screen: keyScreen, modes: offered, lockerRoom: settings().lockerRoom, enterMode: modeFromUrl(window.location.search), onAction });

  if (screen === 'start') return <StartScreen modes={offered} onPlay={startMatch} />;

  return (
    <main className="match" lang="de">
      <div className="game-parent" ref={gameParent} />
      <MatchOverlay
        state={state}
        settings={settings()}
        onHelp={() => controller.askHelp()}
        onPause={() => controller.pause()}
        onResume={() => controller.resume()}
      />
      {roundOver && (
        <RoundEnd
          goals={state.goals}
          elapsedMs={state.elapsedMs}
          roundType={state.roundType}
          record={record}
          onAgain={() => startMatch(state.mode)}
          onBack={() => setScreen('start')}
        />
      )}
    </main>
  );
}

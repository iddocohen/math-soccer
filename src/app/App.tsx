// Structure adapted from math-tank src/app/App.tsx.
/**
 * The app shell (T022): the start screen (StartScreen.tsx), the match with the Phaser canvas (MatchScene.ts) under a
 * React overlay (MatchOverlay.tsx), and the round end over the match (RoundEnd.tsx). The scene tells the controller
 * when the ball lands and when the celebration ends. When a round ends, its result goes to the personal bests (FR-028).
 *
 * Phaser loads in its own chunk when a match starts, so the start screen shows quickly. A round stored before a refresh
 * continues on load (T029). Test query parameters: `?mode=` makes Enter and Space start that mode, `?seed=` fixes the
 * round seed (contracts/screens.md).
 *
 * Parent screens (US3, FR-034): the gear on the start screen and in the match opens the parent menu after a 2-second
 * press. While the menu, the settings page or the progress page is open, a running round pauses (useAutoPause) and keys
 * do nothing in the game. Settings saved during a round reach it once, when the settings page closes after one or more
 * saves (amendment 01, FR-052, MatchController.applySettings); on the start screen, the locker room and the round end
 * the next round uses them. Every finished target goes to the progress
 * (T043), and target selection reads the adaptive steps and mastered directions from it (FR-040).
 *
 * Transfer (FR-041, as math-tank): when the page opens with `#save=` in the address, the code is decoded and
 * TransferDialog asks the parent; "Übernehmen" (a 2-second hold) replaces the settings, progress, personal bests and
 * locker room. The fragment is removed after the dialog closes, unless storing failed, so a reload asks again.
 *
 * Stars and the locker room (US6, FR-042 to FR-044): every star the controller adds to `starsThisRound` goes to the
 * locker room balance at once, so a refresh loses none; a restored round's stars were awarded before the refresh and
 * are not awarded again. The locker room opens from the start screen ("Kabine" or K) when the parent turned it on, and
 * the scene draws the chosen look.
 *
 * Locker room from the match (amendment 01, FR-049, as math-tank amendment 23): with the locker room on, a "Kabine" icon
 * next to the gear opens the locker room over the match with one tap. The match stays loaded underneath; a running
 * round pauses through useAutoPause and the game keys do nothing while it is open. "Zurück" or Escape closes it, the
 * round continues (a round the child paused stays paused) and the chosen look shows at once.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '../core/settings/schema';
import { createSfx } from '../audio/sfx';
import { MatchController, type MatchState, type RoundStore } from '../core/match/MatchController';
import { targetProgress } from '../core/progress/adaptive';
import { recordKey, submitResult } from '../core/records/records';
import { lookOf, newStars } from '../core/rewards/lockerRoom';
import { localStorageKeyValue } from '../core/storage/keyValue';
import { clearRound, loadRound, saveRound } from '../core/storage/storage';
import { decodeTransfer, saveCodeFromHash, type SaveData } from '../core/transfer/transfer';
import { MODES, type Mode } from '../core/types';
import type { GameHandle } from '../game/createGame';
import type { KeeperPhase } from '../game/KeeperView';
import type { KeyAction, KeyScreen } from './keyboard';
import { HelpChart } from './HelpChart';
import { LockerRoom } from './LockerRoom';
import { MatchOverlay } from './MatchOverlay';
import { ParentGate } from './ParentGate';
import { createPersistence, type Persistence } from './persistence';
import { ProgressPage } from './ProgressPage';
import { RoundEnd, type RoundRecord } from './RoundEnd';
import { SettingsPage } from './SettingsPage';
import { StartScreen } from './StartScreen';
import { TransferDialog, type TransferDialogState } from './TransferDialog';
import { useAutoPause } from './useAutoPause';
import { useMatchState } from './useController';
import { applyMatchAction, useKeyboard } from './useKeyboard';

type Screen = 'start' | 'match' | 'lockerRoom';

/** The parent screens over the game: the parent menu, the settings page and the progress page. */
type ParentView = 'closed' | 'menu' | 'settings' | 'progress';

/** The transfer dialog while the code is read, then ready (with the decoded save), invalid or failed. */
type Transfer = { kind: 'reading' } | (TransferDialogState & { data?: SaveData });

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
  const persistence = createPersistence(kv);
  // Saved settings replace what persistence returns; the controller reads them on every start(), so they apply from
  // the next round.
  const settings = () => persistence.settings();
  const store: RoundStore = {
    load: () => loadRound(kv).value,
    save: (round) => void saveRound(kv, round),
    clear: () => void clearRound(kv),
  };
  const seed = seedFromUrl(window.location.search);
  const controller = new MatchController({
    settings,
    store,
    newSeed: seed === undefined ? undefined : () => seed,
    // The adaptive steps and mastered directions of the mode steer target selection (FR-040).
    progress: (mode) => targetProgress(persistence.progress(), mode, settings()),
    // One record per finished target (T043, FR-037).
    onAttempt: (record) => void persistence.recordAttempt(record, settings()),
  });
  const sfx = createSfx({ sound: () => settings().sound });
  // A round stored before a refresh continues (T029); one that no longer fits the settings is discarded (FR-036a).
  const restored = controller.restore();
  // Stars go to the locker room as soon as they are earned (FR-042). A restored round's stars were awarded before.
  let seenStars = controller.getState().starsThisRound;
  controller.subscribe(() => {
    const current = controller.getState().starsThisRound;
    const earned = newStars(seenStars, current);
    seenStars = current;
    if (earned > 0) persistence.awardStars(earned);
  });
  return { persistence, controller, sfx, settings, restored };
}

/** Stores the result of a finished round with the personal bests; null when the parent hides records (FR-028). */
function recordRound(persistence: Persistence, s: MatchState, showRecords: boolean): RoundRecord | null {
  const key = recordKey(s.min, s.max, s.mode, s.roundType);
  const outcome = submitResult(persistence.records(), key, { goals: s.goals, timeMs: s.elapsedMs, at: new Date().toISOString() });
  if (outcome.newRecord) persistence.saveRecords(outcome.records);
  return showRecords ? { newRecord: outcome.newRecord, best: outcome.best } : null;
}

/** Removes `#save=` from the address without a reload or a new history entry. */
function clearSaveHash(): void {
  if (saveCodeFromHash(window.location.hash) === null) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function App() {
  const [{ persistence, controller, sfx, settings, restored }] = useState(createApp);
  const [screen, setScreen] = useState<Screen>(restored ? 'match' : 'start');
  const [parent, setParent] = useState<ParentView>('closed');
  // Bumped after a save, an import or a transfer, so the start screen shows the new offered modes.
  const [, setDataVersion] = useState(0);
  const [transfer, setTransfer] = useState<Transfer | null>(() => (saveCodeFromHash(window.location.hash) === null ? null : { kind: 'reading' }));
  const state = useMatchState(controller);
  const gameParent = useRef<HTMLDivElement>(null);
  const offered: Mode[] = MODES.filter((m) => settings().modes[m]);
  const [record, setRecord] = useState<RoundRecord | null>(null);
  // The keeper's phase from the scene, shown as `data-keeper` in goalkeeper mode (T054).
  const [keeper, setKeeper] = useState<KeeperPhase>('idle');
  // The locker room opened from the match, over the running round (FR-049).
  const [lockerOpen, setLockerOpen] = useState(false);
  const gameHandle = useRef<GameHandle | null>(null);
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
        if (left) return;
        handle = createGame(parent, controller, {
          sounds: sfx,
          settings,
          onKeeper: setKeeper,
          look: () => lookOf(persistence.lockerRoom()),
        });
        gameHandle.current = handle;
      },
      // Without the game chunk no ball can fly, so the round could not go on: back to the start screen.
      () => {
        if (!left) setScreen('start');
      },
    );
    return () => {
      left = true;
      handle?.destroy();
      gameHandle.current = null;
    };
  }, [screen, controller, sfx, settings, persistence]);

  // A round that just ended goes to the personal bests, once (FR-028).
  useEffect(() => {
    const before = lastPhase.current;
    lastPhase.current = state.phase;
    if (state.phase !== 'roundOver' || before === 'roundOver' || !state.started) return;
    setRecord(recordRound(persistence, controller.getState(), settings().showRecords));
  }, [state.phase, state.started, persistence, controller, settings]);

  const lockerOn = settings().lockerRoom;
  const matchLocker = screen === 'match' && lockerOpen && lockerOn;

  // A running round pauses while a parent screen, the transfer dialog or the locker room is open (FR-034, FR-049).
  useAutoPause(controller, state.phase, screen === 'match' && (parent !== 'closed' || transfer !== null || matchLocker));

  // A save link: decode the code once on load (FR-041).
  useEffect(() => {
    const code = saveCodeFromHash(window.location.hash);
    if (code === null) return;
    let live = true;
    decodeTransfer(code).then(
      (r) => {
        if (live) setTransfer(r.ok ? { kind: 'ready', summary: r.summary, data: r.data } : { kind: 'invalid' });
      },
      () => {
        if (live) setTransfer({ kind: 'invalid' });
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const closeTransfer = useCallback(() => {
    setTransfer(null);
    clearSaveHash();
  }, []);
  const acceptTransfer = useCallback(() => {
    if (transfer?.kind !== 'ready' || !transfer.data) return closeTransfer();
    if (!persistence.applyTransfer(transfer.data).ok) {
      // Nothing was changed; `#save=` stays in the address, so a reload asks again.
      setTransfer({ kind: 'failed' });
      return;
    }
    setDataVersion((n) => n + 1);
    closeTransfer();
  }, [transfer, persistence, closeTransfer]);

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
  const gameScreen: KeyScreen =
    screen === 'start' ? 'start' : roundOver ? 'roundEnd' : state.paused ? 'paused' : state.helpChartOpen ? 'helpChart' : 'match';
  // While a parent screen or the transfer dialog is open, keys do nothing in the game (FR-034).
  // The locker room has its own keys (Escape back).
  const keyScreen: KeyScreen | null = parent === 'closed' && transfer === null && screen !== 'lockerRoom' && !matchLocker ? gameScreen : null;

  // Amendment 01 (FR-052): the latest settings saved while the settings page is open; they reach the running round
  // once, when the page closes. Several saves count as one change.
  const savedSettings = useRef<Settings | null>(null);
  const settingsSaved = useCallback((s: Settings) => {
    savedSettings.current = s;
    setDataVersion((n) => n + 1);
  }, []);
  const closeParent = useCallback(() => {
    setParent('closed');
    const saved = savedSettings.current;
    savedSettings.current = null;
    // The round is still paused by the settings page here; useAutoPause resumes it, and a round the child paused stays
    // paused with the new target.
    if (saved !== null && screen === 'match') controller.applySettings(saved);
  }, [controller, screen]);
  const gear = (
    <ParentGate
      open={parent === 'menu'}
      onOpen={() => setParent('menu')}
      onClose={closeParent}
      onSettings={() => setParent('settings')}
      onProgress={() => setParent('progress')}
    />
  );
  const parentScreens = (
    <>
      {parent === 'settings' && <SettingsPage persistence={persistence} onSaved={settingsSaved} onClose={closeParent} />}
      {parent === 'progress' && <ProgressPage persistence={persistence} onClose={closeParent} />}
      {transfer !== null && transfer.kind !== 'reading' && (
        <TransferDialog state={transfer} onAccept={acceptTransfer} onCancel={transfer.kind === 'failed' ? () => setTransfer(null) : closeTransfer} />
      )}
    </>
  );

  const onAction = (action: KeyAction) => {
    if (action.type === 'start') startMatch(action.mode);
    else if (action.type === 'again') startMatch(state.mode);
    else if (action.type === 'lockerRoom') setScreen('lockerRoom');
    else applyMatchAction(controller, action);
  };
  useKeyboard({ screen: keyScreen, modes: offered, lockerRoom: settings().lockerRoom, enterMode: modeFromUrl(window.location.search), onAction });

  const locker = persistence.lockerRoom();
  const saveLocker = (next: typeof locker) => {
    persistence.saveLockerRoom(next);
    setDataVersion((n) => n + 1);
  };
  const closeMatchLocker = () => {
    setLockerOpen(false);
    // The scene draws the look on every state change; a round the child paused has none, so it is shown here.
    gameHandle.current?.showLook();
  };

  if (screen === 'lockerRoom' && lockerOn) {
    return (
      <LockerRoom
        locker={locker}
        onChange={saveLocker}
        onBack={() => setScreen('start')}
      />
    );
  }

  if (screen !== 'match') {
    return (
      <>
        <StartScreen
          modes={offered}
          onPlay={startMatch}
          gear={gear}
          lockerRoom={lockerOn ? { stars: locker.stars, onOpen: () => setScreen('lockerRoom') } : null}
        />
        {parentScreens}
      </>
    );
  }

  return (
    <main className="match" lang="de">
      <div className="game-parent" ref={gameParent} />
      <MatchOverlay
        state={state}
        keeper={keeper}
        ball={locker.ball}
        shirt={locker.shirtColor}
        // Goals per round keep their round-start value (FR-052).
        settings={{ ...settings(), goalsPerRound: controller.getRoundSettings().goalsPerRound }}
        gear={gear}
        onLockerRoom={lockerOn ? () => setLockerOpen(true) : undefined}
        onHelp={() => controller.askHelp()}
        onPause={() => controller.pause()}
        onResume={() => controller.resume()}
      />
      {state.helpChartOpen && state.target && !state.paused && (
        <HelpChart
          min={state.min}
          max={state.max}
          target={state.target.number}
          lastGuess={state.lastGuess}
          onClose={() => controller.closeHelpChart()}
        />
      )}
      {roundOver && (
        <RoundEnd
          goals={state.goals}
          elapsedMs={state.elapsedMs}
          roundType={state.roundType}
          record={record}
          stars={lockerOn ? state.starsThisRound : null}
          onAgain={() => startMatch(state.mode)}
          onBack={() => setScreen('start')}
        />
      )}
      {matchLocker && <LockerRoom locker={locker} onChange={saveLocker} onBack={closeMatchLocker} />}
      {parentScreens}
    </main>
  );
}

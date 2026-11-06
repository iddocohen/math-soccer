// Structure adapted from math-tank src/app/App.tsx.
/**
 * The app shell (T022): the start screen (StartScreen.tsx), the match with the Phaser canvas (MatchScene.ts) under a
 * React overlay (MatchOverlay.tsx), and the round end over the match (RoundEnd.tsx). The scene tells the controller
 * when the ball lands and when the celebration ends. When a round ends, its result goes to the personal bests (FR-028).
 *
 * Phaser loads in its own chunk when a match starts, so the start screen shows quickly. A round stored before a refresh
 * continues on load (T029). Test query parameters: `?start=play|time` makes Enter and Space start that kind of round,
 * `?seed=` fixes the round seed (contracts/screens.md).
 *
 * Start (amendment 05, FR-068, FR-075): "Spielen" starts the goalkeeper game; "Zeit-Challenge" shows when the parent
 * allows it. Until the time round type exists (T092), it starts a normal round.
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
 *
 * Review fixes: a round restored after a refresh during the final goal's celebration ends at once, and its result still
 * goes to the personal bests (M2). Accepting a transfer during a match takes its settings into the round (M3, FR-052).
 * Attempts are recorded with the settings the round uses (M4). When a save during play fails, or stored data was reset on
 * load, the start screen shows a short note (M6, H5, FR-036); play is never interrupted.
 *
 * Polish (T061, T062): the number pad shows by the parent's setting (automatic: only without a mouse or trackpad,
 * FR-031). With "Vorlesen" on (FR-032), each new target reads a short task aloud that never says the number, and each
 * new help line is read aloud; the speaker icon repeats the help line, or the task when there is none. The start tap
 * speaks a short greeting, since tablet browsers speak only after a user tap.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Settings } from '../core/settings/schema';
import { createSfx } from '../audio/sfx';
import { assetUrl, CLIP_FILES, fontReady } from '../assets';
import { createSpeaker } from '../audio/speaker';
import { MatchController, type MatchView, type Phase, type RoundStore } from '../core/match/MatchController';
import { targetProgress } from '../core/progress/adaptive';
import { recordKey, submitResult } from '../core/records/records';
import { lookOf, newStars } from '../core/rewards/lockerRoom';
import { localStorageKeyValue } from '../core/storage/keyValue';
import { clearRound, loadRound, saveRound } from '../core/storage/storage';
import { decodeTransfer, saveCodeFromHash, type SaveData } from '../core/transfer/transfer';
import type { Digit } from '../core/match/entry';
import type { GameHandle } from '../game/createGame';
import type { KeeperPhase } from '../game/KeeperView';
import { resetMessage, t } from '../i18n';
import { START_KINDS, type KeyAction, type KeyScreen, type StartKind } from './keyboard';
import { HelpChart } from './HelpChart';
import { LockerRoom } from './LockerRoom';
import { helpText, MatchOverlay } from './MatchOverlay';
import { numberPadShown, useFinePointer } from './NumberPad';
import { ParentGate } from './ParentGate';
import { createPersistence, type DataKind, type Persistence } from './persistence';
import { ProgressPage } from './ProgressPage';
import { RoundEnd, type RoundRecord } from './RoundEnd';
import { SettingsPage } from './SettingsPage';
import { StartScreen } from './StartScreen';
import { canApplyUpdate, swUpdate } from './swUpdate';
import { TransferDialog, type TransferDialogState } from './TransferDialog';
import { useAutoPause } from './useAutoPause';
import { useMatchState, type ClockSource } from './useController';
import { applyMatchAction, useKeyboard } from './useKeyboard';

type Screen = 'start' | 'match' | 'lockerRoom';

/** The parent screens over the game: the parent menu, the settings page and the progress page. */
type ParentView = 'closed' | 'menu' | 'settings' | 'progress';

/** The transfer dialog while the code is read, then ready (with the decoded save), invalid or failed. */
type Transfer = { kind: 'reading' } | (TransferDialogState & { data?: SaveData });

/** Loads the game chunk and waits for Fredoka, so the board is drawn with it (FR-060). */
async function loadGame(): Promise<typeof import('../game/createGame')> {
  const [game] = await Promise.all([import('../game/createGame'), fontReady()]);
  return game;
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

/** The `start` query parameter when it names a start button (`play` or `time`), or undefined. */
export function startFromUrl(search: string): StartKind | undefined {
  const raw = new URLSearchParams(search).get('start');
  return START_KINDS.find((k) => k === raw);
}

/** Remembers that a save during play failed, so the start screen can say so (review M6). */
function createSaveWatch() {
  let failed = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  return {
    /** Takes the result of a save; a failure is remembered until the note is closed. */
    report(result: { ok: boolean }): void {
      if (result.ok || failed) return;
      failed = true;
      notify();
    },
    failed: () => failed,
    dismiss(): void {
      failed = false;
      notify();
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

type SaveWatch = ReturnType<typeof createSaveWatch>;

/** The lines of the start screen note about data reset on load, one per reason with the kinds it concerns (FR-036). */
function resetNoteLines(reasons: ReturnType<Persistence['resetReasons']>): string[] {
  const lines: string[] = [];
  for (const reason of ['invalid', 'newer', 'unavailable'] as const) {
    const kinds: DataKind[] = reasons.filter((r) => r.reason === reason).map((r) => r.kind);
    if (kinds.length === 0) continue;
    const names = kinds.map((k) => t().parent.dataNames[k]).join(', ');
    lines.push(`${resetMessage(reason)} ${t().storage.kinds(names)}`);
  }
  return lines;
}

function createApp() {
  const kv = localStorageKeyValue();
  const saves = createSaveWatch();
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
    // The adaptive steps and mastered directions steer target selection (FR-040).
    progress: () => targetProgress(persistence.progress(), settings()),
    // One record per finished target (T043, FR-037), with the settings the round uses (FR-052).
    onAttempt: (record) => saves.report(persistence.recordAttempt(record, controller.getRoundSettings())),
  });
  const sfx = createSfx({ sound: () => settings().sound, clips: (name) => assetUrl(CLIP_FILES[name]) });
  const speaker = createSpeaker();
  // A round stored before a refresh continues (T029); one that no longer fits the settings is discarded (FR-036a).
  const restored = controller.restore();
  // Stars go to the locker room as soon as they are earned (FR-042). A restored round's stars were awarded before.
  let seenStars = controller.getState().starsThisRound;
  controller.subscribe(() => {
    const current = controller.getState().starsThisRound;
    const earned = newStars(seenStars, current);
    seenStars = current;
    if (earned > 0) saves.report(persistence.awardStars(earned));
  });
  return { persistence, controller, sfx, speaker, settings, restored, saves };
}

/** Stores the result of a finished round with the personal bests; null when the parent hides records (FR-028). */
function recordRound(persistence: Persistence, saves: SaveWatch, s: MatchView, showRecords: boolean): RoundRecord | null {
  const key = recordKey(s.min, s.max, s.roundType);
  const outcome = submitResult(persistence.records(), key, { goals: s.goals, timeMs: s.elapsedMs, at: new Date().toISOString() });
  if (outcome.newRecord) saves.report(persistence.saveRecords(outcome.records));
  return showRecords ? { newRecord: outcome.newRecord, best: outcome.best } : null;
}

/** Which keys the game takes on `screen`. */
function keyScreenOf(screen: Screen, roundOver: boolean, paused: boolean): KeyScreen {
  if (screen === 'start') return 'start';
  if (roundOver) return 'roundEnd';
  return paused ? 'paused' : 'match';
}

/** Removes `#save=` from the address without a reload or a new history entry. */
function clearSaveHash(): void {
  if (saveCodeFromHash(window.location.hash) === null) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function App() {
  const [{ persistence, controller, sfx, speaker, settings, restored, saves }] = useState(createApp);
  const saveFailed = useSyncExternalStore(saves.subscribe, saves.failed);
  // The note about data reset on load shows until the parent closes it (FR-036).
  const [resetLines, setResetLines] = useState(() => resetNoteLines(persistence.resetReasons()));
  const [screen, setScreen] = useState<Screen>(restored ? 'match' : 'start');
  const [parent, setParent] = useState<ParentView>('closed');
  // Bumped after a save, an import or a transfer, so the start screen shows the new settings (the time challenge).
  const [, setDataVersion] = useState(0);
  const [transfer, setTransfer] = useState<Transfer | null>(() => (saveCodeFromHash(window.location.hash) === null ? null : { kind: 'reading' }));
  const state = useMatchState(controller);
  const gameParent = useRef<HTMLDivElement>(null);
  const timeChallenge = settings().timeChallenge.allowed;
  const [record, setRecord] = useState<RoundRecord | null>(null);
  // The keeper's phase from the scene, shown as `data-keeper` (T054).
  const [keeper, setKeeper] = useState<KeeperPhase>('idle');
  // The locker room opened from the match, over the running round (FR-049).
  const [lockerOpen, setLockerOpen] = useState(false);
  const gameHandle = useRef<GameHandle | null>(null);
  // A restored round has no phase before it: one restored straight into 'roundOver' (a refresh during the final goal's
  // celebration) still goes to the personal bests (review M2).
  const lastPhase = useRef<Phase | null>(restored ? null : state.phase);

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
    setRecord(recordRound(persistence, saves, controller.getState(), settings().showRecords));
  }, [state.phase, state.started, persistence, controller, settings, saves]);

  const lockerOn = settings().lockerRoom;
  const matchLocker = screen === 'match' && lockerOpen && lockerOn;

  // A running round pauses while a parent screen, the transfer dialog or the locker room is open (FR-034, FR-049).
  useAutoPause(controller, state.phase, screen === 'match' && (parent !== 'closed' || transfer !== null || matchLocker));

  // A waiting new version is applied only on the start screen, never during a round (FR-051a), and never while a
  // parent screen or the transfer dialog is open (review R2).
  const updateAllowed = canApplyUpdate({ screen, parentOpen: parent !== 'closed', transferOpen: transfer !== null });
  useEffect(() => {
    swUpdate.setStartScreen(updateAllowed);
  }, [updateAllowed]);

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
    const r = persistence.applyTransfer(transfer.data);
    if (!r.ok) {
      // Nothing (or, with `partial`, only part) was changed; `#save=` stays in the address, so a reload asks again.
      setTransfer({ kind: r.partial ? 'partial' : 'failed' });
      return;
    }
    // The new settings reach a running round as a save on the settings page does (FR-052).
    if (screen === 'match') controller.applySettings(persistence.settings());
    setDataVersion((n) => n + 1);
    closeTransfer();
  }, [transfer, persistence, closeTransfer, screen, controller]);

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

  // Spoken tasks (FR-032): a new target reads its task, a new help line reads the line.
  const speech = settings().sound.speech;
  const taskKey = screen === 'match' && state.target ? `${state.targetCount}:${state.target.number}` : null;
  useEffect(() => {
    if (!speech || taskKey === null) return;
    speaker.speak(t().match.task);
  }, [speech, taskKey, speaker]);
  const help = screen === 'match' ? helpText(state) : '';
  useEffect(() => {
    if (speech && help !== '') speaker.speak(help);
  }, [speech, help, speaker]);
  const speakTask = useCallback(() => {
    const s = controller.getState();
    const line = helpText(s);
    speaker.speak(line !== '' ? line : t().match.task);
  }, [controller, speaker]);

  const finePointer = useFinePointer();
  const showPad = numberPadShown(settings().numberPad, finePointer);

  // What the last round started as, for "Nochmal". The time challenge starts a normal round until T092 builds its
  // round type.
  const lastStart = useRef<StartKind>('play');
  const startMatch = useCallback(
    (kind: StartKind) => {
      lastStart.current = kind;
      // Tablet browsers speak only after a user tap: the start tap (or key) unlocks speech (FR-032).
      if (speech) speaker.prime();
      controller.start();
      setScreen('match');
    },
    [controller, speech, speaker],
  );

  const roundOver = screen === 'match' && state.phase === 'roundOver';
  const gameScreen = keyScreenOf(screen, roundOver, state.paused);
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
  const gear = useMemo(
    () => (
      <ParentGate
        open={parent === 'menu'}
        onOpen={() => setParent('menu')}
        onClose={closeParent}
        onSettings={() => setParent('settings')}
        onProgress={() => setParent('progress')}
      />
    ),
    [parent, closeParent],
  );
  // A failed or partial transfer keeps `#save=` in the address, so a reload asks again.
  const dismissTransfer = transfer?.kind === 'failed' || transfer?.kind === 'partial' ? () => setTransfer(null) : closeTransfer;
  const parentScreens = (
    <>
      {parent === 'settings' && <SettingsPage persistence={persistence} onSaved={settingsSaved} onClose={closeParent} />}
      {parent === 'progress' && <ProgressPage persistence={persistence} onClose={closeParent} />}
      {transfer !== null && transfer.kind !== 'reading' && (
        <TransferDialog
          state={transfer}
          onAccept={acceptTransfer}
          onCancel={dismissTransfer}
        />
      )}
    </>
  );

  // "Nochmal" starts the same kind of round again; a time challenge the parent no longer allows becomes "Spielen".
  const playAgain = () => startMatch(lastStart.current === 'time' && !timeChallenge ? 'play' : lastStart.current);
  const onAction = (action: KeyAction) => {
    if (action.type === 'start') startMatch(action.kind);
    else if (action.type === 'again') playAgain();
    else if (action.type === 'lockerRoom') setScreen('lockerRoom');
    else applyMatchAction(controller, action);
  };
  useKeyboard({ screen: keyScreen, timeChallenge, lockerRoom: lockerOn, enterStart: startFromUrl(window.location.search), onAction });

  const locker = persistence.lockerRoom();
  const saveLocker = (next: typeof locker) => {
    saves.report(persistence.saveLockerRoom(next));
    setDataVersion((n) => n + 1);
  };
  const closeMatchLocker = () => {
    setLockerOpen(false);
    // The scene draws the look on every state change; a round the child paused has none, so it is shown here.
    gameHandle.current?.showLook();
  };

  // Stable props, so the memoized overlay re-renders only when what it shows changes.
  const clock = useMemo<ClockSource>(
    () => ({ subscribe: (fn) => controller.subscribe(fn), elapsedMs: () => controller.getState().elapsedMs }),
    [controller],
  );
  const showClock = settings().showClock;
  // Goals per round keep their round-start value (FR-052).
  const roundGoals = controller.getRoundSettings().goalsPerRound;
  const overlaySettings = useMemo(() => ({ showClock, goalsPerRound: roundGoals }), [showClock, roundGoals]);
  const openMatchLocker = useCallback(() => setLockerOpen(true), []);
  const pad = useMemo(
    () => ({
      onDigit: (digit: Digit) => controller.typeKey({ digit }),
      onBackspace: () => controller.typeKey('backspace'),
      onShoot: () => controller.shoot(),
    }),
    [controller],
  );
  const askHelp = useCallback(() => controller.askHelp(), [controller]);
  const pause = useCallback(() => controller.pause(), [controller]);
  const resume = useCallback(() => controller.resume(), [controller]);
  const closeHelpChart = useCallback(() => controller.closeHelpChart(), [controller]);

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
          timeChallenge={timeChallenge}
          onPlay={startMatch}
          gear={gear}
          lockerRoom={lockerOn ? { stars: locker.stars, onOpen: () => setScreen('lockerRoom') } : null}
          notices={[
            ...(resetLines.length > 0 ? [{ id: 'reset', lines: resetLines, onDismiss: () => setResetLines([]) }] : []),
            ...(saveFailed ? [{ id: 'save', lines: [t().start.saveFailed], onDismiss: saves.dismiss }] : []),
          ]}
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
        help={help}
        clock={clock}
        keeper={keeper}
        ball={locker.ball}
        shirt={locker.shirtColor}
        settings={overlaySettings}
        gear={gear}
        onLockerRoom={lockerOn ? openMatchLocker : undefined}
        pad={showPad ? pad : undefined}
        onSpeak={speech && speaker.available ? speakTask : undefined}
        onHelp={askHelp}
        onPause={pause}
        onResume={resume}
      />
      {state.helpChartOpen && state.target && !state.paused && (
        <HelpChart
          min={state.min}
          max={state.max}
          target={state.target.number}
          lastGuess={state.lastGuess}
          onClose={closeHelpChart}
        />
      )}
      {roundOver && (
        <RoundEnd
          goals={state.goals}
          elapsedMs={state.elapsedMs}
          roundType={state.roundType}
          record={record}
          stars={lockerOn ? state.starsThisRound : null}
          onAgain={playAgain}
          onBack={() => setScreen('start')}
        />
      )}
      {matchLocker && <LockerRoom locker={locker} onChange={saveLocker} onBack={closeMatchLocker} />}
      {parentScreens}
    </main>
  );
}

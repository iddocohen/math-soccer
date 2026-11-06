// Structure adapted from math-tank src/app/App.tsx.
/**
 * The app shell (T022): the start screen (StartScreen.tsx), the match with the Phaser canvas (MatchScene.ts) under a
 * React overlay (MatchOverlay.tsx), and the round end over the match (RoundEnd.tsx). The scene tells the controller
 * when the ball lands and when the celebration ends. When a round ends, its result goes to the personal bests (FR-028).
 *
 * Phaser loads in its own chunk when a match starts, so the start screen shows quickly. A round stored before a refresh
 * continues on load (T029). Test query parameters: `?start=play|time` makes Enter and Space start that kind of round,
 * `?seed=` fixes the round seed, and `?speed=N` (the test speed-up hook, T092) makes play time run N times as fast;
 * with it, a test can change the speed while the page runs through `window.mathSoccerSpeed` (contracts/screens.md).
 *
 * Start (amendment 05, FR-068, FR-075): "Spielen" starts the goalkeeper game; "Zeit-Challenge" shows when the parent
 * allows it, and starts a time challenge (amendment 07, FR-075 to FR-081).
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
 * Cup (amendment 13, T101): "Pokal" (P, or Enter with `?start=cup`) starts the cup's next match with its level and
 * "Tore pro Spiel" (core/cup `nextMatch`, MatchController.startCup). Its attempts count without moving the child's level
 * (FR-109). When the match ends, its result goes to the cup with the bonus stars (`settleCup`), and the round end says
 * "Gewonnen! …" or "Knapp! Noch mal gegen …?"; "Nochmal" starts the next match. "Zum Start" leaves the cup unchanged
 * (FR-118). The bracket screen and the team looks come with T102.
 *
 * Pause and home (amendment 14, FR-116 to FR-118): while the child paused the round, PauseScreen offers "Weiter" and
 * "Zum Start"; the home button pauses and asks "Runde beenden?" with the same two buttons. "Zum Start" goes through
 * `abandonRound`: the controller drops the round (MatchController.abandon) and the start screen shows.
 *
 * Review fixes: a round restored after a refresh during the final goal's celebration ends at once, and its result still
 * goes to the personal bests (M2). Accepting a transfer during a match takes its settings into the round (M3, FR-052).
 * Attempts are recorded with the settings the round uses (M4). When a save during play fails, or stored data was reset on
 * load, the start screen shows a short note (M6, H5, FR-036); play is never interrupted.
 *
 * Polish (T061, T062): the number pad shows by the parent's setting (automatic: only without a mouse or trackpad,
 * FR-031). With "Vorlesen" on (FR-032), each new target reads a short task aloud that never says the number; the
 * speaker icon repeats it. There is no help sentence to read (amendment 14, FR-119). The start tap
 * speaks a short greeting, since tablet browsers speak only after a user tap.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Settings } from '../core/settings/schema';
import { createSfx } from '../audio/sfx';
import { assetUrl, CLIP_FILES, fontReady } from '../assets';
import { createSpeaker } from '../audio/speaker';
import { CUP_STAGES, nextMatch, recordMatch } from '../core/cup/cup';
import { cupMatchWon, MatchController, START_HEARTS, type MatchView, type Phase, type RoundStore } from '../core/match/MatchController';
import { targetProgress } from '../core/progress/adaptive';
import type { Level } from '../core/progress/levels';
import type { TargetProgress } from '../core/targets/nextTarget';
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
import { MatchOverlay } from './MatchOverlay';
import { numberPadShown, useFinePointer } from './NumberPad';
import { ParentGate } from './ParentGate';
import { PauseScreen } from './PauseScreen';
import { createPersistence, type DataKind, type Persistence } from './persistence';
import { ProgressPage } from './ProgressPage';
import { RoundEnd, type CupRoundResult, type RoundRecord } from './RoundEnd';
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

/** The `speed` query parameter (test speed-up hook) as a factor from 0 to 1000, or undefined without it. */
export function speedFromUrl(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('speed');
  if (raw === null || !/^\d{1,4}(\.\d+)?$/.test(raw)) return undefined;
  return Math.min(1000, Number(raw));
}

/** The factor play time runs at: 1, unless the page was opened with the test hook `?speed=` (`fromUrl`). */
function playSpeed(fromUrl: number | undefined): number {
  if (fromUrl === undefined) return 1;
  const live = window.mathSoccerSpeed;
  return typeof live === 'number' && live >= 0 && Number.isFinite(live) ? live : fromUrl;
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
  const controller: MatchController = new MatchController({
    settings,
    store,
    newSeed: seed === undefined ? undefined : () => seed,
    // The difficulty level and mastered directions steer target selection (FR-040, FR-086).
    progress: (): TargetProgress => targetProgress(persistence.progress(), controller.getRoundSettings()),
    // One record per finished target (T043, FR-037), with the settings the round uses (FR-052); a raised level goes
    // back to the controller for "Neue Stufe" (FR-088).
    onAttempt: (record): Level | null => {
      // A cup match plays the level of its stage, so its attempts never move the child's level (FR-109).
      const keepLevel = controller.getState().roundType === 'cup';
      const r = persistence.recordAttempt(record, controller.getRoundSettings(), { keepLevel });
      saves.report(r);
      return r.levelUp;
    },
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
  // A small cheer, clapping on top of the goal's cheer, when a goal raised the level (FR-088).
  let seenMessage = controller.getState().message;
  controller.subscribe(() => {
    const message = controller.getState().message;
    if (message !== seenMessage && message?.kind === 'levelUp') sfx.clap();
    seenMessage = message;
  });
  return { persistence, controller, sfx, speaker, settings, restored, saves };
}

/** Stores the result of a finished round with the personal bests; null when the parent hides records (FR-028). */
function recordRound(persistence: Persistence, saves: SaveWatch, s: MatchView, showRecords: boolean): RoundRecord | null {
  const key = recordKey(s.min, s.max, s.roundType, s.challengeMinutes);
  const outcome = submitResult(persistence.records(), key, { goals: s.goals, timeMs: s.elapsedMs, at: new Date().toISOString() });
  if (outcome.newRecord) saves.report(persistence.saveRecords(outcome.records));
  return showRecords ? { newRecord: outcome.newRecord, best: outcome.best } : null;
}

/**
 * Records a finished cup match in the cup (FR-108, FR-111, FR-112): the next match after a win, one more try after a
 * loss, the trophy and the next cup after a won final. The bonus stars go to the locker room. Returns the round end's
 * line and the bonus stars.
 */
function settleCup(persistence: Persistence, saves: SaveWatch, s: MatchView): CupRoundResult & { bonus: number } {
  const before = persistence.cup();
  const match = nextMatch(before, persistence.settings());
  const won = cupMatchWon(s);
  const update = recordMatch(before, { won, goals: s.goals, against: START_HEARTS - s.hearts });
  saves.report(persistence.saveCup(update.cup));
  if (update.stars > 0) saves.report(persistence.awardStars(update.stars));
  const text = t().cup;
  const line = !won
    ? text.lost(match.team.name)
    : update.cupWon
      ? text.cupWon(before.cup)
      : text.won(text.onTo[CUP_STAGES[update.cup.stage]!]);
  return { won, line, bonus: update.stars };
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
  const [cupResult, setCupResult] = useState<(CupRoundResult & { bonus: number }) | null>(null);
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
    const ended = controller.getState();
    // A cup match goes to the cup, never to the personal bests (FR-108).
    if (ended.roundType === 'cup') {
      setRecord(null);
      setCupResult(settleCup(persistence, saves, ended));
      return;
    }
    setCupResult(null);
    setRecord(recordRound(persistence, saves, ended, settings().showRecords));
  }, [state.phase, state.started, persistence, controller, settings, saves]);

  const lockerOn = settings().lockerRoom;
  const matchLocker = screen === 'match' && lockerOpen && lockerOn;

  // A running round pauses while a parent screen, the transfer dialog or the locker room is open (FR-034, FR-049).
  useAutoPause(controller, state.phase, screen === 'match' && (parent !== 'closed' || transfer !== null || matchLocker));

  // A waiting new version is applied only on the start screen, never during a round (FR-051a), and never while a
  // parent screen or the transfer dialog is open (review R2).
  const updateWaiting = useSyncExternalStore(swUpdate.subscribe, swUpdate.waiting);
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

  // Time played runs while the match shows and the tab is visible (FR-029); the controller stops it while paused. It
  // waits for the scene, so loading the game, the font and the images costs no time of a time challenge.
  useEffect(() => {
    if (screen !== 'match') return;
    const fromUrl = speedFromUrl(window.location.search);
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden && gameHandle.current !== null) controller.tick((now - last) * playSpeed(fromUrl));
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
  // The speaker icon reads the task again; there is no help sentence to read (amendment 14, FR-119).
  const speakTask = useCallback(() => speaker.speak(t().match.task), [speaker]);

  const finePointer = useFinePointer();
  const showPad = numberPadShown(settings().numberPad, finePointer);

  // What the last round started as, for "Nochmal"; a restored time challenge counts as one.
  const restoredType = controller.getState().roundType;
  const lastStart = useRef<StartKind>(restoredType === 'time' || restoredType === 'cup' ? restoredType : 'play');
  const startMatch = useCallback(
    (kind: StartKind) => {
      lastStart.current = kind;
      // Tablet browsers speak only after a user tap: the start tap (or key) unlocks speech (FR-032).
      if (speech) speaker.prime();
      if (kind === 'cup') {
        // The cup's next match, with the level of its stage and "Tore pro Spiel" (FR-108, FR-109).
        const match = nextMatch(persistence.cup(), settings());
        controller.startCup({ level: match.level, goals: match.goals });
      } else {
        controller.start(kind);
      }
      setScreen('match');
    },
    [controller, speech, speaker, persistence, settings],
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
  const playAgain = () => {
    const kind = lastStart.current === 'time' && !timeChallenge ? 'play' : lastStart.current;
    // FR-103: with a new version waiting, "Nochmal" applies it first; the new page starts the round.
    if (swUpdate.applyNow(kind, () => startMatch(kind))) return;
    startMatch(kind);
  };
  // FR-103: the round "Nochmal" asked for before the page reloaded with the new version.
  useEffect(() => {
    const asked = swUpdate.takeStartAfterUpdate();
    const kind = START_KINDS.find((k) => k === asked);
    if (kind) startMatch(kind);
  }, [startMatch]);
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
  // The home button pauses and asks "Runde beenden?" (FR-116); the pause screen then shows that question.
  const [quitAsked, setQuitAsked] = useState(false);
  const askQuit = useCallback(() => {
    controller.pause();
    setQuitAsked(true);
  }, [controller]);
  useEffect(() => {
    if (!state.paused) setQuitAsked(false);
  }, [state.paused]);
  // "Zum Start" (FR-118): the one way a round ends without a round end. A cup match never reaches 'roundOver' this way,
  // so `settleCup` does not run and the cup stays where it was.
  const abandonRound = useCallback(() => {
    controller.abandon();
    setQuitAsked(false);
    setScreen('start');
  }, [controller]);
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
          cup={persistence.cup()}
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
        onHome={askQuit}
      />
      {/* The pause screen shows while the child paused the round, not under a parent screen or the locker room. */}
      {state.paused && !roundOver && keyScreen === 'paused' && (
        <PauseScreen kind={quitAsked ? 'quit' : 'pause'} onResume={resume} onHome={abandonRound} />
      )}
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
          challengeMinutes={state.challengeMinutes}
          record={record}
          cup={state.roundType === 'cup' ? cupResult : null}
          stars={lockerOn ? state.starsThisRound + (state.roundType === 'cup' ? (cupResult?.bonus ?? 0) : 0) : null}
          updateWaiting={updateWaiting}
          onAgain={playAgain}
          onBack={() => setScreen('start')}
        />
      )}
      {matchLocker && <LockerRoom locker={locker} onChange={saveLocker} onBack={closeMatchLocker} />}
      {parentScreens}
    </main>
  );
}

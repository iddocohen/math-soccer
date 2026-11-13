// Copied from math-tank src/app/swUpdate.ts.
/**
 * Offline play and updates (FR-051, FR-051a, research R12). main.tsx installs the service worker with `registerSW`
 * from `virtual:pwa-register` (vite-plugin-pwa, `registerType: 'prompt'`); the worker precaches the whole build, so
 * the game works offline after the first load. When a new version is waiting, it is applied (the page reloads with
 * it) only while the start screen shows, never during a round. The app reports what shows with `report`, and one rule,
 * `mayApplyNow`, decides over that and the child's first input. Without `install` (unit tests, the dev server)
 * nothing happens.
 *
 * Fast updates (Phase 24, amendment 12): the app asks the server for a new service worker on load, each time the start
 * screen shows (FR-102), every UPDATE_CHECK_MS while it is open, and when the page comes back to the front.
 *
 * Amendment 12 (FR-103, FR-104): a version that waits is also applied
 * - at page load, before the child presses a key or touches the screen, on any screen. A reload during a round restores
 *   the round on the match screen, not on the start screen, so before this rule a reload never applied a waiting
 *   version while a round was stored. The round is stored, so the new version restores it.
 * - from the round end: `waiting()` and `subscribe` tell the app to show "Neue Version, startet gleich"; "Zurück" goes
 *   to the start screen (after a cup match to the bracket), which applies it; "Nochmal" calls `applyNow` with a resume
 *   intent (the round kind to start), which the new page reads once with `takeResumeIntent` and starts.
 *
 * Loop guard: before an automatic reload the app stores the version it reloads from in
 * sessionStorage (AUTO_RELOAD_KEY); a page that still runs that version after the reload does not reload again in this
 * browser tab, so a new worker that fails to take control cannot cause a reload loop.
 */
import { START_KINDS, type StartKind } from '../core/match/rounds';
import { BUILD_VERSION } from './buildInfo';

/** How often an open game asks for a new version. */
export const UPDATE_CHECK_MS = 5 * 60 * 1000;
/** sessionStorage key: the version the page last reloaded from automatically. */
export const AUTO_RELOAD_KEY = 'mathSoccer.autoReloadFrom';
/** sessionStorage key: the round kind "Nochmal" asked for before the page reloaded with a new version (FR-103). */
export const START_AFTER_UPDATE_KEY = 'mathSoccer.startAfterUpdate';

/** Whether the page may reload automatically to apply a waiting version (one reload per version and browser tab). */
export function mayAutoReload(currentVersion: string, reloadedFrom: string | null): boolean {
  return reloadedFrom !== currentVersion;
}

/** What swUpdate needs from the browser; tests pass their own. */
export interface SwUpdateEnv {
  version: string;
  session: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } | null;
  setInterval(fn: () => void, ms: number): void;
  document: {
    visibilityState: DocumentVisibilityState;
    addEventListener(type: 'visibilitychange' | 'keydown' | 'pointerdown', fn: () => void, options?: { capture?: boolean }): void;
  } | null;
  /**
   * Reloads the page once the new service worker controls it. vite-plugin-pwa reloads only when a worker controlled the
   * page when it loaded (workbox-window's `isUpdate`); a page from a first visit or after the browser data was cleared
   * would keep running the old version (amendment 12, found by tests/e2e/update.spec.ts).
   */
  reloadOnControllerChange?(): void;
}

function browserEnv(): SwUpdateEnv {
  let session: SwUpdateEnv['session'] = null;
  try {
    session = typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    // Storage blocked: the guard then allows one reload per page load only (see `reloadedFrom` below).
  }
  return {
    version: BUILD_VERSION,
    session,
    setInterval: (fn, ms) => void setInterval(fn, ms),
    document: typeof document === 'undefined' ? null : document,
    reloadOnControllerChange() {
      if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    },
  };
}

/** What the app reports to the update rule: the screen and what is open over it. */
export interface AppView {
  screen: string;
  /** The parent menu, the settings or progress page, or the start card of "Papa gegen Kind" is open. */
  parentOpen: boolean;
  /** The transfer dialog is open. */
  transferOpen: boolean;
}

/** The update rule's whole context: what shows, and whether the child pressed a key or touched the screen yet. */
export interface UpdateContext extends AppView {
  inputReceived: boolean;
}

/**
 * Whether a waiting version may reload the page now (FR-051a, FR-104, review R2):
 * - before the child's first key or touch since the page loaded, on any screen: a stored round comes back after the
 *   reload, so nothing is lost (FR-104);
 * - after it only between rounds, on the start screen or the cup's bracket screen (`cup`, where "Weiter" and "Zurück"
 *   of a cup match's round end lead, FR-103), and never while a parent screen, the start card of "Papa gegen Kind" or
 *   the transfer dialog is open, so no unsaved setting, typed name or pending take-over is lost.
 */
export function mayApplyNow(context: UpdateContext): boolean {
  return !context.inputReceived || betweenRounds(context);
}

/** The rule after the first input: the start screen or the bracket, with nothing open over it. */
function betweenRounds(view: AppView): boolean {
  return (view.screen === 'start' || view.screen === 'cup') && !view.parentOpen && !view.transferOpen;
}

/** The view before the app's first report: no screen. */
const NOTHING_SHOWN: AppView = { screen: '', parentOpen: false, transferOpen: false };

/** What the page that loads the new version does first: start the round "Nochmal" asked for (FR-103). */
export interface ResumeIntent {
  start: StartKind;
}

/** The resume intent stored as its round kind, or null for anything that is not one. */
export function parseResumeIntent(stored: string | null): ResumeIntent | null {
  const start = START_KINDS.find((k) => k === stored);
  return start ? { start } : null;
}

export interface RegisterOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: unknown) => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
}

/** The shape of registerSW from virtual:pwa-register: returns the function that applies the waiting version. */
export type RegisterSW = (options: RegisterOptions) => (reloadPage?: boolean) => Promise<void>;

export interface SwUpdate {
  install(register: RegisterSW): void;
  /** Reports what the app shows; a waiting version is applied when `mayApplyNow` allows it. */
  report(view: AppView): void;
  /** Whether a new version waits to be applied. */
  waiting(): boolean;
  /** Calls `fn` whenever `waiting()` changes; returns the function that stops it. */
  subscribe(fn: () => void): () => void;
  /**
   * Applies the waiting version now and leaves `intent` for the new page (FR-103, "Nochmal"). Returns false when
   * nothing waits or the loop guard holds; when the update fails (offline), `onFail` runs instead.
   */
  applyNow(intent: ResumeIntent, onFail: () => void): boolean;
  /** The resume intent a "Nochmal" before the reload left, read once; null otherwise. */
  takeResumeIntent(): ResumeIntent | null;
}

export function createSwUpdate(env: SwUpdateEnv = browserEnv()): SwUpdate {
  let update: ((reloadPage?: boolean) => Promise<void>) | null = null;
  let waiting = false;
  // What the app reported last; null before its first report.
  let view: AppView | null = null;
  // False from page load until the child's first key or touch (FR-104).
  let inputReceived = false;
  let registered: ServiceWorkerRegistration | null = null;
  /** The version the page last reloaded from automatically; read from the session once, then kept here. */
  let reloadedFrom: string | null | undefined;
  const listeners = new Set<() => void>();
  const setWaiting = (value: boolean) => {
    if (waiting === value) return;
    waiting = value;
    for (const fn of listeners) fn();
  };

  // Only this page writes the key, so after the first read the kept value is the stored one.
  const readSession = (): string | null => {
    if (reloadedFrom === undefined) {
      try {
        reloadedFrom = env.session?.getItem(AUTO_RELOAD_KEY) ?? null;
      } catch {
        reloadedFrom = null;
      }
    }
    return reloadedFrom;
  };
  const writeSession = (value: string) => {
    reloadedFrom = value;
    try {
      env.session?.setItem(AUTO_RELOAD_KEY, value);
    } catch {
      // Without storage the guard holds for this page load only.
    }
  };

  const checkForUpdate = (registration: ServiceWorkerRegistration) => {
    // Offline or a server error: the next check tries again.
    registration.update().catch(() => {});
  };

  /** Applies the waiting version if the loop guard allows it; false when it did not try. */
  const apply = (onFail?: () => void): boolean => {
    if (!waiting || !update) return false;
    const before = readSession();
    if (!mayAutoReload(env.version, before)) return false;
    writeSession(env.version);
    setWaiting(false);
    env.reloadOnControllerChange?.();
    // Review L4: a failed update (for example offline) did not reload; it waits for the next time the start screen
    // shows, and does not count as the one automatic reload.
    update(true).catch(() => {
      writeSession(before ?? '');
      setWaiting(true);
      onFail?.();
    });
    return true;
  };

  const applyIfAllowed = () => {
    if (mayApplyNow({ ...(view ?? NOTHING_SHOWN), inputReceived })) apply();
  };

  const endFresh = () => {
    inputReceived = true;
  };

  return {
    install(register) {
      if (update) return;
      update = register({
        immediate: true,
        onNeedRefresh() {
          setWaiting(true);
          applyIfAllowed();
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          registered = registration;
          checkForUpdate(registration);
          // A hidden page skips the check: it checks when it comes back to the front.
          env.setInterval(() => {
            if (env.document?.visibilityState !== 'hidden') checkForUpdate(registration);
          }, UPDATE_CHECK_MS);
          env.document?.addEventListener('visibilitychange', () => {
            if (env.document?.visibilityState === 'visible') checkForUpdate(registration);
          });
        },
        onRegisterError(error) {
          // The game still works from the network; offline play and updates wait for the next load (review L4).
          console.warn('Service worker registration failed', error);
        },
      });
      env.document?.addEventListener('keydown', endFresh, { capture: true });
      env.document?.addEventListener('pointerdown', endFresh, { capture: true });
    },
    report(next) {
      const was = view === null ? null : betweenRounds(view);
      const now = betweenRounds(next);
      view = { ...next };
      // The rule's answer for this view changes only with `betweenRounds` (or the first input, which applies nothing
      // by itself): a report that keeps it does nothing.
      if (was === now) return;
      // FR-102: every time the start screen (or the bracket) shows with nothing over it, ask for a new version.
      if (now && registered) checkForUpdate(registered);
      applyIfAllowed();
    },
    // A version the loop guard holds back does not count: the round end would promise a reload that never comes.
    waiting: () => waiting && mayAutoReload(env.version, readSession()),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    applyNow(intent, onFail) {
      try {
        env.session?.setItem(START_AFTER_UPDATE_KEY, intent.start);
      } catch {
        // Without storage the new page shows the start screen instead of the round.
      }
      const clear = () => {
        try {
          env.session?.removeItem(START_AFTER_UPDATE_KEY);
        } catch {
          // Nothing stored.
        }
      };
      const tried = apply(() => {
        clear();
        onFail();
      });
      if (!tried) clear();
      return tried;
    },
    takeResumeIntent() {
      try {
        const stored = env.session?.getItem(START_AFTER_UPDATE_KEY) ?? null;
        if (stored !== null) env.session?.removeItem(START_AFTER_UPDATE_KEY);
        return parseResumeIntent(stored);
      } catch {
        return null;
      }
    },
  };
}

/** The app's one instance. */
export const swUpdate = createSwUpdate();

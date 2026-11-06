// Copied from math-tank src/app/swUpdate.ts.
/**
 * Offline play and updates (FR-051, FR-051a, research R12). main.tsx installs the service worker with `registerSW`
 * from `virtual:pwa-register` (vite-plugin-pwa, `registerType: 'prompt'`); the worker precaches the whole build, so
 * the game works offline after the first load. When a new version is waiting, it is applied (the page reloads with
 * it) only while the start screen shows, never during a round: the app reports the start screen with
 * `setStartScreen`. Without `install` (unit tests, the dev server) nothing happens.
 *
 * Fast updates (Phase 24): the app asks the server for a new service worker on load, every UPDATE_CHECK_MS while it is
 * open, and when the page comes back to the front. A version found waiting at page load is applied at once, because
 * the start screen shows then. Loop guard: before an automatic reload the app stores the version it reloads from in
 * sessionStorage (AUTO_RELOAD_KEY); a page that still runs that version after the reload does not reload again in this
 * browser tab, so a new worker that fails to take control cannot cause a reload loop.
 */
import { BUILD_VERSION } from './buildInfo';

/** How often an open game asks for a new version. */
export const UPDATE_CHECK_MS = 30 * 60 * 1000;
/** sessionStorage key: the version the page last reloaded from automatically. */
export const AUTO_RELOAD_KEY = 'mathSoccer.autoReloadFrom';

/** Whether the page may reload automatically to apply a waiting version (one reload per version and browser tab). */
export function mayAutoReload(currentVersion: string, reloadedFrom: string | null): boolean {
  return reloadedFrom !== currentVersion;
}

/** What swUpdate needs from the browser; tests pass their own. */
export interface SwUpdateEnv {
  version: string;
  session: { getItem(key: string): string | null; setItem(key: string, value: string): void } | null;
  setInterval(fn: () => void, ms: number): void;
  document: { visibilityState: DocumentVisibilityState; addEventListener(type: 'visibilitychange', fn: () => void): void } | null;
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
  };
}

/**
 * Whether a waiting version may reload the page now (FR-051a, review R2): only on the start screen, and never while the
 * parent menu, the settings or progress page or the transfer dialog is open, so no unsaved setting or pending take-over
 * is lost.
 */
export function canApplyUpdate(view: { screen: string; parentOpen: boolean; transferOpen: boolean }): boolean {
  return view.screen === 'start' && !view.parentOpen && !view.transferOpen;
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
  setStartScreen(shown: boolean): void;
}

export function createSwUpdate(env: SwUpdateEnv = browserEnv()): SwUpdate {
  let update: ((reloadPage?: boolean) => Promise<void>) | null = null;
  let waiting = false;
  let onStart = false;
  let reloadedFromMemory: string | null = null;

  const readSession = (): string | null => {
    try {
      return env.session?.getItem(AUTO_RELOAD_KEY) ?? reloadedFromMemory;
    } catch {
      return reloadedFromMemory;
    }
  };
  const writeSession = (value: string) => {
    reloadedFromMemory = value;
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

  const applyIfAllowed = () => {
    if (!waiting || !onStart || !update) return;
    const before = readSession();
    if (!mayAutoReload(env.version, before)) return;
    writeSession(env.version);
    waiting = false;
    // Review L4: a failed update (for example offline) did not reload; it waits for the next time the start screen
    // shows, and does not count as the one automatic reload.
    update(true).catch(() => {
      writeSession(before ?? '');
      waiting = true;
    });
  };

  return {
    install(register) {
      if (update) return;
      update = register({
        immediate: true,
        onNeedRefresh() {
          waiting = true;
          applyIfAllowed();
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          checkForUpdate(registration);
          env.setInterval(() => checkForUpdate(registration), UPDATE_CHECK_MS);
          env.document?.addEventListener('visibilitychange', () => {
            if (env.document?.visibilityState === 'visible') checkForUpdate(registration);
          });
        },
        onRegisterError(error) {
          // The game still works from the network; offline play and updates wait for the next load (review L4).
          console.warn('Service worker registration failed', error);
        },
      });
    },
    setStartScreen(shown) {
      onStart = shown;
      applyIfAllowed();
    },
  };
}

/** The app's one instance. */
export const swUpdate = createSwUpdate();

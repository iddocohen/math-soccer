// Copied from math-tank src/app/swUpdate.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTO_RELOAD_KEY,
  canApplyUpdate,
  createSwUpdate,
  mayAutoReload,
  START_AFTER_UPDATE_KEY,
  UPDATE_CHECK_MS,
  type RegisterSW,
  type SwUpdateEnv,
} from './swUpdate';

/** The child's first key ends the load window in which a waiting version applies on any screen (FR-104). */
const firstKey = () => document.dispatchEvent(new KeyboardEvent('keydown'));

// The loop guard keeps its marker in sessionStorage; every test starts without one.
afterEach(() => sessionStorage.clear());

/** A stand-in for registerSW from virtual:pwa-register: remembers the callbacks and counts updates. */
function fakeRegister() {
  const calls = { update: 0, reload: [] as Array<boolean | undefined> };
  let needRefresh: (() => void) | undefined;
  const register: RegisterSW = (options) => {
    needRefresh = options.onNeedRefresh;
    return async (reload?: boolean) => {
      calls.update++;
      calls.reload.push(reload);
    };
  };
  return { register, calls, newVersion: () => needRefresh?.() };
}

describe('service worker update (FR-051, FR-051a, research R12)', () => {
  it('registers the service worker once with the prompt callbacks', () => {
    const register = vi.fn<RegisterSW>(() => async () => {});
    const sw = createSwUpdate();
    sw.install(register);
    sw.install(register);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]![0]).toMatchObject({ immediate: true });
  });

  it('applies a waiting version at once while the start screen shows', () => {
    const f = fakeRegister();
    const sw = createSwUpdate();
    sw.install(f.register);
    sw.setStartScreen(true);
    f.newVersion();
    expect(f.calls.update).toBe(1);
    expect(f.calls.reload).toEqual([true]);
  });

  it('never applies it during a round: it waits until the start screen shows again', () => {
    const f = fakeRegister();
    const sw = createSwUpdate();
    sw.install(f.register);
    firstKey();
    sw.setStartScreen(false);
    f.newVersion();
    expect(f.calls.update).toBe(0);
    sw.setStartScreen(false);
    expect(f.calls.update).toBe(0);
    sw.setStartScreen(true);
    expect(f.calls.update).toBe(1);
    // Applied once only.
    sw.setStartScreen(false);
    sw.setStartScreen(true);
    expect(f.calls.update).toBe(1);
  });

  it('does nothing before install, for example in unit tests of the app', () => {
    const sw = createSwUpdate();
    expect(() => sw.setStartScreen(true)).not.toThrow();
  });
});

describe('canApplyUpdate (review R2)', () => {
  it('allows the reload only on the start screen with no parent screen and no transfer dialog open', () => {
    expect(canApplyUpdate({ screen: 'start', parentOpen: false, transferOpen: false })).toBe(true);
    expect(canApplyUpdate({ screen: 'battle', parentOpen: false, transferOpen: false })).toBe(false);
    expect(canApplyUpdate({ screen: 'garage', parentOpen: false, transferOpen: false })).toBe(false);
    expect(canApplyUpdate({ screen: 'start', parentOpen: true, transferOpen: false })).toBe(false);
    expect(canApplyUpdate({ screen: 'start', parentOpen: false, transferOpen: true })).toBe(false);
  });

  it('a failed update is tried again the next time the start screen shows, without an unhandled rejection (review L4)', async () => {
    let fail = true;
    let needRefresh: (() => void) | undefined;
    let calls = 0;
    const register: RegisterSW = (options) => {
      needRefresh = options.onNeedRefresh;
      expect(options.onRegisterError).toBeTypeOf('function');
      return () => {
        calls++;
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve();
      };
    };
    const sw = createSwUpdate();
    sw.install(register);
    firstKey();
    sw.setStartScreen(true);
    needRefresh?.();
    await Promise.resolve();
    await Promise.resolve();
    fail = false;
    sw.setStartScreen(false);
    sw.setStartScreen(true);
    expect(calls).toBe(2);
  });
});

/** A test environment: a session store, interval timers that tests run by hand and a document with visibility. */
function fakeEnv(version = 'v1', stored: Record<string, string> = {}) {
  const intervals: Array<{ fn: () => void; ms: number }> = [];
  const handlers: Record<string, Array<() => void>> = {};
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (t: string, fn: () => void) => void (handlers[t] ??= []).push(fn),
  };
  const fire = (t: string) => (handlers[t] ?? []).forEach((fn) => fn());
  const env: SwUpdateEnv = {
    version,
    session: { getItem: (k) => stored[k] ?? null, setItem: (k, v) => void (stored[k] = v), removeItem: (k) => void delete stored[k] },
    setInterval: (fn, ms) => void intervals.push({ fn, ms }),
    document: doc,
  };
  return { env, stored, intervals, doc, becomeVisible: () => fire('visibilitychange'), touch: () => fire('pointerdown'), key: () => fire('keydown') };
}

function registration() {
  return { update: vi.fn(() => Promise.resolve()) };
}

// Phase 24 "Fast updates and cache cleanup": new builds reach devices quickly, without a reload loop.
describe('update checks (Phase 24)', () => {
  it('asks the server for a new version on load, every 5 minutes and when the page comes back to the front (FR-102)', () => {
    const f = fakeEnv();
    const reg = registration();
    const register: RegisterSW = (options) => {
      options.onRegisteredSW?.('/sw.js', reg as unknown as ServiceWorkerRegistration);
      return async () => {};
    };
    createSwUpdate(f.env).install(register);
    expect(reg.update).toHaveBeenCalledTimes(1);
    expect(UPDATE_CHECK_MS).toBe(5 * 60 * 1000);
    expect(f.intervals.map((i) => i.ms)).toEqual([UPDATE_CHECK_MS]);
    f.intervals[0]!.fn();
    expect(reg.update).toHaveBeenCalledTimes(2);
    f.becomeVisible();
    expect(reg.update).toHaveBeenCalledTimes(3);
    f.doc.visibilityState = 'hidden';
    f.becomeVisible();
    expect(reg.update).toHaveBeenCalledTimes(3);
  });

  it('a failed check (offline) is ignored', async () => {
    const f = fakeEnv();
    const reg = { update: vi.fn(() => Promise.reject(new Error('offline'))) };
    const register: RegisterSW = (options) => {
      options.onRegisteredSW?.('/sw.js', reg as unknown as ServiceWorkerRegistration);
      return async () => {};
    };
    createSwUpdate(f.env).install(register);
    await Promise.resolve();
    expect(reg.update).toHaveBeenCalledTimes(1);
  });
});

describe('mayAutoReload (loop guard, Phase 24)', () => {
  it('allows one automatic reload per version in a browser tab', () => {
    expect(mayAutoReload('v1', null)).toBe(true);
    expect(mayAutoReload('v2', 'v1')).toBe(true);
    expect(mayAutoReload('v1', 'v1')).toBe(false);
  });
});

describe('applying a waiting version (Phase 24, FR-051a)', () => {
  function setupWith(f: ReturnType<typeof fakeEnv>) {
    const calls: Array<boolean | undefined> = [];
    let needRefresh: (() => void) | undefined;
    const register: RegisterSW = (options) => {
      needRefresh = options.onNeedRefresh;
      return async (reload?: boolean) => void calls.push(reload);
    };
    const sw = createSwUpdate(f.env);
    sw.install(register);
    return { sw, calls, newVersion: () => needRefresh?.() };
  }

  it('on load on the start screen applies it at once and remembers the version it reloaded from', () => {
    const f = fakeEnv('v1');
    const s = setupWith(f);
    s.newVersion();
    s.sw.setStartScreen(true);
    expect(s.calls).toEqual([true]);
    expect(f.stored[AUTO_RELOAD_KEY]).toBe('v1');
  });

  it('mid-round it waits for the start screen', () => {
    const f = fakeEnv('v1');
    const s = setupWith(f);
    f.touch();
    s.sw.setStartScreen(false);
    s.newVersion();
    expect(s.calls).toEqual([]);
    s.sw.setStartScreen(true);
    expect(s.calls).toEqual([true]);
  });

  it('does not reload again when the page already reloaded once from this version (no reload loop)', () => {
    const f = fakeEnv('v1', { [AUTO_RELOAD_KEY]: 'v1' });
    const s = setupWith(f);
    s.sw.setStartScreen(true);
    s.newVersion();
    expect(s.calls).toEqual([]);
  });

  it('after an update to v2, a later version v3 is applied again', () => {
    const f = fakeEnv('v2', { [AUTO_RELOAD_KEY]: 'v1' });
    const s = setupWith(f);
    s.sw.setStartScreen(true);
    s.newVersion();
    expect(s.calls).toEqual([true]);
    expect(f.stored[AUTO_RELOAD_KEY]).toBe('v2');
  });
});

describe('amendment 12: new versions reach open pages', () => {
  function setup(f: ReturnType<typeof fakeEnv>, fail = false) {
    const calls: Array<boolean | undefined> = [];
    const reg = registration();
    let needRefresh: (() => void) | undefined;
    const register: RegisterSW = (options) => {
      needRefresh = options.onNeedRefresh;
      options.onRegisteredSW?.('/sw.js', reg as unknown as ServiceWorkerRegistration);
      return (reload?: boolean) => {
        calls.push(reload);
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve();
      };
    };
    const sw = createSwUpdate(f.env);
    sw.install(register);
    return { sw, calls, reg, newVersion: () => needRefresh?.() };
  }

  it('asks for a new version each time the start screen shows, not again while it stays (FR-102)', () => {
    const f = fakeEnv();
    const s = setup(f);
    expect(s.reg.update).toHaveBeenCalledTimes(1);
    s.sw.setStartScreen(true);
    expect(s.reg.update).toHaveBeenCalledTimes(2);
    s.sw.setStartScreen(true);
    expect(s.reg.update).toHaveBeenCalledTimes(2);
    s.sw.setStartScreen(false);
    s.sw.setStartScreen(true);
    expect(s.reg.update).toHaveBeenCalledTimes(3);
  });

  it('a reload that restores a round applies a waiting version before the first key or touch (FR-104)', () => {
    const f = fakeEnv('v1');
    const s = setup(f);
    s.sw.setStartScreen(false);
    s.newVersion();
    expect(s.calls).toEqual([true]);
  });

  it('after the first key a version found during the round waits, and the round end reports it (FR-103)', () => {
    const f = fakeEnv('v1');
    const s = setup(f);
    s.sw.setStartScreen(false);
    f.key();
    const seen: boolean[] = [];
    s.sw.subscribe(() => seen.push(s.sw.waiting()));
    expect(s.sw.waiting()).toBe(false);
    s.newVersion();
    expect(s.calls).toEqual([]);
    expect(s.sw.waiting()).toBe(true);
    expect(seen).toEqual([true]);
    // "Zurück": the start screen applies it.
    s.sw.setStartScreen(true);
    expect(s.calls).toEqual([true]);
    expect(s.sw.waiting()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('"Nochmal" applies it and leaves the round kind for the new page, which reads it once (FR-103)', () => {
    const f = fakeEnv('v1');
    const s = setup(f);
    f.touch();
    s.newVersion();
    const onFail = vi.fn();
    expect(s.sw.applyNow('time', onFail)).toBe(true);
    expect(s.calls).toEqual([true]);
    expect(f.stored[START_AFTER_UPDATE_KEY]).toBe('time');
    const next = createSwUpdate(fakeEnv('v2', f.stored).env);
    expect(next.takeStartAfterUpdate()).toBe('time');
    expect(next.takeStartAfterUpdate()).toBeNull();
    expect(onFail).not.toHaveBeenCalled();
  });

  it('"Nochmal" without a waiting version does nothing and stores no round kind', () => {
    const f = fakeEnv('v1');
    const s = setup(f);
    f.touch();
    expect(s.sw.applyNow('play', () => {})).toBe(false);
    expect(f.stored[START_AFTER_UPDATE_KEY]).toBeUndefined();
  });

  it('a failed "Nochmal" update starts the round in the old version and clears the round kind', async () => {
    const f = fakeEnv('v1');
    const s = setup(f, true);
    f.touch();
    s.newVersion();
    const onFail = vi.fn();
    expect(s.sw.applyNow('play', onFail)).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(f.stored[START_AFTER_UPDATE_KEY]).toBeUndefined();
    expect(s.sw.waiting()).toBe(true);
  });

  it('applying a version also reloads the page itself when the new worker takes control (first visit)', () => {
    const f = fakeEnv('v1');
    const reloads = vi.fn();
    f.env.reloadOnControllerChange = reloads;
    const s = setup(f);
    s.sw.setStartScreen(true);
    expect(reloads).not.toHaveBeenCalled();
    s.newVersion();
    expect(reloads).toHaveBeenCalledTimes(1);
  });

  it('a version the loop guard holds back does not count as waiting', () => {
    const f = fakeEnv('v1', { [AUTO_RELOAD_KEY]: 'v1' });
    const s = setup(f);
    f.touch();
    s.newVersion();
    expect(s.sw.waiting()).toBe(false);
    expect(s.sw.applyNow('play', () => {})).toBe(false);
  });
});

// Copied from math-tank src/app/useScreen.test.ts, trimmed to the number pad (no layout, no lastEvent).
/**
 * Amendment 16: useNumberPadShown reads the CSS media queries of PAD_QUERIES (matchMedia), measures again on their
 * `change` events and, as a backup, on window events and after short waits. The window width is read only when no
 * matchMedia exists.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAD_QUERIES, type PadMedia } from '../core/view/screen';
import { useNumberPadShown } from './useScreen';

type Listener = (event: { matches: boolean }) => void;

const listeners = new Map<string, Set<Listener>>();
let media: PadMedia;

const DESKTOP: PadMedia = { padWidth: false, finePointer: true };
/** An iPad Mini held sideways (1024 px) with a trackpad, or a Fire tablet in Silk that reports a fine pointer. */
const TABLET_FINE: PadMedia = { padWidth: true, finePointer: true };
/** A large tablet held sideways with touch only. */
const TABLET_TOUCH_WIDE: PadMedia = { padWidth: false, finePointer: false };

function keyOf(query: string): keyof PadMedia {
  const entry = Object.entries(PAD_QUERIES).find(([, q]) => q === query);
  if (!entry) throw new Error(`unexpected media query ${query}`);
  return entry[0] as keyof PadMedia;
}

/** Changes the media query results and fires `change` on the queries whose result changed, as a browser does. */
function setMedia(next: PadMedia): void {
  const before = media;
  media = next;
  for (const key of Object.keys(next) as Array<keyof PadMedia>) {
    if (before[key] === next[key]) continue;
    for (const listener of listeners.get(PAD_QUERIES[key]) ?? []) listener({ matches: next[key] });
  }
}

function listenerCount(): number {
  let n = 0;
  for (const set of listeners.values()) n += set.size;
  return n;
}

beforeEach(() => {
  vi.useFakeTimers();
  listeners.clear();
  media = DESKTOP;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  // jsdom has no matchMedia: every query of PAD_QUERIES answers from `media`.
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return media[keyOf(query)];
    },
    addEventListener: (_type: string, listener: Listener) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => listeners.get(query)?.delete(listener),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useNumberPadShown (amendment 16)', () => {
  it('auto: no pad on a wide screen with a fine pointer, a pad on a narrow one or without a fine pointer', () => {
    const { result } = renderHook(() => useNumberPadShown('auto'));
    expect(result.current).toBe(false);
    act(() => setMedia(TABLET_FINE));
    expect(result.current).toBe(true);
    act(() => setMedia(TABLET_TOUCH_WIDE));
    expect(result.current).toBe(true);
    act(() => setMedia(DESKTOP));
    expect(result.current).toBe(false);
  });

  it('always and never ignore the media queries', () => {
    const always = renderHook(() => useNumberPadShown('always'));
    const never = renderHook(() => useNumberPadShown('never'));
    expect(always.result.current).toBe(true);
    expect(never.result.current).toBe(false);
    act(() => setMedia(TABLET_FINE));
    expect(always.result.current).toBe(true);
    expect(never.result.current).toBe(false);
  });

  it('reads the media queries on mounting', () => {
    media = TABLET_FINE;
    const { result } = renderHook(() => useNumberPadShown('auto'));
    expect(result.current).toBe(true);
  });

  it('measures again after an event and after short waits, as a backup (math-tank T306)', () => {
    const { result } = renderHook(() => useNumberPadShown('auto'));
    // The queries change without a change event; the orientationchange event and the re-measures after it pick it up.
    media = TABLET_FINE;
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    expect(result.current).toBe(true);
    media = DESKTOP;
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toBe(false);
  });

  it('measures again when the page comes back to the front', () => {
    const { result } = renderHook(() => useNumberPadShown('auto'));
    media = TABLET_FINE;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(true);
    media = DESKTOP;
    act(() => {
      window.dispatchEvent(new Event('pageshow'));
    });
    expect(result.current).toBe(false);
  });

  it('uses the window width when no matchMedia exists', () => {
    // @ts-expect-error: a browser without matchMedia
    delete window.matchMedia;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    const { result } = renderHook(() => useNumberPadShown('auto'));
    expect(result.current).toBe(true);
  });

  it('reads the same media query lists on every measurement instead of asking matchMedia again', () => {
    const spy = vi.spyOn(window, 'matchMedia');
    const { result } = renderHook(() => useNumberPadShown('auto'));
    const afterMount = spy.mock.calls.length;
    media = TABLET_FINE;
    act(() => {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toBe(true);
    expect(spy.mock.calls.length).toBe(afterMount);
  });

  it('stops measuring after unmount', () => {
    const { unmount } = renderHook(() => useNumberPadShown('auto'));
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    unmount();
    expect(listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

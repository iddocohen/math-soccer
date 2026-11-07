// Copied from math-tank src/app/useScreen.ts, trimmed to the number pad (math-soccer has one match layout, and no
// `?debug=screen` overlay, so `layout` and `lastEvent` are left out).
/**
 * Whether the number pad shows (FR-031, amendment 16), from the CSS media queries of PAD_QUERIES
 * (src/core/view/screen.ts) and the parent's "Zahlenfeld" setting. The rule itself is pure, in src/core/view/screen.ts.
 *
 * As in math-tank, the hook reads the media queries (`matchMedia`) and listens to their `change` events, because
 * Chrome on iOS can report `window.innerWidth` from before a turn. As a backup it also measures on `resize`,
 * `orientationchange`, `visualViewport` resize and when the page comes back to the front (`pageshow`,
 * `visibilitychange`), and after each of these on the next animation frame and after REMEASURE_DELAYS_MS. The window
 * width is read only when no matchMedia exists.
 */
import { useEffect, useState } from 'react';
import { numberPadShown, PAD_QUERIES, padMediaFromWidth, type NumberPadSetting, type PadMedia } from '../core/view/screen';

/** Waits after an event (and after mounting) before measuring again (math-tank bug T306). */
export const REMEASURE_DELAYS_MS = [100, 300, 700, 1500] as const;

const KEYS = Object.keys(PAD_QUERIES) as Array<keyof PadMedia>;

type QueryLists = Record<keyof PadMedia, MediaQueryList>;

/** One MediaQueryList per query of PAD_QUERIES, or null without matchMedia. */
function queryLists(): QueryLists | null {
  if (typeof window.matchMedia !== 'function') return null;
  const lists = {} as QueryLists;
  for (const key of KEYS) lists[key] = window.matchMedia(PAD_QUERIES[key]);
  return lists;
}

/** The media query results from `lists`; from the window width only without matchMedia (counts as a fine pointer). */
export function readPadMedia(lists: QueryLists | null = queryLists()): PadMedia {
  if (lists === null) return padMediaFromWidth(window.innerWidth, true);
  const media = {} as PadMedia;
  for (const key of KEYS) media[key] = lists[key].matches;
  return media;
}

function sameMedia(a: PadMedia, b: PadMedia): boolean {
  return KEYS.every((key) => a[key] === b[key]);
}

/** True when the number pad shows with `setting` on this device; follows resizes, turns and pointer changes. */
export function useNumberPadShown(setting: NumberPadSetting): boolean {
  const [media, setMedia] = useState<PadMedia>(() => readPadMedia());

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let frame: number | null = null;
    // The lists are made once and read on every measurement; each list's `matches` follows the browser's layout.
    const lists = queryLists();
    const measure = () => {
      const next = readPadMedia(lists);
      setMedia((prev) => (sameMedia(prev, next) ? prev : next));
    };
    const measureSoon = () => {
      measure();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => ((frame = null), measure())) : null;
      for (const delay of REMEASURE_DELAYS_MS) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          measure();
        }, delay);
        timers.add(timer);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') measureSoon();
    };
    const queries = KEYS.map((key) => lists?.[key]);
    for (const list of queries) list?.addEventListener?.('change', measureSoon);
    const windowEvents = ['resize', 'orientationchange', 'pageshow'] as const;
    const viewportApi = window.visualViewport;
    for (const type of windowEvents) window.addEventListener(type, measureSoon);
    document.addEventListener('visibilitychange', onVisibility);
    viewportApi?.addEventListener('resize', measureSoon);
    // The result read during the first render can be the one from before a turn or a reload (iOS).
    measureSoon();
    return () => {
      for (const type of windowEvents) window.removeEventListener(type, measureSoon);
      document.removeEventListener('visibilitychange', onVisibility);
      viewportApi?.removeEventListener('resize', measureSoon);
      for (const list of queries) list?.removeEventListener?.('change', measureSoon);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    };
  }, []);

  return numberPadShown(setting, media);
}

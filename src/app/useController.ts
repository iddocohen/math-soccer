// Adapted from math-tank src/app/useController.ts.
/**
 * React bridge to the MatchController (research R7). `useMatchState` re-renders on every new state except one where
 * only the time changed (`elapsedMs` and the countdown of the shown square), so the clock tick does not re-render the
 * whole app four times a second; `useElapsedMs` gives the time to the clock alone.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { onlyTimeChanged, type MatchController, type MatchView } from '../core/match/MatchController';

export function useMatchState(controller: MatchController): MatchView {
  const last = useRef<MatchView | null>(null);
  const subscribe = useCallback((onChange: () => void) => controller.subscribe(onChange), [controller]);
  const getSnapshot = useCallback(() => {
    const next = controller.getState();
    const prev = last.current;
    if (prev !== null && onlyTimeChanged(prev, next)) return prev;
    last.current = next;
    return next;
  }, [controller]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Where the clock reads the time played. */
export interface ClockSource {
  subscribe(onChange: () => void): () => void;
  elapsedMs(): number;
}

/** The time played, re-rendering only the component that shows it. */
export function useElapsedMs(source: ClockSource): number {
  return useSyncExternalStore(source.subscribe, source.elapsedMs);
}

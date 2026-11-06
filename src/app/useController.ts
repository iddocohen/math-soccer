// Adapted from math-tank src/app/useController.ts.
/** React bridge to the MatchController (research R7): re-renders on every new state, as a read-only MatchView. */
import { useCallback, useSyncExternalStore } from 'react';
import type { MatchController, MatchView } from '../core/match/MatchController';

export function useMatchState(controller: MatchController): MatchView {
  const subscribe = useCallback((onChange: () => void) => controller.subscribe(onChange), [controller]);
  const getSnapshot = useCallback(() => controller.getState(), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Adapted from math-tank src/app/useController.ts.
/** React bridge to the MatchController (research R7): re-renders on every new MatchState. */
import { useCallback, useSyncExternalStore } from 'react';
import type { MatchController, MatchState } from '../core/match/MatchController';

export function useMatchState(controller: MatchController): MatchState {
  const subscribe = useCallback((onChange: () => void) => controller.subscribe(onChange), [controller]);
  const getSnapshot = useCallback(() => controller.getState(), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

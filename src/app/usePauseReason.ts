/**
 * Holds one pause reason of the MatchController while `on` is true (refactor R1, FR-034, FR-049): a parent screen or the
 * transfer dialog, the locker room over the match, or the cup's intro card. The controller keeps the reasons, so the
 * round plays again only when the last one ends, and a round the child paused stays paused.
 *
 * A layout effect sets the reason in the same commit as the screen that needs it, before the next clock tick.
 */
import { useLayoutEffect } from 'react';
import type { PauseReason } from '../core/match/MatchController';

/** The parts of the MatchController this hook uses. */
export interface Pausable {
  pause(reason: PauseReason): void;
  resume(reason: PauseReason): void;
}

export function usePauseReason(controller: Pausable, reason: PauseReason, on: boolean): void {
  useLayoutEffect(() => {
    if (!on) return;
    controller.pause(reason);
    return () => controller.resume(reason);
  }, [controller, reason, on]);
}

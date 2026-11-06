// Adapted from math-tank src/app/useAutoPause.ts: MatchController keeps `paused` beside the phase.
/**
 * Pauses a running round while a parent screen or the transfer dialog is open, and resumes only what it paused
 * (FR-034). The app passes one flag, so the round resumes only when the last reason ends, whatever order they come
 * and go in. A round the child paused with the pause button stays paused: the hook resumes only a pause it made itself.
 */
import { useEffect, useRef } from 'react';

/** The parts of the MatchController this hook uses. */
export interface Pausable {
  getState(): { paused: boolean; phase: string; started: boolean };
  pause(): void;
  resume(): void;
}

export function useAutoPause(controller: Pausable, phase: string, wantPause: boolean): void {
  const pausedByApp = useRef(false);
  useEffect(() => {
    if (phase === 'roundOver') {
      pausedByApp.current = false;
      return;
    }
    if (wantPause) {
      if (controller.getState().paused) return;
      controller.pause();
      pausedByApp.current = controller.getState().paused;
    } else if (pausedByApp.current) {
      pausedByApp.current = false;
      controller.resume();
    }
  }, [controller, phase, wantPause]);
}

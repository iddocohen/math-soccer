// Copied from math-tank src/app/useHold.ts.
/**
 * Press and hold for 2 seconds with mouse or touch (FR-034, as math-tank), shared by the parent gate and the
 * "Übernehmen" button of the save transfer (FR-041). A shorter press, leaving the button or any key
 * does nothing. The time is measured with the clock, not by counting ticks: a busy page (the match canvas) delays
 * interval callbacks.
 */
import { useEffect, useRef, useState } from 'react';

export const HOLD_MS = 2000;
const TICK_MS = 50;

export interface Hold {
  /** 0 to 1 while pressed, for the filling ring. */
  progress: number;
  /** Pointer and key handlers for the button. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onContextMenu: (e: React.SyntheticEvent) => void;
    onMouseDown: (e: React.SyntheticEvent) => void;
    onKeyDown: (e: React.SyntheticEvent) => void;
    onKeyUp: (e: React.SyntheticEvent) => void;
  };
}

/** `onDone` runs once when a press has lasted `HOLD_MS`; `enabled` false ignores presses. */
export function useHold(onDone: () => void, enabled = true): Hold {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const stop = () => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  useEffect(
    () => () => {
      if (timer.current !== null) clearInterval(timer.current);
    },
    [],
  );

  const start = (e: React.PointerEvent) => {
    if (e.button !== 0 || !enabled) return;
    stop();
    const startedAt = Date.now();
    timer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= HOLD_MS) {
        stop();
        done.current();
        return;
      }
      setProgress(elapsed / HOLD_MS);
    }, TICK_MS);
  };

  const prevent = (e: React.SyntheticEvent) => e.preventDefault();
  return {
    progress,
    handlers: {
      onPointerDown: start,
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      // No long-press menu on touch, no focus on mouse down, and no key does anything.
      onContextMenu: prevent,
      onMouseDown: prevent,
      onKeyDown: prevent,
      onKeyUp: prevent,
    },
  };
}

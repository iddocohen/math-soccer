// Adapted from math-tank src/app/keyboard.ts.
/**
 * Keyboard map per screen (contracts/screens.md, research R12). Pure: keyToAction turns one key event into an action
 * for the current screen, or null when the key does nothing there.
 *
 * - Start screen: 1, 2 and 3 start hole, line and goalkeeper mode when that mode is offered; Enter or Space starts the
 *   mode named by `?mode=` when it is offered, otherwise the first offered mode; K opens the locker room when it is on.
 * - Match: digits, Backspace, Enter or Space shoot, H help, Escape pause. Mode keys work only on the start screen, so
 *   digits always type during a round (plan decision 7).
 * - Paused: Enter, Space or Escape resume. Round end: Enter or Space play again.
 *
 * Keys with Ctrl, Alt or Meta stay with the browser, held Enter and Space do not repeat, and no key opens the parent
 * gate.
 */
import type { Digit } from '../core/match/entry';
import { MODES, type Mode } from '../core/types';

/** The fields of a KeyboardEvent the map reads. */
export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}

export type KeyScreen = 'start' | 'match' | 'paused' | 'roundEnd';

export type KeyAction =
  | { type: 'start'; mode: Mode }
  | { type: 'lockerRoom' }
  | { type: 'digit'; digit: Digit }
  | { type: 'backspace' }
  | { type: 'shoot' }
  | { type: 'help' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'again' };

export interface KeyContext {
  /** The offered modes in start-screen order. */
  modes?: readonly Mode[];
  /** The parent's locker room setting: K opens it only when it is on. */
  lockerRoom?: boolean;
  /** The mode Enter and Space start when it is offered (`?mode=` in tests); otherwise the first offered mode. */
  enterMode?: Mode;
}

export function keyToAction(event: KeyLike, screen: KeyScreen, context: KeyContext = {}): KeyAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const { key } = event;
  const isEnter = key === 'Enter';
  const isSpace = key === ' ' || key === 'Spacebar';
  if ((isEnter || isSpace) && event.repeat) return null;
  const offered = MODES.filter((m) => context.modes?.includes(m));

  switch (screen) {
    case 'start': {
      if (isEnter || isSpace) {
        const mode = context.enterMode && offered.includes(context.enterMode) ? context.enterMode : offered[0];
        return mode ? { type: 'start', mode } : null;
      }
      if (/^[1-3]$/.test(key)) {
        const mode = MODES[Number(key) - 1]!;
        return !event.repeat && offered.includes(mode) ? { type: 'start', mode } : null;
      }
      return (key === 'k' || key === 'K') && context.lockerRoom === true ? { type: 'lockerRoom' } : null;
    }
    case 'paused':
      return isEnter || isSpace || key === 'Escape' ? { type: 'resume' } : null;
    case 'roundEnd':
      return isEnter || isSpace ? { type: 'again' } : null;
    case 'match':
      if (/^[0-9]$/.test(key)) return { type: 'digit', digit: Number(key) as Digit };
      if (key === 'Backspace') return { type: 'backspace' };
      if (isEnter || isSpace) return { type: 'shoot' };
      if (key === 'h' || key === 'H') return { type: 'help' };
      if (key === 'Escape') return { type: 'pause' };
      return null;
  }
}

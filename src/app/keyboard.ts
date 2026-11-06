// Adapted from math-tank src/app/keyboard.ts.
/**
 * Keyboard map per screen (contracts/screens.md, research R12). Pure: keyToAction turns one key event into an action
 * for the current screen, or null when the key does nothing there.
 *
 * - Start screen (FR-068, FR-075): Enter or Space start "Spielen"; Z starts the "Zeit-Challenge" when the parent allows
 *   it; K opens the locker room when it is on. `?start=time` in tests makes Enter and Space start the time challenge
 *   when it is allowed. Start keys work only on the start screen, so digits always type during a round (plan
 *   decision 7).
 * - Match: digits, Backspace, Enter or Space shoot, H help, Escape pause.
 * - Help chart open (help step 3): the keys map as in the match; MatchController.typeKey closes the chart on Enter,
 *   Space or Escape without shooting or pausing.
 * - Paused: Enter, Space or Escape resume. Round end: Enter or Space play again.
 *
 * Keys with Ctrl, Alt or Meta stay with the browser, held Enter and Space do not repeat, and no key opens the parent
 * gate.
 */
import type { Digit } from '../core/match/entry';

/** What a start screen button starts: a normal round ("Spielen") or the time challenge ("Zeit-Challenge"). */
export const START_KINDS = ['play', 'time'] as const;
export type StartKind = (typeof START_KINDS)[number];

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
  | { type: 'start'; kind: StartKind }
  | { type: 'lockerRoom' }
  | { type: 'digit'; digit: Digit }
  | { type: 'backspace' }
  | { type: 'shoot' }
  | { type: 'help' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'again' };

export interface KeyContext {
  /** The parent allows the time challenge: Z starts it only then. */
  timeChallenge?: boolean;
  /** The parent's locker room setting: K opens it only when it is on. */
  lockerRoom?: boolean;
  /** What Enter and Space start (`?start=` in tests); 'time' only when the time challenge is allowed. */
  enterStart?: StartKind;
}

export function keyToAction(event: KeyLike, screen: KeyScreen, context: KeyContext = {}): KeyAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const { key } = event;
  const isEnter = key === 'Enter';
  const isSpace = key === ' ' || key === 'Spacebar';
  if ((isEnter || isSpace) && event.repeat) return null;

  switch (screen) {
    case 'start': {
      if (isEnter || isSpace) {
        return { type: 'start', kind: context.enterStart === 'time' && context.timeChallenge === true ? 'time' : 'play' };
      }
      if (key === 'z' || key === 'Z') {
        return !event.repeat && context.timeChallenge === true ? { type: 'start', kind: 'time' } : null;
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

// Adapted from math-tank src/app/keyboard.ts.
/**
 * Keyboard map per screen (contracts/screens.md, research R12). Pure: keyToAction turns one key event into an action
 * for the current screen, or null when the key does nothing there.
 *
 * - Start screen (FR-068, FR-075): Enter or Space start "Spielen"; Z starts the "Zeit-Challenge" when the parent allows
 *   it; P opens the cup's bracket screen ("Pokal", amendment 13, FR-105); K opens the locker room when it is on.
 *   `?start=time` in tests makes Enter and Space start the time challenge when it is allowed, `?start=cup` the next cup
 *   match without the bracket screen.
 * - Start screen, modes to unlock (amendment 21, FR-141): M "Mauer", T "Torwart", E "Elfmeter". A key does something
 *   only while its button shows (`modeKeys`): an unlocked mode starts, a locked one opens the locker room at
 *   "Spielarten" (with the locker room on). An unlocked mode whose game is not built yet does nothing.
 * - Bracket screen (FR-106): Enter or Space start the highlighted match, Escape goes back to the start screen.
 * - Match intro card of a cup match: Enter or Space skip it; every other key works as in the match. Start keys work only on the start screen, so digits always type during a round (plan
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
import type { StartKind } from '../core/match/rounds';
import { MODE_OFFERS, UNLOCK_MODES, type UnlockMode } from '../core/rewards/modes';

/** What a start screen button starts (core/match/rounds.ts). */
export { START_KINDS, type StartKind } from '../core/match/rounds';

/** What a mode key does on the start screen: start the mode, or open the locker room at "Spielarten". */
export type ModeKey = 'start' | 'locked';

/** The fields of a KeyboardEvent the map reads. */
export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}

export type KeyScreen = 'start' | 'match' | 'paused' | 'roundEnd' | 'bracket' | 'intro';

export type KeyAction =
  | { type: 'start'; kind: StartKind }
  /** Opens the locker room; `modes` scrolls it to "Spielarten" (a locked mode's key, FR-141). */
  | { type: 'lockerRoom'; group?: 'modes' }
  | { type: 'bracket' }
  | { type: 'back' }
  | { type: 'skipIntro' }
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
  /**
   * What Enter and Space start (`?start=` in tests); 'time' only when the time challenge is allowed, a mode only when
   * its key would start it.
   */
  enterStart?: StartKind;
  /** The mode keys that do something now; a mode missing here has no button or nothing to start yet. */
  modeKeys?: Partial<Record<UnlockMode, ModeKey>>;
}

/** The mode of a start screen key, M, T or E in either case; null for any other key. */
function modeOfKey(key: string): UnlockMode | null {
  return UNLOCK_MODES.find((m) => MODE_OFFERS[m].key === key.toUpperCase() && key.length === 1) ?? null;
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
        if (context.enterStart === 'cup') return { type: 'start', kind: 'cup' };
        const startMode = UNLOCK_MODES.find((m) => m === context.enterStart);
        if (startMode !== undefined && context.modeKeys?.[startMode] === 'start') return { type: 'start', kind: startMode };
        return { type: 'start', kind: context.enterStart === 'time' && context.timeChallenge === true ? 'time' : 'play' };
      }
      if (key === 'p' || key === 'P') return event.repeat ? null : { type: 'bracket' };
      if (key === 'z' || key === 'Z') {
        return !event.repeat && context.timeChallenge === true ? { type: 'start', kind: 'time' } : null;
      }
      const mode = modeOfKey(key);
      if (mode !== null) {
        const what = event.repeat ? undefined : context.modeKeys?.[mode];
        if (what === 'start') return { type: 'start', kind: mode };
        return what === 'locked' && context.lockerRoom === true ? { type: 'lockerRoom', group: 'modes' } : null;
      }
      return (key === 'k' || key === 'K') && context.lockerRoom === true ? { type: 'lockerRoom' } : null;
    }
    case 'bracket':
      if (isEnter || isSpace) return { type: 'start', kind: 'cup' };
      return key === 'Escape' ? { type: 'back' } : null;
    case 'intro':
      // Enter or Space only skip the intro card; every other key works as in the match and also ends the card.
      if (isEnter || isSpace) return { type: 'skipIntro' };
      return keyToAction(event, 'match', context);
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

// Adapted from math-tank src/app/useKeyboard.ts.
/**
 * One `keydown` listener on window. keyToAction decides what a key does on the current screen; handled keys call
 * preventDefault so the page does not scroll and no focused button is clicked. `screen` null means keys do nothing.
 * The listener is attached in a layout effect, before the browser paints, so a key pressed as soon as the start
 * screen shows is not lost (math-tank T393).
 */
import { useLayoutEffect, useRef } from 'react';
import type { MatchController } from '../core/match/MatchController';
import { keyToAction, type KeyAction, type KeyContext, type KeyScreen, type StartKind } from './keyboard';

export interface KeyboardOptions {
  screen: KeyScreen | null;
  timeChallenge?: boolean;
  lockerRoom?: boolean;
  enterStart?: StartKind;
  /** What the mode keys M, T and E do on the start screen (amendment 21). */
  modeKeys?: KeyContext['modeKeys'];
  onAction: (action: KeyAction) => void;
}

export function useKeyboard({ screen, timeChallenge = false, lockerRoom = false, enterStart, modeKeys, onAction }: KeyboardOptions): void {
  const latest = useRef({ screen, timeChallenge, lockerRoom, enterStart, modeKeys, onAction });
  latest.current = { screen, timeChallenge, lockerRoom, enterStart, modeKeys, onAction };

  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { screen: current, timeChallenge: timeOn, lockerRoom: lockerOn, enterStart: wanted, modeKeys: modes, onAction: handle } = latest.current;
      if (current === null || isTextField(event.target)) return;
      const action = keyToAction(event, current, { timeChallenge: timeOn, lockerRoom: lockerOn, enterStart: wanted, modeKeys: modes });
      if (action === null) return;
      event.preventDefault();
      handle(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/**
 * Match actions go to `controller.typeKey`, which also owns the help chart rule: with the chart open, shoot and pause
 * only close it. Returns false for actions the match does not handle (start, again).
 */
export function applyMatchAction(controller: MatchController, action: KeyAction): boolean {
  switch (action.type) {
    case 'digit':
      controller.typeKey({ digit: action.digit });
      return true;
    case 'backspace':
      controller.typeKey('backspace');
      return true;
    case 'shoot':
      controller.typeKey('enter');
      return true;
    case 'help':
      controller.typeKey('help');
      return true;
    case 'pause':
      controller.typeKey('escape');
      return true;
    case 'resume':
      controller.resume();
      return true;
    case 'start':
    case 'again':
    case 'lockerRoom':
    case 'bracket':
    case 'back':
    case 'skipIntro':
      return false;
  }
}

/** Parent screens have text fields; typing there must not reach the game. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

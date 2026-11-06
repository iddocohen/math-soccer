// Adapted from math-tank src/app/useKeyboard.ts.
/**
 * One `keydown` listener on window. keyToAction decides what a key does on the current screen; handled keys call
 * preventDefault so the page does not scroll and no focused button is clicked. `screen` null means keys do nothing.
 * The listener is attached in a layout effect, before the browser paints, so a key pressed as soon as the start
 * screen shows is not lost (math-tank T393).
 */
import { useLayoutEffect, useRef } from 'react';
import type { MatchController } from '../core/match/MatchController';
import type { Mode } from '../core/types';
import { keyToAction, type KeyAction, type KeyScreen } from './keyboard';

export interface KeyboardOptions {
  screen: KeyScreen | null;
  modes?: readonly Mode[];
  lockerRoom?: boolean;
  onAction: (action: KeyAction) => void;
}

export function useKeyboard({ screen, modes = [], lockerRoom = false, onAction }: KeyboardOptions): void {
  const latest = useRef({ screen, modes, lockerRoom, onAction });
  latest.current = { screen, modes, lockerRoom, onAction };

  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { screen: current, modes: offered, lockerRoom: lockerOn, onAction: handle } = latest.current;
      if (current === null || isTextField(event.target)) return;
      const action = keyToAction(event, current, { modes: offered, lockerRoom: lockerOn });
      if (action === null) return;
      event.preventDefault();
      handle(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/** Match actions go to controller methods. Returns false for actions the match does not handle (start, again). */
export function applyMatchAction(controller: MatchController, action: KeyAction): boolean {
  switch (action.type) {
    case 'digit':
      controller.typeKey({ digit: action.digit });
      return true;
    case 'backspace':
      controller.typeKey('backspace');
      return true;
    case 'shoot':
      controller.shoot();
      return true;
    case 'help':
      controller.askHelp();
      return true;
    case 'pause':
      controller.pause();
      return true;
    case 'resume':
      controller.resume();
      return true;
    case 'start':
    case 'again':
    case 'lockerRoom':
      return false;
  }
}

/** Parent screens have text fields; typing there must not reach the game. */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

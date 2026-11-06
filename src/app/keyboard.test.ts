// Adapted from math-tank src/app/keyboard.test.ts.
import { describe, expect, it } from 'vitest';
import { keyToAction, type KeyLike, type KeyScreen } from './keyboard';

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({ key: k, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...extra });
const SCREENS: KeyScreen[] = ['start', 'match', 'paused', 'roundEnd'];
const ALL = { modes: ['holes', 'lines', 'keeper'] as const, lockerRoom: true };

describe('keyToAction: start screen', () => {
  it('1, 2 and 3 start hole, line and goalkeeper mode', () => {
    expect(keyToAction(key('1'), 'start', ALL)).toEqual({ type: 'start', mode: 'holes' });
    expect(keyToAction(key('2'), 'start', ALL)).toEqual({ type: 'start', mode: 'lines' });
    expect(keyToAction(key('3'), 'start', ALL)).toEqual({ type: 'start', mode: 'keeper' });
  });

  it('a mode key does nothing when that mode is not offered', () => {
    expect(keyToAction(key('2'), 'start', { modes: ['holes', 'keeper'] })).toBeNull();
  });

  it('Enter and Space start the first offered mode', () => {
    expect(keyToAction(key('Enter'), 'start', ALL)).toEqual({ type: 'start', mode: 'holes' });
    expect(keyToAction(key(' '), 'start', { modes: ['keeper', 'lines'] })).toEqual({ type: 'start', mode: 'lines' });
    expect(keyToAction(key('Enter'), 'start', { modes: [] })).toBeNull();
  });

  it('K opens the locker room only when it is on', () => {
    expect(keyToAction(key('k'), 'start', ALL)).toEqual({ type: 'lockerRoom' });
    expect(keyToAction(key('K'), 'start', ALL)).toEqual({ type: 'lockerRoom' });
    expect(keyToAction(key('k'), 'start', { ...ALL, lockerRoom: false })).toBeNull();
  });

  it('other digits and H do nothing on the start screen', () => {
    expect(keyToAction(key('4'), 'start', ALL)).toBeNull();
    expect(keyToAction(key('h'), 'start', ALL)).toBeNull();
  });
});

describe('keyToAction: match', () => {
  it('maps digits 0 to 9, including 1 to 3, to digit actions', () => {
    for (let d = 0; d <= 9; d++) {
      expect(keyToAction(key(String(d)), 'match', ALL)).toEqual({ type: 'digit', digit: d });
    }
  });

  it('Backspace deletes, Enter and Space shoot, H helps, Escape pauses', () => {
    expect(keyToAction(key('Backspace'), 'match')).toEqual({ type: 'backspace' });
    expect(keyToAction(key('Enter'), 'match')).toEqual({ type: 'shoot' });
    expect(keyToAction(key(' '), 'match')).toEqual({ type: 'shoot' });
    expect(keyToAction(key('h'), 'match')).toEqual({ type: 'help' });
    expect(keyToAction(key('H'), 'match')).toEqual({ type: 'help' });
    expect(keyToAction(key('Escape'), 'match')).toEqual({ type: 'pause' });
  });

  it('K and arrow keys do nothing in a match', () => {
    expect(keyToAction(key('k'), 'match', ALL)).toBeNull();
    expect(keyToAction(key('ArrowLeft'), 'match')).toBeNull();
  });
});

describe('keyToAction: paused and round end', () => {
  it('Enter, Space and Escape resume a paused match', () => {
    for (const k of ['Enter', ' ', 'Escape']) expect(keyToAction(key(k), 'paused')).toEqual({ type: 'resume' });
    expect(keyToAction(key('5'), 'paused')).toBeNull();
  });

  it('Enter and Space play again at the round end', () => {
    expect(keyToAction(key('Enter'), 'roundEnd')).toEqual({ type: 'again' });
    expect(keyToAction(key(' '), 'roundEnd')).toEqual({ type: 'again' });
    expect(keyToAction(key('Escape'), 'roundEnd')).toBeNull();
  });
});

describe('keyToAction: keys left to the browser', () => {
  it('ignores repeated Enter and Space everywhere', () => {
    for (const screen of SCREENS) {
      expect(keyToAction(key('Enter', { repeat: true }), screen, ALL)).toBeNull();
      expect(keyToAction(key(' ', { repeat: true }), screen, ALL)).toBeNull();
    }
  });

  it('ignores keys with Ctrl, Alt or Meta', () => {
    for (const screen of SCREENS) {
      expect(keyToAction(key('1', { ctrlKey: true }), screen, ALL)).toBeNull();
      expect(keyToAction(key('Enter', { altKey: true }), screen, ALL)).toBeNull();
      expect(keyToAction(key('h', { metaKey: true }), screen, ALL)).toBeNull();
    }
  });
});

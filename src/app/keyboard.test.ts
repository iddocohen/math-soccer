// Adapted from math-tank src/app/keyboard.test.ts.
import { describe, expect, it } from 'vitest';
import { MatchController } from '../core/match/MatchController';
import { defaultSettings } from '../core/settings/defaults';
import type { Target } from '../core/types';
import { keyToAction, type KeyLike, type KeyScreen } from './keyboard';
import { applyMatchAction } from './useKeyboard';

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({ key: k, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...extra });
const SCREENS: KeyScreen[] = ['start', 'match', 'paused', 'roundEnd'];
const ALL = { timeChallenge: true, lockerRoom: true };

describe('keyToAction: start screen', () => {
  it('Enter and Space start "Spielen" (FR-068)', () => {
    expect(keyToAction(key('Enter'), 'start', ALL)).toEqual({ type: 'start', kind: 'play' });
    expect(keyToAction(key(' '), 'start', {})).toEqual({ type: 'start', kind: 'play' });
  });

  it('Z starts the time challenge only when the parent allows it (FR-075)', () => {
    expect(keyToAction(key('z'), 'start', ALL)).toEqual({ type: 'start', kind: 'time' });
    expect(keyToAction(key('Z'), 'start', ALL)).toEqual({ type: 'start', kind: 'time' });
    expect(keyToAction(key('z'), 'start', { ...ALL, timeChallenge: false })).toBeNull();
    expect(keyToAction(key('z', { repeat: true }), 'start', ALL)).toBeNull();
  });

  it('Enter and Space start what ?start= names, the time challenge only when allowed', () => {
    expect(keyToAction(key('Enter'), 'start', { ...ALL, enterStart: 'time' })).toEqual({ type: 'start', kind: 'time' });
    expect(keyToAction(key(' '), 'start', { timeChallenge: false, enterStart: 'time' })).toEqual({ type: 'start', kind: 'play' });
    expect(keyToAction(key('Enter'), 'start', { ...ALL, enterStart: 'play' })).toEqual({ type: 'start', kind: 'play' });
  });

  it('P opens the bracket screen, and Enter starts the next cup match with ?start=cup (FR-105)', () => {
    expect(keyToAction(key('p'), 'start', ALL)).toEqual({ type: 'bracket' });
    expect(keyToAction(key('P'), 'start', {})).toEqual({ type: 'bracket' });
    expect(keyToAction(key('p', { repeat: true }), 'start', ALL)).toBeNull();
    expect(keyToAction(key('Enter'), 'start', { ...ALL, enterStart: 'cup' })).toEqual({ type: 'start', kind: 'cup' });
    for (const screen of ['match', 'paused', 'roundEnd', 'bracket', 'intro'] as const) expect(keyToAction(key('p'), screen, ALL)).toBeNull();
  });

  it('on the bracket screen Enter or Space start the highlighted match and Escape goes back (FR-106)', () => {
    expect(keyToAction(key('Enter'), 'bracket', ALL)).toEqual({ type: 'start', kind: 'cup' });
    expect(keyToAction(key(' '), 'bracket', ALL)).toEqual({ type: 'start', kind: 'cup' });
    expect(keyToAction(key('Enter', { repeat: true }), 'bracket', ALL)).toBeNull();
    expect(keyToAction(key('Escape'), 'bracket', ALL)).toEqual({ type: 'back' });
    expect(keyToAction(key('5'), 'bracket', ALL)).toBeNull();
  });

  it('during the match intro Enter or Space skip it and never shoot; digits type as in the match', () => {
    expect(keyToAction(key('Enter'), 'intro', ALL)).toEqual({ type: 'skipIntro' });
    expect(keyToAction(key(' '), 'intro', ALL)).toEqual({ type: 'skipIntro' });
    expect(keyToAction(key('7'), 'intro', ALL)).toEqual({ type: 'digit', digit: 7 });
    expect(keyToAction(key('Escape'), 'intro', ALL)).toEqual({ type: 'pause' });
  });

  it('K opens the locker room only when it is on', () => {
    expect(keyToAction(key('k'), 'start', ALL)).toEqual({ type: 'lockerRoom' });
    expect(keyToAction(key('K'), 'start', ALL)).toEqual({ type: 'lockerRoom' });
    expect(keyToAction(key('k'), 'start', { ...ALL, lockerRoom: false })).toBeNull();
  });

  it('digits, including the old mode keys 1 to 3, and H do nothing on the start screen', () => {
    for (const d of ['1', '2', '3', '4']) expect(keyToAction(key(d), 'start', ALL)).toBeNull();
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

describe('applyMatchAction: help chart open (help step 3)', () => {
  function chartOpen(): MatchController {
    const target: Target = { number: 46, hints: [45], directions: ['right'], level: 1, pattern: 'neighbors' };
    const c = new MatchController({ settings: defaultSettings, newSeed: () => 7, nextTarget: () => target });
    c.start();
    c.typeKey({ digit: 4 });
    c.askHelp();
    c.askHelp();
    c.askHelp();
    return c;
  }

  for (const k of ['Enter', ' ', 'Escape']) {
    it(`${k === ' ' ? 'Space' : k} closes the chart; it does not shoot or pause`, () => {
      const c = chartOpen();
      applyMatchAction(c, keyToAction(key(k), 'match', ALL)!);
      expect(c.getState()).toMatchObject({ helpStep: 3, helpChartOpen: false, phase: 'aiming', paused: false, ball: null });
    });
  }

  it('H goes on to help step 4; digits and Backspace close it and type', () => {
    const c = chartOpen();
    applyMatchAction(c, keyToAction(key('h'), 'match', ALL)!);
    expect(c.getState()).toMatchObject({ helpStep: 4, helpChartOpen: false });
    const d = chartOpen();
    applyMatchAction(d, keyToAction(key('5'), 'match', ALL)!);
    expect(d.getState()).toMatchObject({ helpChartOpen: false, entry: '45' });
    const b = chartOpen();
    applyMatchAction(b, keyToAction(key('Backspace'), 'match', ALL)!);
    expect(b.getState()).toMatchObject({ helpChartOpen: false, entry: '' });
  });
});

import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Target } from '../types';
import { MatchController } from './MatchController';
import type { Digit } from './entry';

function target(number: number): Target {
  return { mode: 'holes', number, hints: [number - 1], patchedHoles: [], directions: ['right'], difficultyStep: 0 };
}

function makeController(answer = 46) {
  const c = new MatchController({ settings: defaultSettings, newSeed: () => 7, nextTarget: () => target(answer) });
  c.start('holes');
  return c;
}

function type(c: MatchController, text: string) {
  for (const ch of text) c.typeKey({ digit: Number(ch) as Digit });
}

describe('MatchController skeleton', () => {
  it('starts in aiming with a target, 3 hearts and no goals', () => {
    const s = makeController().getState();
    expect(s).toMatchObject({ started: true, mode: 'holes', seed: 7, phase: 'aiming', goals: 0, hearts: 3, helpStep: 0 });
    expect(s.target?.number).toBe(46);
  });

  it('refuses a number above the range: no shot, the range message, entry cleared (FR-005)', () => {
    const c = makeController();
    type(c, '150');
    c.shoot();
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, entry: '', message: { kind: 'outOfRange', min: 1, max: 100 } });
  });

  it('refuses 0 in the range 1 to 100', () => {
    const c = makeController();
    type(c, '0');
    c.typeKey('enter');
    expect(c.getState().phase).toBe('aiming');
    expect(c.getState().message).toEqual({ kind: 'outOfRange', min: 1, max: 100 });
  });

  it('does nothing when Enter is pressed with nothing typed', () => {
    const c = makeController();
    const before = c.getState();
    c.shoot();
    expect(c.getState()).toBe(before);
  });

  it('shoots an in-range number and lands it as a goal, then the next target after the celebration', () => {
    const c = makeController();
    type(c, '46');
    c.typeKey('enter');
    expect(c.getState()).toMatchObject({ phase: 'ballInFlight', ball: { number: 46, outcome: null }, entry: '' });
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'celebrating', goals: 1, ball: { outcome: 'goal' }, message: { kind: 'goal' } });
    c.celebrationDone();
    expect(c.getState()).toMatchObject({ phase: 'aiming', ball: null, helpStep: 0 });
  });

  it('lands a wrong number as a miss: back to aiming, help step +1, the square named', () => {
    const c = makeController();
    type(c, '56');
    c.shoot();
    c.ballLanded();
    expect(c.getState()).toMatchObject({ phase: 'aiming', goals: 0, missesInRow: 1, helpStep: 1, message: { kind: 'miss', number: 56 } });
  });

  it('ignores typing and help while the ball flies', () => {
    const c = makeController();
    type(c, '46');
    c.shoot();
    type(c, '1');
    c.askHelp();
    expect(c.getState()).toMatchObject({ entry: '', helpStep: 0, phase: 'ballInFlight' });
  });

  it('H raises the help step up to 3', () => {
    const c = makeController();
    for (let i = 0; i < 5; i++) c.typeKey('help');
    expect(c.getState().helpStep).toBe(3);
  });

  it('Escape pauses and resumes; time played stops while paused (FR-029)', () => {
    const c = makeController();
    c.tick(1000);
    c.typeKey('escape');
    expect(c.getState().paused).toBe(true);
    c.tick(5000);
    type(c, '4');
    expect(c.getState()).toMatchObject({ elapsedMs: 1000, entry: '' });
    c.typeKey('escape');
    c.tick(500);
    expect(c.getState()).toMatchObject({ paused: false, elapsedMs: 1500 });
  });

  it('notifies subscribers with a new state object and stops after unsubscribe', () => {
    const c = makeController();
    let calls = 0;
    const off = c.subscribe(() => calls++);
    const before = c.getState();
    type(c, '4');
    expect(calls).toBe(1);
    expect(c.getState()).not.toBe(before);
    off();
    type(c, '6');
    expect(calls).toBe(1);
  });

  it('reads the settings again on start', () => {
    let settings = defaultSettings();
    const c = new MatchController({ settings: () => settings, newSeed: () => 1 });
    settings = { ...settings, range: { preset: 'custom', min: 205, max: 480 } };
    c.start('keeper');
    expect(c.getState()).toMatchObject({ mode: 'keeper', min: 205, max: 480, target: null });
  });
});

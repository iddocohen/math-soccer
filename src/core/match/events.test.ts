import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { Level } from '../progress/levels';
import { STARS } from '../rewards/lockerRoom';
import type { Target } from '../types';
import { MatchController, type MatchEvent } from './MatchController';
import type { Digit } from './entry';

function target(number: number): Target {
  return { number, hints: [number - 1], directions: ['right'], level: 1, pattern: 'neighbors' };
}

/** A controller whose every target is 46, and the events of each state change in order. */
function setup(options: { settings?: () => Settings; levelUp?: Level } = {}) {
  const c = new MatchController({
    settings: options.settings ?? defaultSettings,
    newSeed: () => 7,
    nextTarget: () => target(46),
    onAttempt: () => options.levelUp ?? null,
  });
  const changes: MatchEvent[][] = [];
  c.subscribe((events) => changes.push([...events]));
  return { c, changes };
}

function shootNumber(c: MatchController, text: string) {
  for (const ch of text) c.typeKey({ digit: Number(ch) as Digit });
  c.typeKey('enter');
}

/** The events of the changes since `from`, the changes without events left out. */
function eventsSince(changes: MatchEvent[][], from: number): MatchEvent[][] {
  return changes.slice(from).filter((events) => events.length > 0);
}

describe('MatchController events (refactor R1)', () => {
  it('a new round starts with its first target', () => {
    const { c, changes } = setup();
    c.start();
    expect(eventsSince(changes, 0)).toEqual([[{ type: 'roundStarted' }, { type: 'targetChanged' }]]);
  });

  it('a goal: the shot, the landing with the stars, then the next target after the celebration', () => {
    const { c, changes } = setup();
    c.start();
    const from = changes.length;
    shootNumber(c, '46');
    c.ballLanded();
    c.celebrationDone();
    expect(eventsSince(changes, from)).toEqual([
      [{ type: 'shot' }],
      [{ type: 'landed', outcome: 'goal' }, { type: 'starsEarned', n: STARS.goal }],
      [{ type: 'targetChanged' }],
    ]);
  });

  it('a miss: the shot and the landing, no stars and no new target', () => {
    const { c, changes } = setup();
    c.start();
    const from = changes.length;
    shootNumber(c, '45');
    c.ballLanded();
    expect(eventsSince(changes, from)).toEqual([[{ type: 'shot' }], [{ type: 'landed', outcome: 'miss' }]]);
  });

  it('a level up comes with the landing of the goal, before its stars', () => {
    const { c, changes } = setup({ levelUp: 3 });
    c.start();
    const from = changes.length;
    shootNumber(c, '46');
    c.ballLanded();
    expect(eventsSince(changes, from)).toEqual([
      [{ type: 'shot' }],
      [{ type: 'landed', outcome: 'goal' }, { type: 'levelUp', level: 3 }, { type: 'starsEarned', n: STARS.goal }],
    ]);
  });

  it('the round ends after the celebration of its last goal, and a new round starts again', () => {
    const settings = (): Settings => ({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 });
    const { c, changes } = setup({ settings });
    c.start();
    shootNumber(c, '46');
    c.ballLanded();
    const from = changes.length;
    c.celebrationDone();
    expect(eventsSince(changes, from)).toEqual([[{ type: 'roundEnded' }]]);
    expect(c.getState().phase).toBe('roundOver');
    const again = changes.length;
    c.start();
    // The stars of the round before are not counted again, and the first target is new also when its count stays 1.
    expect(eventsSince(changes, again)).toEqual([[{ type: 'roundStarted' }, { type: 'targetChanged' }]]);
  });

  it('a decided shot of "Selbst ins Tor" says so, with the stars of a save', () => {
    const { c, changes } = setup();
    c.start('keeper');
    const from = changes.length;
    shootNumber(c, '46');
    expect(eventsSince(changes, from)).toEqual([[{ type: 'keeperShotDecided' }, { type: 'starsEarned', n: STARS.save }]]);
  });

  it('a pause or a clock tick carries no events', () => {
    const { c, changes } = setup();
    c.start();
    const from = changes.length;
    c.tick(1000);
    c.pause();
    c.resume();
    expect(changes.length).toBeGreaterThan(from);
    expect(eventsSince(changes, from)).toEqual([]);
  });
});

describe('MatchController pause reasons (refactor R1)', () => {
  function running() {
    const { c } = setup();
    c.start();
    return c;
  }

  it('stays paused until the last reason that pauses play ends, in any order', () => {
    const c = running();
    c.pause('parent');
    c.pause('lockerRoom');
    expect(c.getState().paused).toBe(true);
    c.resume('parent');
    expect(c.getState().paused).toBe(true);
    c.tick(500);
    expect(c.getState().elapsedMs).toBe(0);
    c.resume('lockerRoom');
    expect(c.getState().paused).toBe(false);
    c.tick(500);
    expect(c.getState().elapsedMs).toBe(500);
  });

  it("keeps the child's pause after a parent screen closes", () => {
    const c = running();
    c.pause('child');
    c.pause('parent');
    c.resume('parent');
    expect(c.getState().paused).toBe(true);
    c.resume('child');
    expect(c.getState().paused).toBe(false);
  });

  it('the child does not pause a round that is already paused by the app', () => {
    const c = running();
    c.pause('parent');
    c.pause('child');
    c.resume('parent');
    expect(c.getState().paused).toBe(false);
  });

  it('the intro card and a hidden tab stop the clock without pausing play', () => {
    const c = running();
    c.pause('cupIntro');
    c.pause('hidden');
    expect(c.getState().paused).toBe(false);
    c.tick(500);
    expect(c.getState().elapsedMs).toBe(0);
    c.resume('cupIntro');
    c.tick(500);
    expect(c.getState().elapsedMs).toBe(0);
    c.resume('hidden');
    c.tick(500);
    expect(c.getState().elapsedMs).toBe(500);
  });

  it("a new round drops the child's pause and keeps the app's reasons", () => {
    const c = running();
    c.pause('child');
    c.start();
    expect(c.getState().paused).toBe(false);
    c.pause('cupIntro');
    c.start();
    c.tick(500);
    expect(c.getState().elapsedMs).toBe(0);
    c.pause('parent');
    c.start();
    expect(c.getState().paused).toBe(true);
  });

  it('an app reason set before the round starts pauses it once it runs, and not after it ends', () => {
    const { c } = setup();
    c.pause('parent');
    expect(c.getState().paused).toBe(false);
    c.start();
    expect(c.getState().paused).toBe(true);
    c.resume('parent');
    c.pause('child');
    c.abandon();
    c.start();
    expect(c.getState().paused).toBe(false);
  });
});

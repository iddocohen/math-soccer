import { describe, expect, it } from 'vitest';
import { canStart, START_KIND_INFO, startKindOf } from '../match/rounds';
import { recordKey } from '../records/records';
import { defaultSettings } from '../settings/defaults';
import { parseSettings } from '../storage/migrate';
import { emptyLockerRoom, lockerRoomSchema, type LockerRoom } from '../storage/schemas';
import { LOCKER_ROOM } from '../storage/storage';
import { award, cleanLockerRoom } from './lockerRoom';
import { canUnlockMode, cleanModes, isModeUnlocked, MODE_OFFERS, modeButtons, modeLock, UNLOCK_MODES, unlockMode } from './modes';

const withStars = (stars: number, modes: string[] = []): LockerRoom => ({ ...emptyLockerRoom(), stars, totalEarned: stars, modes });
const ALL = { wall: true, keeper: true, shootout: true, torwand: true, family: true };

describe('modes to unlock (amendment 21, FR-140)', () => {
  it('"Freistoß mit Mauer" 200, "Selbst ins Tor" 300, "Elfmeterschießen" 600 after "Selbst ins Tor"', () => {
    expect(UNLOCK_MODES).toEqual(['wall', 'keeper', 'shootout', 'torwand', 'family']);
    expect(Object.values(MODE_OFFERS).map((o) => [o.mode, o.price, o.requires, o.key])).toEqual([
      ['wall', 200, null, 'M'],
      ['keeper', 300, null, 'T'],
      ['shootout', 600, 'keeper', 'E'],
      ['torwand', 150, null, 'W'],
      ['family', 250, null, 'F'],
    ]);
  });

  it('a new player has no mode unlocked', () => {
    for (const mode of UNLOCK_MODES) expect(isModeUnlocked(emptyLockerRoom(), mode)).toBe(false);
  });

  it('unlocking takes the price once and keeps the mode; too few stars change nothing', () => {
    const poor = withStars(199);
    expect(modeLock(poor, 'wall')).toEqual({ kind: 'stars', price: 200, needed: 1 });
    expect(unlockMode(poor, 'wall')).toBe(poor);
    const rich = withStars(250);
    expect(modeLock(rich, 'wall')).toEqual({ kind: 'affordable', price: 200 });
    const after = unlockMode(rich, 'wall');
    expect(after).toMatchObject({ stars: 50, totalEarned: 250, modes: ['wall'] });
    expect(modeLock(after, 'wall')).toEqual({ kind: 'unlocked' });
    expect(unlockMode(award(after, 500), 'wall').modes).toEqual(['wall']);
  });

  it('"Elfmeterschießen" needs "Selbst ins Tor" first, whatever the balance', () => {
    const rich = withStars(2000);
    expect(modeLock(rich, 'shootout')).toEqual({ kind: 'needs', mode: 'keeper' });
    expect(canUnlockMode(rich, 'shootout')).toBe(false);
    expect(unlockMode(rich, 'shootout')).toBe(rich);
    const keeper = unlockMode(rich, 'keeper');
    expect(keeper).toMatchObject({ stars: 1700, modes: ['keeper'] });
    const both = unlockMode(keeper, 'shootout');
    expect(both).toMatchObject({ stars: 1100, modes: ['keeper', 'shootout'] });
  });

  it('stored modes keep known names once; a locker room stored before amendment 21 loads with none', () => {
    expect(cleanModes(['shootout', 'wall', 'wall', 'line'])).toEqual(['wall', 'shootout']);
    expect(cleanLockerRoom({ ...emptyLockerRoom(), modes: ['wall', 'x', 'wall'] }).modes).toEqual(['wall']);
    const old: Partial<LockerRoom> = emptyLockerRoom();
    delete old.modes;
    expect(lockerRoomSchema.parse(old).modes).toEqual([]);
    expect(LOCKER_ROOM.parse({ ...emptyLockerRoom(), modes: ['keeper', 'nope'] })?.modes).toEqual(['keeper']);
  });
});

describe('start buttons and startable modes (FR-141)', () => {
  it('locked modes show greyed with their price; unlocked ones start', () => {
    expect(modeButtons(emptyLockerRoom(), ALL, true)).toEqual([
      { mode: 'wall', key: 'M', state: 'locked', price: 200 },
      { mode: 'keeper', key: 'T', state: 'locked', price: 300 },
      { mode: 'shootout', key: 'E', state: 'locked', price: 600 },
      { mode: 'torwand', key: 'W', state: 'locked', price: 150 },
      { mode: 'family', key: 'F', state: 'locked', price: 250 },
    ]);
    const owned = withStars(0, ['wall', 'keeper', 'shootout', 'torwand', 'family']);
    expect(modeButtons(owned, ALL, true).map((b) => [b.mode, b.state])).toEqual([
      ['wall', 'ready'],
      ['keeper', 'ready'],
      ['shootout', 'ready'],
      ['torwand', 'ready'],
      ['family', 'ready'],
    ]);
  });

  it('a mode the parent turned off has no button; without the locker room locked modes have none either', () => {
    const owned = withStars(0, ['wall']);
    expect(modeButtons(owned, { ...ALL, wall: false }, true).map((b) => b.mode)).toEqual(['keeper', 'shootout', 'torwand', 'family']);
    expect(modeButtons(owned, ALL, false).map((b) => b.mode)).toEqual(['wall']);
  });

  it('locked modes are not startable; an unlocked one is, while the parent allows it', () => {
    const settings = defaultSettings();
    expect(canStart('wall', emptyLockerRoom(), settings)).toBe(false);
    const owned = withStars(0, ['wall', 'keeper', 'shootout']);
    expect(canStart('wall', owned, settings)).toBe(true);
    expect(canStart('wall', owned, { ...settings, modesAllowed: { ...ALL, wall: false } })).toBe(false);
    expect(canStart('keeper', owned, settings)).toBe(true);
    expect(canStart('keeper', owned, { ...settings, modesAllowed: { ...ALL, keeper: false } })).toBe(false);
    expect(canStart('shootout', owned, settings)).toBe(true);
    expect(canStart('shootout', owned, { ...settings, modesAllowed: { ...ALL, shootout: false } })).toBe(false);
    expect(canStart('shootout', withStars(0, ['keeper']), settings)).toBe(false);
    const amendment23 = withStars(0, ['torwand', 'family']);
    expect(canStart('torwand', amendment23, settings)).toBe(true);
    expect(canStart('family', amendment23, settings)).toBe(true);
    expect(canStart('torwand', amendment23, { ...settings, modesAllowed: { ...ALL, torwand: false } })).toBe(false);
    expect(canStart('family', withStars(0, ['torwand']), settings)).toBe(false);
    expect(canStart('play', emptyLockerRoom(), settings)).toBe(true);
    expect(canStart('time', emptyLockerRoom(), { ...settings, timeChallenge: { allowed: false, minutes: 2 } })).toBe(false);
  });

  it('"Nochmal" starts a round of the same kind again', () => {
    expect(startKindOf({ roundType: 'untilHearts', mode: 'wall' })).toBe('wall');
    expect(startKindOf({ roundType: 'goalCount', mode: 'keeper' })).toBe('keeper');
    expect(startKindOf({ roundType: 'goalCount', mode: 'normal' })).toBe('play');
    expect(startKindOf({ roundType: 'time', mode: 'normal' })).toBe('time');
    expect(startKindOf({ roundType: 'cup', mode: 'normal' })).toBe('cup');
    expect(startKindOf({ roundType: 'untilHearts', mode: 'torwand' })).toBe('torwand');
    expect(startKindOf({ roundType: 'goalCount', mode: 'family' })).toBe('family');
    expect(START_KIND_INFO.wall).toEqual({ mode: 'wall', unlock: 'wall', roundType: 'settings' });
  });

  it('settings stored before amendment 21 load with every mode allowed', () => {
    const old: Partial<ReturnType<typeof defaultSettings>> = defaultSettings();
    delete old.modesAllowed;
    expect(parseSettings(old)?.modesAllowed).toEqual(ALL);
  });

  it('settings stored before amendment 23 load with "Torwand" and "Papa gegen Kind" allowed', () => {
    const old = { ...defaultSettings(), modesAllowed: { wall: false, keeper: true, shootout: true } };
    expect(parseSettings(old)?.modesAllowed).toEqual({ ...ALL, wall: false });
  });

  it('a wall round keeps its bests apart from "Spielen"', () => {
    expect(recordKey(1, 100, 'untilHearts')).toBe('1-100|keeper|untilHearts');
    expect(recordKey(1, 100, 'untilHearts', null, 'wall')).toBe('1-100|keeper|untilHearts|wall');
  });

  it('"Torwart" and "Elfmeter" keep one best per range, whatever the round type', () => {
    expect(recordKey(1, 100, 'untilHearts', null, 'keeper')).toBe('1-100|keeper|keeper');
    expect(recordKey(1, 100, 'goalCount', null, 'keeper')).toBe('1-100|keeper|keeper');
    expect(recordKey(1, 100, 'goalCount', null, 'shootout')).toBe('1-100|keeper|shootout');
    expect(recordKey(1, 100, 'untilHearts', null, 'torwand')).toBe('1-100|keeper|torwand');
    expect(recordKey(1, 100, 'goalCount', null, 'family')).toBe('1-100|keeper|family');
    expect(startKindOf({ roundType: 'untilHearts', mode: 'shootout' })).toBe('shootout');
  });
});

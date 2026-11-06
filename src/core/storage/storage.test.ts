// Adapted from math-tank src/core/storage/storage.test.ts and exportImport.test.ts.
import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { exportData, importData } from './exportImport';
import { memoryKeyValue, type KeyValue } from './keyValue';
import { migrate } from './migrate';
import { emptyLockerRoom, emptyProgress, emptyRecords, type StoredRound } from './schemas';
import {
  clearRound,
  LOCKER_ROOM_KEY,
  loadLockerRoom,
  loadProgress,
  loadRecords,
  loadRound,
  loadSettings,
  PROGRESS_KEY,
  RECORDS_KEY,
  requestPersistentStorage,
  ROUND_KEY,
  saveLockerRoom,
  saveProgress,
  saveRecords,
  saveRound,
  saveSettings,
  SETTINGS_KEY,
  unreadableKey,
} from './storage';

/** A full stored round in hole mode; `over` replaces fields. */
function storedRound(over: Partial<StoredRound> = {}): StoredRound {
  return {
    version: 1,
    seed: 1,
    mode: 'holes',
    roundType: 'untilHearts',
    min: 1,
    max: 100,
    goals: 0,
    hearts: 3,
    missesInRow: 0,
    helpStep: 0,
    target: { mode: 'holes', number: 46, hints: [45, 47, 36, 56], patchedHoles: [], directions: ['right', 'left', 'down', 'up'], difficultyStep: 0 },
    targetCount: 1,
    starsThisRound: 0,
    elapsedMs: 0,
    phase: 'aiming',
    ...over,
  };
}

function throwingKeyValue(): KeyValue {
  const fail = () => {
    throw new Error('blocked');
  };
  return { get: fail, set: fail, remove: fail };
}

describe('storage keys', () => {
  it('are the five mathsoccer keys', () => {
    expect([SETTINGS_KEY, PROGRESS_KEY, LOCKER_ROOM_KEY, RECORDS_KEY, ROUND_KEY]).toEqual([
      'mathsoccer.settings.v1',
      'mathsoccer.progress.v1',
      'mathsoccer.lockerroom.v1',
      'mathsoccer.records.v1',
      'mathsoccer.round.v1',
    ]);
  });

  it('save writes under those keys', () => {
    const kv = memoryKeyValue();
    saveSettings(kv, defaultSettings());
    saveProgress(kv, emptyProgress());
    saveRecords(kv, emptyRecords());
    saveLockerRoom(kv, emptyLockerRoom());
    saveRound(kv, storedRound());
    for (const key of [SETTINGS_KEY, PROGRESS_KEY, LOCKER_ROOM_KEY, RECORDS_KEY, ROUND_KEY]) expect(kv.get(key)).not.toBeNull();
  });
});

describe('round trip', () => {
  it('keeps every kind unchanged', () => {
    const kv = memoryKeyValue();
    const settings = { ...defaultSettings(), lineLength: 7, difficulty: 'normal' as const };
    const records = { version: 1 as const, bests: { '1-100|holes|untilHearts': { goals: 8, timeMs: 340000, at: '2026-11-06T10:00:00.000Z' } } };
    const locker = { ...emptyLockerRoom(), stars: 12, totalEarned: 20, shirtName: 'MIA' };
    const round = storedRound({ seed: 42, mode: 'keeper', roundType: 'goalCount', goals: 3, hearts: 2, elapsedMs: 61_500 });
    saveSettings(kv, settings);
    saveRecords(kv, records);
    saveLockerRoom(kv, locker);
    saveRound(kv, round);
    expect(loadSettings(kv)).toEqual({ value: settings, resetReason: 'none' });
    expect(loadRecords(kv)).toEqual({ value: records, resetReason: 'none' });
    expect(loadLockerRoom(kv)).toEqual({ value: locker, resetReason: 'none' });
    expect(loadRound(kv)).toEqual({ value: round, resetReason: 'none' });
  });

  it('clearRound removes the stored round', () => {
    const kv = memoryKeyValue();
    saveRound(kv, storedRound({ mode: 'keeper' }));
    clearRound(kv);
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'none' });
  });
});

describe('missing key', () => {
  it('gives defaults with resetReason none', () => {
    const kv = memoryKeyValue();
    expect(loadSettings(kv)).toEqual({ value: defaultSettings(), resetReason: 'none' });
    expect(loadProgress(kv)).toEqual({ value: emptyProgress(), resetReason: 'none' });
    expect(loadRecords(kv)).toEqual({ value: emptyRecords(), resetReason: 'none' });
    expect(loadLockerRoom(kv)).toEqual({ value: emptyLockerRoom(), resetReason: 'none' });
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'none' });
  });
});

describe('damaged data resets with a reason (FR-036)', () => {
  it('damaged JSON gives defaults with resetReason invalid and keeps the old text', () => {
    const kv = memoryKeyValue({ [SETTINGS_KEY]: '{not json' });
    expect(loadSettings(kv)).toEqual({ value: defaultSettings(), resetReason: 'invalid' });
    expect(kv.get(unreadableKey(SETTINGS_KEY))).toBe('{not json');
  });

  it('schema-invalid data gives defaults with resetReason invalid', () => {
    const kv = memoryKeyValue({
      [PROGRESS_KEY]: JSON.stringify({ version: 1, attempts: 'many' }),
      [LOCKER_ROOM_KEY]: JSON.stringify({ ...emptyLockerRoom(), stars: -3 }),
      [ROUND_KEY]: JSON.stringify({ ...storedRound(), mode: 'penalty' }),
    });
    expect(loadProgress(kv)).toEqual({ value: emptyProgress(), resetReason: 'invalid' });
    expect(loadLockerRoom(kv)).toEqual({ value: emptyLockerRoom(), resetReason: 'invalid' });
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'invalid' });
  });

  it('settings that break a settings rule give defaults with resetReason invalid', () => {
    const bad = { ...defaultSettings(), modes: { holes: false, lines: false, keeper: false } };
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(bad) });
    expect(loadSettings(kv)).toEqual({ value: defaultSettings(), resetReason: 'invalid' });
  });

  it('data without a version gives defaults with resetReason invalid', () => {
    const { version: _v, ...noVersion } = defaultSettings();
    void _v;
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(noVersion) });
    expect(loadSettings(kv).resetReason).toBe('invalid');
  });

  it('data from a newer version of the game gives defaults with resetReason newer', () => {
    const text = JSON.stringify({ ...emptyRecords(), version: 2 });
    const kv = memoryKeyValue({ [RECORDS_KEY]: text });
    expect(loadRecords(kv)).toEqual({ value: emptyRecords(), resetReason: 'newer' });
    expect(kv.get(unreadableKey(RECORDS_KEY))).toBe(text);
  });
});

describe('unavailable storage', () => {
  it('a throwing KeyValue gives defaults with resetReason unavailable', () => {
    expect(loadSettings(throwingKeyValue())).toEqual({ value: defaultSettings(), resetReason: 'unavailable' });
    expect(loadRound(throwingKeyValue())).toEqual({ value: null, resetReason: 'unavailable' });
  });

  it('save and clear return ok false', () => {
    expect(saveSettings(throwingKeyValue(), defaultSettings())).toEqual({ ok: false });
    expect(saveProgress(throwingKeyValue(), emptyProgress())).toEqual({ ok: false });
    expect(clearRound(throwingKeyValue())).toEqual({ ok: false });
  });
});

describe('migrate', () => {
  it('returns version 1 data and non-objects unchanged', () => {
    const s = defaultSettings();
    expect(migrate(s, 'settings')).toBe(s);
    expect(migrate('text', 'progress')).toBe('text');
    expect(migrate([1, 2], 'records')).toEqual([1, 2]);
  });
});

describe('requestPersistentStorage', () => {
  it('asks once and reports granted or denied', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    expect(await requestPersistentStorage({ persist, persisted: vi.fn().mockResolvedValue(false) })).toBe('granted');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await requestPersistentStorage({ persist: vi.fn().mockResolvedValue(false) })).toBe('denied');
  });

  it('does not ask again when the data is already kept', async () => {
    const persist = vi.fn();
    expect(await requestPersistentStorage({ persist, persisted: vi.fn().mockResolvedValue(true) })).toBe('granted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('gives unsupported without the API and failed on an error', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
    expect(await requestPersistentStorage({})).toBe('unsupported');
    expect(await requestPersistentStorage({ persist: vi.fn().mockRejectedValue(new Error('no')) })).toBe('failed');
  });
});

describe('export and import', () => {
  const data = () => ({
    settings: { ...defaultSettings(), goalsPerRound: 15 },
    progress: { version: 1 as const, attempts: [{ target: 56, solved: true }] },
    records: emptyRecords(),
    lockerRoom: { ...emptyLockerRoom(), stars: 9 },
  });

  it('round-trips all four kinds and stamps the app and the time', () => {
    const text = exportData(data(), new Date('2026-11-06T12:00:00.000Z'));
    const file = JSON.parse(text) as Record<string, unknown>;
    expect(file.app).toBe('math-soccer');
    expect(file.exportedAt).toBe('2026-11-06T12:00:00.000Z');
    expect(importData(text)).toEqual({ ok: true, ...data() });
  });

  it('refuses text that is not JSON, a file of another app and each invalid part', () => {
    expect(importData('nope')).toEqual({ ok: false, reason: 'notJson' });
    expect(importData('[1]')).toEqual({ ok: false, reason: 'notJson' });
    expect(importData(JSON.stringify({ ...data(), app: 'math-tanks' }))).toEqual({ ok: false, reason: 'wrongApp' });
    const file = (over: Record<string, unknown>) => JSON.stringify({ app: 'math-soccer', ...data(), ...over });
    expect(importData(file({ settings: { ...defaultSettings(), lineLength: 1 } }))).toEqual({ ok: false, reason: 'invalidSettings' });
    expect(importData(file({ progress: null }))).toEqual({ ok: false, reason: 'invalidProgress' });
    expect(importData(file({ records: { version: 1 } }))).toEqual({ ok: false, reason: 'invalidRecords' });
    expect(importData(file({ lockerRoom: { ...emptyLockerRoom(), shirtNumber: 100 } }))).toEqual({
      ok: false,
      reason: 'invalidLockerRoom',
    });
  });
});

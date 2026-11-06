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

/** A full stored round; `over` replaces fields. */
function storedRound(over: Partial<StoredRound> = {}): StoredRound {
  return {
    version: 2,
    seed: 1,
    roundType: 'untilHearts',
    challengeMinutes: null,
    min: 1,
    max: 100,
    goals: 0,
    hearts: 3,
    missesInRow: 0,
    helpStep: 0,
    target: { number: 46, hints: [45, 47, 36, 56], directions: ['right', 'left', 'down', 'up'], difficultyStep: 0, pattern: 'neighbors' },
    targetCount: 1,
    starsThisRound: 0,
    elapsedMs: 0,
    targetStartMs: 0,
    targetMisses: 0,
    missTimes: [],
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
    const settings = { ...defaultSettings(), timeChallenge: { allowed: false, minutes: 3 as const }, difficulty: 'normal' as const };
    const records = { version: 1 as const, bests: { '1-100|holes|untilHearts': { goals: 8, timeMs: 340000, at: '2026-11-06T10:00:00.000Z' } } };
    const locker = { ...emptyLockerRoom(), stars: 12, totalEarned: 20, shirtName: 'MIA' };
    const round = storedRound({ seed: 42, roundType: 'goalCount', goals: 3, hearts: 2, elapsedMs: 61_500 });
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
    saveRound(kv, storedRound());
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
      [ROUND_KEY]: JSON.stringify({ ...storedRound(), roundType: 'penalty' }),
    });
    expect(loadProgress(kv)).toEqual({ value: emptyProgress(), resetReason: 'invalid' });
    expect(loadLockerRoom(kv)).toEqual({ value: emptyLockerRoom(), resetReason: 'invalid' });
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'invalid' });
  });

  it('settings that break a settings rule give defaults with resetReason invalid', () => {
    const bad = { ...defaultSettings(), patterns: { neighbors: false, middle: false, row: false, shape: false } };
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(bad) });
    expect(loadSettings(kv)).toEqual({ value: defaultSettings(), resetReason: 'invalid' });
  });

  it('settings stored by the published game (version 1) load as version 2 without a reset (FR-070)', () => {
    const v1 = {
      ...defaultSettings(),
      version: 1,
      modes: { holes: true, lines: false, keeper: true },
      lineLength: 6,
      lineDirections: { ...defaultSettings().directions, up: true },
      difficulty: 'challenging',
    } as Record<string, unknown>;
    for (const key of ['directions', 'patterns', 'shapes', 'timeChallenge']) delete v1[key];
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(v1) });
    const { value, resetReason } = loadSettings(kv);
    expect(resetReason).toBe('none');
    expect(value).toEqual({ ...defaultSettings(), directions: { ...defaultSettings().directions, up: true }, difficulty: 'challenging' });
  });

  it('progress of version 1 maps old keeper ladder steps 0 to 3 to the new steps 0, 2, 6 and 7 (amendment 05)', () => {
    const ds = (step: number) => ({ step, recent: ['independent' as const], masteryWindow: [], attempts: 1, independent: 1, assisted: 0, guesses: 0 });
    const v1 = {
      version: 1,
      attempts: [],
      directions: { 'keeper|right': ds(0), 'keeper|left': ds(1), 'keeper|down': ds(2), 'keeper|up': ds(3), 'holes|down': ds(2) },
    };
    const { value, resetReason } = loadProgress(memoryKeyValue({ [PROGRESS_KEY]: JSON.stringify(v1) }));
    expect(resetReason).toBe('none');
    expect(value.version).toBe(2);
    expect(value.directions).toEqual({
      'keeper|right': ds(0),
      'keeper|left': ds(2),
      'keeper|down': ds(6),
      'keeper|up': ds(7),
      'holes|down': ds(2),
    });
  });

  it('progress of version 2 keeps its ladder steps', () => {
    const v2 = { ...emptyProgress(), directions: { 'keeper|down': { step: 3, recent: [], masteryWindow: [], attempts: 0, independent: 0, assisted: 0, guesses: 0 } } };
    expect(loadProgress(memoryKeyValue({ [PROGRESS_KEY]: JSON.stringify(v2) }))).toEqual({ value: v2, resetReason: 'none' });
  });

  it('settings of a version above 2 give defaults with resetReason newer', () => {
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), version: 3 }) });
    expect(loadSettings(kv)).toEqual({ value: defaultSettings(), resetReason: 'newer' });
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
    progress: { ...emptyProgress(), directions: { 'holes|down': { step: 1, recent: [], masteryWindow: ['independent' as const], attempts: 1, independent: 1, assisted: 0, guesses: 0 } } },
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
    expect(importData(file({ settings: { ...defaultSettings(), goalsPerRound: 0 } }))).toEqual({ ok: false, reason: 'invalidSettings' });
    expect(importData(file({ progress: null }))).toEqual({ ok: false, reason: 'invalidProgress' });
    expect(importData(file({ records: { version: 1 } }))).toEqual({ ok: false, reason: 'invalidRecords' });
    expect(importData(file({ lockerRoom: { ...emptyLockerRoom(), shirtNumber: 100 } }))).toEqual({
      ok: false,
      reason: 'invalidLockerRoom',
    });
  });
});

describe('rules between the fields of a stored round (review H3)', () => {
  const kvWith = (round: unknown) => memoryKeyValue({ [ROUND_KEY]: JSON.stringify(round) });

  it('keeps a consistent round', () => {
    expect(loadRound(kvWith(storedRound())).resetReason).toBe('none');
    expect(loadRound(kvWith(storedRound({ goalsPerRound: 5 }))).value?.goalsPerRound).toBe(5);
  });

  it('discards an aiming round without a target (code review), which could never end', () => {
    expect(loadRound(kvWith(storedRound({ phase: 'aiming', target: null }))).resetReason).toBe('invalid');
  });

  it('discards a round whose min is not below its max', () => {
    expect(loadRound(kvWith(storedRound({ min: 100, max: 100 })))).toEqual({ value: null, resetReason: 'invalid' });
  });

  it('discards a round whose target lies outside its range', () => {
    expect(loadRound(kvWith(storedRound({ target: { ...storedRound().target!, number: 101 } }))).resetReason).toBe('invalid');
  });

  it('discards goals per round outside 1 to 20', () => {
    expect(loadRound(kvWith(storedRound({ goalsPerRound: 0 }))).resetReason).toBe('invalid');
    expect(loadRound(kvWith(storedRound({ goalsPerRound: 21 }))).resetReason).toBe('invalid');
  });
});

describe('rounds of version 1 (amendment 05, FR-070)', () => {
  const kvWith = (round: unknown) => memoryKeyValue({ [ROUND_KEY]: JSON.stringify(round) });
  /** A round as version 1 stored it, with a mode, a line and a target with a mode and patched holes. */
  function v1Round(mode: 'holes' | 'lines' | 'keeper', extra: Record<string, unknown> = {}) {
    const { target, ...rest } = storedRound();
    return {
      ...rest,
      version: 1,
      mode,
      line: mode === 'lines' ? { squares: [45, 46, 47, 48], direction: 'right', given: 2, index: 2 } : null,
      target: { mode, number: target!.number, hints: target!.hints, patchedHoles: mode === 'holes' ? [12] : [], directions: target!.directions, difficultyStep: 0 },
      ...extra,
    };
  }

  it('discards a stored hole or line round on load, without a reset note and without a kept copy', () => {
    for (const mode of ['holes', 'lines'] as const) {
      const kv = kvWith(v1Round(mode));
      expect(loadRound(kv)).toEqual({ value: null, resetReason: 'none' });
      expect(kv.get(unreadableKey(ROUND_KEY))).toBeNull();
    }
  });

  it('turns a goalkeeper round of version 1 into version 2: no mode, no line, a Nachbarn target', () => {
    expect(loadRound(kvWith(v1Round('keeper')))).toEqual({ value: storedRound(), resetReason: 'none' });
    const withPattern = v1Round('keeper', { target: { ...v1Round('keeper').target, pattern: 'middle' } });
    expect(loadRound(kvWith(withPattern)).value?.target?.pattern).toBe('middle');
  });
});

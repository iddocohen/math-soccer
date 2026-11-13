// Adapted from math-tank src/core/storage/storage.test.ts and exportImport.test.ts.
import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { exportData, importData } from './exportImport';
import { memoryKeyValue, type KeyValue } from './keyValue';
import { migrate, migrateWith, type MigrationStep } from './migrate';
import { emptyCup, emptyLockerRoom, emptyProgress, emptyRecords, type StoredRound } from './schemas';
import {
  applyBaseline,
  BASELINE,
  BASELINE_KEY,
  clearRound,
  CUP,
  CUP_KEY,
  DATA_KEYS,
  LOCKER_ROOM,
  PROGRESS,
  RECORDS,
  ROUND,
  SETTINGS,
  loadCup,
  saveCup,
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
    play: { kind: 'normal' },
    wait: null,
    shots: 0,
    goalsPerRound: 10,
    min: 1,
    max: 100,
    goals: 0,
    hearts: 3,
    missesInRow: 0,
    helpStep: 0,
    target: { number: 46, hints: [45, 47, 36, 56], directions: ['right', 'left', 'down', 'up'], level: 1, pattern: 'neighbors' },
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
    const records = { version: 1 as const, bests: { '1-100|keeper|untilHearts': { goals: 8, timeMs: 340000, at: '2026-11-06T10:00:00.000Z' } } };
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

  it('an unreadable round is kept once and its key is cleared, so the next load finds no round', () => {
    const kv = memoryKeyValue({ [ROUND_KEY]: '{not json' });
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'invalid' });
    expect(kv.get(unreadableKey(ROUND_KEY))).toBe('{not json');
    expect(kv.get(ROUND_KEY)).toBeNull();
    kv.set(unreadableKey(ROUND_KEY), 'older copy');
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'none' });
    expect(kv.get(unreadableKey(ROUND_KEY))).toBe('older copy');
  });

  it('a round from a newer version is kept and its key is cleared', () => {
    const text = JSON.stringify({ ...storedRound(), version: 99 });
    const kv = memoryKeyValue({ [ROUND_KEY]: text });
    expect(loadRound(kv)).toEqual({ value: null, resetReason: 'newer' });
    expect(kv.get(unreadableKey(ROUND_KEY))).toBe(text);
    expect(kv.get(ROUND_KEY)).toBeNull();
  });

  it('settings that break a settings rule give defaults with resetReason invalid', () => {
    const bad = { ...defaultSettings(), levels: { start: 4, hardest: 2 } };
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(bad) });
    expect(loadSettings(kv)).toEqual({ value: defaultSettings(), resetReason: 'invalid' });
  });

  it('progress loads as it is', () => {
    const counters = { masteryWindow: [], attempts: 1, independent: 1, assisted: 0, guesses: 0 };
    const progress = { ...emptyProgress(), level: 2 as const, levelWins: 1, directions: { 'keeper|down': counters } };
    expect(loadProgress(memoryKeyValue({ [PROGRESS_KEY]: JSON.stringify(progress) }))).toEqual({ value: progress, resetReason: 'none' });
  });

  it('settings of a version above 1 give defaults with resetReason newer', () => {
    const kv = memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), version: 2 }) });
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
  it('returns version 1 data and non-objects unchanged: no kind has a step since the baseline', () => {
    const s = defaultSettings();
    expect(migrate(s, 'settings')).toBe(s);
    expect(migrate('text', 'progress')).toBe('text');
    expect(migrate([1, 2], 'records')).toEqual([1, 2]);
  });

  it('example: how a future step from version 1 to version 2 runs', () => {
    // A later change would add this step to the kind's list in migrate.ts and raise its schema to version 2.
    const v1ToV2: MigrationStep = (raw) => ({ ...raw, version: 2, celebrationSpeed: 'normal' });
    const steps = [v1ToV2];
    expect(migrateWith({ version: 1, stars: 3 }, steps)).toEqual({ version: 2, stars: 3, celebrationSpeed: 'normal' });
    // Data already at version 2 runs no step; data without a usable version is left for the schema to refuse.
    const v2 = { version: 2, stars: 3, celebrationSpeed: 'fast' };
    expect(migrateWith(v2, steps)).toBe(v2);
    for (const raw of [{ stars: 3 }, { version: 0 }, { version: 1.5 }, null]) expect(migrateWith(raw, steps)).toBe(raw);
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
    progress: { ...emptyProgress(), directions: { 'keeper|down': { masteryWindow: ['independent' as const], attempts: 1, independent: 1, assisted: 0, guesses: 0 } } },
    records: emptyRecords(),
    lockerRoom: { ...emptyLockerRoom(), stars: 9 },
    cup: emptyCup(),
  });

  it('round-trips all five kinds, the cup included, and stamps the app and the time', () => {
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
    expect(importData(file({ cup: { ...emptyCup(), stage: 3 } }))).toEqual({ ok: false, reason: 'invalidCup' });
  });

  it('carries the cup (amendment 13), and refuses a file without one', () => {
    const cup = { ...emptyCup(), cup: 2, stage: 1, tries: 1, scores: [{ goals: 5, against: 2 }], trophies: [{ cup: 1, at: '2026-11-06T12:00:00.000Z' }] };
    const r = importData(exportData({ ...data(), cup }));
    expect(r.ok && r.cup).toEqual(cup);
    const { cup: _cup, ...withoutCup } = data();
    void _cup;
    expect(importData(JSON.stringify({ app: 'math-soccer', ...withoutCup }))).toEqual({ ok: false, reason: 'invalidCup' });
  });

  it('refuses a file saved before the stored data baseline (T106)', () => {
    const old = JSON.stringify({ app: 'math-soccer', ...data(), settings: { ...defaultSettings(), version: 4 } });
    expect(importData(old)).toEqual({ ok: false, reason: 'invalidSettings' });
  });
});

describe('stored cup (mathsoccer.cup.v1, amendment 13)', () => {
  it('loads the first cup when nothing is stored, and what was saved', () => {
    const kv = memoryKeyValue();
    expect(loadCup(kv)).toEqual({ value: emptyCup(), resetReason: 'none' });
    const cup = { ...emptyCup(), stage: 2, tries: 3, scores: [{ goals: 5, against: 0 }, { goals: 5, against: 3 }] };
    expect(saveCup(kv, cup)).toEqual({ ok: true });
    expect(CUP_KEY).toBe('mathsoccer.cup.v1');
    expect(loadCup(kv)).toEqual({ value: cup, resetReason: 'none' });
  });

  it('resets a damaged or newer cup to the first cup and keeps the old text', () => {
    const bad = memoryKeyValue({ [CUP_KEY]: JSON.stringify({ ...emptyCup(), stage: 9 }) });
    expect(loadCup(bad)).toEqual({ value: emptyCup(), resetReason: 'invalid' });
    expect(bad.get(unreadableKey(CUP_KEY))).not.toBeNull();
    const newer = memoryKeyValue({ [CUP_KEY]: JSON.stringify({ ...emptyCup(), version: 2 }) });
    expect(loadCup(newer).resetReason).toBe('newer');
  });

  it('a stored cup round needs its cup match, and only a cup round has one', () => {
    const cupRound = storedRound({ roundType: 'cup', play: { kind: 'cup', match: { level: 3, goals: 5, cup: 1, stage: 0 } } });
    expect(loadRound(memoryKeyValue({ [ROUND_KEY]: JSON.stringify(cupRound) })).value).toEqual(cupRound);
    expect(loadRound(memoryKeyValue({ [ROUND_KEY]: JSON.stringify({ ...cupRound, play: { kind: 'normal' } }) })).resetReason).toBe('invalid');
    expect(loadRound(memoryKeyValue({ [ROUND_KEY]: JSON.stringify(storedRound({ play: { kind: 'cup', match: { level: 3, goals: 5, cup: 1, stage: 0 } } })) })).resetReason).toBe('invalid');
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

describe('help steps of a stored round (amendment 10)', () => {
  it('accepts help step 4 and refuses 5', () => {
    const kvWith = (round: unknown) => memoryKeyValue({ [ROUND_KEY]: JSON.stringify(round) });
    expect(loadRound(kvWith(storedRound({ helpStep: 4 }))).value?.helpStep).toBe(4);
    expect(loadRound(kvWith({ ...storedRound(), helpStep: 5 })).resetReason).toBe('invalid');
  });
});

describe('stored data baseline (T106)', () => {
  /** Data as a browser may hold it from before the baseline: versions 2 to 4 under the same keys, and kept copies. */
  function preBaseline(): Record<string, string> {
    const entries: Record<string, string> = {
      [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), version: 4 }),
      [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), version: 4 }),
      [LOCKER_ROOM_KEY]: JSON.stringify({ ...emptyLockerRoom(), version: 2, stars: 30 }),
      [RECORDS_KEY]: JSON.stringify(emptyRecords()),
      [ROUND_KEY]: JSON.stringify({ ...storedRound(), version: 4 }),
      [CUP_KEY]: JSON.stringify(emptyCup()),
      [unreadableKey(LOCKER_ROOM_KEY)]: '{"version":1',
      'mathSoccer.autoReloadFrom': '1.2.3',
    };
    return entries;
  }

  it('lists every data key', () => {
    expect([...DATA_KEYS].sort()).toEqual([CUP_KEY, LOCKER_ROOM_KEY, PROGRESS_KEY, RECORDS_KEY, ROUND_KEY, SETTINGS_KEY].sort());
  });

  it('clears every data key and kept copy once, writes the marker, and leaves other keys alone', () => {
    const kv = memoryKeyValue(preBaseline());
    applyBaseline(kv);
    for (const key of DATA_KEYS) {
      expect(kv.get(key)).toBeNull();
      expect(kv.get(unreadableKey(key))).toBeNull();
    }
    expect(kv.get(BASELINE_KEY)).toBe(BASELINE);
    expect(kv.get('mathSoccer.autoReloadFrom')).toBe('1.2.3');
    // The data loads as the defaults, with no reset note.
    expect(loadSettings(kv)).toEqual({ value: defaultSettings(), resetReason: 'none' });
    expect(loadLockerRoom(kv)).toEqual({ value: emptyLockerRoom(), resetReason: 'none' });
  });

  it('keeps data saved after the marker', () => {
    const kv = memoryKeyValue();
    applyBaseline(kv);
    const locker = { ...emptyLockerRoom(), stars: 7 };
    saveLockerRoom(kv, locker);
    applyBaseline(kv);
    expect(loadLockerRoom(kv).value).toEqual(locker);
  });

  it('clears again when the marker holds another baseline', () => {
    const kv = memoryKeyValue({ ...preBaseline(), [BASELINE_KEY]: 'old' });
    applyBaseline(kv);
    expect(kv.get(SETTINGS_KEY)).toBeNull();
    expect(kv.get(BASELINE_KEY)).toBe(BASELINE);
  });

  it('changes nothing and does not throw when storage is blocked', () => {
    expect(() => applyBaseline(throwingKeyValue())).not.toThrow();
  });

  it('puts every stored kind at version 1, and the running round at version 2 (refactor R2)', () => {
    for (const kind of [SETTINGS, PROGRESS, RECORDS, LOCKER_ROOM, CUP]) expect(kind.version).toBe(1);
    for (const value of [defaultSettings(), emptyProgress(), emptyRecords(), emptyLockerRoom(), emptyCup()]) expect(value.version).toBe(1);
    expect(ROUND.version).toBe(2);
    expect(storedRound().version).toBe(2);
  });
});

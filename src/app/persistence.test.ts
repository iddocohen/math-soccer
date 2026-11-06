// Adapted from math-tank src/app/persistence.test.ts: the kept-copy, newer-data and "Alles zurücksetzen" tests.
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import { memoryKeyValue, type KeyValue } from '../core/storage/keyValue';
import { emptyCup, emptyLockerRoom, emptyProgress, emptyRecords } from '../core/storage/schemas';
import { CUP_KEY, LOCKER_ROOM_KEY, PROGRESS_KEY, RECORDS_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { createPersistence } from './persistence';

/** A key-value store whose writes to `keys` fail, as when browser storage is full or blocked. */
function failingKeys(kv: KeyValue, keys: Set<string>): KeyValue {
  return {
    get: (key) => kv.get(key),
    set: (key, value) => {
      if (keys.has(key)) throw new DOMException('quota', 'QuotaExceededError');
      kv.set(key, value);
    },
    remove: (key) => kv.remove(key),
  };
}

const richLocker = () => ({ ...emptyLockerRoom(), stars: 40, totalEarned: 40 });

describe('createPersistence', () => {
  it('saves settings so a new instance on the same store loads them', () => {
    const kv = memoryKeyValue();
    const p = createPersistence(kv);
    expect(p.saveSettings({ ...defaultSettings(), showClock: true })).toEqual({ ok: true });
    expect(createPersistence(kv).settings().showClock).toBe(true);
  });

  it('keeps a value for this session when its save fails', () => {
    const p = createPersistence(failingKeys(memoryKeyValue(), new Set([LOCKER_ROOM_KEY])));
    expect(p.awardStars(3)).toEqual({ ok: false });
    expect(p.lockerRoom().stars).toBe(3);
  });
});

describe('data that could not be loaded is never saved over (amendment 01)', () => {
  it('keeps damaged progress under <key>.unreadable and then saves the new progress', () => {
    const kv = memoryKeyValue({ [PROGRESS_KEY]: '{"version":1,"attempts":[' });
    const p = createPersistence(kv);
    expect(kv.get(`${PROGRESS_KEY}.unreadable`)).toBe('{"version":1,"attempts":[');
    expect(p.resetProgress()).toEqual({ ok: true });
    expect(kv.get(`${PROGRESS_KEY}.unreadable`)).toBe('{"version":1,"attempts":[');
    expect(JSON.parse(kv.get(PROGRESS_KEY)!)).toEqual(emptyProgress());
  });

  it('refuses to save over damaged data when its copy cannot be written', () => {
    const inner = memoryKeyValue({ [PROGRESS_KEY]: 'broken' });
    const p = createPersistence(failingKeys(inner, new Set([`${PROGRESS_KEY}.unreadable`])));
    expect(p.resetProgress()).toEqual({ ok: false });
    expect(inner.get(PROGRESS_KEY)).toBe('broken');
  });

  it('never saves over data from a newer version of the game; other data still saves', () => {
    const newer = JSON.stringify({ ...emptyLockerRoom(), version: 5, stars: 40 });
    const kv = memoryKeyValue({ [LOCKER_ROOM_KEY]: newer });
    const p = createPersistence(kv);
    expect(p.awardStars(3)).toEqual({ ok: false });
    expect(kv.get(LOCKER_ROOM_KEY)).toBe(newer);
    expect(p.saveSettings({ ...defaultSettings(), showClock: true })).toEqual({ ok: true });
  });
});

describe('restoring kept copies (FR-050)', () => {
  const COPY = `${LOCKER_ROOM_KEY}.unreadable`;

  it('offers a readable copy and restores it, then removes the copy', () => {
    const kv = memoryKeyValue({ [LOCKER_ROOM_KEY]: JSON.stringify(emptyLockerRoom()), [COPY]: JSON.stringify(richLocker()) });
    const p = createPersistence(kv);
    expect(p.backups()).toEqual(['lockerRoom']);
    expect(p.restoreBackups()).toEqual({ ok: true });
    expect(p.lockerRoom().stars).toBe(40);
    expect(JSON.parse(kv.get(LOCKER_ROOM_KEY)!)).toMatchObject({ stars: 40 });
    expect(kv.get(COPY)).toBeNull();
    expect(p.backups()).toEqual([]);
    expect(createPersistence(kv).lockerRoom().stars).toBe(40);
  });

  it('offers settings, progress and records copies the same way, in the usual order', () => {
    const kv = memoryKeyValue({
      [`${PROGRESS_KEY}.unreadable`]: JSON.stringify(emptyProgress()),
      [`${SETTINGS_KEY}.unreadable`]: JSON.stringify(defaultSettings()),
      [`${RECORDS_KEY}.unreadable`]: JSON.stringify(emptyRecords()),
    });
    expect(createPersistence(kv).backups()).toEqual(['settings', 'progress', 'records']);
  });

  it('does not offer a copy this version cannot read, nor one from a newer version', () => {
    const kv = memoryKeyValue({ [COPY]: '{"stars":', [`${PROGRESS_KEY}.unreadable`]: JSON.stringify({ ...emptyProgress(), version: 9 }) });
    const p = createPersistence(kv);
    expect(p.backups()).toEqual([]);
    expect(p.restoreBackups()).toEqual({ ok: false });
    expect(kv.get(COPY)).toBe('{"stars":');
  });

  it('restores all copies or none: a failed write keeps the copies and the current data', () => {
    const inner = memoryKeyValue({
      [LOCKER_ROOM_KEY]: JSON.stringify(emptyLockerRoom()),
      [COPY]: JSON.stringify(richLocker()),
      [`${PROGRESS_KEY}.unreadable`]: JSON.stringify(emptyProgress()),
    });
    const p = createPersistence(failingKeys(inner, new Set([LOCKER_ROOM_KEY])));
    expect(p.restoreBackups()).toEqual({ ok: false });
    expect(p.lockerRoom().stars).toBe(0);
    expect(inner.get(PROGRESS_KEY)).toBeNull();
    expect(inner.get(COPY)).not.toBeNull();
    expect(inner.get(`${PROGRESS_KEY}.unreadable`)).not.toBeNull();
  });
});

describe('resetAll (FR-051)', () => {
  it('saves empty progress, records and locker room together and keeps the settings', () => {
    const settings = JSON.stringify({ ...defaultSettings(), showClock: true });
    const kv = memoryKeyValue({ [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: JSON.stringify({ ...emptyLockerRoom(), stars: 5, totalEarned: 9 }) });
    const p = createPersistence(kv);
    p.saveRecords({ ...emptyRecords(), bests: { '1-100|holes|goalCount': { goals: 3, timeMs: 1000, at: '2026-11-06T00:00:00.000Z' } } });
    expect(p.resetAll()).toEqual({ ok: true });
    expect(p.lockerRoom()).toEqual(emptyLockerRoom());
    expect(p.records()).toEqual(emptyRecords());
    expect(p.progress()).toEqual(emptyProgress());
    expect(kv.get(SETTINGS_KEY)).toBe(settings);
    expect(JSON.parse(kv.get(LOCKER_ROOM_KEY)!)).toMatchObject({ stars: 0, totalEarned: 0 });
  });

  it('changes nothing when one of the writes fails', () => {
    const inner = memoryKeyValue({ [LOCKER_ROOM_KEY]: JSON.stringify({ ...emptyLockerRoom(), stars: 5, totalEarned: 9 }) });
    const p = createPersistence(failingKeys(inner, new Set([RECORDS_KEY])));
    expect(p.resetAll()).toEqual({ ok: false });
    expect(p.lockerRoom().stars).toBe(5);
    expect(JSON.parse(inner.get(LOCKER_ROOM_KEY)!).stars).toBe(5);
  });
});

/** A store whose writes to `keys` fail, and whose writes of old text back to `stuck` fail too. */
function stuckRollback(kv: KeyValue, failing: string, stuck: string): KeyValue {
  const written = new Set<string>();
  return {
    get: (key) => kv.get(key),
    set: (key, value) => {
      if (key === failing) throw new DOMException('quota', 'QuotaExceededError');
      if (key === stuck && written.has(key)) throw new DOMException('quota', 'QuotaExceededError');
      written.add(key);
      kv.set(key, value);
    },
    remove: (key) => kv.remove(key),
  };
}

describe('a save of several kinds that cannot be undone (review H6)', () => {
  it('resetAll says partial when the old text cannot be written back', () => {
    const inner = memoryKeyValue({
      [PROGRESS_KEY]: JSON.stringify(emptyProgress()),
      [LOCKER_ROOM_KEY]: JSON.stringify({ ...emptyLockerRoom(), stars: 5, totalEarned: 9 }),
    });
    const p = createPersistence(stuckRollback(inner, LOCKER_ROOM_KEY, PROGRESS_KEY));
    expect(p.resetAll()).toEqual({ ok: false, partial: true });
    // The session keeps its old values.
    expect(p.lockerRoom().stars).toBe(5);
  });

  it('a transfer and an import say partial the same way', () => {
    const data = { settings: defaultSettings(), progress: emptyProgress(), records: emptyRecords(), lockerRoom: emptyLockerRoom(), cup: emptyCup() };
    const p = createPersistence(stuckRollback(memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(defaultSettings()) }), LOCKER_ROOM_KEY, SETTINGS_KEY));
    expect(p.applyTransfer(data)).toEqual({ ok: false, partial: true });
    const text = createPersistence(memoryKeyValue()).exportText();
    const q = createPersistence(stuckRollback(memoryKeyValue({ [SETTINGS_KEY]: JSON.stringify(defaultSettings()) }), LOCKER_ROOM_KEY, SETTINGS_KEY));
    expect(q.importText(text)).toEqual({ ok: false, reason: 'storePartial' });
  });

  it('a failed save whose old text goes back stays a plain failure', () => {
    const p = createPersistence(failingKeys(memoryKeyValue(), new Set([RECORDS_KEY])));
    expect(p.resetAll()).toEqual({ ok: false });
  });
});

describe('resetReasons (FR-036, review H5)', () => {
  it('names the kinds reset on load and why, and nothing for clean data', () => {
    expect(createPersistence(memoryKeyValue()).resetReasons()).toEqual([]);
    const kv = memoryKeyValue({
      [PROGRESS_KEY]: '{broken',
      [LOCKER_ROOM_KEY]: JSON.stringify({ ...emptyLockerRoom(), version: 9 }),
    });
    expect(createPersistence(kv).resetReasons()).toEqual([
      { kind: 'progress', reason: 'invalid' },
      { kind: 'lockerRoom', reason: 'newer' },
    ]);
  });
});

describe('the cup journey in stored data (amendment 13)', () => {
  const playedCup = () => ({ ...emptyCup(), cup: 2, stage: 1, scores: [{ goals: 5, against: 1 }], trophies: [{ cup: 1, at: '2026-11-06T12:00:00.000Z' }] });

  it('saves the cup so a new instance loads it', () => {
    const kv = memoryKeyValue();
    expect(createPersistence(kv).saveCup(playedCup())).toEqual({ ok: true });
    expect(createPersistence(kv).cup()).toEqual(playedCup());
  });

  it('"Alles zurücksetzen" starts the cup again and empties the trophy shelf', () => {
    const kv = memoryKeyValue({ [CUP_KEY]: JSON.stringify(playedCup()) });
    const p = createPersistence(kv);
    expect(p.resetAll()).toEqual({ ok: true });
    expect(p.cup()).toEqual(emptyCup());
    expect(JSON.parse(kv.get(CUP_KEY)!)).toEqual(emptyCup());
  });

  it('is part of "Daten sichern", "Daten laden" and the transfer', () => {
    const from = createPersistence(memoryKeyValue());
    from.saveCup(playedCup());
    expect(from.saveData().cup).toEqual(playedCup());
    const to = createPersistence(memoryKeyValue());
    expect(to.importText(from.exportText()).ok).toBe(true);
    expect(to.cup()).toEqual(playedCup());
    const other = createPersistence(memoryKeyValue());
    expect(other.applyTransfer(from.saveData())).toEqual({ ok: true });
    expect(other.cup()).toEqual(playedCup());
  });

  it('offers a kept copy of a damaged cup through "Kopie wiederherstellen"', () => {
    // A damaged cup resets to the first cup and keeps its text; a kept copy this version can read is offered.
    const damaged = createPersistence(memoryKeyValue({ [CUP_KEY]: '{' }));
    expect(damaged.cup()).toEqual(emptyCup());
    expect(damaged.resetReasons()).toEqual([{ kind: 'cup', reason: 'invalid' }]);
    const kv = memoryKeyValue({ [CUP_KEY]: JSON.stringify(emptyCup()), [`${CUP_KEY}.unreadable`]: JSON.stringify(playedCup()) });
    const p = createPersistence(kv);
    expect(p.backups()).toEqual(['cup']);
    expect(p.restoreBackups()).toEqual({ ok: true });
    expect(p.cup()).toEqual(playedCup());
  });

  it('a cup attempt counts but keeps the child level (FR-109)', () => {
    const p = createPersistence(memoryKeyValue());
    const settings = defaultSettings();
    const record = {
      at: '2026-11-06T12:00:00.000Z',
      mode: 'keeper' as const,
      min: 1,
      max: 100,
      target: 46,
      directions: ['right' as const],
      hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
      hintDisplay: 'always' as const,
      level: 1 as const,
      solved: true,
      helpStep: 0,
      misses: 0,
      responseMs: 4000,
      guess: false,
    };
    for (let i = 0; i < 3; i++) expect(p.recordAttempt(record, settings, { keepLevel: true }).levelUp).toBeNull();
    expect(p.progress().level).toBeNull();
    expect(p.progress().levels['1']).toMatchObject({ independent: 3 });
    expect(p.progress().attempts).toHaveLength(3);
    // The same attempts outside a cup raise the level after 3 solved alone.
    const levelUps = [0, 1, 2].map(() => p.recordAttempt(record, settings).levelUp);
    expect(levelUps).toEqual([null, null, 2]);
  });
});

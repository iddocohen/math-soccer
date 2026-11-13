// Adapted from math-tank src/core/storage/storage.ts.
import { cleanLockerRoom } from '../rewards/lockerRoom';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { isRecord } from '../util';
import type { KeyValue } from './keyValue';
import { migrate, parseSettings, type StoredKindName } from './migrate';
import {
  cupSchema,
  emptyCup,
  emptyLockerRoom,
  emptyProgress,
  emptyRecords,
  lockerRoomSchema,
  progressSchema,
  recordsSchema,
  roundSchema,
  type Cup,
  type LockerRoom,
  type Progress,
  type Records,
  type StoredRound,
} from './schemas';

/** Storage keys (data-model.md). The names keep `.v1`; the version inside the stored value can be higher. */
export const SETTINGS_KEY = 'mathsoccer.settings.v1';
export const PROGRESS_KEY = 'mathsoccer.progress.v1';
export const LOCKER_ROOM_KEY = 'mathsoccer.lockerroom.v1';
export const RECORDS_KEY = 'mathsoccer.records.v1';
export const ROUND_KEY = 'mathsoccer.round.v1';
export const CUP_KEY = 'mathsoccer.cup.v1';

/** Every key that holds stored game data; each can have a kept copy under `unreadableKey`. */
export const DATA_KEYS = [SETTINGS_KEY, PROGRESS_KEY, LOCKER_ROOM_KEY, RECORDS_KEY, ROUND_KEY, CUP_KEY] as const;

/**
 * The stored data baseline (T106, data-model.md "Stored data baseline"). During development the stored kinds went
 * through versions 2 to 4 under the same keys; the baseline made every kind version 1 again. A browser whose
 * `BASELINE_KEY` does not hold `BASELINE` may still hold that older data, so `applyBaseline` clears it once. Changing
 * `BASELINE` clears every player's data again; a normal shape change uses a migration step (migrate.ts) instead.
 */
export const BASELINE_KEY = 'mathsoccer.baseline';
export const BASELINE = '1';

/**
 * Why loaded data was replaced by its defaults: 'invalid' for damaged or invalid data, 'newer' for data written by a
 * newer version of the game, 'unavailable' when storage cannot be read. The parent sees a short message (FR-036).
 */
export type ResetReason = 'none' | 'invalid' | 'newer' | 'unavailable';

/** One stored kind: its key, its current version, how to read it and what to use when there is nothing usable. */
export interface StoredKind<T> {
  name: StoredKindName;
  key: string;
  version: number;
  /** The value after migration and validation, or null when it is not usable. */
  parse(raw: unknown): T | null;
  empty(): T;
}

function schemaParser<T>(name: StoredKindName, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }) {
  return (raw: unknown): T | null => {
    const r = schema.safeParse(migrate(raw, name));
    return r.success ? r.data : null;
  };
}

export const SETTINGS: StoredKind<Settings> = {
  name: 'settings',
  key: SETTINGS_KEY,
  version: 1,
  parse: parseSettings,
  empty: defaultSettings,
};

export const PROGRESS: StoredKind<Progress> = {
  name: 'progress',
  key: PROGRESS_KEY,
  version: 1,
  parse: schemaParser('progress', progressSchema),
  empty: emptyProgress,
};

export const RECORDS: StoredKind<Records> = {
  name: 'records',
  key: RECORDS_KEY,
  version: 1,
  parse: schemaParser('records', recordsSchema),
  empty: emptyRecords,
};

export const LOCKER_ROOM: StoredKind<LockerRoom> = {
  name: 'lockerRoom',
  key: LOCKER_ROOM_KEY,
  version: 1,
  parse: (raw) => {
    const locker = schemaParser('lockerRoom', lockerRoomSchema)(raw);
    return locker && cleanLockerRoom(locker);
  },
  empty: emptyLockerRoom,
};

/** The cup journey (amendment 13); no stored cup is the first cup at its first match. */
export const CUP: StoredKind<Cup> = {
  name: 'cup',
  key: CUP_KEY,
  version: 1,
  parse: schemaParser('cup', cupSchema),
  empty: emptyCup,
};

/** A round is either stored or not; "empty" is no round to continue. */
export const ROUND: StoredKind<StoredRound | null> = {
  name: 'round',
  key: ROUND_KEY,
  version: 2,
  parse: schemaParser('round', roundSchema),
  empty: () => null,
};

/** Where a copy of stored data that could not be read is kept, before anything is saved over it. */
export function unreadableKey(key: string): string {
  return `${key}.unreadable`;
}

/** True when `value` carries a version number above the one this game writes. */
function isNewer(value: unknown, current: number): boolean {
  return isRecord(value) && typeof value.version === 'number' && value.version > current;
}

/** Keeps the text that could not be read; a failed write changes nothing for the player. */
function keepUnreadable(kv: KeyValue, key: string, text: string): void {
  try {
    kv.set(unreadableKey(key), text);
  } catch {
    // Storage is full or blocked; the reset itself still goes ahead.
  }
}

/**
 * Loads one stored kind. Missing data gives the empty value with reason 'none'. Damaged, invalid, newer or unreadable
 * data gives the empty value with its reason, and the old text is kept under `unreadableKey` (FR-036).
 */
export function load<T>(kv: KeyValue, kind: StoredKind<T>): { value: T; resetReason: ResetReason } {
  let text: string | null;
  try {
    text = kv.get(kind.key);
  } catch {
    return { value: kind.empty(), resetReason: 'unavailable' };
  }
  if (text === null) return { value: kind.empty(), resetReason: 'none' };

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    keepUnreadable(kv, kind.key, text);
    return { value: kind.empty(), resetReason: 'invalid' };
  }
  if (isNewer(raw, kind.version)) {
    keepUnreadable(kv, kind.key, text);
    return { value: kind.empty(), resetReason: 'newer' };
  }
  const value = kind.parse(raw);
  if (value === null) {
    keepUnreadable(kv, kind.key, text);
    return { value: kind.empty(), resetReason: 'invalid' };
  }
  return { value, resetReason: 'none' };
}

/**
 * Clears stored data from before the baseline once: when `BASELINE_KEY` does not hold `BASELINE`, every data key and
 * its kept copy is removed and the marker is written. Runs before anything is loaded. When storage cannot be read or
 * written, the loaders report it as usual and the next start tries again.
 */
export function applyBaseline(kv: KeyValue): void {
  try {
    if (kv.get(BASELINE_KEY) === BASELINE) return;
    for (const key of DATA_KEYS) {
      for (const k of [key, unreadableKey(key)]) {
        if (kv.get(k) !== null) kv.remove(k);
      }
    }
    kv.set(BASELINE_KEY, BASELINE);
  } catch {
    // Storage is blocked or full: what was removed stays removed, and the next start tries again.
  }
}

/** Saves one stored kind; `ok` is false when storage is full or blocked, and the game keeps going. */
export function save<T>(kv: KeyValue, kind: StoredKind<T>, value: T): { ok: boolean } {
  try {
    kv.set(kind.key, JSON.stringify(value));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Deletes one stored kind, for example the round when it ends. */
export function clear<T>(kv: KeyValue, kind: StoredKind<T>): { ok: boolean } {
  try {
    kv.remove(kind.key);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export const loadSettings = (kv: KeyValue) => load(kv, SETTINGS);
export const saveSettings = (kv: KeyValue, s: Settings) => save(kv, SETTINGS, s);
export const loadProgress = (kv: KeyValue) => load(kv, PROGRESS);
export const saveProgress = (kv: KeyValue, p: Progress) => save(kv, PROGRESS, p);
export const loadRecords = (kv: KeyValue) => load(kv, RECORDS);
export const saveRecords = (kv: KeyValue, r: Records) => save(kv, RECORDS, r);
export const loadLockerRoom = (kv: KeyValue) => load(kv, LOCKER_ROOM);
export const saveLockerRoom = (kv: KeyValue, l: LockerRoom) => save(kv, LOCKER_ROOM, l);
export const loadCup = (kv: KeyValue) => load(kv, CUP);
export const saveCup = (kv: KeyValue, c: Cup) => save(kv, CUP, c);
export const loadRound = (kv: KeyValue) => load(kv, ROUND);
export const saveRound = (kv: KeyValue, r: StoredRound) => save(kv, ROUND, r);
export const clearRound = (kv: KeyValue) => clear(kv, ROUND);

/** The part of `navigator.storage` this game uses. */
export interface PersistentStorage {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

export type PersistOutcome = 'granted' | 'denied' | 'unsupported' | 'failed';

/**
 * Asks the browser once, on start, to keep this game's data when space runs low (FR-036, as math-tank).
 * Pass `navigator.storage`; a missing API gives 'unsupported' and an error gives 'failed', never a throw.
 */
export async function requestPersistentStorage(storage: PersistentStorage | undefined): Promise<PersistOutcome> {
  if (!storage?.persist) return 'unsupported';
  try {
    if (storage.persisted && (await storage.persisted())) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'failed';
  }
}

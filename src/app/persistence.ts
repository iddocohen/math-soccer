// Adapted from math-tank src/app/persistence.ts (with its amendment 24), trimmed: no persistent-storage request and no
// per-kind failure status.
/**
 * Browser persistence for settings, progress, personal bests and the locker room (FR-036, FR-037, FR-041).
 * Loads them once and keeps the current values in memory, so the game reads them without parsing storage again.
 * Every save goes to storage at once; a failed save keeps the value for this session and reports `ok: false`.
 *
 * The locker room has its own key, so "Fortschritt zurücksetzen" never touches the stars.
 *
 * Keeping the child's progress (amendment 01, FR-050, FR-051, after math-tank amendment 24):
 * - Data from a newer version of the game is never saved over in this session, nor is damaged data whose copy under
 *   `<key>.unreadable` could not be written (storage.ts keeps that copy when it loads).
 * - `backups()` names the kinds whose kept copy this version can read; `restoreBackups()` saves those copies as the
 *   current data, all or none, and removes the copies.
 * - `resetAll()` ("Alles zurücksetzen") saves empty progress, personal bests and locker room, all or none; the settings
 *   stay.
 */
import { recordAttempt as addAttempt } from '../core/progress/adaptive';
import { award } from '../core/rewards/lockerRoom';
import type { Settings } from '../core/settings/schema';
import { exportData, importData, type ImportResult, type SaveData } from '../core/storage/exportImport';
import type { KeyValue } from '../core/storage/keyValue';
import {
  emptyLockerRoom,
  emptyProgress,
  emptyRecords,
  type AttemptRecord,
  type LockerRoom,
  type Progress,
  type Records,
} from '../core/storage/schemas';
import {
  load,
  LOCKER_ROOM,
  LOCKER_ROOM_KEY,
  PROGRESS,
  PROGRESS_KEY,
  RECORDS,
  RECORDS_KEY,
  SETTINGS,
  SETTINGS_KEY,
  unreadableKey,
  type StoredKind,
} from '../core/storage/storage';

/** The four kinds of stored data, each under its own `mathsoccer.` key. */
export type DataKind = 'settings' | 'progress' | 'records' | 'lockerRoom';

const DATA_ORDER: DataKind[] = ['settings', 'progress', 'records', 'lockerRoom'];

const KEYS: Record<DataKind, string> = { settings: SETTINGS_KEY, progress: PROGRESS_KEY, records: RECORDS_KEY, lockerRoom: LOCKER_ROOM_KEY };

/** The values of every kind of data, as the session holds them. */
type Values = { settings: Settings; progress: Progress; records: Records; lockerRoom: LockerRoom };

const KINDS: { [K in DataKind]: StoredKind<Values[K]> } = { settings: SETTINGS, progress: PROGRESS, records: RECORDS, lockerRoom: LOCKER_ROOM };

/**
 * The copies under `<key>.unreadable`, seen under the usual keys, so the usual loader reads them (as math-tank's
 * `keptCopies`). Writing through this view is refused.
 */
function keptCopies(kv: KeyValue): KeyValue {
  const refuse = () => {
    throw new Error('kept copies are read only');
  };
  return { get: (key) => kv.get(unreadableKey(key)), set: refuse, remove: refuse };
}

export interface Persistence {
  settings(): Settings;
  progress(): Progress;
  records(): Records;
  lockerRoom(): LockerRoom;
  saveSettings(s: Settings): { ok: boolean };
  /** Adds one finished target to the progress, with the adaptive step for the settings in use, and saves (T043). */
  recordAttempt(record: AttemptRecord, settings: Settings): { ok: boolean };
  /** Empties the progress; the stars and the personal bests stay. */
  resetProgress(): { ok: boolean };
  /** Adds stars earned in a round to the locker room and saves (FR-042). */
  awardStars(n: number): { ok: boolean };
  /** The locker room after a purchase, a choice, or a new shirt number or name. */
  saveLockerRoom(l: LockerRoom): { ok: boolean };
  /** Personal bests changed by the round end. */
  saveRecords(r: Records): { ok: boolean };
  /** The export file for "Daten sichern" (FR-041). */
  exportText(now?: Date): string;
  /** Reads an export file for "Daten laden"; stores everything, or nothing when the file is refused. */
  importText(text: string): ImportResult;
  /** The data a transfer link carries. */
  saveData(): SaveData;
  /** Takes over a transferred save: all four kinds are stored, or the old ones are put back. */
  applyTransfer(data: SaveData): { ok: boolean };
  /**
   * "Alles zurücksetzen" (FR-051): saves empty progress, personal bests and locker room (including the total ever
   * earned), all or none; the settings stay.
   */
  resetAll(): { ok: boolean };
  /** The kinds of data with a kept copy under `<key>.unreadable` that this version can read, in the usual order (FR-050). */
  backups(): DataKind[];
  /**
   * "Kopie wiederherstellen" (FR-050): saves the copies of `backups()` as the current data, all or none, and removes the
   * copies. `ok: false` when there is nothing to restore or the save fails; then nothing changes.
   */
  restoreBackups(): { ok: boolean };
}

export function createPersistence(kv: KeyValue): Persistence {
  const loaded = {
    settings: load(kv, SETTINGS),
    progress: load(kv, PROGRESS),
    records: load(kv, RECORDS),
    lockerRoom: load(kv, LOCKER_ROOM),
  };
  const values: Values = {
    settings: loaded.settings.value,
    progress: loaded.progress.value,
    records: loaded.records.value,
    lockerRoom: loaded.lockerRoom.value,
  };

  // Kinds of data that are never saved over in this session: data from a newer version, and damaged data whose copy
  // under `<key>.unreadable` could not be written.
  const kept = new Set<DataKind>();
  for (const kind of DATA_ORDER) {
    const reason = loaded[kind].resetReason;
    if (reason === 'newer') kept.add(kind);
    if (reason !== 'invalid') continue;
    try {
      if (kv.get(unreadableKey(KEYS[kind])) !== kv.get(KEYS[kind])) kept.add(kind);
    } catch {
      kept.add(kind);
    }
  }

  /**
   * Saves the given kinds of data, all or none. On success the session takes the new values; when any write fails or
   * a kind is kept, the keys written so far get their old text back and nothing changes.
   */
  function save(next: Partial<Values>): { ok: boolean } {
    const kinds = DATA_ORDER.filter((kind) => next[kind] !== undefined);
    if (kinds.some((kind) => kept.has(kind))) return { ok: false };
    const written: Array<{ key: string; old: string | null }> = [];
    try {
      for (const kind of kinds) {
        const key = KEYS[kind];
        const old = kinds.length > 1 ? kv.get(key) : null;
        kv.set(key, JSON.stringify(next[kind]));
        written.push({ key, old });
      }
    } catch {
      for (const { key, old } of written.reverse()) {
        try {
          if (old === null) kv.remove(key);
          else kv.set(key, old);
        } catch {
          // Storage refuses even the old text; the session keeps its old values and reports the failure.
        }
      }
      return { ok: false };
    }
    Object.assign(values, next);
    return { ok: true };
  }

  /** Saves one kind of data during play: the value applies for this session even when the write fails. */
  function saveOne<K extends DataKind>(kind: K, value: Values[K]): { ok: boolean } {
    const r = save({ [kind]: value } as Partial<Values>);
    values[kind] = value;
    return r;
  }

  /** The kept copies this version can read: valid, and not from a newer version. */
  function readableCopies(): Partial<Values> {
    const copies = keptCopies(kv);
    const found: Partial<Values> = {};
    for (const kind of DATA_ORDER) {
      let raw: string | null;
      try {
        raw = kv.get(unreadableKey(KEYS[kind]));
      } catch {
        continue;
      }
      if (raw === null) continue;
      // Loading through the read-only view cannot write another copy; a refused write is caught in storage.ts.
      const r = load(copies, KINDS[kind] as StoredKind<unknown>);
      if (r.resetReason === 'none') (found as Record<DataKind, unknown>)[kind] = r.value;
    }
    return found;
  }

  const saveData = (): SaveData => ({ ...values });

  return {
    settings: () => values.settings,
    progress: () => values.progress,
    records: () => values.records,
    lockerRoom: () => values.lockerRoom,
    saveSettings: (s) => saveOne('settings', structuredClone(s)),
    recordAttempt: (record, inUse) => saveOne('progress', addAttempt(values.progress, record, inUse)),
    resetProgress: () => saveOne('progress', emptyProgress()),
    awardStars: (n) => saveOne('lockerRoom', award(values.lockerRoom, n)),
    saveLockerRoom: (l) => saveOne('lockerRoom', structuredClone(l)),
    saveRecords: (r) => saveOne('records', r),
    exportText: (now = new Date()) => exportData(saveData(), now),
    importText(text) {
      const r = importData(text);
      if (!r.ok) return r;
      const data: Values = { settings: r.settings, progress: r.progress, records: r.records, lockerRoom: r.lockerRoom };
      return save(structuredClone(data)).ok ? r : { ok: false, reason: 'storeFailed' };
    },
    saveData,
    applyTransfer: (data) =>
      save(structuredClone({ settings: data.settings, progress: data.progress, records: data.records, lockerRoom: data.lockerRoom })),
    resetAll: () => save({ progress: emptyProgress(), records: emptyRecords(), lockerRoom: emptyLockerRoom() }),
    backups: () => DATA_ORDER.filter((kind) => readableCopies()[kind] !== undefined),
    restoreBackups() {
      const copies = readableCopies();
      const kinds = DATA_ORDER.filter((kind) => copies[kind] !== undefined);
      if (kinds.length === 0) return { ok: false };
      const r = save(copies);
      if (!r.ok) return r;
      for (const kind of kinds) {
        try {
          kv.remove(unreadableKey(KEYS[kind]));
        } catch {
          // The data is restored; a copy left behind is offered again, and restoring it twice changes nothing.
        }
      }
      return r;
    },
  };
}

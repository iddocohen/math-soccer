// Adapted from math-tank src/app/persistence.ts, trimmed: no kept-copy restore and no "Alles zurücksetzen" yet (T072).
/**
 * Browser persistence for settings, progress, personal bests and the locker room (FR-036, FR-037, FR-041).
 * Loads them once and keeps the current values in memory, so the game reads them without parsing storage again.
 * Every save goes to storage at once; a failed save keeps the value for this session and reports `ok: false`.
 *
 * The locker room has its own key, so "Fortschritt zurücksetzen" never touches the stars.
 */
import { recordAttempt as addAttempt } from '../core/progress/adaptive';
import type { Settings } from '../core/settings/schema';
import { exportData, importData, type ImportResult, type SaveData } from '../core/storage/exportImport';
import type { KeyValue } from '../core/storage/keyValue';
import { emptyProgress, type AttemptRecord, type LockerRoom, type Progress, type Records } from '../core/storage/schemas';
import {
  loadLockerRoom,
  loadProgress,
  loadRecords,
  loadSettings,
  saveLockerRoom,
  saveProgress,
  saveRecords,
  saveSettings,
} from '../core/storage/storage';

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
}

export function createPersistence(kv: KeyValue): Persistence {
  let settings = loadSettings(kv).value;
  let progress = loadProgress(kv).value;
  let records = loadRecords(kv).value;
  let lockerRoom = loadLockerRoom(kv).value;

  const saveData = (): SaveData => ({ settings, progress, records, lockerRoom });

  /** Stores all four kinds; when one fails, the previous values are written back so nothing is half replaced. */
  const storeAll = (data: SaveData): { ok: boolean } => {
    const before = saveData();
    const ok =
      saveSettings(kv, data.settings).ok &&
      saveProgress(kv, data.progress).ok &&
      saveRecords(kv, data.records).ok &&
      saveLockerRoom(kv, data.lockerRoom).ok;
    if (!ok) {
      saveSettings(kv, before.settings);
      saveProgress(kv, before.progress);
      saveRecords(kv, before.records);
      saveLockerRoom(kv, before.lockerRoom);
      return { ok: false };
    }
    ({ settings, progress, records, lockerRoom } = structuredClone(data));
    return { ok: true };
  };

  return {
    settings: () => settings,
    progress: () => progress,
    records: () => records,
    lockerRoom: () => lockerRoom,
    saveSettings(s) {
      settings = structuredClone(s);
      return saveSettings(kv, settings);
    },
    recordAttempt(record, inUse) {
      progress = addAttempt(progress, record, inUse);
      return saveProgress(kv, progress);
    },
    resetProgress() {
      progress = emptyProgress();
      return saveProgress(kv, progress);
    },
    saveRecords(r) {
      records = r;
      return saveRecords(kv, records);
    },
    exportText: (now = new Date()) => exportData(saveData(), now),
    importText(text) {
      const r = importData(text);
      if (!r.ok) return r;
      const data: SaveData = { settings: r.settings, progress: r.progress, records: r.records, lockerRoom: r.lockerRoom };
      return storeAll(data).ok ? r : { ok: false, reason: 'storeFailed' };
    },
    saveData,
    applyTransfer: (data) => storeAll(data),
  };
}

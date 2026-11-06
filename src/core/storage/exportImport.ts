// Adapted from math-tank src/core/storage/exportImport.ts.
import type { Settings } from '../settings/schema';
import { isRecord } from '../util';
import { emptyCup, type Cup, type LockerRoom, type Progress, type Records } from './schemas';
import { CUP, LOCKER_ROOM, PROGRESS, RECORDS, SETTINGS } from './storage';

/** Marks an export file as ours. */
export const EXPORT_APP = 'math-soccer';

/** Why an import was refused; the settings page maps each reason to a German message. */
export type ImportFailure =
  | 'notJson'
  | 'wrongApp'
  | 'invalidSettings'
  | 'invalidProgress'
  | 'invalidRecords'
  | 'invalidLockerRoom'
  | 'invalidCup'
  /** The file was fine, but the browser could not store it; nothing was changed. */
  | 'storeFailed'
  /** The browser stored part of the file and could not put the old data back. */
  | 'storePartial';

export interface SaveData {
  settings: Settings;
  progress: Progress;
  records: Records;
  lockerRoom: LockerRoom;
  /** The cup journey (amendment 13). */
  cup: Cup;
}

export type ImportResult = ({ ok: true } & SaveData) | { ok: false; reason: ImportFailure };

/** JSON text of `{ app, exportedAt, settings, progress, records, lockerRoom, cup }` for the "Daten sichern" download (FR-041). */
export function exportData(data: SaveData, now: Date = new Date()): string {
  return JSON.stringify({ app: EXPORT_APP, exportedAt: now.toISOString(), ...data }, null, 2);
}

/**
 * Reads an export file with the same migrations, schemas and settings rules as loading from storage. It returns new
 * objects and stores nothing; the caller saves them only when `ok` is true. The running round is never exported.
 */
export function importData(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  if (!isRecord(raw)) return { ok: false, reason: 'notJson' };
  if (raw.app !== EXPORT_APP) return { ok: false, reason: 'wrongApp' };

  const settings = SETTINGS.parse(raw.settings);
  if (!settings) return { ok: false, reason: 'invalidSettings' };
  const progress = PROGRESS.parse(raw.progress);
  if (!progress) return { ok: false, reason: 'invalidProgress' };
  const records = RECORDS.parse(raw.records);
  if (!records) return { ok: false, reason: 'invalidRecords' };
  const lockerRoom = LOCKER_ROOM.parse(raw.lockerRoom);
  if (!lockerRoom) return { ok: false, reason: 'invalidLockerRoom' };
  // A file saved before the cup (amendment 13) has none: the cup starts at its first match.
  const cup = raw.cup === undefined ? emptyCup() : CUP.parse(raw.cup);
  if (!cup) return { ok: false, reason: 'invalidCup' };

  return { ok: true, settings, progress, records, lockerRoom, cup };
}

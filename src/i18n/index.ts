// Adapted from math-tank src/i18n/index.ts.
import type { ResetReason } from '../core/storage/storage';
import { de } from './de';

/** The shape every translation table must have; de.ts is the source of truth for keys. */
export type Messages = typeof de;

const active: Messages = de;

/** The active translation table. */
export function t(): Messages {
  return active;
}

/** No child-facing text may contain one of these, case-insensitive, also inside compounds (FR-023, SC-007). */
export const forbiddenWords: readonly string[] = ['falsch', 'verloren', 'Fehler', 'schlecht'];

/** Sections of the table a child reads or hears; the rest is for parents. */
export const CHILD_SECTIONS = ['appName', 'start', 'match', 'feedback', 'help', 'roundEnd', 'lockerRoom', 'storage'] as const;

/** True when `text` contains a forbidden word. */
export function hasForbiddenWord(text: string): boolean {
  const lower = text.toLocaleLowerCase('de');
  return forbiddenWords.some((w) => lower.includes(w.toLocaleLowerCase('de')));
}

/** The short note after stored data was reset on load (FR-036), or null when nothing was reset. */
export function resetMessage(reason: ResetReason): string | null {
  return reason === 'none' ? null : active.storage.reset[reason];
}

// Adapted from math-tank src/core/storage/migrate.ts.
import { settingsSchema, type Settings } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import { isRecord } from '../util';

/** The stored kinds that carry a version (data-model.md). */
export type StoredKindName = 'settings' | 'progress' | 'records' | 'lockerRoom' | 'round' | 'cup';

/** One upgrade step: turns stored data of version n into version n + 1. */
export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Upgrade steps per kind: step i turns version i + 1 into version i + 2. Every kind is at version 1 since the stored data
 * baseline (T106, data-model.md "Stored data baseline"), so no kind has a step yet. A later change to a stored shape
 * raises the kind's version in its schema and in storage.ts, and adds a step here, as math-tank does. The storage keys
 * keep their `.v1` names.
 */
const STEPS: Record<StoredKindName, MigrationStep[]> = {
  settings: [],
  progress: [],
  records: [],
  lockerRoom: [],
  cup: [],
  round: [],
};

/**
 * Runs the steps from the stored version on. Anything that is not an object, or has no whole-number version of at least
 * 1, is returned unchanged so validation rejects it. Exported for the example test of a future step.
 */
export function migrateWith(raw: unknown, steps: readonly MigrationStep[]): unknown {
  if (!isRecord(raw)) return raw;
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return raw;
  return steps.slice(version - 1).reduce((r, step) => step(r), raw);
}

/** Upgrades older stored versions of `kind` to the current one before schema validation (FR-036). */
export function migrate(raw: unknown, kind: StoredKindName): unknown {
  return migrateWith(raw, STEPS[kind]);
}

/**
 * Settings from storage or an export file: migrated, checked by the schema and by every settings rule.
 * Null when anything fails; the caller decides what that means.
 */
export function parseSettings(raw: unknown): Settings | null {
  const parsed = settingsSchema.safeParse(migrate(raw, 'settings'));
  return parsed.success && validateSettings(parsed.data).length === 0 ? parsed.data : null;
}

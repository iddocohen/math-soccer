// Adapted from math-tank src/core/storage/migrate.ts.
import { settingsSchema, type Settings } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import { isRecord } from '../util';

/** The stored kinds that carry a version (data-model.md). */
export type StoredKindName = 'settings' | 'progress' | 'records' | 'lockerRoom' | 'round';

/**
 * Upgrade steps per kind: step i turns version i + 1 into version i + 2. Every kind is at version 1, so all lists are
 * empty; a change to a stored shape raises its version and adds a step here, as math-tank does.
 */
const STEPS: Record<StoredKindName, Array<(raw: Record<string, unknown>) => Record<string, unknown>>> = {
  settings: [],
  progress: [],
  records: [],
  lockerRoom: [],
  round: [],
};

/**
 * Upgrades older stored versions to the current one before schema validation (FR-036). Anything that is not an object,
 * or has no whole-number version of at least 1, is returned unchanged so validation rejects it.
 */
export function migrate(raw: unknown, kind: StoredKindName): unknown {
  if (!isRecord(raw)) return raw;
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return raw;
  return STEPS[kind].slice(version - 1).reduce((r, step) => step(r), raw);
}

/**
 * Settings from storage or an export file: migrated, checked by the schema and by every settings rule.
 * Null when anything fails; the caller decides what that means.
 */
export function parseSettings(raw: unknown): Settings | null {
  const parsed = settingsSchema.safeParse(migrate(raw, 'settings'));
  return parsed.success && validateSettings(parsed.data).length === 0 ? parsed.data : null;
}

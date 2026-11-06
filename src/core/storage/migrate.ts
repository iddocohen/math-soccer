// Adapted from math-tank src/core/storage/migrate.ts.
import { defaultSettings } from '../settings/defaults';
import { settingsSchema, type Settings } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import { isRecord } from '../util';

/** The stored kinds that carry a version (data-model.md). */
export type StoredKindName = 'settings' | 'progress' | 'records' | 'lockerRoom' | 'round';

/**
 * Settings version 1 to version 2 (amendment 05, FR-070; amendments 06 and 07): the game modes and the line length go,
 * the line directions stay as "Richtungen" (`directions`), and every hint pattern, every shape and the time challenge
 * of 2 minutes are turned on. The other fields stay as they were.
 */
function settingsV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...raw };
  delete rest.modes;
  delete rest.lineLength;
  delete rest.lineDirections;
  const defaults = defaultSettings();
  return {
    ...rest,
    version: 2,
    directions: raw.lineDirections ?? defaults.directions,
    patterns: defaults.patterns,
    shapes: defaults.shapes,
    timeChallenge: defaults.timeChallenge,
  };
}

/**
 * Round version 1 to version 2 (amendment 05, FR-070): the mode and the line go, and the target loses its mode and its
 * patched holes. A goalkeeper target stored before hint patterns had Nachbarn hints. Hole and line rounds never reach
 * this step: storage.ts discards them first (`isRemovedModeRound`).
 */
function roundV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...raw };
  delete rest.mode;
  delete rest.line;
  let target = raw.target;
  if (isRecord(target)) {
    const t = { ...target };
    delete t.mode;
    delete t.patchedHoles;
    target = { ...t, pattern: t.pattern ?? 'neighbors' };
  }
  return { ...rest, version: 2, target };
}

/** True for a round of version 1 in hole or line mode: the game discards it on load (FR-070). */
export function isRemovedModeRound(raw: unknown): boolean {
  return isRecord(raw) && raw.version === 1 && (raw.mode === 'holes' || raw.mode === 'lines');
}

/**
 * Upgrade steps per kind: step i turns version i + 1 into version i + 2. A change to a stored shape raises its version
 * and adds a step here, as math-tank does. The storage keys keep their `.v1` names.
 */
const STEPS: Record<StoredKindName, Array<(raw: Record<string, unknown>) => Record<string, unknown>>> = {
  settings: [settingsV1toV2],
  progress: [],
  records: [],
  lockerRoom: [],
  round: [roundV1toV2],
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

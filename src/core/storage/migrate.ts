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
    directions: raw.lineDirections ?? {},
    patterns: { neighbors: true, middle: true, row: true, shape: true },
    shapes: defaults.shapes,
    timeChallenge: defaults.timeChallenge,
  };
}

/**
 * Settings version 2 to version 3 (amendment 09): the difficulty levels replace "Richtungen" (`directions`) and
 * "Hinweis-Muster" (`patterns`). The levels start at 1 and go up to 5; the hint display and the shape switches stay. A
 * parent who had turned the pattern "Formen" off gets every shape off, so levels 3 and 4 are skipped and the child still
 * meets no shapes (design call, T095).
 */
function settingsV2toV3(raw: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...raw };
  delete rest.directions;
  delete rest.patterns;
  const shapesOff = isRecord(raw.patterns) && raw.patterns.shape === false && isRecord(raw.shapes);
  const shapes = shapesOff ? Object.fromEntries(Object.keys(raw.shapes as object).map((k) => [k, false])) : raw.shapes;
  return { ...rest, version: 3, levels: defaultSettings().levels, shapes };
}

/** Settings version 3 to version 4 (amendment 10): the row and column helper is new and starts on (FR-093). */
function settingsV3toV4(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, version: 4, rowColumnHelper: true };
}

/**
 * A help step of the three-step help (1 hint, 2 help chart, 3 answer) as a step of the four-step help of amendment 10
 * (1 row, 2 column, 3 help chart, 4 answer): 1 stays, since the row step keeps the hint; 2 becomes 3 and 3 becomes 4.
 * Anything that is not a help step of the old help stays as it is, so the schema refuses it.
 */
export function helpStepOfThreeStepHelp(step: unknown): unknown {
  return step === 2 ? 3 : step === 3 ? 4 : step;
}

/**
 * The level of a ladder step of amendment 05 (amendment 09, "Stored data"): steps 0 to 2 are level 1, 3 and 4 level 2,
 * 5 level 3, and 6 and 7 level 4. Anything else is level 1.
 */
export function levelOfStep(step: unknown): 1 | 2 | 3 | 4 {
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 3) return 1;
  if (step <= 4) return 2;
  return step === 5 ? 3 : 4;
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

/** Old keeper ladder step (0 to 3, before amendment 05) to the step of the 8-step ladder that offers the same hints. */
const OLD_KEEPER_STEP = [0, 2, 6, 7];

/**
 * Progress version 1 to version 2 (amendment 05): keeper steps stored on the old 4-step ladder move to the new one,
 * 0, 1, 2 and 3 to 0, 2, 6 and 7. A keeper step above 3 was already stored on the new ladder by a build before this
 * migration, so then no step moves. Steps of the removed modes stay as they are; they no longer steer anything.
 */
function progressV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const directions = isRecord(raw.directions) ? raw.directions : {};
  const keeper = Object.entries(directions).filter(([key, ds]) => key.startsWith('keeper|') && isRecord(ds));
  const oldLadder = keeper.every(([, ds]) => {
    const step = (ds as Record<string, unknown>).step;
    return typeof step !== 'number' || step <= 3;
  });
  if (!oldLadder) return { ...raw, version: 2 };
  const moved = Object.fromEntries(
    Object.entries(directions).map(([key, ds]) => {
      if (!key.startsWith('keeper|') || !isRecord(ds) || typeof ds.step !== 'number') return [key, ds];
      return [key, { ...ds, step: OLD_KEEPER_STEP[ds.step] ?? ds.step }];
    }),
  );
  return { ...raw, version: 2, directions: moved };
}

/** Round version 2 to version 3 (amendment 09): the target's ladder step becomes its level. */
function roundV2toV3(raw: Record<string, unknown>): Record<string, unknown> {
  let target = raw.target;
  if (isRecord(target)) {
    const t: Record<string, unknown> = { ...target, level: levelOfStep(target.difficultyStep) };
    delete t.difficultyStep;
    target = t;
  }
  return { ...raw, version: 3, target };
}

/** Round version 3 to version 4 (amendment 10): the help step moves to the four-step help. */
function roundV3toV4(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, version: 4, helpStep: helpStepOfThreeStepHelp(raw.helpStep) };
}

/** Progress version 3 to version 4 (amendment 10): each attempt's help step moves to the four-step help. */
function progressV3toV4(raw: Record<string, unknown>): Record<string, unknown> {
  const attempts: unknown = Array.isArray(raw.attempts)
    ? raw.attempts.map((a: unknown) => (isRecord(a) ? { ...a, helpStep: helpStepOfThreeStepHelp(a.helpStep) } : a))
    : raw.attempts;
  return { ...raw, version: 4, attempts };
}

/**
 * Progress version 2 to version 3 (amendment 09): the ladder steps per direction become one current level, from the
 * highest keeper step (design call, T095: the level falls again after 2 helped targets in 3, so starting high costs
 * little). Each attempt's step becomes its level, and the per-level counters start from the kept goalkeeper attempts.
 * The level is clamped to the parent's range when it is used (core/progress/levels.ts `currentLevel`).
 */
function progressV2toV3(raw: Record<string, unknown>): Record<string, unknown> {
  const directions = isRecord(raw.directions) ? raw.directions : {};
  const keeperSteps = Object.entries(directions)
    .filter(([key, ds]) => key.startsWith('keeper|') && isRecord(ds) && typeof ds.step === 'number')
    .map(([, ds]) => (ds as Record<string, unknown>).step as number);
  // Damaged attempts stay as they are, so the schema refuses them.
  const attempts: unknown = Array.isArray(raw.attempts)
    ? raw.attempts.map((a: unknown) => {
        if (!isRecord(a)) return a;
        const moved: Record<string, unknown> = { ...a, level: levelOfStep(a.difficultyStep) };
        delete moved.difficultyStep;
        return moved;
      })
    : raw.attempts;
  const levels: Record<string, { independent: number; assisted: number; guesses: number }> = {};
  for (const a of Array.isArray(attempts) ? attempts : []) {
    if (!isRecord(a) || a.mode !== 'keeper') continue;
    const count = (levels[String(a.level)] ??= { independent: 0, assisted: 0, guesses: 0 });
    if (a.guess === true) count.guesses += 1;
    else if (a.solved === true && a.helpStep === 0 && a.misses === 0) count.independent += 1;
    else count.assisted += 1;
  }
  return {
    ...raw,
    version: 3,
    attempts,
    level: keeperSteps.length > 0 ? levelOfStep(Math.max(...keeperSteps)) : null,
    levelRecent: [],
    levelWins: 0,
    levels,
  };
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
  settings: [settingsV1toV2, settingsV2toV3, settingsV3toV4],
  progress: [progressV1toV2, progressV2toV3, progressV3toV4],
  records: [],
  lockerRoom: [],
  round: [roundV1toV2, roundV2toV3, roundV3toV4],
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

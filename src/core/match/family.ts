/**
 * "Papa gegen Kind" (amendment 23, FR-158 to FR-161): the child and a grown-up take turns in a penalty shootout on one
 * tablet, both against the computer keeper. Pure data and functions; the controller plays the turns with the shootout
 * functions of core/match/shootout.ts (side 0 is the child, side 1 the grown-up).
 *
 * - The grown-up's name ("Papa" by default) and level (6 by default) come from the mode's start card.
 * - Each player shoots at his own level: the child at his current level, the grown-up at the chosen one.
 * - Only the child earns stars: GOAL_STARS per goal and FAMILY_WIN_STARS for a win. Only his shots are recorded.
 */
import { LEVELS, type Level } from '../settings/defaults';
import type { ShootoutSide } from './shootout';

/** What the start card sets: the grown-up's name and level. */
export interface FamilySetup {
  name: string;
  level: Level;
}

export const DEFAULT_GROWNUP_NAME = 'Papa';
export const DEFAULT_GROWNUP_LEVEL: Level = 6;
/** The longest grown-up name, as the shirt name of the locker room. */
export const GROWNUP_NAME_MAX = 10;

/** Stars for the child's win (FR-160). */
export const FAMILY_WIN_STARS = 3;

export function defaultFamilySetup(): FamilySetup {
  return { name: DEFAULT_GROWNUP_NAME, level: DEFAULT_GROWNUP_LEVEL };
}

/**
 * The name as typed, cleaned: letters, spaces and hyphens only, at most GROWNUP_NAME_MAX characters, trimmed;
 * DEFAULT_GROWNUP_NAME when nothing is left.
 */
export function cleanGrownupName(raw: string): string {
  const name = raw
    .replace(/[^\p{L} -]/gu, '')
    .slice(0, GROWNUP_NAME_MAX)
    .trim();
  return name === '' ? DEFAULT_GROWNUP_NAME : name;
}

/** A level from the start card, or DEFAULT_GROWNUP_LEVEL for anything that is not a level. */
export function cleanGrownupLevel(raw: number): Level {
  return (LEVELS as readonly number[]).includes(raw) ? (raw as Level) : DEFAULT_GROWNUP_LEVEL;
}

/** Who shoots for a side: side 0 is the child, side 1 the grown-up. */
export type FamilyShooter = 'child' | 'grownup';

export function shooterOf(side: ShootoutSide): FamilyShooter {
  return side === 0 ? 'child' : 'grownup';
}

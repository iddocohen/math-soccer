// Replaces the 8-step ladder of amendment 05 (ladder.ts); the direction pick is kept from it, adapted from math-tank.
/**
 * The difficulty levels of the goalkeeper game (amendment 09, FR-085 to FR-089), easiest first:
 *
 *   1. "Gerade Linien": Nachbarn, Mitte and Reihe across and down, forward and backward
 *   2. "Schräge Linien": Mitte and Reihe on the two diagonals, forward and backward, and the big plus
 *   3. "Formen": shapes with one empty square (amendment 06)
 *   4. "Formen mit 2 Lücken": shapes with two empty squares
 *   5. "X-Form": the diagonal cross (xshape.ts); two empty squares once the child has solved 2 targets alone at level 5
 *
 * Nachbarn follow the parent's hint distances: "direkt daneben" (the small plus) and "darüber und darunter" train
 * across and down, so they belong to level 1; "schräg" trains the diagonals, so diagonal Nachbarn belong to level 2
 * (design call, T094: the hint distance switches keep working). "weiter weg" is the big plus (amendment 15, FR-122): it
 * trains across and down too, but jumping two rows and two columns at once is harder, so it belongs to level 2. Level 2
 * therefore picks among the straight directions too (`PICK_DIRECTIONS`); for them it offers only the big plus.
 *
 * The parent sets the start level and the hardest level. With every shape off, levels 3 and 4 are skipped. A level
 * whose patterns do not fit the chart (for example the diagonals on a chart of one row) falls back to the nearest lower
 * level that fits, else the nearest higher one.
 *
 * Within a level the direction is drawn at random, directions not mastered yet weighted twice (FR-089, FR-040), then
 * one pattern choice of that level for it, with equal weight.
 */
import type { ChartLayout } from '../chart/layout';
import type { Rng } from '../rng';
import { LEVELS, type Level } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { placements, ROW_GIVEN, type PatternChoice } from '../targets/patterns';
import { SHAPE_IDS } from '../targets/shapes';
import { X_DIRECTIONS } from '../targets/xshape';
import type { Direction, HintDistance } from '../types';

export { LEVELS, type Level };

/** The lowest and the highest level. */
export const FIRST_LEVEL: Level = 1;
export const LAST_LEVEL: Level = 5;

/** The level whose X shape gets two empty squares, and after how many targets solved alone at it (amendment 09). */
export const X_LEVEL: Level = 5;
export const X_TWO_EMPTIES_AFTER = 2;

/** Unmastered directions are picked this many times as often as mastered ones (research R9, FR-089). */
export const UNMASTERED_WEIGHT = 2;

const STRAIGHT: readonly Direction[] = ['right', 'left', 'down', 'up'];
const DIAGONAL: readonly Direction[] = X_DIRECTIONS;

/**
 * The directions each level trains. A target whose hints stayed hidden counts toward these (attempt.ts); a big plus
 * target of level 2 counts toward its own straight directions instead.
 */
export const LEVEL_DIRECTIONS: Record<Level, readonly Direction[]> = {
  1: STRAIGHT,
  2: DIAGONAL,
  3: STRAIGHT,
  4: STRAIGHT,
  5: DIAGONAL,
};

/** The directions each level picks from: its own, and for level 2 the straight ones of the big plus too (FR-122). */
export const PICK_DIRECTIONS: Record<Level, readonly Direction[]> = {
  ...LEVEL_DIRECTIONS,
  2: [...DIAGONAL, ...STRAIGHT],
};

/** The directions that Nachbarn hints of each distance train. */
export const DISTANCE_DIRECTIONS: Record<HintDistance, readonly Direction[]> = {
  direct: STRAIGHT,
  vertical: ['down', 'up'],
  diagonal: DIAGONAL,
  far: STRAIGHT,
};

/** True when `n` is one of the five levels. */
export function isLevel(n: unknown): n is Level {
  return typeof n === 'number' && (LEVELS as readonly number[]).includes(n);
}

/** True when the parent's settings allow level `level` at all: levels 3 and 4 need at least one shape. */
function offered(level: Level, settings: Pick<Settings, 'shapes'>): boolean {
  return (level !== 3 && level !== 4) || Object.values(settings.shapes).some(Boolean);
}

/**
 * The levels the child can play, from the start level to the hardest level, without the skipped ones. Never empty:
 * when every level in the range is skipped (settings validation prevents it), the nearest offered level below the start
 * level stands in.
 */
export function levelRange(settings: Pick<Settings, 'levels' | 'shapes'>): Level[] {
  const { start, hardest } = settings.levels;
  const range = LEVELS.filter((l) => l >= start && l <= hardest && offered(l, settings));
  if (range.length > 0) return range;
  const below = LEVELS.filter((l) => l < start && offered(l, settings));
  return [below[below.length - 1] ?? FIRST_LEVEL];
}

/** The level a round starts at on the very first round or after a reset (FR-086). */
export function startLevel(settings: Pick<Settings, 'levels' | 'shapes'>): Level {
  return levelRange(settings)[0]!;
}

/** The hardest level the child can reach under the settings. */
export function topLevel(settings: Pick<Settings, 'levels' | 'shapes'>): Level {
  const range = levelRange(settings);
  return range[range.length - 1]!;
}

/** `level` moved into the parent's range: up to the next offered level, or down to the top one (FR-087). */
export function clampLevel(level: number | null | undefined, settings: Pick<Settings, 'levels' | 'shapes'>): Level {
  const range = levelRange(settings);
  if (typeof level !== 'number') return range[0]!;
  return range.find((l) => l >= level) ?? range[range.length - 1]!;
}

/**
 * The child's current level (FR-086): the stored one, clamped to the parent's range. With adaptive difficulty off it is
 * always the start level (FR-087).
 */
export function currentLevel(stored: number | null | undefined, settings: Pick<Settings, 'levels' | 'shapes' | 'adaptive'>): Level {
  return settings.adaptive ? clampLevel(stored, settings) : startLevel(settings);
}

/** The next level up in the range, or `level` at the top. */
export function levelUp(level: Level, settings: Pick<Settings, 'levels' | 'shapes'>): Level {
  return levelRange(settings).find((l) => l > level) ?? level;
}

/** The next level down in the range, or `level` at the bottom. */
export function levelDown(level: Level, settings: Pick<Settings, 'levels' | 'shapes'>): Level {
  const lower = levelRange(settings).filter((l) => l < level);
  return lower[lower.length - 1] ?? level;
}

function neighbors(settings: Settings, direction: Direction, distances: readonly HintDistance[]): PatternChoice[] {
  return distances.filter((d) => settings.hintDistance[d] && DISTANCE_DIRECTIONS[d].includes(direction)).map((distance) => ({ pattern: 'neighbors', distance }));
}

function lines(direction: Direction): PatternChoice[] {
  return [{ pattern: 'middle', direction }, ...ROW_GIVEN.map((given): PatternChoice => ({ pattern: 'row', direction, given }))];
}

function shapes(settings: Settings, empties: 1 | 2): PatternChoice[] {
  return SHAPE_IDS.filter((id) => settings.shapes[id]).map((shape) => ({ pattern: 'shape', shape, empties }));
}

/**
 * What level `level` offers for `direction` under the parent's settings, without checking the chart. `xTwoEmpties`
 * gives the X shape of level 5 its two empty squares.
 */
export function levelChoices(level: Level, direction: Direction, settings: Settings, xTwoEmpties = false): PatternChoice[] {
  if (!PICK_DIRECTIONS[level].includes(direction)) return [];
  switch (level) {
    case 1:
      return [...neighbors(settings, direction, ['direct', 'vertical']), ...lines(direction)];
    case 2:
      // The straight directions of level 2 offer only the big plus; its lines belong to level 1.
      if (!LEVEL_DIRECTIONS[2].includes(direction)) return neighbors(settings, direction, ['far']);
      return [...neighbors(settings, direction, ['diagonal']), ...lines(direction)];
    case 3:
      return shapes(settings, 1);
    case 4:
      return shapes(settings, 2);
    case 5:
      return [{ pattern: 'xshape', empties: xTwoEmpties ? 2 : 1 }];
  }
}

/**
 * Picks one direction, weighting directions not yet mastered UNMASTERED_WEIGHT times (FR-089: directions the child has
 * not mastered yet are weighted twice).
 */
export function pickDirection(candidates: readonly Direction[], mastered: readonly Direction[], rng: Rng): Direction {
  if (candidates.length === 0) throw new RangeError('pickDirection: no candidates');
  const weights = candidates.map((d) => (mastered.includes(d) ? 1 : UNMASTERED_WEIGHT));
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}

/** One pattern choice for one direction, as the target generator uses it. */
export interface LevelPick {
  direction: Direction;
  choice: PatternChoice;
  /** The level whose patterns the target uses (1 to 5). */
  level: Level;
}

/** What target selection needs to know about the child (FR-086, FR-089). */
export interface LevelProgress {
  /** Directions the child has mastered. */
  mastered: readonly Direction[];
  /** The current level, already clamped to the parent's range (`currentLevel`). */
  level: Level;
  /** Two empty squares in the X shape of level 5. */
  xTwoEmpties: boolean;
}

/** Answers of `fits`, by range, choice and direction: they never change, and every target asks them again. */
const fitCache = new Map<string, boolean>();

/** True when `choice` has a placement on `layout` that trains `direction`. */
function fits(layout: ChartLayout, choice: PatternChoice, direction: Direction): boolean {
  const key = `${layout.min}-${layout.max}|${JSON.stringify(choice)}|${direction}`;
  let found = fitCache.get(key);
  if (found === undefined) {
    found = placements(layout, choice, direction).length > 0;
    fitCache.set(key, found);
  }
  return found;
}

/** The choices of `level` that fit the chart, by direction; empty when nothing of the level fits. */
function fittingAt(layout: ChartLayout, level: Level, settings: Settings, xTwoEmpties: boolean): Map<Direction, PatternChoice[]> {
  const out = new Map<Direction, PatternChoice[]>();
  for (const direction of PICK_DIRECTIONS[level]) {
    const ok = levelChoices(level, direction, settings, xTwoEmpties).filter((c) => fits(layout, c, direction));
    if (ok.length > 0) out.set(direction, ok);
  }
  return out;
}

/** The levels to try for `level`, in order: the level itself, every lower level from the nearest down, then every higher one. */
function fallbackOrder(level: Level): Level[] {
  return [level, ...LEVELS.filter((l) => l < level).reverse(), ...LEVELS.filter((l) => l > level)];
}

/** Used when nothing fits the chart, which a valid range of at least 10 numbers never causes. */
const FALLBACK: LevelPick = { direction: 'right', choice: { pattern: 'neighbors', distance: 'direct' }, level: FIRST_LEVEL };

/**
 * The pick for the next target (FR-086, FR-089): the child's level, or the nearest level that fits the chart, then a
 * direction of it (unmastered ones weighted twice), then one of its pattern choices for that direction.
 */
export function levelChoice(layout: ChartLayout, settings: Settings, progress: LevelProgress, rng: Rng): LevelPick {
  for (const level of fallbackOrder(progress.level)) {
    const usable = fittingAt(layout, level, settings, level === X_LEVEL && progress.xTwoEmpties);
    if (usable.size === 0) continue;
    const direction = pickDirection([...usable.keys()], progress.mastered, rng);
    return { direction, choice: rng.pick(usable.get(direction)!), level };
  }
  return FALLBACK;
}

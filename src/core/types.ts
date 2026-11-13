/** Shared types of the engine-free core (data-model.md, contracts/core-api.md). */
import type { Level } from './settings/defaults';
import type { Pattern } from './targets/patterns';

/** The 8 directions on the hundred chart. Steps: right +1, left -1, down +10, up -10, downRight +11, upLeft -11, downLeft +9, upRight -9. */
export const DIRECTIONS = ['right', 'left', 'down', 'up', 'downRight', 'upLeft', 'downLeft', 'upRight'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * The mode name in stored attempts and personal bests. Since amendment 05 the goalkeeper game (`keeper`) is the only
 * game; the stored data baseline (T106) dropped the hole and line modes of earlier data.
 */
export const MODES = ['keeper'] as const;
export type Mode = (typeof MODES)[number];

/** The mode of every attempt and personal best. */
export const PLAYED_MODE = 'keeper' satisfies Mode;

/**
 * The round types (FR-026, FR-077, FR-108): until the hearts are gone, a fixed number of goals, the time challenge,
 * which counts goals until its countdown ends, or a cup match, won at "Tore pro Spiel" goals before the hearts are gone.
 * The parent chooses between the first two for "Spielen"; "Zeit-Challenge" starts the third and "Pokal" the fourth.
 */
export const ROUND_TYPES = ['untilHearts', 'goalCount', 'time', 'cup'] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

/** How far the hint numbers sit from the target. */
export const HINT_DISTANCES = ['direct', 'vertical', 'diagonal', 'far'] as const;
export type HintDistance = (typeof HINT_DISTANCES)[number];

/** An axis-aligned rectangle in world pixels; `x`, `y` is the top left corner. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The current target (data-model "Target"), from `nextTarget` in core/targets. */
export interface Target {
  /** The answer. */
  number: number;
  /** Visible hint numbers. */
  hints: number[];
  /** Directions trained, from the hint offsets (FR-038). */
  directions: Direction[];
  /** The difficulty level whose patterns the target uses, 1 to 6 (core/progress/levels.ts, amendments 09 and 18). */
  level: Level;
  /** The hint pattern (FR-065). */
  pattern: Pattern;
  /**
   * Formen or the X shape with two empty squares (FR-072): the empty squares of the same shape still to be shot after this one, in
   * order, with the directions each trains. Missing or empty for every other target.
   */
  queue?: Array<{ number: number; directions: Direction[] }>;
  /**
   * A cutout of level 6 (amendment 18, FR-124): all its squares and the given ones. The squares filled so far are the
   * hints that are not given. The target is the last square of the cutout when `queue` is empty; only that one is a
   * keeper shot and a goal (FR-126). Missing for every other target.
   */
  cutout?: Cutout;
}

/** The squares of a cutout (amendment 18): all of them, and those given with their numbers from the start. */
export interface Cutout {
  squares: number[];
  given: number[];
}

/** True when `target` is a square of a cutout with more empty squares after it: no keeper, no goal (FR-126). */
export function isCutoutFill(target: { cutout?: unknown; queue?: readonly unknown[] } | null | undefined): boolean {
  return target?.cutout !== undefined && (target.queue?.length ?? 0) > 0;
}

/** A read-only view of `T`, nested objects and arrays included (review H1: views cannot change the match state). */
export type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

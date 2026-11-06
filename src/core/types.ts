/** Shared types of the engine-free core (data-model.md, contracts/core-api.md). */
import type { Pattern } from './targets/patterns';

/** The 8 directions on the hundred chart. Steps: right +1, left -1, down +10, up -10, downRight +11, upLeft -11, downLeft +9, upRight -9. */
export const DIRECTIONS = ['right', 'left', 'down', 'up', 'downRight', 'upLeft', 'downLeft', 'upRight'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * The mode names in stored attempts and personal bests. Since amendment 05 the goalkeeper game (`keeper`) is the only
 * game; `holes` and `lines` stay readable in data from earlier versions and show as "früher" (FR-070).
 */
export const MODES = ['holes', 'lines', 'keeper'] as const;
export type Mode = (typeof MODES)[number];

/** The mode of every new attempt and personal best. */
export const PLAYED_MODE = 'keeper' satisfies Mode;

/** The removed modes, kept only in old stored data. */
export const EARLIER_MODES = ['holes', 'lines'] as const satisfies readonly Mode[];
export type EarlierMode = (typeof EARLIER_MODES)[number];

/**
 * The round types (FR-026, FR-077): until the hearts are gone, a fixed number of goals, or the time challenge, which
 * counts goals until its countdown ends. The parent chooses between the first two for "Spielen"; "Zeit-Challenge"
 * starts the third.
 */
export const ROUND_TYPES = ['untilHearts', 'goalCount', 'time'] as const;
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
  /** 0 to 7, from the adaptive ladder (core/progress/ladder.ts). */
  difficultyStep: number;
  /** The hint pattern (FR-065). */
  pattern: Pattern;
  /**
   * Formen with two empty squares (FR-072): the empty squares of the same shape still to be shot after this one, in
   * order, with the directions each trains. Missing or empty for every other target.
   */
  queue?: Array<{ number: number; directions: Direction[] }>;
}

/** A read-only view of `T`, nested objects and arrays included (review H1: views cannot change the match state). */
export type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

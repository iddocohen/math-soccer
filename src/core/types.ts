/** Shared types of the engine-free core (data-model.md, contracts/core-api.md). */

/** The 8 directions on the hundred chart. Steps: right +1, left -1, down +10, up -10, downRight +11, upLeft -11, downLeft +9, upRight -9. */
export const DIRECTIONS = ['right', 'left', 'down', 'up', 'downRight', 'upLeft', 'downLeft', 'upRight'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** The three game modes: hole mode, line mode, goalkeeper mode. */
export const MODES = ['holes', 'lines', 'keeper'] as const;
export type Mode = (typeof MODES)[number];

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

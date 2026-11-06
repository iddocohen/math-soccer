import type { Rect } from '../types';

/**
 * Fixed world coordinates of the match scene (contracts/screens.md). The canvas scales this world to fit the screen,
 * so every view and the chart mapping work in these units.
 */

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;

/** The goal mouth, which holds the number chart: x 300 to 1300, y 230 to 790. */
export const GOAL_RECT: Rect = { x: 300, y: 230, width: 1000, height: 560 };

/** The stands with the fans: y 0 to 260. */
export const STANDS_BOTTOM = 260;

/** Where the player stands and the ball waits before a shot. */
export const KICK_SPOT = { x: 800, y: 930 } as const;

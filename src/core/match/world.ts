import type { Rect } from '../types';

/**
 * Fixed world coordinates of the match scene (contracts/screens.md, amendment 02). The canvas scales this world to fit
 * the screen, so every view and the chart mapping work in these units.
 */

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;

/** Outer edge of the goal posts and the crossbar: x 260 to 1340, y 200 to 800. The bottom edge is the goal line. */
export const GOAL_FRAME: Rect = { x: 260, y: 200, width: 1080, height: 600 };

/** Thickness of the posts and the crossbar. */
export const POST_WIDTH = 22;

/**
 * The number chart, a panel inside the goal mouth: x 340 to 1260, y 265 to 750 (FR-054). The margins to the outer edge
 * of the frame are 80 at the sides and 65 at the top, at least 6% of the goal width (64.8). The net shows between the
 * panel and the posts and crossbar. Board, hints, help arrow and ball target all use this rectangle with `cellRect`.
 */
export const CHART_RECT: Rect = { x: 340, y: 265, width: 920, height: 485 };

/** The stands with the fans: y 0 to 260. */
export const STANDS_BOTTOM = 260;

/** Where the ball waits before a shot, below the goal line so it never covers a chart square (FR-056). */
export const KICK_SPOT = { x: 860, y: 940 } as const;

/**
 * The help line, the typed number and the message start at this world x, just right of the ball at the kick spot, so
 * the player standing to the lower left of the ball never lies under them (amendment 08, FR-083). The overlay turns it
 * into screen pixels with the canvas scale (src/app/styles.css `.overlay-bottom`).
 */
export const OVERLAY_LEFT = 894;

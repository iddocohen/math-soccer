// Copied from math-tank tests/e2e/gameWait.ts.
/**
 * How long a spec waits for a game state that depends on game time: a ball in flight, the keeper's dive, the end of a
 * round. Phaser caps the time step of a slow frame, so game time runs slower than wall time when several browsers
 * render at once. The waits still end on a game state, never after a fixed time. playwright.config.ts sets it as the
 * timeout of every `expect`; `page.waitForFunction` takes it explicitly.
 */
export const GAME_WAIT = 30_000;

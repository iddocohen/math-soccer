/**
 * "Selbst ins Tor" (amendment 21, FR-143 to FR-146): the child is the goalkeeper. Pure functions and constants; the
 * controller plays the round (MatchController), the scene draws it (src/game/ShotView.ts).
 *
 * - An opponent from the cup teams shoots at one square of the chart; the square has no number. The child types the
 *   square's number before the ball arrives and presses Enter.
 * - The flight time comes from the parent's "Schussgeschwindigkeit" (`KEEPER_FLIGHT_MS`); the first shot of a round
 *   always flies at the slow speed (FR-144).
 * - The squares follow the child's level in reverse (FR-146): any square of the range, with its row and column
 *   neighbors as hints at levels 1 to 2, one row and one column neighbor at levels 3 to 4, no hints at levels 5 to 6.
 * - A round has KEEPER_SHOTS shots; each save earns `STARS.save` (src/core/rewards/lockerRoom.ts).
 */
import type { ChartLayout } from '../chart/layout';
import { directionsOf, hintsFor } from '../targets/hints';
import { TEAMS, type CupTeam } from '../cup/teams';
import type { Rng } from '../rng';
import type { Level } from '../settings/defaults';
import type { Direction, Target } from '../types';

/** The shots of one round (FR-146). */
export const KEEPER_SHOTS = 10;

/** The parent's "Schussgeschwindigkeit" (FR-144). */
export const KEEPER_SPEEDS = ['slow', 'medium', 'fast'] as const;
export type KeeperSpeed = (typeof KEEPER_SPEEDS)[number];

/** The ball's flight time per speed: langsam 10 s, mittel 8 s, schnell 5 s (FR-144). */
export const KEEPER_FLIGHT_MS: Record<KeeperSpeed, number> = { slow: 10_000, medium: 8_000, fast: 5_000 };

/**
 * Play time from a decided shot to the next one: the dive, the save or the ball in the net, and the real square with its
 * number. At least SHOWN_MS of the controller, so the square shows its number long enough (FR-004).
 */
export const KEEPER_RESULT_MS = 1800;

/** How the current shot was decided: saved, a wrong number, or no number before the ball arrived. */
export type ShotResult = 'saved' | 'wrong' | 'late';

/**
 * The opponent's shot at the current target. While `result` is null the ball flies and `leftMs` counts down; with
 * `held` the flight waits for the next key (help, FR-145). Once decided, `resultLeftMs` counts down to the next shot.
 */
export interface KeeperShot {
  totalMs: number;
  leftMs: number;
  held: boolean;
  result: ShotResult | null;
  /** The number the child typed for this shot; null when none was shot before the ball arrived. */
  typed: number | null;
  resultLeftMs: number;
}

/** The flight time of shot `index` (0 for the first of the round) at `speed`: the first one is always slow (FR-144). */
export function flightMsOf(speed: KeeperSpeed, index: number): number {
  return KEEPER_FLIGHT_MS[index === 0 ? 'slow' : speed];
}

/** A new shot that flies `totalMs`. */
export function newShot(totalMs: number): KeeperShot {
  return { totalMs, leftMs: totalMs, held: false, result: null, typed: null, resultLeftMs: 0 };
}

/** How a shot at `target` ends when the child shoots `typed` (null: too late). */
export function shotResult(target: number, typed: number | null): ShotResult {
  if (typed === null) return 'late';
  return typed === target ? 'saved' : 'wrong';
}

/** The opponent of a round: one of the cup teams, from the round's seed. */
export function keeperOpponent(seed: number): CupTeam {
  return TEAMS[Math.abs(Math.trunc(seed)) % TEAMS.length]!;
}

/** How many hint neighbors the target gets at `level` (FR-146): all row and column neighbors, one of each, or none. */
export function keeperHintCount(level: Level): 'all' | 'some' | 'none' {
  if (level <= 2) return 'all';
  return level <= 4 ? 'some' : 'none';
}

/** The row and column neighbors of a square: the step from the neighbor to the square, and the neighbor's number. */
interface Neighbor {
  number: number;
  direction: Direction;
  axis: 'row' | 'column';
}

function neighborsOf(layout: ChartLayout, n: number): Neighbor[] {
  return hintsFor(layout, n, 'direct').map((number) => {
    const direction = directionsOf(n, [number])[0]!;
    return { number, direction, axis: direction === 'right' || direction === 'left' ? 'row' : 'column' };
  });
}

/**
 * The square of the next shot (FR-146): any square of the range but `avoid`, with hints by `level` in reverse. The
 * target's `level` is the child's, so the hint display follows it as in "Spielen".
 */
export function keeperTarget(layout: ChartLayout, level: Level, rng: Rng, avoid: number | null = null): Target {
  const span = layout.max - layout.min;
  let number = rng.int(layout.min, layout.max);
  if (number === avoid && span > 0) number = number === layout.max ? layout.min : number + 1;
  const neighbors = neighborsOf(layout, number);
  const count = keeperHintCount(level);
  let chosen: Neighbor[] = [];
  if (count === 'all') chosen = neighbors;
  else if (count === 'some') {
    // One neighbor in the row and one in the column, where the chart has them.
    for (const axis of ['row', 'column'] as const) {
      const options = neighbors.filter((x) => x.axis === axis);
      if (options.length > 0) chosen.push(rng.pick(options));
    }
  }
  return {
    number,
    hints: chosen.map((x) => x.number),
    directions: [...new Set(chosen.map((x) => x.direction))],
    level,
    pattern: 'neighbors',
  };
}

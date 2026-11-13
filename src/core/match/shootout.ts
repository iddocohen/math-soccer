/**
 * The penalty shootout (amendment 21 part 3, FR-147, FR-148). Pure functions over the kicks of two sides; the
 * controller plays the turns (MatchController, mode 'shootout') and the overlay draws the score circles.
 *
 * - Side 0 shoots first in each round, side 1 second. In "Elfmeterschießen" side 0 is the child (he shoots as in
 *   "Spielen") and side 1 the opponent (the child keeps, as in "Selbst ins Tor"). "Papa gegen Kind" (amendment 23) can
 *   give the two sides to two players with their own levels; nothing here knows who shoots.
 * - SHOOTOUT_ROUNDS rounds of one kick per side. Every round is played to the end, so the child always takes his five
 *   kicks. When the score is level after them, single rounds follow until one side leads after a full round.
 * - The score circles show at least SHOOTOUT_ROUNDS per side and grow by one per round of sudden death.
 */

/** One kick: a goal or a miss. A save of the keeper is a miss of the shooter. */
export type Kick = 'goal' | 'miss';

/** The two sides: 0 shoots first in each round, 1 second. */
export type ShootoutSide = 0 | 1;

/** The kicks of each side, in order. */
export type ShootoutKicks = readonly [readonly Kick[], readonly Kick[]];

/** The rounds before sudden death (FR-147). */
export const SHOOTOUT_ROUNDS = 5;

/** One circle of the score: a goal, a miss, or a kick still to come. */
export type ScoreCircle = Kick | 'open';

export function emptyKicks(): [Kick[], Kick[]] {
  return [[], []];
}

/** The goals of each side. */
export function shootoutScore(kicks: ShootoutKicks): [number, number] {
  return [goalsOf(kicks[0]), goalsOf(kicks[1])];
}

function goalsOf(side: readonly Kick[]): number {
  return side.filter((k) => k === 'goal').length;
}

/**
 * The winning side, or null while the shootout goes on: both sides took the same number of kicks, at least
 * SHOOTOUT_ROUNDS each, and one side has more goals.
 */
export function shootoutWinner(kicks: ShootoutKicks): ShootoutSide | null {
  const [a, b] = kicks;
  if (a.length !== b.length || a.length < SHOOTOUT_ROUNDS) return null;
  const [ga, gb] = shootoutScore(kicks);
  if (ga === gb) return null;
  return ga > gb ? 0 : 1;
}

export function shootoutOver(kicks: ShootoutKicks): boolean {
  return shootoutWinner(kicks) !== null;
}

/** The side whose kick comes next, or null when the shootout is over. */
export function nextSide(kicks: ShootoutKicks): ShootoutSide | null {
  if (shootoutOver(kicks)) return null;
  return kicks[0].length > kicks[1].length ? 1 : 0;
}

/** The kicks with `kick` added for the side whose turn it is; unchanged when the shootout is over. */
export function addKick(kicks: ShootoutKicks, kick: Kick): [Kick[], Kick[]] {
  const side = nextSide(kicks);
  const next: [Kick[], Kick[]] = [[...kicks[0]], [...kicks[1]]];
  if (side !== null) next[side].push(kick);
  return next;
}

/** The round being played, from 1; in sudden death above SHOOTOUT_ROUNDS. After the end, the last round. */
export function shootoutRound(kicks: ShootoutKicks): number {
  const done = Math.min(kicks[0].length, kicks[1].length);
  return shootoutOver(kicks) ? done : done + 1;
}

/**
 * The score circles of each side (FR-147): one per kick taken and one open circle per kick still to come in the
 * current rounds, at least SHOOTOUT_ROUNDS per side. In sudden death both rows grow by one circle per round.
 */
export function scoreCircles(kicks: ShootoutKicks): [ScoreCircle[], ScoreCircle[]] {
  const length = Math.max(SHOOTOUT_ROUNDS, shootoutRound(kicks));
  const row = (side: readonly Kick[]): ScoreCircle[] => Array.from({ length }, (_, i) => side[i] ?? 'open');
  return [row(kicks[0]), row(kicks[1])];
}

/** The score as `data-shootout-score` shows it: "2:1". */
export function scoreText(kicks: ShootoutKicks): string {
  const [a, b] = shootoutScore(kicks);
  return `${a}:${b}`;
}

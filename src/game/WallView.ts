/**
 * The wall of "Freistoß mit Mauer" (amendment 21, FR-142): 3 to 5 defenders stand shoulder to shoulder on the grass in
 * front of the goal line, lined up under the band of columns the wall covers (core/match/wall.ts). They are drawn
 * taller than the keeper and smaller than the child's player, because they stand between the two. A light wash in
 * the wall's kit color over those columns of the chart shows which numbers are behind the wall; it lies under the grid,
 * so the square of a typed number still lights up over it.
 *
 * - The defenders wear a neutral kit: red, or blue when the child's shirt is red-like, so they never look like his team.
 *   Their arms are folded in front, as in a real wall. Their upper bodies reach into the chart's lower rows, so like the
 *   waiting keeper (FR-120) they are drawn behind the grid: every number, hint and the target stay readable over them.
 *   The wall never stands in the columns of the child's player when it can avoid them (`PLAYER_COLUMNS`).
 * - `hitPoint(n)`: where a shot at `n` meets the wall, at the chest of the defender nearest to its column.
 * - `bump()`: the defenders jump a little when the ball hits them.
 */
import Phaser from 'phaser';
import { COLUMNS, cellOf, type ChartLayout } from '../core/chart/layout';
import type { Wall } from '../core/match/wall';
import { CHART_RECT } from '../core/match/world';
import type { DeepReadonly, Rect } from '../core/types';
import { BOARD_DEPTH } from './GoalView';
import { COLOR } from './palette';
import { WAITING_DEPTH } from './KeeperView';
import { KEEPER_DRAWN_HEIGHT, PLAYER_SCALE, BODY } from './playerPose';

/** Under the grid and the defenders, over the waiting keeper and the ball in the net. */
const SHADE_DEPTH = WAITING_DEPTH + (BOARD_DEPTH - WAITING_DEPTH) * 0.25;
/** Behind the grid, so no number is covered, and in front of the waiting keeper, who stands further back (FR-120). */
export const WALL_DEPTH = WAITING_DEPTH + (BOARD_DEPTH - WAITING_DEPTH) * 0.6;
/** Where the defenders' feet stand: on the grass in front of the goal line (y 800), behind the kick spot (y 940). */
export const WALL_FEET_Y = 880;
/** A defender from the feet to the top of the head: between the keeper and the child's player (amendment 21). */
export const DEFENDER_HEIGHT = Math.round(KEEPER_DRAWN_HEIGHT * 1.15);
/** The child's player is this tall; the defenders stay smaller. */
export const PLAYER_HEIGHT = BODY.height * PLAYER_SCALE;
const DEFENDER_WIDTH_MIN = 60;
const DEFENDER_WIDTH_MAX = 110;
/** The defenders' shirt colors: red, or blue when the child wears a red-like shirt. */
const KITS = [0xc94f4f, 0x3e6fb0] as const;
const BUMP_MS = 160;

/** The kit of the wall for a child in `shirt`: the first of KITS far enough from his shirt color. */
export function wallKit(shirt: number): number {
  const far = (a: number, b: number) =>
    Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff)) + Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)) + Math.abs((a & 0xff) - (b & 0xff)) > 150;
  return KITS.find((k) => far(k, shirt)) ?? KITS[0];
}

/** The x of each defender's middle over the band of `wall`, evenly spread from its left to its right edge. */
export function defenderXs(wall: DeepReadonly<Wall>): number[] {
  const col = CHART_RECT.width / COLUMNS;
  const left = CHART_RECT.x + wall.from * col;
  const step = ((wall.to - wall.from + 1) * col) / wall.defenders;
  return Array.from({ length: wall.defenders }, (_, i) => left + step * (i + 0.5));
}

export class WallView {
  private readonly scene: Phaser.Scene;
  private readonly shade: Phaser.GameObjects.Graphics;
  private readonly defenders: Phaser.GameObjects.Container;
  private wall: DeepReadonly<Wall> | null = null;
  private key = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.shade = scene.add.graphics().setDepth(SHADE_DEPTH);
    this.defenders = scene.add.container(0, 0).setDepth(WALL_DEPTH);
  }

  /** Shows `wall` in the kit for a child in `shirt`; null hides it. Redraws only when either changed. */
  setWall(wall: DeepReadonly<Wall> | null, shirt: number): void {
    const key = wall === null ? '' : `${wall.from}-${wall.to}-${wall.defenders}-${wallKit(shirt)}`;
    if (key === this.key) return;
    this.key = key;
    this.wall = wall;
    this.shade.clear();
    this.defenders.removeAll(true);
    if (wall === null) return;
    const col = CHART_RECT.width / COLUMNS;
    // The columns behind the wall: a light wash in the wall's kit color with a thin edge on both sides.
    const kit = wallKit(shirt);
    const left = CHART_RECT.x + wall.from * col;
    const width = (wall.to - wall.from + 1) * col;
    this.shade.fillStyle(kit, 0.2);
    this.shade.fillRect(left, CHART_RECT.y, width, CHART_RECT.height);
    this.shade.lineStyle(3, kit, 0.6);
    this.shade.lineBetween(left, CHART_RECT.y, left, CHART_RECT.y + CHART_RECT.height);
    this.shade.lineBetween(left + width, CHART_RECT.y, left + width, CHART_RECT.y + CHART_RECT.height);
    const xs = defenderXs(wall);
    // Shoulder to shoulder: a little wider than the space between two defenders, so their shoulders overlap.
    const spacing = xs.length > 1 ? xs[1]! - xs[0]! : DEFENDER_WIDTH_MAX;
    const size = defenderWidth(spacing);
    for (const x of xs) this.defenders.add(drawDefender(this.scene, x, WALL_FEET_Y, size, kit));
  }

  /** Where a shot at `n` meets the wall: a small square at the chest of the defender nearest to the column of `n`. */
  hitPoint(layout: ChartLayout, n: number): Rect {
    const wall = this.wall;
    const col = CHART_RECT.width / COLUMNS;
    const x = CHART_RECT.x + (cellOf(layout, n).col + 0.5) * col;
    const xs = wall ? defenderXs(wall) : [x];
    const nearest = xs.reduce((best, d) => (Math.abs(d - x) < Math.abs(best - x) ? d : best), xs[0]!);
    const y = WALL_FEET_Y - DEFENDER_HEIGHT * 0.62;
    return { x: nearest - 20, y: y - 20, width: 40, height: 40 };
  }

  /** The defenders jump a little: the ball hit the wall. */
  bump(): void {
    this.scene.tweens.add({ targets: this.defenders, y: -10, duration: BUMP_MS, yoyo: true, ease: 'Quad.easeOut' });
  }

  get showing(): boolean {
    return this.wall !== null;
  }
}

/** A defender's width for `spacing` between two defenders' middles. */
export function defenderWidth(spacing: number): number {
  return Math.min(DEFENDER_WIDTH_MAX, Math.max(DEFENDER_WIDTH_MIN, spacing * 1.3));
}

/** One defender seen from the front, feet at (`x`, `feet`): legs, shorts, shirt, folded arms and head. */
function drawDefender(scene: Phaser.Scene, x: number, feet: number, width: number, kit: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y: feet });
  const w = width;
  const h = DEFENDER_HEIGHT;
  // Shadow on the grass.
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(0, 0, w * 1.1, 10);
  // Legs with socks in the kit color.
  g.fillStyle(COLOR.skin, 1);
  g.fillRect(-w * 0.32, -h * 0.34, w * 0.24, h * 0.16);
  g.fillRect(w * 0.08, -h * 0.34, w * 0.24, h * 0.16);
  g.fillStyle(kit, 1);
  g.fillRect(-w * 0.32, -h * 0.18, w * 0.24, h * 0.16);
  g.fillRect(w * 0.08, -h * 0.18, w * 0.24, h * 0.16);
  g.fillStyle(COLOR.ink, 1);
  g.fillRect(-w * 0.36, -h * 0.03, w * 0.3, h * 0.03);
  g.fillRect(w * 0.06, -h * 0.03, w * 0.3, h * 0.03);
  // Shorts.
  g.fillStyle(COLOR.chalk, 1);
  g.fillRect(-w * 0.4, -h * 0.48, w * 0.8, h * 0.16);
  // Shirt.
  g.fillStyle(kit, 1);
  g.fillRoundedRect(-w / 2, -h * 0.82, w, h * 0.36, 6);
  // Arms folded in front of the belly.
  g.fillStyle(COLOR.skin, 1);
  g.fillRoundedRect(-w * 0.42, -h * 0.6, w * 0.84, h * 0.07, 4);
  // Head and hair.
  g.fillStyle(COLOR.skin, 1);
  const head = Math.min(w * 0.3, h * 0.08);
  g.fillCircle(0, -h * 0.9, head);
  g.fillStyle(COLOR.hair, 1);
  g.slice(0, -h * 0.9, head + 1, Math.PI, 0, false);
  g.fillPath();
  return g;
}

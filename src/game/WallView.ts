/**
 * The wall of "Freistoß mit Mauer" (amendment 21, FR-142): 3 to 5 defenders stand side by side with a small gap on the
 * grass in front of the goal line, below the band of columns the wall covers (core/match/wall.ts). They are drawn
 * taller than the keeper and smaller than the child's player, because they stand between the two. A soft dark shade
 * on each chart square behind the wall shows which numbers are blocked; it lies under the grid, so the square of a
 * typed number still lights up over it.
 *
 * - Each defender is drawn like the keeper (KeeperView): head with hair and eyes, shirt with a trim stripe, shorts,
 *   two legs with socks and boots, and arms. In the wall pose the hands are crossed low in front.
 * - The defenders wear a neutral kit: red, or blue when the child's shirt is red-like, so they never look like his team.
 *   Their upper bodies reach into the chart's lower rows, so like the waiting keeper (FR-120) they are drawn behind the
 *   grid: every number, hint and the target stay readable over them. Where they stand comes from wallLook.ts
 *   (`defenderSpots`): beside the child's player whenever the band is beside him.
 * - `hitPoint(n)`: where a shot at `n` meets the wall, at the chest of the defender nearest to its column.
 * - `jump(blocked)`: on every shot all defenders jump together, timed with the ball (`wallHop`), then land.
 */
import Phaser from 'phaser';
import { cellRect, center, type ChartLayout } from '../core/chart/layout';
import { lerp } from '../core/util';
import type { Wall } from '../core/match/wall';
import { CHART_RECT } from '../core/match/world';
import type { DeepReadonly, Rect } from '../core/types';
import { FLIGHT_MS } from './BallView';
import { BOARD_DEPTH } from './GoalView';
import { drawLegs, drawShirt, WAITING_DEPTH } from './KeeperView';
import { FEET_BELOW_HIPS } from './keeperDive';
import { COLOR } from './palette';
import { KEEPER_DRAWN_HEIGHT } from './playerPose';
import { blockedSquareRects, DEFENDER_GAP, DEFENDER_PITCH, defenderSpots, hopOffset, wallHop } from './wallLook';

/** Under the grid and the defenders, over the waiting keeper and the ball in the net. */
const SHADE_DEPTH = lerp(WAITING_DEPTH, BOARD_DEPTH, 0.25);
/** Behind the grid, so no number is covered, and in front of the waiting keeper, who stands further back (FR-120). */
export const WALL_DEPTH = lerp(WAITING_DEPTH, BOARD_DEPTH, 0.6);
/** Where the defenders' feet stand: on the grass in front of the goal line (y 800), behind the kick spot (y 940). */
export const WALL_FEET_Y = 880;
/** A defender from the feet to the top of the head: between the keeper and the child's player (amendment 21). */
export const DEFENDER_HEIGHT = Math.round(KEEPER_DRAWN_HEIGHT * 1.15);
/** The defenders' shirt colors: red, or blue when the child wears a red-like shirt. */
const KITS = [0xc94f4f, COLOR.keeperJersey] as const;
/** How dark the shade on a blocked square is, and how far it stays inside the square's edges. */
const SHADE_ALPHA = 0.28;
const SHADE_INSET = 3;

/**
 * The figure in the keeper's drawing units (KeeperView `paint`): the hips at 0, the neck at NECK, the soles at
 * FEET_BELOW_HIPS, the body BODY_UNITS wide. The head is drawn on its own above the neck and keeps its round shape.
 */
const NECK = -41;
const HEAD_UNITS = 26;
const BODY_UNITS = 40;
/** Scales from units to world pixels: across the body, along it, and for the head. */
const SCALE_X = (DEFENDER_PITCH - DEFENDER_GAP) / BODY_UNITS;
const HEAD_SCALE = SCALE_X * 1.04;
const SCALE_Y = (DEFENDER_HEIGHT - HEAD_UNITS * HEAD_SCALE) / (FEET_BELOW_HIPS - NECK);

/** The kit of the wall for a child in `shirt`: the first of KITS far enough from his shirt color. */
export function wallKit(shirt: number): number {
  const far = (a: number, b: number) =>
    Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff)) + Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)) + Math.abs((a & 0xff) - (b & 0xff)) > 150;
  return KITS.find((k) => far(k, shirt)) ?? KITS[0];
}

export class WallView {
  private readonly scene: Phaser.Scene;
  private readonly shade: Phaser.GameObjects.Graphics;
  private readonly defenders: Phaser.GameObjects.Container;
  private wall: DeepReadonly<Wall> | null = null;
  private key = '';
  private hop: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.shade = scene.add.graphics().setDepth(SHADE_DEPTH);
    this.defenders = scene.add.container(0, 0).setDepth(WALL_DEPTH);
  }

  /** Shows `wall` in the kit for a child in `shirt`; null hides it. Redraws only when either changed. */
  setWall(layout: ChartLayout, wall: DeepReadonly<Wall> | null, shirt: number): void {
    const key = wall === null ? '' : `${layout.min}-${layout.max}-${wall.from}-${wall.to}-${wall.defenders}-${wallKit(shirt)}`;
    if (key === this.key) return;
    this.key = key;
    this.wall = wall;
    this.stopHop();
    this.shade.clear();
    this.defenders.removeAll(true);
    if (wall === null) return;
    // A soft dark shade on each blocked square, a little inside its edges, so the squares stay apart.
    this.shade.fillStyle(COLOR.night, SHADE_ALPHA);
    for (const r of blockedSquareRects(layout, wall)) {
      this.shade.fillRoundedRect(r.x + SHADE_INSET, r.y + SHADE_INSET, r.width - 2 * SHADE_INSET, r.height - 2 * SHADE_INSET, 4);
    }
    const kit = wallKit(shirt);
    for (const x of defenderSpots(wall)) this.defenders.add(drawDefender(this.scene, x, WALL_FEET_Y, kit));
  }

  /** Where a shot at `n` meets the wall: a small square at the chest of the defender nearest to the column of `n`. */
  hitPoint(layout: ChartLayout, n: number): Rect {
    const wall = this.wall;
    const x = center(cellRect(layout, CHART_RECT, n)).x;
    const xs = wall ? defenderSpots(wall) : [x];
    const nearest = xs.reduce((best, d) => (Math.abs(d - x) < Math.abs(best - x) ? d : best), xs[0]!);
    const y = WALL_FEET_Y - DEFENDER_HEIGHT * 0.6;
    return { x: nearest - 20, y: y - 20, width: 40, height: 40 };
  }

  /** The child shot: all defenders jump together, highest when the ball reaches the wall, then land. */
  jump(blocked: boolean): void {
    if (this.wall === null) return;
    this.stopHop();
    const hop = wallHop(FLIGHT_MS, blocked);
    this.hop = this.scene.tweens.addCounter({
      from: 0,
      to: hop.land,
      duration: hop.land,
      onUpdate: (tw) => this.defenders.setY(-hopOffset(tw.getValue() ?? 0, hop)),
      onComplete: () => {
        this.hop = null;
        this.defenders.setY(0);
      },
    });
  }

  private stopHop(): void {
    this.hop?.stop();
    this.hop = null;
    this.defenders.setY(0);
  }

  get showing(): boolean {
    return this.wall !== null;
  }
}

/**
 * One defender seen from the front, feet at (`x`, `feet`), drawn like the keeper: shadow, legs with socks and boots,
 * shorts, shirt with a trim stripe, arms with the hands crossed low in front, and a round head with hair and eyes.
 */
function drawDefender(scene: Phaser.Scene, x: number, feet: number, kit: number): Phaser.GameObjects.Container {
  const hips = -FEET_BELOW_HIPS * SCALE_Y;
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.25);
  shadow.fillEllipse(0, 0, (DEFENDER_PITCH - DEFENDER_GAP) * 0.95, 12);

  const body = scene.add.graphics({ x: 0, y: hips }).setScale(SCALE_X, SCALE_Y);
  // Legs, white shorts and the shirt with a trim stripe, as the keeper's (KeeperView.ts).
  drawLegs(body, kit, COLOR.chalk);
  body.fillStyle(COLOR.chalkShade, 1);
  body.fillRect(-1, 4, 2, 9);
  drawShirt(body, kit, COLOR.chalk);
  // Arms: short sleeves, upper arms down the sides, forearms crossed low in front with the hands over the shorts.
  body.lineStyle(9, kit, 1);
  body.lineBetween(-16, -36, -17, -26);
  body.lineBetween(16, -36, 17, -26);
  body.lineStyle(7, COLOR.skin, 1);
  body.lineBetween(-17, -27, -16, -13);
  body.lineBetween(17, -27, 16, -13);
  body.lineBetween(-16, -13, 7, 3);
  body.lineBetween(16, -13, -7, 3);
  body.fillStyle(COLOR.skin, 1);
  body.fillCircle(-16, -13, 3.5);
  body.fillCircle(16, -13, 3.5);
  body.fillCircle(8, 4, 4.5);
  body.fillCircle(-8, 4, 4.5);

  // The head on its own, so it stays round: skin, hair on top, two eyes.
  const head = scene.add.graphics({ x: 0, y: hips + NECK * SCALE_Y }).setScale(HEAD_SCALE);
  head.fillStyle(COLOR.skin, 1);
  head.fillCircle(0, -13, 13);
  head.fillStyle(COLOR.hair, 1);
  head.fillEllipse(0, -20, 26, 12);
  head.fillStyle(COLOR.ink, 1);
  head.fillCircle(-4.5, -14, 1.8);
  head.fillCircle(4.5, -14, 1.8);

  return scene.add.container(x, feet, [shadow, body, head]);
}

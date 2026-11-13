/**
 * The board of "Torwandschießen" (amendment 23, FR-155): a light panel over the whole goal mouth, in the classic look of
 * a German shooting wall, with the chart squares printed faintly and without numbers. Round holes are cut into the
 * squares of `holes`; through them the net shows, and a ball in the net (BALL_IN_NET_DEPTH) shows only through its
 * hole. The hint numbers, the shown square and the help of the grid (GoalView, BOARD_DEPTH) lie on top.
 *
 * The panel is painted into one canvas texture, and only again when the holes or the range change.
 */
import Phaser from 'phaser';
import { cellRect, cellRectAt, center, chartSquares, type ChartLayout } from '../core/chart/layout';
import { CHART_RECT, GOAL_FRAME, POST_WIDTH } from '../core/match/world';
import type { Rect } from '../core/types';
import { BALL_IN_NET_DEPTH, BOARD_DEPTH } from './GoalView';
import { COLOR, css } from './palette';

/** Between a ball in the net and the grid, so the ball in the net shows only through a hole. */
export const TORWAND_DEPTH = (BALL_IN_NET_DEPTH + BOARD_DEPTH) / 2;

const TEXTURE = 'torwand-board';
/** Canvas pixels per world pixel. */
const RESOLUTION = 1.5;

/** The part of the goal mouth the board covers: inside the posts and under the crossbar, down to the goal line. */
export const TORWAND_RECT: Rect = {
  x: GOAL_FRAME.x + POST_WIDTH,
  y: GOAL_FRAME.y + POST_WIDTH,
  width: GOAL_FRAME.width - 2 * POST_WIDTH,
  height: GOAL_FRAME.height - POST_WIDTH,
};

/** A round hole: its center and radius in world pixels. */
export interface Hole {
  x: number;
  y: number;
  r: number;
}

/** The round hole cut into the chart square of `n`: centered, a little wider than the square's shorter side, as on a real board. */
export function holeCircle(layout: ChartLayout, n: number): Hole {
  const rect = cellRect(layout, CHART_RECT, n);
  const { x, y } = center(rect);
  return { x, y, r: Math.min(rect.width, rect.height) * 0.55 };
}

export class TorwandView {
  private readonly scene: Phaser.Scene;
  /** The board's canvas texture and image, made at the first board of the scene. */
  private board: { texture: Phaser.Textures.CanvasTexture; image: Phaser.GameObjects.Image } | null = null;
  private key = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private makeBoard(): { texture: Phaser.Textures.CanvasTexture; image: Phaser.GameObjects.Image } {
    const scene = this.scene;
    if (scene.textures.exists(TEXTURE)) scene.textures.remove(TEXTURE);
    const texture = scene.textures.createCanvas(TEXTURE, TORWAND_RECT.width * RESOLUTION, TORWAND_RECT.height * RESOLUTION);
    if (!texture) throw new Error('TorwandView: the board texture could not be created');
    const image = scene.add
      .image(TORWAND_RECT.x, TORWAND_RECT.y, TEXTURE)
      .setOrigin(0, 0)
      .setDisplaySize(TORWAND_RECT.width, TORWAND_RECT.height)
      .setDepth(TORWAND_DEPTH);
    return { texture, image };
  }

  /** True while the board shows. */
  get showing(): boolean {
    return this.board?.image.visible === true;
  }

  /** Shows the board with holes in the squares of `holes`; null hides it (every other mode). */
  setHoles(layout: ChartLayout, holes: readonly number[] | null): void {
    if (holes === null) {
      this.board?.image.setVisible(false);
      this.key = '';
      return;
    }
    this.board ??= this.makeBoard();
    this.board.image.setVisible(true);
    const key = `${layout.min}-${layout.max}|${holes.join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.paint(this.board.texture, layout, holes);
  }

  private paint(texture: Phaser.Textures.CanvasTexture, layout: ChartLayout, holes: readonly number[]): void {
    const ctx = texture.getContext();
    const { x: bx, y: by, width, height } = TORWAND_RECT;
    ctx.setTransform(RESOLUTION, 0, 0, RESOLUTION, -bx * RESOLUTION, -by * RESOLUTION);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(bx, by, width, height);
    // The light panel, a little darker toward the bottom, with faint planks.
    const panel = ctx.createLinearGradient(0, by, 0, by + height);
    panel.addColorStop(0, '#f1ece0');
    panel.addColorStop(1, '#d9d2c2');
    ctx.fillStyle = panel;
    ctx.fillRect(bx, by, width, height);
    ctx.strokeStyle = 'rgb(120 100 70 / 12%)';
    ctx.lineWidth = 2;
    for (let x = bx + 90; x < bx + width; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x, by + height);
      ctx.stroke();
    }
    // The chart squares, printed faintly and without numbers.
    ctx.strokeStyle = css(COLOR.ink, 0.14);
    ctx.lineWidth = 1.5;
    for (const { row, col } of chartSquares(layout)) {
      const r = cellRectAt(layout, CHART_RECT, row, col);
      ctx.strokeRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
    }
    // A painted frame around the chart, as on a real board.
    ctx.strokeStyle = css(COLOR.ink, 0.3);
    ctx.lineWidth = 3;
    ctx.strokeRect(CHART_RECT.x - 6, CHART_RECT.y - 6, CHART_RECT.width + 12, CHART_RECT.height + 12);
    // The holes: cut out, so the net shows through, with a dark rim.
    const circles = holes.map((n) => holeCircle(layout, n));
    ctx.globalCompositeOperation = 'destination-out';
    for (const h of circles) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const h of circles) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgb(70 55 35 / 70%)';
      ctx.lineWidth = Math.max(2, h.r * 0.14);
      ctx.stroke();
    }
    texture.refresh();
  }

  destroy(): void {
    this.board?.image.destroy();
    this.board = null;
  }
}

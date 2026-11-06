/**
 * The goal (FR-001, FR-004, FR-011, FR-013): the net, the board with the printed chart, and the posts, in three layers.
 *
 * - The net is drawn once, behind the board.
 * - The board is a canvas texture of the whole goal rectangle, drawn from `buildBoard` (src/game/board.ts). It is redrawn
 *   only when `boardKey` changes, that is when the target, the hints shown, the help step or the shown square change
 *   (plan decision 9), not every frame. The open hole is left transparent, so the net shows through it, and a ball
 *   placed between the net and the board (`BALL_IN_NET_DEPTH`) shows only through the hole.
 * - The posts and the crossbar are drawn once, in front of the board.
 */
import Phaser from 'phaser';
import type { Rect } from '../core/types';
import { boardKey, buildBoard, type BoardInput, type Square } from './board';
import { COLOR, css } from './palette';

export const NET_DEPTH = 2;
/** A ball that went through the hole sits here: behind the board, in front of the net. */
export const BALL_IN_NET_DEPTH = 3;
export const BOARD_DEPTH = 4;
export const POSTS_DEPTH = 5;

const BOARD_TEXTURE = 'goal-board';
/** Canvas pixels per world pixel, so the numbers stay sharp on large screens. */
const RESOLUTION = 2;
const NET_MESH = 14;
const POST = 14;

export class GoalView {
  private readonly scene: Phaser.Scene;
  private readonly goal: Rect;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly net: Phaser.GameObjects.Graphics;
  private readonly board: Phaser.GameObjects.Image;
  private readonly posts: Phaser.GameObjects.Graphics;
  private key = '';
  /** How often the board was drawn; the scene shows it as `data-board-draws` for tests. */
  draws = 0;

  constructor(scene: Phaser.Scene, goal: Rect) {
    this.scene = scene;
    this.goal = goal;

    this.net = scene.add.graphics().setDepth(NET_DEPTH);
    this.net.fillStyle(COLOR.net, 1);
    this.net.fillRect(goal.x, goal.y, goal.width, goal.height);
    this.net.lineStyle(1, COLOR.chalk, 0.18);
    for (let x = goal.x; x <= goal.x + goal.width; x += NET_MESH) this.net.lineBetween(x, goal.y, x, goal.y + goal.height);
    for (let y = goal.y; y <= goal.y + goal.height; y += NET_MESH) this.net.lineBetween(goal.x, y, goal.x + goal.width, y);

    if (scene.textures.exists(BOARD_TEXTURE)) scene.textures.remove(BOARD_TEXTURE);
    const texture = scene.textures.createCanvas(BOARD_TEXTURE, goal.width * RESOLUTION, goal.height * RESOLUTION);
    if (!texture) throw new Error('GoalView: the board texture could not be created');
    this.texture = texture;
    this.board = scene.add.image(goal.x, goal.y, BOARD_TEXTURE).setOrigin(0, 0).setDisplaySize(goal.width, goal.height).setDepth(BOARD_DEPTH);

    this.posts = scene.add.graphics().setDepth(POSTS_DEPTH);
    this.posts.fillStyle(COLOR.chalk, 1);
    this.posts.fillRect(goal.x - POST, goal.y - POST, POST, goal.height + POST);
    this.posts.fillRect(goal.x + goal.width, goal.y - POST, POST, goal.height + POST);
    this.posts.fillRect(goal.x - POST, goal.y - POST, goal.width + 2 * POST, POST);
  }

  /** Redraws the board when what it shows changed; returns true when it did. */
  update(input: Omit<BoardInput, 'goal'>): boolean {
    const full: BoardInput = { ...input, goal: this.goal };
    const key = boardKey(full);
    if (key === this.key) return false;
    this.key = key;
    this.draw(full);
    return true;
  }

  private draw(input: BoardInput): void {
    const board = buildBoard(input);
    const ctx = this.texture.getContext();
    const { x: gx, y: gy, width, height } = this.goal;
    ctx.setTransform(RESOLUTION, 0, 0, RESOLUTION, -gx * RESOLUTION, -gy * RESOLUTION);
    ctx.clearRect(gx, gy, width, height);
    for (const s of board.squares) this.drawSquare(ctx, s);
    // Labels after all squares, so a badge larger than its square is not covered by the next square.
    ctx.font = `800 ${board.fontSize}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of board.squares) this.drawLabel(ctx, s, board.fontSize, board.numbersFit);
    this.texture.refresh();
    this.draws++;
  }

  private drawSquare(ctx: CanvasRenderingContext2D, s: Square): void {
    const { x, y, width: w, height: h } = s.rect;
    const gap = Math.min(1, h / 8);
    switch (s.kind) {
      case 'printed':
        ctx.fillStyle = css(COLOR.board);
        ctx.fillRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
        break;
      case 'empty':
        ctx.fillStyle = css(0xd6dacf);
        ctx.fillRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
        break;
      case 'patch':
        // A net patch over an old hole: board color with a cross-hatch.
        ctx.fillStyle = css(0xc9cfc2);
        ctx.fillRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
        ctx.strokeStyle = css(COLOR.ink, 0.25);
        ctx.lineWidth = 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
        ctx.clip();
        ctx.beginPath();
        for (let d = -h; d < w; d += 7) {
          ctx.moveTo(x + d, y);
          ctx.lineTo(x + d + h, y + h);
          ctx.moveTo(x + d, y + h);
          ctx.lineTo(x + d + h, y);
        }
        ctx.stroke();
        ctx.restore();
        break;
      case 'open':
        ctx.strokeStyle = css(COLOR.chalk, 0.22);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        break;
      case 'hole':
        // Transparent: the net behind the board shows through.
        break;
    }
    if (s.lit) {
      ctx.fillStyle = css(COLOR.kit, 0.85);
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    }
    if (s.shown) {
      ctx.fillStyle = css(COLOR.miss);
      ctx.fillRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
    }
    if (s.outlined) {
      const line = Math.max(2, Math.min(5, h / 6));
      ctx.strokeStyle = css(COLOR.kit);
      ctx.lineWidth = line;
      ctx.strokeRect(x + line / 2 + 1, y + line / 2 + 1, w - line - 2, h - line - 2);
    }
  }

  private drawLabel(ctx: CanvasRenderingContext2D, s: Square, fontSize: number, numbersFit: boolean): void {
    if (!s.label) return;
    const cx = s.rect.x + s.rect.width / 2;
    const cy = s.rect.y + s.rect.height / 2;
    if (!numbersFit) {
      // Squares are too small for a number: the label sits on a badge larger than the square.
      const w = ctx.measureText(s.label.text).width + 8;
      ctx.fillStyle = s.label.style === 'shown' ? css(COLOR.miss) : css(COLOR.ink, 0.9);
      ctx.fillRect(cx - w / 2, cy - fontSize * 0.7, w, fontSize * 1.4);
    }
    const color = { ink: numbersFit ? COLOR.ink : COLOR.chalk, shown: 0xffffff, answer: COLOR.kit }[s.label.style];
    ctx.fillStyle = css(color);
    ctx.fillText(s.label.text, cx, cy + 1);
  }

  destroy(): void {
    this.net.destroy();
    this.board.destroy();
    this.posts.destroy();
    if (this.scene.textures.exists(BOARD_TEXTURE)) this.scene.textures.remove(BOARD_TEXTURE);
  }
}

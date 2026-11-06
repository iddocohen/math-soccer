/**
 * The goal (FR-001, FR-004, FR-013, FR-019, FR-053 to FR-055): the net in depth, the grid of the chart over the open
 * goal, and the posts, in three layers. Seen from the penalty spot.
 *
 * - The net is painted once into a canvas texture named `netKey()` (src/game/net.ts, amendment 11), behind the grid: the
 *   back net, the side nets and the roof net in perspective, as a thin diamond mesh that hangs a little, and the thin
 *   back posts. The back net is darker than the side nets and the roof. It fills the whole goal mouth (`GOAL_FRAME`).
 *   After a goal, `bulge()` pushes a round patch of the net out around the ball for NET_BULGE_MS (FR-098); a caught
 *   ball does not move it.
 * - The grid is a canvas texture of `CHART_RECT` inside the goal mouth, drawn from `buildBoard` (src/game/board.ts): a
 *   soft panel of square cells with rounded corners, thin chalk lines and a faint dark fill, so it reads apart from the
 *   net behind it (FR-097); the panel shows only from help step 2 until the target is scored, otherwise only the
 *   hint squares and the target show over the net. Then the hint squares filled in the team color with dark numbers, and the empty target
 *   square washed light and outlined in the team color (T055). It is redrawn only when `boardKey` changes, that is
 *   when the target, the hints shown, the help step or the shown square change (plan decision 9), not every frame.
 *   Help shows on the grid too (T040, T096): at steps 1 to 3 a yellow arrow from the closest hint number to the target,
 *   soft bands over the target's row (step 1 on) and column (step 2 on), at step 4 the answer in the target square. A ball after a goal sits between the net and the grid
 *   (`BALL_IN_NET_DEPTH`).
 * - The posts and the crossbar are drawn once, in front of the grid.
 */
import Phaser from 'phaser';
import { center } from '../core/chart/layout';
import { CHART_RECT, GOAL_FRAME, POST_WIDTH } from '../core/match/world';
import type { Rect } from '../core/types';
import { clamp } from '../core/util';
import { boardKey, buildBoard, type Arrow, type BoardInput, type Square } from './board';
import { GAME_FONT, GAME_FONT_WEIGHT } from '../assets';
import { bulgeAt, diamondMesh, goalCorners, NET_BULGE_MS, NET_BULGE_RADIUS, NET_BULGE_STRETCH, netKey, type Point, type Surface } from './net';
import { COLOR, css } from './palette';

export const NET_DEPTH = 2;
/** A ball in the net after a goal sits here: behind the grid, in front of the net. */
export const BALL_IN_NET_DEPTH = 3;
export const BOARD_DEPTH = 4;
export const POSTS_DEPTH = 5;

const BOARD_TEXTURE = 'goal-board';
/** Canvas pixels per world pixel, so the numbers stay sharp on large screens. */
const RESOLUTION = 2;
/** Canvas pixels per world pixel of the net texture. */
const NET_RESOLUTION = 1.5;
const BULGE_TEXTURE = 'goal-net-bulge';

export class GoalView {
  private readonly scene: Phaser.Scene;
  private readonly chart: Rect = CHART_RECT;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly net: Phaser.GameObjects.Image;
  private readonly netCanvas: HTMLCanvasElement | null;
  private bulgePatch: Phaser.GameObjects.Image | null = null;
  private readonly board: Phaser.GameObjects.Image;
  private readonly posts: Phaser.GameObjects.Graphics;
  private key = '';
  /** How often the board was drawn; the scene shows it as `data-board-draws` for tests. */
  draws = 0;
  /** How often the net was painted: once per texture, never per frame. */
  netDraws = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const chart = this.chart;

    const key = netKey();
    if (!scene.textures.exists(key)) {
      const net = scene.textures.createCanvas(key, GOAL_FRAME.width * NET_RESOLUTION, GOAL_FRAME.height * NET_RESOLUTION);
      if (net) {
        const ctx = net.getContext();
        ctx.setTransform(NET_RESOLUTION, 0, 0, NET_RESOLUTION, -GOAL_FRAME.x * NET_RESOLUTION, -GOAL_FRAME.y * NET_RESOLUTION);
        paintNet(ctx);
        net.refresh();
        this.netDraws++;
      }
    }
    this.netCanvas = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture).getCanvas() : null;
    this.net = scene.add.image(GOAL_FRAME.x, GOAL_FRAME.y, key).setOrigin(0, 0).setDisplaySize(GOAL_FRAME.width, GOAL_FRAME.height).setDepth(NET_DEPTH);

    if (scene.textures.exists(BOARD_TEXTURE)) scene.textures.remove(BOARD_TEXTURE);
    const texture = scene.textures.createCanvas(BOARD_TEXTURE, chart.width * RESOLUTION, chart.height * RESOLUTION);
    if (!texture) throw new Error('GoalView: the board texture could not be created');
    this.texture = texture;
    this.board = scene.add.image(chart.x, chart.y, BOARD_TEXTURE).setOrigin(0, 0).setDisplaySize(chart.width, chart.height).setDepth(BOARD_DEPTH);

    this.posts = scene.add.graphics().setDepth(POSTS_DEPTH);
    drawPosts(this.posts);
  }

  /** Redraws the board when what it shows changed; returns true when it did. */
  update(input: Omit<BoardInput, 'goal'>): boolean {
    const full: BoardInput = { ...input, goal: this.chart };
    const key = boardKey(full);
    if (key === this.key) return false;
    this.key = key;
    this.draw(full);
    return true;
  }

  private draw(input: BoardInput): void {
    const board = buildBoard(input);
    const ctx = this.texture.getContext();
    const { x: gx, y: gy, width, height } = this.chart;
    ctx.setTransform(RESOLUTION, 0, 0, RESOLUTION, -gx * RESOLUTION, -gy * RESOLUTION);
    ctx.clearRect(gx, gy, width, height);
    // The soft bands of help steps 1 and 2 under the grid (amendment 10).
    ctx.fillStyle = css(COLOR.kit, 0.2);
    for (const band of [board.bands.row, board.bands.column]) if (band) ctx.fillRect(band.x, band.y, band.width, band.height);
    for (const s of board.squares) this.drawSquare(ctx, s, board.panel);
    // Labels after all squares, so a badge larger than its square is not covered by the next square.
    ctx.font = `${GAME_FONT_WEIGHT} ${board.fontSize}px ${GAME_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of board.squares) this.drawLabel(ctx, s, board.fontSize, board.numbersFit);
    if (board.arrow) this.drawArrow(ctx, board.arrow, board.squares[0]?.rect.height ?? 20);
    this.texture.refresh();
    this.draws++;
  }

  private drawSquare(ctx: CanvasRenderingContext2D, s: Square, panel: boolean): void {
    const { x, y, width: w, height: h } = s.rect;
    const gap = Math.min(1, h / 8);
    // A soft panel over the net (FR-097), only from help step 2 until the target is scored (`cellPanelVisible`): each
    // cell a faint dark square with rounded corners and a thin chalk line, so the grid reads apart from the mesh. The empty target square gets a light wash so it reads as marked.
    const inset = Math.min(1, h / 10);
    const radius = Math.min(5, h / 5);
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, w - 2 * inset, h - 2 * inset, radius);
    if (panel) {
      ctx.fillStyle = css(COLOR.night, 0.38);
      ctx.fill();
    }
    if (s.outlined) {
      // Where the row and column bands cross, the target square stands out more.
      ctx.fillStyle = css(COLOR.chalk, s.crossing ? 0.4 : 0.16);
      ctx.fill();
    }
    if (panel) {
      ctx.strokeStyle = css(COLOR.chalk, 0.26);
      ctx.lineWidth = 1;
      ctx.stroke();
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
      const line = clamp(h / 6, 2, 5);
      ctx.strokeStyle = css(COLOR.kit);
      ctx.lineWidth = line;
      ctx.strokeRect(x + line / 2 + 1, y + line / 2 + 1, w - line - 2, h - line - 2);
    }
    if (s.waiting && !s.shown) {
      // The shape's next empty square: thinner and fainter than the target's outline, dashed (FR-072).
      const line = clamp(h / 12, 1.5, 2.5);
      const dash = Math.max(3, h / 8);
      ctx.save();
      ctx.setLineDash([dash, dash * 0.7]);
      ctx.strokeStyle = css(COLOR.kit, 0.55);
      ctx.lineWidth = line;
      ctx.strokeRect(x + line / 2 + 2, y + line / 2 + 2, w - line - 4, h - line - 4);
      ctx.restore();
    }
  }

  private drawLabel(ctx: CanvasRenderingContext2D, s: Square, fontSize: number, numbersFit: boolean): void {
    if (!s.label) return;
    const { x: cx, y: cy } = center(s.rect);
    if (!numbersFit) {
      // Squares are too small for a number: the label sits on a badge larger than the square.
      const w = ctx.measureText(s.label.text).width + 8;
      // A lit square keeps its team color on the badge, with a dark number.
      const litInk = s.lit && s.label.style === 'ink';
      ctx.fillStyle = s.label.style === 'shown' ? css(COLOR.miss) : litInk ? css(COLOR.kit) : css(COLOR.ink, 0.9);
      ctx.fillRect(cx - w / 2, cy - fontSize * 0.7, w, fontSize * 1.4);
    }
    const ink = numbersFit || (s.lit && !s.shown) ? COLOR.ink : COLOR.chalk;
    const color = { ink, shown: 0xffffff, answer: COLOR.kit }[s.label.style];
    ctx.fillStyle = css(color);
    ctx.fillText(s.label.text, cx, cy + 1);
  }

  /** The help arrow: a thick yellow line with a dark edge and a head that stops short of the target's center. */
  private drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, cellHeight: number): void {
    const { from, to } = arrow;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const ux = dx / length;
    const uy = dy / length;
    const width = clamp(cellHeight / 6, 3, 9);
    // Start beside the hint's number and end at the target's edge, so neither number is covered.
    const start = Math.min(length / 3, cellHeight * 0.35);
    const sx = from.x + ux * start;
    const sy = from.y + uy * start;
    const ex = to.x - ux * Math.min(length / 3, cellHeight * 0.3);
    const ey = to.y - uy * Math.min(length / 3, cellHeight * 0.3);
    paintArrow(ctx, { from: { x: sx, y: sy }, to: { x: ex, y: ey } }, width);
  }

  /**
   * The net bulges out around `at` after a goal and settles again (FR-098): a round patch of the painted net, a little
   * darker in the middle where it is pushed away, stretches and shrinks back over NET_BULGE_MS.
   */
  bulge(at: Point): void {
    if (!this.netCanvas) return;
    const size = NET_BULGE_RADIUS * 2;
    if (!this.scene.textures.exists(BULGE_TEXTURE)) this.scene.textures.createCanvas(BULGE_TEXTURE, size * NET_RESOLUTION, size * NET_RESOLUTION);
    const texture = this.scene.textures.get(BULGE_TEXTURE) as Phaser.Textures.CanvasTexture;
    const ctx = texture.getContext();
    const px = size * NET_RESOLUTION;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.globalCompositeOperation = 'source-over';
    const sx = (at.x - NET_BULGE_RADIUS - GOAL_FRAME.x) * NET_RESOLUTION;
    const sy = (at.y - NET_BULGE_RADIUS - GOAL_FRAME.y) * NET_RESOLUTION;
    ctx.drawImage(this.netCanvas, sx, sy, px, px, 0, 0, px, px);
    const shade = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    shade.addColorStop(0, 'rgb(0 0 0 / 30%)');
    shade.addColorStop(1, 'rgb(0 0 0 / 0%)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, px, px);
    // A soft round edge, so the stretched patch blends into the net around it.
    const edge = ctx.createRadialGradient(px / 2, px / 2, px * 0.3, px / 2, px / 2, px / 2);
    edge.addColorStop(0, 'rgb(0 0 0 / 100%)');
    edge.addColorStop(1, 'rgb(0 0 0 / 0%)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, px, px);
    ctx.globalCompositeOperation = 'source-over';
    texture.refresh();

    this.bulgePatch?.destroy();
    const patch = this.scene.add.image(at.x, at.y, BULGE_TEXTURE).setDisplaySize(size, size).setDepth(NET_DEPTH + 0.5);
    this.bulgePatch = patch;
    const base = patch.scale;
    this.scene.tweens.addCounter({
      from: 0,
      to: NET_BULGE_MS,
      duration: NET_BULGE_MS,
      onUpdate: (tween) => patch.setScale(base * (1 + NET_BULGE_STRETCH * bulgeAt(tween.getValue() ?? 0))),
      onComplete: () => {
        patch.destroy();
        if (this.bulgePatch === patch) this.bulgePatch = null;
      },
    });
  }

  destroy(): void {
    this.bulgePatch?.destroy();
    this.net.destroy();
    this.board.destroy();
    this.posts.destroy();
    if (this.scene.textures.exists(BOARD_TEXTURE)) this.scene.textures.remove(BOARD_TEXTURE);
  }
}

/** A thick yellow arrow with a dark edge from `arrow.from` to its head's tip at `arrow.to` (help, T040 and T096). */
export function paintArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, width: number): void {
  const { from, to } = arrow;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) return;
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const head = width * 3;
  const bx = to.x - ux * head;
  const by = to.y - uy * head;
  for (const [color, extra] of [
    [COLOR.ink, 3],
    [COLOR.kit, 0],
  ] as const) {
    ctx.strokeStyle = css(color);
    ctx.fillStyle = css(color);
    ctx.lineWidth = width + extra;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x + ux * extra, to.y + uy * extra);
    ctx.lineTo(bx - uy * (head * 0.6 + extra), by + ux * (head * 0.6 + extra));
    ctx.lineTo(bx + uy * (head * 0.6 + extra), by - ux * (head * 0.6 + extra));
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Paints the net in depth (amendment 11, FR-096) in world coordinates: grass inside the goal, the back net darker than
 * the side nets and the roof, each with its diamond mesh in thin chalk lines, then the back posts and the stays.
 */
function paintNet(ctx: CanvasRenderingContext2D): void {
  const { front: f, back: b } = goalCorners();
  const poly = (points: Point[], color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  };
  // Grass inside the goal, in the shade of the net.
  poly([f.bl, f.br, b.br, b.bl], '#1d4a26');
  poly([b.tl, b.tr, b.br, b.bl], css(COLOR.net, 0.82));
  poly([f.tl, b.tl, b.bl, f.bl], css(COLOR.net, 0.6));
  poly([f.tr, b.tr, b.br, f.br], css(COLOR.net, 0.6));
  poly([f.tl, f.tr, b.tr, b.tl], css(COLOR.net, 0.7));

  const mesh: Array<[Surface, number]> = [
    ['back', 0.17],
    ['left', 0.24],
    ['right', 0.24],
    ['roof', 0.24],
  ];
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  for (const [surface, alpha] of mesh) {
    ctx.strokeStyle = css(COLOR.chalk, alpha);
    ctx.beginPath();
    for (const line of diamondMesh(surface)) line.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  // Back posts, back bar and the stays from the crossbar corners to the back.
  ctx.lineCap = 'round';
  ctx.strokeStyle = css(COLOR.chalk, 0.5);
  ctx.lineWidth = 5;
  ctx.beginPath();
  [b.bl, b.tl, b.tr, b.br].forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = css(COLOR.chalk, 0.42);
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
    ctx.moveTo(f[corner].x, f[corner].y);
    ctx.lineTo(b[corner].x, b[corner].y);
  }
  ctx.stroke();
}

/** Thick white posts and crossbar with a shaded inner side, and their shadow on the goal line. */
function drawPosts(g: Phaser.GameObjects.Graphics): void {
  const { x, y, width, height } = GOAL_FRAME;
  const p = POST_WIDTH;
  const shade = 7;
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(x + p / 2, y + height, p * 2.4, 12);
  g.fillEllipse(x + width - p / 2, y + height, p * 2.4, 12);
  g.fillStyle(COLOR.chalk, 1);
  g.fillRect(x, y, p, height);
  g.fillRect(x + width - p, y, p, height);
  g.fillRect(x, y, width, p);
  g.fillStyle(0xc4c9bd, 1);
  g.fillRect(x + p - shade, y + p, shade, height - p);
  g.fillRect(x + width - p, y + p, shade, height - p);
  g.fillRect(x + p - shade, y + p - shade, width - 2 * p + 2 * shade, shade);
  g.lineStyle(2, COLOR.ink, 0.45);
  g.strokeRect(x, y, width, p);
  g.lineBetween(x, y + p, x, y + height);
  g.lineBetween(x + width, y + p, x + width, y + height);
}

/**
 * The goal (FR-001, FR-004, FR-011, FR-013, FR-053 to FR-055): the net in depth, the board panel with the printed
 * chart, and the posts, in three layers. Seen from the penalty spot.
 *
 * - The net is drawn once, behind the board: the back net, the side nets and the roof net in perspective, with the
 *   mesh visible, and the thin back posts. It fills the whole goal mouth (`GOAL_FRAME`), so it shows around the panel.
 * - The board is a canvas texture of `CHART_RECT`, a panel inside the goal mouth, drawn from `buildBoard`
 *   (src/game/board.ts). It is redrawn only when `boardKey` changes, that is when the target, the hints shown, the help
 *   step or the shown square change (plan decision 9), not every frame. Help shows on the board too (T040): at steps 1
 *   and 2 a yellow arrow from the closest hint number to the hole, at step 3 the answer in the hole. The open hole is
 *   left transparent, so the net shows through it, and a ball placed between the net and the board
 *   (`BALL_IN_NET_DEPTH`) shows only through the hole.
 * - In hole and line mode a dark edge and ropes to the frame hang the panel in the goal. In goalkeeper mode the goal is
 *   open: no panel edge, and the faint grid lies inside the same `CHART_RECT`.
 * - The posts and the crossbar are drawn once, in front of the board.
 */
import Phaser from 'phaser';
import { CHART_RECT, GOAL_FRAME, POST_WIDTH } from '../core/match/world';
import type { Rect } from '../core/types';
import { boardKey, buildBoard, type Arrow, type BoardInput, type Square } from './board';
import { COLOR, css } from './palette';

export const NET_DEPTH = 2;
/** A ball that went through the hole sits here: behind the board, in front of the net. */
export const BALL_IN_NET_DEPTH = 3;
export const BOARD_DEPTH = 4;
export const POSTS_DEPTH = 5;

const BOARD_TEXTURE = 'goal-board';
/** Canvas pixels per world pixel, so the numbers stay sharp on large screens. */
const RESOLUTION = 2;
/** Mesh size of the back net in world pixels. */
const NET_MESH = 18;
/** Width of the dark edge around the board panel. */
const PANEL_EDGE = 8;

interface Point {
  x: number;
  y: number;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export class GoalView {
  private readonly scene: Phaser.Scene;
  private readonly chart: Rect = CHART_RECT;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly net: Phaser.GameObjects.Graphics;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly board: Phaser.GameObjects.Image;
  private readonly posts: Phaser.GameObjects.Graphics;
  private key = '';
  /** How often the board was drawn; the scene shows it as `data-board-draws` for tests. */
  draws = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const chart = this.chart;

    this.net = scene.add.graphics().setDepth(NET_DEPTH);
    drawNet(this.net);

    this.panel = scene.add.graphics().setDepth(BOARD_DEPTH);
    drawPanelEdge(this.panel, chart);

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
    this.panel.setVisible(input.mode !== 'keeper');
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
    for (const s of board.squares) this.drawSquare(ctx, s);
    // Labels after all squares, so a badge larger than its square is not covered by the next square.
    ctx.font = `800 ${board.fontSize}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of board.squares) this.drawLabel(ctx, s, board.fontSize, board.numbersFit);
    if (board.arrow) this.drawArrow(ctx, board.arrow, board.squares[0]?.rect.height ?? 20);
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

  /** The help arrow: a thick yellow line with a dark edge and a head that stops short of the hole's center. */
  private drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, cellHeight: number): void {
    const { from, to } = arrow;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const ux = dx / length;
    const uy = dy / length;
    const width = Math.max(3, Math.min(9, cellHeight / 6));
    const head = width * 3;
    // Start beside the hint's number and end at the hole's edge, so neither number is covered.
    const start = Math.min(length / 3, cellHeight * 0.35);
    const sx = from.x + ux * start;
    const sy = from.y + uy * start;
    const ex = to.x - ux * Math.min(length / 3, cellHeight * 0.3);
    const ey = to.y - uy * Math.min(length / 3, cellHeight * 0.3);
    const bx = ex - ux * head;
    const by = ey - uy * head;
    for (const [color, extra] of [
      [COLOR.ink, 3],
      [COLOR.kit, 0],
    ] as const) {
      ctx.strokeStyle = css(color);
      ctx.fillStyle = css(color);
      ctx.lineWidth = width + extra;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex + ux * extra, ey + uy * extra);
      ctx.lineTo(bx - uy * (head * 0.6 + extra), by + ux * (head * 0.6 + extra));
      ctx.lineTo(bx + uy * (head * 0.6 + extra), by - ux * (head * 0.6 + extra));
      ctx.closePath();
      ctx.fill();
    }
  }

  destroy(): void {
    this.net.destroy();
    this.panel.destroy();
    this.board.destroy();
    this.posts.destroy();
    if (this.scene.textures.exists(BOARD_TEXTURE)) this.scene.textures.remove(BOARD_TEXTURE);
  }
}

/** Inner corners of the goal mouth (front) and of the back of the goal, which looks smaller and higher from the spot. */
function goalCorners(): { front: Record<'tl' | 'tr' | 'bl' | 'br', Point>; back: Record<'tl' | 'tr' | 'bl' | 'br', Point> } {
  const left = GOAL_FRAME.x + POST_WIDTH;
  const right = GOAL_FRAME.x + GOAL_FRAME.width - POST_WIDTH;
  const top = GOAL_FRAME.y + POST_WIDTH;
  const line = GOAL_FRAME.y + GOAL_FRAME.height;
  const backLeft = left + 100;
  const backRight = right - 100;
  const backTop = top + 70;
  const backLine = line - 45;
  return {
    front: { tl: { x: left, y: top }, tr: { x: right, y: top }, bl: { x: left, y: line }, br: { x: right, y: line } },
    back: { tl: { x: backLeft, y: backTop }, tr: { x: backRight, y: backTop }, bl: { x: backLeft, y: backLine }, br: { x: backRight, y: backLine } },
  };
}

/** The net in depth: grass inside the goal, back net, side nets and roof net with their mesh, and the back posts. */
function drawNet(g: Phaser.GameObjects.Graphics): void {
  const { front: f, back: b } = goalCorners();
  const poly = (points: Point[], color: number, alpha: number): void => {
    g.fillStyle(color, alpha);
    g.fillPoints(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
  };
  // Grass inside the goal, in the shade of the net.
  poly([f.bl, f.br, b.br, b.bl], 0x1d4a26, 1);
  // Back net, then the side and roof nets, a little lighter where the light falls on them.
  poly([b.tl, b.tr, b.br, b.bl], COLOR.net, 0.72);
  poly([f.tl, b.tl, b.bl, f.bl], COLOR.net, 0.7);
  poly([f.tr, b.tr, b.br, f.br], COLOR.net, 0.7);
  poly([f.tl, f.tr, b.tr, b.tl], COLOR.net, 0.85);

  // Mesh of the back net.
  g.lineStyle(1.5, COLOR.chalk, 0.32);
  for (let x = b.tl.x; x <= b.tr.x + 0.5; x += NET_MESH) g.lineBetween(x, b.tl.y, x, b.bl.y);
  for (let y = b.tl.y; y <= b.bl.y + 0.5; y += NET_MESH) g.lineBetween(b.tl.x, y, b.tr.x, y);

  // Mesh of the side and roof nets: lines along the depth and lines across it.
  g.lineStyle(1.5, COLOR.chalk, 0.38);
  const across = 6;
  const sides: Array<[Point, Point, Point, Point]> = [
    [f.tl, f.bl, b.tl, b.bl],
    [f.tr, f.br, b.tr, b.br],
    [f.tl, f.tr, b.tl, b.tr],
  ];
  for (const [f0, f1, b0, b1] of sides) {
    const along = Math.round(Math.hypot(f1.x - f0.x, f1.y - f0.y) / NET_MESH);
    for (let i = 0; i <= along; i++) {
      const t = i / along;
      const a = lerp(f0, f1, t);
      const c = lerp(b0, b1, t);
      g.lineBetween(a.x, a.y, c.x, c.y);
    }
    for (let i = 1; i < across; i++) {
      const t = i / across;
      const a = lerp(f0, b0, t);
      const c = lerp(f1, b1, t);
      g.lineBetween(a.x, a.y, c.x, c.y);
    }
  }

  // Back posts, back bar and the stays from the crossbar corners to the back.
  g.lineStyle(5, COLOR.chalk, 0.6);
  g.strokePoints([b.bl, b.tl, b.tr, b.br].map((p) => new Phaser.Math.Vector2(p.x, p.y)), false);
  g.lineStyle(4, COLOR.chalk, 0.5);
  g.lineBetween(f.tl.x, f.tl.y, b.tl.x, b.tl.y);
  g.lineBetween(f.tr.x, f.tr.y, b.tr.x, b.tr.y);
  g.lineBetween(f.bl.x, f.bl.y, b.bl.x, b.bl.y);
  g.lineBetween(f.br.x, f.br.y, b.br.x, b.br.y);
}

/** The dark edge of the board panel and the ropes that hang it from the crossbar and the posts. */
function drawPanelEdge(g: Phaser.GameObjects.Graphics, chart: Rect): void {
  const left = GOAL_FRAME.x + POST_WIDTH;
  const right = GOAL_FRAME.x + GOAL_FRAME.width - POST_WIDTH;
  const top = GOAL_FRAME.y + POST_WIDTH;
  const chartRight = chart.x + chart.width;
  const chartBottom = chart.y + chart.height;
  g.lineStyle(3, 0xd8d2bd, 0.9);
  for (const x of [chart.x + 30, chartRight - 30]) g.lineBetween(x, top, x, chart.y);
  for (const y of [chart.y + 40, chartBottom - 40]) {
    g.lineBetween(left, y, chart.x, y);
    g.lineBetween(chartRight, y, right, y);
  }
  g.fillStyle(0x2a3a46, 1);
  g.fillRect(chart.x - PANEL_EDGE, chart.y - PANEL_EDGE, chart.width + 2 * PANEL_EDGE, PANEL_EDGE);
  g.fillRect(chart.x - PANEL_EDGE, chartBottom, chart.width + 2 * PANEL_EDGE, PANEL_EDGE);
  g.fillRect(chart.x - PANEL_EDGE, chart.y, PANEL_EDGE, chart.height);
  g.fillRect(chartRight, chart.y, PANEL_EDGE, chart.height);
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

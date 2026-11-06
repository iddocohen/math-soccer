/**
 * The row and column helper beside the goal (T096, amendment 10, FR-091 to FR-095), drawn from `buildScales`
 * (src/game/scales.ts) into two canvas textures, empty until help asks for a scale (amendment 14, FR-115): the row scale right of the goal and the column scale above the
 * crossbar. Calm chalk numbers with a thin dark edge on one dark strip per scale (FR-101a), no box per label; a lit label is larger and in the kit color, and the
 * help arrows from the scales point at the target's row and column. Like the board, the textures are redrawn only when
 * `scalesKey` changes. They sit in front of the posts, so an arrow crosses the post or the crossbar into the goal.
 */
import Phaser from 'phaser';
import type { ChartLayout } from '../core/chart/layout';
import { CHART_RECT } from '../core/match/world';
import type { DeepReadonly, Rect, Target } from '../core/types';
import { GAME_FONT, GAME_FONT_WEIGHT } from '../assets';
import { paintArrow, POSTS_DEPTH } from './GoalView';
import { COLOR, css } from './palette';
import { buildScales, COLUMN_STRIP, LIT_LABEL_SCALE, ROW_STRIP, scalesKey, type ScaleText } from './scales';

export const HELPER_DEPTH = POSTS_DEPTH + 0.5;

/** Canvas pixels per world pixel. */
const RESOLUTION = 2;
const ARROW_WIDTH = 7;

interface Strip {
  rect: Rect;
  key: string;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
}

export class HelperView {
  private readonly scene: Phaser.Scene;
  private readonly rows: Strip;
  private readonly columns: Strip;
  private key = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rows = makeStrip(scene, 'helper-rows', ROW_STRIP);
    this.columns = makeStrip(scene, 'helper-columns', COLUMN_STRIP);
  }

  /** Redraws the scales when what they show changed; returns true when it did. */
  update(layout: ChartLayout, target: DeepReadonly<Target> | null, helpStep: number, helperOn: boolean, solved = false): boolean {
    const key = scalesKey(layout, target, helpStep, helperOn, solved);
    if (key === this.key) return false;
    this.key = key;
    const scales = buildScales(layout, CHART_RECT, target, helpStep, helperOn, solved);
    drawStrip(this.rows, (ctx) => {
      if (scales.rowBacking) paintBacking(ctx, scales.rowBacking);
      if (scales.rowArrow) paintArrow(ctx, scales.rowArrow, ARROW_WIDTH);
      ctx.textAlign = 'left';
      for (const label of scales.rowLabels) drawLabel(ctx, label, scales.rowFontSize);
    });
    drawStrip(this.columns, (ctx) => {
      if (scales.columnBacking) paintBacking(ctx, scales.columnBacking);
      if (scales.columnArrow) paintArrow(ctx, scales.columnArrow, ARROW_WIDTH);
      ctx.textAlign = 'center';
      for (const label of scales.columnLabels) drawLabel(ctx, label, scales.columnFontSize);
    });
    return true;
  }

  destroy(): void {
    for (const strip of [this.rows, this.columns]) {
      strip.image.destroy();
      if (this.scene.textures.exists(strip.key)) this.scene.textures.remove(strip.key);
    }
  }
}

function makeStrip(scene: Phaser.Scene, key: string, rect: Rect): Strip {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, rect.width * RESOLUTION, rect.height * RESOLUTION);
  if (!texture) throw new Error(`HelperView: the texture ${key} could not be created`);
  const image = scene.add.image(rect.x, rect.y, key).setOrigin(0, 0).setDisplaySize(rect.width, rect.height).setDepth(HELPER_DEPTH);
  return { rect, key, texture, image };
}

/** Clears the strip and draws in world coordinates. */
function drawStrip(strip: Strip, paint: (ctx: CanvasRenderingContext2D) => void): void {
  const ctx = strip.texture.getContext();
  const { x, y, width, height } = strip.rect;
  ctx.setTransform(RESOLUTION, 0, 0, RESOLUTION, -x * RESOLUTION, -y * RESOLUTION);
  ctx.clearRect(x, y, width, height);
  ctx.textBaseline = 'middle';
  paint(ctx);
  strip.texture.refresh();
}

/** The calm dark strip behind a scale's labels: night color, slightly transparent, with round ends (FR-101a). */
function paintBacking(ctx: CanvasRenderingContext2D, r: Rect): void {
  const radius = Math.min(r.width, r.height) / 2;
  ctx.fillStyle = css(COLOR.night, 0.8);
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.width, r.height, radius);
  ctx.fill();
}

/** Chalk text with a thin dark edge so it reads over the fans and the grass; a lit label is larger, in the kit color. */
function drawLabel(ctx: CanvasRenderingContext2D, label: ScaleText, fontSize: number): void {
  const size = label.lit ? Math.round(fontSize * LIT_LABEL_SCALE) : fontSize;
  ctx.font = `${GAME_FONT_WEIGHT} ${size}px ${GAME_FONT}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = label.lit ? 5 : 4;
  ctx.strokeStyle = css(COLOR.ink, label.lit ? 0.9 : 0.6);
  ctx.strokeText(label.text, label.x, label.y + 1);
  ctx.fillStyle = label.lit ? css(COLOR.kit) : css(COLOR.chalk, 0.85);
  ctx.fillText(label.text, label.x, label.y + 1);
}

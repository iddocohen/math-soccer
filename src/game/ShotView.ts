/**
 * The target square of "Selbst ins Tor" (amendment 21, FR-143, FR-144): while the opponent's ball flies, the square it
 * flies at flashes, with no number on it, and a ring around it counts the flight time down in kit yellow. The ring is
 * full at the kick and empty when the ball arrives; while help holds the shot the ring stops and the square stays lit.
 *
 * `show(rect, left)` draws the square of `rect` with `left` (1 to 0) of the ring; `hide()` takes both away. The flash
 * runs on the scene's update with `update(deltaMs)`, so it stops while the round is paused.
 */
import Phaser from 'phaser';
import { center } from '../core/chart/layout';
import type { Rect } from '../core/types';
import { clamp } from '../core/util';
import { POSTS_DEPTH } from './GoalView';
import { COLOR } from './palette';

/** Over the grid and the posts, under the help arrows (POSTS_DEPTH + 0.5) and the player. */
export const SHOT_DEPTH = POSTS_DEPTH + 0.25;
/** One flash, from light to strong and back. */
const FLASH_MS = 700;
const RING_WIDTH = 8;
/** The dark edge around the yellow ring, so it shows on the yellow hint squares too. */
const RING_EDGE = 3;

/** How strong the flash is `t` ms into it: from 0.4 to 0.9 and back, smoothly. */
export function flashAlpha(t: number): number {
  const k = (t % FLASH_MS) / FLASH_MS;
  return 0.4 + 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * k));
}

/** The ring's radius around a square of `rect`: just outside its corners. */
export function ringRadius(rect: Rect): number {
  return Math.hypot(rect.width, rect.height) / 2 + RING_WIDTH;
}

export class ShotView {
  /** The square's light fill; its alpha flashes. */
  private readonly square: Phaser.GameObjects.Graphics;
  /** The square's yellow frame, drawn once per square. */
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private rect: Rect | null = null;
  private left = 1;
  private flashMs = 0;
  private held = false;

  constructor(scene: Phaser.Scene) {
    this.square = scene.add.graphics().setDepth(SHOT_DEPTH);
    this.frame = scene.add.graphics().setDepth(SHOT_DEPTH);
    this.ring = scene.add.graphics().setDepth(SHOT_DEPTH);
  }

  /** Shows the flashing square of `rect` with `left` of the ring (1 full, 0 empty); `held` keeps the square lit. */
  show(rect: Rect, left: number, held: boolean): void {
    const changed = this.rect === null || this.rect.x !== rect.x || this.rect.y !== rect.y || this.rect.width !== rect.width || this.rect.height !== rect.height;
    this.rect = rect;
    this.held = held;
    if (changed) {
      this.flashMs = 0;
      this.drawSquare();
    }
    const next = clamp(left, 0, 1);
    if (changed || Math.abs(next - this.left) > 0.001) {
      this.left = next;
      this.drawRing();
    }
    this.flash();
  }

  hide(): void {
    this.rect = null;
    this.square.clear();
    this.frame.clear();
    this.ring.clear();
  }

  /** True while a square shows. */
  get showing(): boolean {
    return this.rect !== null;
  }

  update(deltaMs: number): void {
    if (this.rect === null) return;
    if (!this.held) this.flashMs += deltaMs;
    this.flash();
  }

  /** The flash of the square's fill now: steady while help holds the shot. */
  private flash(): void {
    this.square.setAlpha(this.held ? 0.9 : flashAlpha(this.flashMs));
  }

  /** Draws the square of the current rect: the fill, whose alpha `flash` sets, and the frame. */
  private drawSquare(): void {
    const r = this.rect;
    const g = this.square.clear();
    const frame = this.frame.clear();
    if (r === null) return;
    g.fillStyle(COLOR.chalk, 0.85);
    g.fillRect(r.x, r.y, r.width, r.height);
    frame.lineStyle(5, COLOR.kit, 1);
    frame.strokeRect(r.x + 2.5, r.y + 2.5, r.width - 5, r.height - 5);
  }

  private drawRing(): void {
    const r = this.rect;
    const g = this.ring.clear();
    if (r === null) return;
    const { x: cx, y: cy } = center(r);
    const radius = ringRadius(r);
    // A dark full circle under the yellow part that is left; its edge shows the ring on the yellow hint squares too.
    g.lineStyle(RING_WIDTH + RING_EDGE * 2, COLOR.ink, 0.55);
    g.strokeCircle(cx, cy, radius);
    if (this.left <= 0) return;
    const start = -Math.PI / 2;
    g.lineStyle(RING_WIDTH + RING_EDGE * 2, COLOR.ink, 0.9);
    g.beginPath();
    g.arc(cx, cy, radius, start, start + this.left * Math.PI * 2, false);
    g.strokePath();
    g.lineStyle(RING_WIDTH, COLOR.kit, 1);
    g.beginPath();
    g.arc(cx, cy, radius, start, start + this.left * Math.PI * 2, false);
    g.strokePath();
  }

  destroy(): void {
    this.square.destroy();
    this.frame.destroy();
    this.ring.destroy();
  }
}

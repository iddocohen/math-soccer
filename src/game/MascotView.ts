/**
 * The mascot beside the pitch (amendment 20, FR-136), drawn in code from the shapes in mascot.ts (no image files). It
 * idles, cheers on a goal (jumps twice and waves) and covers its eyes on a miss, then idles again. The scene moves it
 * on in update() with the frame time, and not while the round is paused.
 */
import Phaser from 'phaser';
import { ARM_LENGTH, ARM_WIDTH, MASCOT_ART, MASCOT_DEPTH, MASCOT_FEET, MASCOT_SCALE, mascotPose, moodMs, PAW_RADIUS, SHOULDER, type MascotArt, type MascotMood, type MascotShape } from './mascot';
import type { Mascot } from '../core/rewards/items';

export class MascotView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly arms: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
  private readonly onMood?: (mood: MascotMood) => void;
  private mascot: Mascot = 'none';
  private mood: MascotMood = 'idle';
  private elapsed = 0;

  constructor(scene: Phaser.Scene, onMood?: (mood: MascotMood) => void) {
    this.onMood = onMood;
    this.body = scene.add.graphics();
    this.arms = [scene.add.graphics().setPosition(-SHOULDER.x, SHOULDER.y), scene.add.graphics().setPosition(SHOULDER.x, SHOULDER.y)];
    this.container = scene.add
      .container(MASCOT_FEET.x, MASCOT_FEET.y, [this.body, ...this.arms])
      .setScale(MASCOT_SCALE)
      .setDepth(MASCOT_DEPTH)
      .setVisible(false);
  }

  /** Shows `mascot`, or nothing for none; the drawing changes only when the mascot does. */
  setMascot(mascot: Mascot): void {
    if (mascot === this.mascot) return;
    this.mascot = mascot;
    this.container.setVisible(mascot !== 'none');
    if (mascot !== 'none') this.draw(MASCOT_ART[mascot]);
    this.setMood('idle');
  }

  /** Cheers after a goal. */
  cheer(): void {
    this.setMood('cheer');
  }

  /** Covers its eyes after a miss. */
  coverEyes(): void {
    this.setMood('eyes');
  }

  /** Back to idling, as at the start of a round. */
  calm(): void {
    this.setMood('idle');
  }

  update(ms: number): void {
    this.elapsed += ms;
    if (this.elapsed >= moodMs(this.mood)) this.setMood('idle');
    if (this.mascot === 'none') return;
    const pose = mascotPose(this.mood, this.elapsed);
    this.container.setY(MASCOT_FEET.y - pose.lift * MASCOT_SCALE);
    this.arms[0].setRotation(pose.left);
    this.arms[1].setRotation(pose.right);
  }

  private setMood(mood: MascotMood): void {
    this.elapsed = 0;
    if (mood === this.mood) return;
    this.mood = mood;
    this.onMood?.(mood);
  }

  private draw(art: MascotArt): void {
    const g = this.body;
    g.clear();
    for (const shape of art.shapes) fillShape(g, shape);
    for (const arm of this.arms) {
      arm.clear();
      arm.fillStyle(art.arm.color, 1);
      arm.fillCircle(0, 0, ARM_WIDTH / 2);
      arm.fillRect(-ARM_WIDTH / 2, 0, ARM_WIDTH, ARM_LENGTH);
      arm.fillStyle(art.arm.paw, 1);
      arm.fillCircle(0, ARM_LENGTH, PAW_RADIUS);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}

function fillShape(g: Phaser.GameObjects.Graphics, s: MascotShape): void {
  switch (s.type) {
    case 'circle':
      g.fillStyle(s.color, 1);
      g.fillCircle(s.x, s.y, s.r);
      return;
    case 'ellipse':
      g.fillStyle(s.color, 1);
      g.fillEllipse(s.x, s.y, s.rx * 2, s.ry * 2);
      return;
    case 'triangle':
      g.fillStyle(s.color, 1);
      g.fillTriangle(...s.points);
      return;
    case 'smile':
      g.lineStyle(s.width, s.color, 1);
      g.beginPath();
      g.arc(s.x, s.y, s.r, Math.PI * 0.15, Math.PI * 0.85);
      g.strokePath();
  }
}

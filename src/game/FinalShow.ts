/**
 * The won cup final (amendment 13, FR-110): confetti falls over the pitch and fireworks burst over the stands until the
 * scene starts a new round. Drawn with shapes in code (FR-048). Everything runs on the scene's clock and tweens, so a
 * paused scene holds it. The player's cup lift is PlayerView.liftCup; the sounds come from src/audio/sfx.ts.
 */
import Phaser from 'phaser';
import { STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';

/** Over the fans (depth 1), under the goal and its grid (2 and up). */
export const FIREWORKS_DEPTH = 1.5;
/** Over everything else in the scene. */
export const CONFETTI_DEPTH = 9;

const CONFETTI_COUNT = 90;
const CONFETTI_COLORS = [0xf2c230, 0xd8382f, 0x2b6fd6, 0x3aa64a, 0xf4f6ef, 0xf07a1a, 0x6a3fb5];
const BURST_EVERY_MS = 650;
const BURST_SPARKS = 22;
const BURST_MS = 900;

export class FinalShow {
  private readonly scene: Phaser.Scene;
  private readonly pieces: Phaser.GameObjects.Rectangle[] = [];
  private readonly sparks: Phaser.GameObjects.Arc[] = [];
  private timer: Phaser.Time.TimerEvent | null = null;
  private bursts = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** True while the confetti and the fireworks run. */
  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    for (let i = 0; i < CONFETTI_COUNT; i++) this.dropConfetti(i);
    this.burst();
    this.timer = this.scene.time.addEvent({ delay: BURST_EVERY_MS, loop: true, callback: () => this.burst() });
  }

  stop(): void {
    this.timer?.remove();
    this.timer = null;
    for (const p of this.pieces) {
      this.scene.tweens.killTweensOf(p);
      p.destroy();
    }
    for (const s of this.sparks) {
      this.scene.tweens.killTweensOf(s);
      s.destroy();
    }
    this.pieces.length = 0;
    this.sparks.length = 0;
    this.bursts = 0;
  }

  /**
   * One piece of confetti. The first pieces start spread over the upper screen, so the confetti shows at once; each
   * piece that reaches the bottom starts again above the top edge.
   */
  private dropConfetti(i: number): void {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
    const piece = this.scene.add
      .rectangle(Phaser.Math.Between(0, WORLD_WIDTH), Phaser.Math.Between(-80, WORLD_HEIGHT * 0.7), Phaser.Math.Between(8, 14), Phaser.Math.Between(14, 22), color)
      .setDepth(CONFETTI_DEPTH)
      .setRotation(Math.random() * Math.PI);
    this.pieces.push(piece);
    this.fall(piece);
  }

  private fall(piece: Phaser.GameObjects.Rectangle): void {
    const left = (WORLD_HEIGHT + 30 - piece.y) / (WORLD_HEIGHT + 50);
    this.scene.tweens.add({
      targets: piece,
      y: WORLD_HEIGHT + 30,
      x: piece.x + Phaser.Math.Between(-120, 120),
      rotation: piece.rotation + Phaser.Math.FloatBetween(4, 9),
      duration: Phaser.Math.Between(2600, 4200) * left,
      onComplete: () => {
        if (!this.pieces.includes(piece)) return;
        piece.setPosition(Phaser.Math.Between(0, WORLD_WIDTH), -20);
        this.fall(piece);
      },
    });
  }

  /** A firework over the stands: sparks fly out in a ring and fade. */
  private burst(): void {
    this.bursts += 1;
    const x = Phaser.Math.Between(120, WORLD_WIDTH - 120);
    const y = Phaser.Math.Between(50, STANDS_BOTTOM - 90);
    const color = CONFETTI_COLORS[this.bursts % CONFETTI_COLORS.length]!;
    const radius = Phaser.Math.Between(70, 120);
    for (let i = 0; i < BURST_SPARKS; i++) {
      const angle = (i / BURST_SPARKS) * Math.PI * 2;
      const spark = this.scene.add.circle(x, y, 5, color).setDepth(FIREWORKS_DEPTH);
      this.sparks.push(spark);
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * radius,
        // Sparks sink a little as they fade.
        y: y + Math.sin(angle) * radius + 20,
        alpha: 0,
        scale: 0.4,
        duration: BURST_MS,
        ease: 'Quad.easeOut',
        onComplete: () => {
          const at = this.sparks.indexOf(spark);
          if (at >= 0) this.sparks.splice(at, 1);
          spark.destroy();
        },
      });
    }
  }
}

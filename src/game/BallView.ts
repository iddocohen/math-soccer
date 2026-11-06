/**
 * The ball (FR-003, FR-008, FR-012). Its kind follows the chart size (`ballKind`): a soccer ball up to 10 rows, a
 * tennis ball up to 30, a ping-pong ball above. Its design is the one chosen in the locker room (FR-043); ballArt.ts
 * draws every design in every kind.
 *
 * - `fly(rect, onArrive)`: from the kick spot along an arc to the middle of `rect` (the `cellRect` of the typed number)
 *   in FLIGHT_MS, shrinking with distance to fit the square, with a shadow on the ground. Calls `onArrive` at the end.
 * - `intoNet()`: after a goal the ball drops behind the board, through the open hole, into the net.
 * - `bounce(onDone)`: after a miss, or a correct square in line mode, the ball bounces off the board onto the pitch and fades, then waits at the kick spot.
 * - `caught(ms)`: in goalkeeper mode the ball stays in the keeper's gloves, then fades and waits at the kick spot.
 * - `reset()`: the ball waits at the kick spot.
 *
 * All motion uses scene tweens, so pausing the scene's tweens pauses the ball.
 */
import Phaser from 'phaser';
import { center, type BallKind } from '../core/chart/layout';
import type { BallDesign } from '../core/rewards/items';
import { GOAL_FRAME, KICK_SPOT } from '../core/match/world';
import type { Rect } from '../core/types';
import { ballTexture } from './ballArt';
import { BALL_IN_NET_DEPTH } from './GoalView';
import { BALL_SIZE } from './textures';

export const BALL_DEPTH = 7;
/** Flight time from the kick spot to the square (plan "Performance Goals"). */
export const FLIGHT_MS = 800;
/** Time from the ball hitting the board to the ball waiting at the kick spot again. */
export const BOUNCE_MS = 900;
/** How high the arc rises above the straight line, in world pixels. */
const ARC = 120;
/** The ball shrinks to at most this part of its size at the goal, and smaller when the square is smaller. */
const FAR_SCALE = 0.55;

export class BallView {
  private readonly scene: Phaser.Scene;
  private readonly ball: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private kind: BallKind;
  private design: BallDesign;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, kind: BallKind, design: BallDesign) {
    this.scene = scene;
    this.kind = kind;
    this.design = design;
    this.shadow = scene.add.ellipse(KICK_SPOT.x, KICK_SPOT.y, 100, 35, 0x000000, 0.25).setDepth(BALL_DEPTH - 1);
    this.ball = scene.add.image(KICK_SPOT.x, KICK_SPOT.y, ballTexture(scene, design, kind)).setDepth(BALL_DEPTH);
    this.reset();
  }

  /** The ball kind for the chart size and the design from the locker room. A new kind puts the ball back at the kick spot. */
  setLook(kind: BallKind, design: BallDesign): void {
    if (kind === this.kind && design === this.design) return;
    const newKind = kind !== this.kind;
    this.kind = kind;
    this.design = design;
    this.ball.setTexture(ballTexture(this.scene, design, kind));
    if (newKind) this.reset();
  }

  /** Stops any motion and puts the ball at the kick spot. */
  reset(): void {
    this.stop();
    this.ball.setPosition(KICK_SPOT.x, KICK_SPOT.y).setScale(1).setAlpha(1).setRotation(0).setDepth(BALL_DEPTH).setVisible(true);
    this.placeShadow(KICK_SPOT.x, KICK_SPOT.y, 1);
    this.shadow.setVisible(true);
  }

  fly(to: Rect, onArrive: () => void): void {
    this.reset();
    const size = BALL_SIZE[this.kind];
    const endScale = Math.min(FAR_SCALE, (to.height * 0.85) / size, (to.width * 0.85) / size);
    const x0 = KICK_SPOT.x;
    const y0 = KICK_SPOT.y;
    const { x: x1, y: y1 } = center(to);
    this.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FLIGHT_MS,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        // Fast off the foot, slower near the goal.
        const e = 1 - (1 - k) * (1 - k);
        const x = x0 + (x1 - x0) * e;
        const ground = y0 + (y1 - y0) * e;
        const scale = 1 + (endScale - 1) * e;
        this.ball.setPosition(x, ground - Math.sin(Math.PI * k) * ARC).setScale(scale).setRotation(k * 6);
        this.placeShadow(x, ground, scale);
      },
      onComplete: () => {
        this.tween = null;
        this.ball.setPosition(x1, y1).setScale(endScale);
        this.shadow.setVisible(false);
        onArrive();
      },
    });
  }

  /** The ball goes through the hole into the net: behind the board, a little smaller and lower. */
  intoNet(): void {
    this.stop();
    this.shadow.setVisible(false);
    this.ball.setDepth(BALL_IN_NET_DEPTH);
    this.tween = this.scene.tweens.add({
      targets: this.ball,
      scale: this.ball.scale * 0.75,
      y: this.ball.y + this.ball.displayHeight * 0.2,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tween = null;
      },
    });
  }

  /** The ball bounces off the board onto the pitch in front of the goal, fades out, and waits at the kick spot. */
  bounce(onDone?: () => void): void {
    this.stop();
    const x0 = this.ball.x;
    const y0 = this.ball.y;
    const scale0 = this.ball.scale;
    const x1 = x0 + (x0 < KICK_SPOT.x ? -40 : 40);
    const floor = GOAL_FRAME.y + GOAL_FRAME.height + 40;
    this.shadow.setVisible(true);
    this.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: BOUNCE_MS,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        // Out from the board and down, with one small hop on the pitch.
        const fall = Math.min(1, k / 0.55);
        const hop = k > 0.55 ? Math.sin(((k - 0.55) / 0.45) * Math.PI) * 30 : 0;
        const y = y0 + (floor - y0) * fall * fall - hop;
        const x = x0 + (x1 - x0) * k;
        const scale = scale0 + (scale0 * 1.15 - scale0) * k;
        this.ball.setPosition(x, y).setScale(scale).setAlpha(k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        this.placeShadow(x, floor, scale);
        this.shadow.setAlpha(this.ball.alpha);
      },
      onComplete: () => {
        this.tween = null;
        this.shadow.setAlpha(1);
        this.reset();
        onDone?.();
      },
    });
  }

  /** The keeper caught the ball: it stays in his gloves for `ms`, fades out, and waits at the kick spot. */
  caught(ms: number): void {
    this.stop();
    this.shadow.setVisible(false);
    this.tween = this.scene.tweens.add({
      targets: this.ball,
      alpha: 0,
      delay: ms,
      duration: 300,
      onComplete: () => {
        this.tween = null;
        this.reset();
      },
    });
  }

  /** True while the ball moves (flight, net or bounce). */
  get moving(): boolean {
    return this.tween !== null;
  }

  stop(): void {
    this.tween?.stop();
    this.tween = null;
  }

  private placeShadow(x: number, groundY: number, scale: number): void {
    const size = BALL_SIZE[this.kind] * scale;
    this.shadow.setPosition(x, groundY + size / 2).setScale(size / 100);
  }

  destroy(): void {
    this.stop();
    this.ball.destroy();
    this.shadow.destroy();
  }
}

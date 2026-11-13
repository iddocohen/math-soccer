/**
 * The ball (FR-003, FR-008, FR-012). Its kind follows the chart size (`ballKind`): a soccer ball up to 10 rows, a
 * tennis ball up to 30, a ping-pong ball above. Its design is the one chosen in the locker room (FR-043); ballArt.ts
 * gives the picture of every design in every kind. The classic soccer ball is a rotation sprite: it spins through its
 * frames during the flight and rests on frame 0 (FR-058); drawn balls turn instead.
 *
 * - `fly(rect, onArrive)`: from the kick spot along an arc to the middle of `rect` (the `cellRect` of the typed number)
 *   in FLIGHT_MS, shrinking with distance to fit the square, with a shadow on the ground. Calls `onArrive` at the end.
 * - `intoNet()`: after a goal the ball drops behind the grid, through the empty target square, into the net.
 * - `caught(ms)`: after a miss the ball stays in the keeper's gloves, then fades and waits at the kick spot. On a square
 *   of a cutout without the keeper (amendment 18) it rests on the square the same way.
 * - `reset()`: the ball waits at the kick spot.
 * - "Selbst ins Tor" (amendment 21): `roll(rect, k)` puts the opponent's ball `k` (0 to 1) of the way it rolls on the
 *   grass toward the square before the shot is decided; it stays below the goal line, so it never covers a square.
 *   `flyOn(rect, onArrive)` then flies it from where it is to the square in FLIGHT_MS.
 * - `flightPoint`: the ball's middle and drawn width while it flies to the square, null otherwise; the ball trail
 *   follows it (amendment 20, FR-134).
 *
 * All motion uses scene tweens, so pausing the scene's tweens pauses the ball.
 */
import Phaser from 'phaser';
import { center, type BallKind } from '../core/chart/layout';
import type { BallDesign } from '../core/rewards/items';
import { KICK_SPOT } from '../core/match/world';
import type { Rect } from '../core/types';
import { clamp, lerp } from '../core/util';
import { ballPicture, type BallPicture } from './ballArt';
import { spinFrame } from './ballSpin';
import { BALL_IN_NET_DEPTH } from './GoalView';
import { BALL_SIZE } from './textures';

export const BALL_DEPTH = 7;
/** Flight time from the kick spot to the square (plan "Performance Goals"). */
export const FLIGHT_MS = 800;
/** How high the arc rises above the straight line, in world pixels. */
const ARC = 120;
/** The ball shrinks to at most this part of its size at the goal, and smaller when the square is smaller. */
const FAR_SCALE = 0.55;
/** The opponent's rolling ball goes at most this part of the way to the square, and never past ROLL_TOP_Y. */
const ROLL_SHARE = 0.35;
/** A little below the goal line (y 800), so the rolling ball never covers the chart. */
const ROLL_TOP_Y = 820;

/** Where the rolling ball is `k` (0 to 1) of its way toward `to`, and its scale there (amendment 21). */
export function rollPoint(to: { x: number; y: number }, k: number): { x: number; y: number; scale: number } {
  const dy = KICK_SPOT.y - to.y;
  const share = dy > 0 ? Math.min(ROLL_SHARE, (KICK_SPOT.y - ROLL_TOP_Y) / dy) : ROLL_SHARE;
  const along = clamp(k, 0, 1);
  const f = share * along;
  return { x: lerp(KICK_SPOT.x, to.x, f), y: KICK_SPOT.y - dy * f, scale: 1 - 0.2 * along };
}

export class BallView {
  private readonly scene: Phaser.Scene;
  private readonly ball: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private kind: BallKind;
  private design: BallDesign;
  private picture: BallPicture;
  private tween: Phaser.Tweens.Tween | null = null;
  /** True from the kick until the ball reaches the square. */
  private inFlight = false;

  constructor(scene: Phaser.Scene, kind: BallKind, design: BallDesign) {
    this.scene = scene;
    this.kind = kind;
    this.design = design;
    this.shadow = scene.add.ellipse(KICK_SPOT.x, KICK_SPOT.y, 100, 35, 0x000000, 0.25).setDepth(BALL_DEPTH - 1);
    this.picture = ballPicture(scene, design, kind);
    this.ball = scene.add.image(KICK_SPOT.x, KICK_SPOT.y, this.picture.key, this.picture.sprite ? 0 : undefined).setDepth(BALL_DEPTH);
    this.reset();
  }

  /** The ball kind for the chart size and the design from the locker room. A new kind puts the ball back at the kick spot. */
  setLook(kind: BallKind, design: BallDesign): void {
    if (kind === this.kind && design === this.design) return;
    const newKind = kind !== this.kind;
    this.kind = kind;
    this.design = design;
    // Keep the ball's size along a flight when only its picture changes.
    const scale = this.relativeScale();
    this.picture = ballPicture(this.scene, design, kind);
    this.ball.setTexture(this.picture.key, this.picture.sprite ? 0 : undefined);
    this.setSize(scale);
    if (newKind) this.reset();
  }

  /** Stops any motion and puts the ball at the kick spot. */
  reset(): void {
    this.stop();
    this.ball.setPosition(KICK_SPOT.x, KICK_SPOT.y).setAlpha(1).setRotation(0).setDepth(BALL_DEPTH).setVisible(true);
    this.setSize(1);
    if (this.picture.sprite) this.ball.setFrame(0);
    this.placeShadow(KICK_SPOT.x, KICK_SPOT.y, 1);
    this.shadow.setVisible(true);
  }

  fly(to: Rect, onArrive: () => void): void {
    this.reset();
    this.flyFrom({ x: KICK_SPOT.x, y: KICK_SPOT.y, scale: 1 }, to, onArrive);
  }

  /** The opponent's ball rolls on the grass, `k` of its way toward `to` (amendment 21). */
  roll(to: Rect, k: number): void {
    this.stop();
    const p = rollPoint(center(to), k);
    this.ball.setPosition(p.x, p.y).setAlpha(1).setDepth(BALL_DEPTH).setVisible(true);
    this.setSize(p.scale);
    if (this.picture.sprite) this.ball.setFrame(spinFrame(k * 0.5));
    else this.ball.setRotation(k * 4);
    this.placeShadow(p.x, p.y, p.scale);
    this.shadow.setVisible(true);
  }

  /** Flies the ball from where it is now to `to` in FLIGHT_MS (amendment 21: after `roll`). */
  flyOn(to: Rect, onArrive: () => void): void {
    this.stop();
    this.ball.setAlpha(1).setDepth(BALL_DEPTH).setVisible(true);
    this.flyFrom({ x: this.ball.x, y: this.ball.y, scale: this.relativeScale() }, to, onArrive);
  }

  private flyFrom(from: { x: number; y: number; scale: number }, to: Rect, onArrive: () => void): void {
    const size = BALL_SIZE[this.kind];
    const endScale = Math.min(FAR_SCALE, (to.height * 0.85) / size, (to.width * 0.85) / size);
    const startScale = from.scale;
    const x0 = from.x;
    const y0 = from.y;
    const { x: x1, y: y1 } = center(to);
    this.inFlight = true;
    this.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FLIGHT_MS,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        // Fast off the foot, slower near the goal.
        const e = 1 - (1 - k) * (1 - k);
        const x = lerp(x0, x1, e);
        const ground = lerp(y0, y1, e);
        const scale = lerp(startScale, endScale, e);
        this.ball.setPosition(x, ground - Math.sin(Math.PI * k) * ARC);
        this.setSize(scale);
        // The sprite spins through its frames; a drawn ball turns.
        if (this.picture.sprite) this.ball.setFrame(spinFrame(k));
        else this.ball.setRotation(k * 6);
        this.placeShadow(x, ground, scale);
      },
      onComplete: () => {
        this.tween = null;
        this.inFlight = false;
        this.ball.setPosition(x1, y1);
        this.setSize(endScale);
        if (this.picture.sprite) this.ball.setFrame(spinFrame(1));
        this.shadow.setVisible(false);
        onArrive();
      },
    });
  }

  /** The ball goes past the keeper into the net: behind the grid, a little smaller and lower. */
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

  /** The keeper caught the ball, or it landed on a square of a cutout: it stays for `ms`, fades out, and waits at the kick spot. */
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

  /** True while the ball moves (flight, net or fading from the keeper's gloves). */
  get moving(): boolean {
    return this.tween !== null;
  }

  /** The ball's middle and drawn width while it flies to the square; null otherwise. */
  get flightPoint(): { x: number; y: number; size: number } | null {
    return this.inFlight ? { x: this.ball.x, y: this.ball.y, size: this.ball.displayWidth } : null;
  }

  stop(): void {
    this.tween?.stop();
    this.tween = null;
    this.inFlight = false;
  }

  /** Scales the ball to `scale` times its BALL_SIZE (1 at the kick spot). */
  private setSize(scale: number): void {
    this.ball.setScale(scale * this.picture.scale);
  }

  /** The ball's scale as a part of its BALL_SIZE. */
  private relativeScale(): number {
    return this.ball.scale / this.picture.scale;
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

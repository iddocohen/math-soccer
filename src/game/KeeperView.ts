/**
 * The goalkeeper in goalkeeper mode (FR-019, FR-020; idea from the prototype's drawKeeper in
 * specs/001-math-soccer/prototype/index.html). Drawn with shapes in code (FR-048): a blue jersey, dark shorts, yellow
 * gloves on arms that swing from the shoulders. Where he goes comes from keeperDive.ts.
 *
 * - He waits small and low in the middle of the goal, in front of the grid but below its squares (`idle`).
 * - On every shot he watches the ball for a moment, then leaps along a short arc (DIVE_MS, timed to end when the ball
 *   arrives): the body tilts toward the ball, the arms stretch over the head and he grows as he comes off the line
 *   (`diving`).
 * - `catchBall()`: on a wrong number his gloves are on the ball; he holds it (`caught`), then walks back to the middle.
 * - `beaten()`: on the correct number his gloves stop short of the ball; he lands on the grass (`beaten`), gets up and
 *   walks back to the middle.
 * - `onPhase` hears every change of `phase`; the app shows it as `data-keeper` for tests.
 *
 * All motion uses scene tweens, so pausing the scene's tweens pauses the keeper.
 */
import Phaser from 'phaser';
import type { Rect } from '../core/types';
import { FLIGHT_MS } from './BallView';
import { diveEnd, fallenPose, HOME_POSE, mixPose, type KeeperPose } from './keeperDive';
import { COLOR } from './palette';

export const KEEPER_PHASES = ['idle', 'diving', 'caught', 'beaten'] as const;
export type KeeperPhase = (typeof KEEPER_PHASES)[number];

/** In front of the grid (board depth 4) and behind the posts (5), the player (6) and the flying ball (7). */
export const KEEPER_DEPTH = 4.5;
/** The leap itself; before it the keeper waits FLIGHT_MS - DIVE_MS, so he arrives with the ball. */
export const DIVE_MS = 500;
/** How long he holds a caught ball, or lies on the grass, before he goes back. */
export const HOLD_MS = 700;
/** Falling onto the grass after a beaten dive. */
const FALL_MS = 300;
/** Walking back to the middle. */
const RETURN_MS = 450;
/** How high the leap's arc rises above the straight path, at most, in world pixels. */
const ARC = 60;

const JERSEY = 0x3e6fb0;
const GLOVE = 0xe8b923;
/** The arms' swing from the ready stance (gloves out low) to over the head, left arm; the right arm mirrors it. */
const ARM_READY = 0.9;
const ARM_UP = Math.PI + 0.3;
const SHOULDER = { x: 18, y: -38 } as const;

export class KeeperView {
  private readonly scene: Phaser.Scene;
  private readonly body: Phaser.GameObjects.Container;
  private readonly leftArm: Phaser.GameObjects.Graphics;
  private readonly rightArm: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly onPhase: (phase: KeeperPhase) => void;
  private pose: KeeperPose = HOME_POSE;
  private tween: Phaser.Tweens.Tween | null = null;
  private current: KeeperPhase = 'idle';

  constructor(scene: Phaser.Scene, onPhase: (phase: KeeperPhase) => void = () => {}) {
    this.scene = scene;
    this.onPhase = onPhase;

    const legs = scene.add.graphics();
    legs.fillStyle(COLOR.skin, 1);
    legs.fillRect(-15, 12, 11, 14);
    legs.fillRect(4, 12, 11, 14);
    legs.fillStyle(JERSEY, 1);
    legs.fillRect(-15, 22, 11, 8);
    legs.fillRect(4, 22, 11, 8);
    legs.fillStyle(COLOR.ink, 1);
    legs.fillRect(-18, 0, 36, 13);
    legs.fillRect(-17, 30, 14, 5);
    legs.fillRect(3, 30, 14, 5);

    const torso = scene.add.graphics();
    torso.fillStyle(JERSEY, 1);
    torso.fillRoundedRect(-18, -42, 36, 44, 7);
    torso.fillStyle(COLOR.chalk, 0.9);
    torso.fillRect(-18, -12, 36, 4);

    const head = scene.add.graphics();
    head.fillStyle(COLOR.skin, 1);
    head.fillCircle(0, -54, 13);
    head.fillStyle(COLOR.hair, 1);
    head.fillEllipse(0, -61, 26, 12);

    this.leftArm = drawArm(scene).setPosition(-SHOULDER.x, SHOULDER.y);
    this.rightArm = drawArm(scene).setPosition(SHOULDER.x, SHOULDER.y);

    this.shadow = scene.add.ellipse(HOME_POSE.x, 0, 70, 14, 0x000000, 0.28).setDepth(KEEPER_DEPTH - 0.01);
    this.body = scene.add.container(0, 0, [this.leftArm, this.rightArm, legs, torso, head]).setDepth(KEEPER_DEPTH);
    this.apply(HOME_POSE);
    // A new scene starts with a waiting keeper; tell the listener, which may still hold the last scene's phase.
    this.onPhase('idle');
  }

  get phase(): KeeperPhase {
    return this.current;
  }

  setVisible(visible: boolean): void {
    this.body.setVisible(visible);
    this.shadow.setVisible(visible);
  }

  /** Stops any motion: the keeper waits in the middle. */
  reset(): void {
    this.stop();
    this.apply(HOME_POSE);
    this.setPhase('idle');
  }

  /**
   * The shot flies to `square`: a ball he will `catch` (a wrong number), or one that beats him (the correct number).
   * The leap ends after FLIGHT_MS, when the ball arrives.
   */
  dive(square: Rect, outcome: 'catch' | 'beaten'): void {
    this.stop();
    this.setPhase('diving');
    const from = this.pose;
    const to = diveEnd(square, outcome);
    const arc = Math.min(ARC, Math.hypot(to.x - from.x, to.y - from.y) * 0.2);
    this.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay: Math.max(0, FLIGHT_MS - DIVE_MS),
      duration: DIVE_MS,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        // Fast off the line, slowing as he stretches; the body and the arms turn first.
        const travel = 1 - (1 - k) * (1 - k);
        const turn = Math.min(1, k * 1.6);
        const p = mixPose(from, to, travel);
        this.apply({ ...p, y: p.y - Math.sin(Math.PI * k) * arc, rotation: from.rotation + (to.rotation - from.rotation) * turn, arms: from.arms + (to.arms - from.arms) * turn });
      },
      onComplete: () => {
        this.tween = null;
        this.apply(to);
      },
    });
  }

  /** The ball is in his gloves: he holds it, then goes back to the middle. */
  catchBall(): void {
    this.setPhase('caught');
    this.moveTo(this.pose, HOLD_MS, () => this.goHome());
  }

  /** The ball went past him: he lands on the grass, waits, then goes back to the middle. */
  beaten(): void {
    this.setPhase('beaten');
    this.moveTo(fallenPose(this.pose), FALL_MS, () => this.moveTo(this.pose, HOLD_MS, () => this.goHome()), (k) => k * k);
  }

  private goHome(): void {
    this.moveTo(HOME_POSE, RETURN_MS, () => this.setPhase('idle'), (k) => (1 - Math.cos(Math.PI * k)) / 2);
  }

  private moveTo(to: KeeperPose, ms: number, onDone: () => void, easing: (k: number) => number = (k) => k): void {
    this.stop();
    const from = this.pose;
    this.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => this.apply(mixPose(from, to, easing(tw.getValue() ?? 0))),
      onComplete: () => {
        this.tween = null;
        this.apply(to);
        onDone();
      },
    });
  }

  private stop(): void {
    this.tween?.stop();
    this.tween = null;
  }

  private setPhase(phase: KeeperPhase): void {
    if (phase === this.current) return;
    this.current = phase;
    this.onPhase(phase);
  }

  private apply(pose: KeeperPose): void {
    this.pose = pose;
    this.body.setPosition(pose.x, pose.y).setRotation(pose.rotation).setScale(pose.scale);
    const arm = ARM_READY + (ARM_UP - ARM_READY) * pose.arms;
    this.leftArm.setRotation(arm);
    this.rightArm.setRotation(-arm);
    // The shadow stays on the grass below him and fades as he leaps up.
    const height = Math.max(0, HOME_POSE.y - pose.y);
    this.shadow
      .setPosition(pose.x, HOME_POSE.y + 34 * HOME_POSE.scale)
      .setScale(pose.scale / HOME_POSE.scale)
      .setAlpha(Math.max(0.15, 1 - height / 300));
  }

  destroy(): void {
    this.stop();
    this.body.destroy();
    this.shadow.destroy();
  }
}

/** One arm drawn hanging from the shoulder at (0, 0): the sleeve, then the glove whose middle is 36 below it. */
function drawArm(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(JERSEY, 1);
  g.fillRoundedRect(-5, -3, 10, 32, 4);
  g.fillStyle(GLOVE, 1);
  g.fillRoundedRect(-8, 28, 16, 16, 5);
  g.lineStyle(1.5, COLOR.ink, 0.5);
  g.strokeRoundedRect(-8, 28, 16, 16, 5);
  return g;
}

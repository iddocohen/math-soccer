/**
 * The goalkeeper (FR-019, FR-020; idea from the prototype's drawKeeper in
 * specs/001-math-soccer/prototype/index.html). Drawn with shapes in code (FR-048): a blue jersey, dark shorts, yellow
 * gloves on arms that swing from the shoulders. Where he goes comes from keeperDive.ts.
 *
 * - He has one size for the whole shot, half as tall as the goal mouth, and waits with his feet on the goal line
 *   (FR-062, FR-063). `keepClear()` hears the target, hint and waiting shape squares: he shuffles sideways to a spot that leaves them
 *   visible, or waits half transparent in the middle when no spot does (FR-064) (`idle`). A new target that comes
 *   while he walks back after a shot turns him toward the new spot at once (FR-121).
 * - While he waits he is drawn behind the grid, so the hint squares, their numbers, the target outline and the waiting
 *   shape squares stay readable wherever he stands (FR-120). From the leap until he is back on his spot he is drawn in
 *   front of the grid.
 * - On every shot he watches the ball for a moment, then leaps along a short arc (DIVE_MS, timed to end when the ball
 *   arrives): the body tilts toward the ball and the arms stretch over the head (`diving`).
 * - `catchBall()`: on a wrong number his gloves are on the ball; he holds it (`caught`), then walks back to his spot.
 * - `beaten()`: on the correct number his gloves stop short of the ball; he lands on the grass (`beaten`), gets up and
 *   walks back to his spot.
 * - `onPhase` hears every change of `phase`; the app shows it as `data-keeper` for tests.
 *
 * All motion uses scene tweens, so pausing the scene's tweens pauses the keeper.
 */
import Phaser from 'phaser';
import type { Rect } from '../core/types';
import { FLIGHT_MS } from './BallView';
import { BALL_IN_NET_DEPTH, BOARD_DEPTH } from './GoalView';
import {
  diveEnd,
  FADED_ALPHA,
  fallenPose,
  FEET_BELOW_HIPS,
  GOAL_LINE,
  HOME_POSE,
  KEEPER_SCALE,
  mixPose,
  waitingSpot,
  type KeeperPose,
} from './keeperDive';
import { COLOR } from './palette';

export const KEEPER_PHASES = ['idle', 'diving', 'caught', 'beaten'] as const;
export type KeeperPhase = (typeof KEEPER_PHASES)[number];

/** In front of the grid (board depth 4) and behind the posts (5), the player (6) and the flying ball (7). */
export const KEEPER_DEPTH = 4.5;
/** The waiting keeper: behind the grid (board depth 4), in front of a ball in the net (3), FR-120. */
export const WAITING_DEPTH = (BALL_IN_NET_DEPTH + BOARD_DEPTH) / 2;
/** The leap itself; before it the keeper waits FLIGHT_MS - DIVE_MS, so he arrives with the ball. */
export const DIVE_MS = 500;
/** How long he holds a caught ball, or lies on the grass, before he goes back. */
export const HOLD_MS = 700;
/** Falling onto the grass after a beaten dive. */
const FALL_MS = 300;
/** Walking back to his waiting spot. */
const RETURN_MS = 450;
/** Shuffling sideways to a new waiting spot for a new target. */
const SHUFFLE_MS = 350;
/** How high the leap's arc rises above the straight path, at most, in world pixels. */
const ARC = 60;

const JERSEY = 0x3e6fb0;
const GLOVE = COLOR.kit;
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
  /** Where he waits for the next shot, and whether he covers none of the target and hint squares there. */
  private home: KeeperPose = HOME_POSE;
  private clear = true;
  /** The squares last given to `keepClear`, as text, so the same squares do not move him again. */
  private squaresKey = '';
  private faded = false;
  /** True while he walks back to his waiting spot after a shot. */
  private returning = false;

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

    this.shadow = scene.add
      .ellipse(HOME_POSE.x, GOAL_LINE, 70 * KEEPER_SCALE, 14 * KEEPER_SCALE, 0x000000, 0.28)
      .setDepth(WAITING_DEPTH - 0.01);
    this.body = scene.add
      .container(0, 0, [this.leftArm, this.rightArm, legs, torso, head])
      .setDepth(WAITING_DEPTH)
      .setScale(KEEPER_SCALE);
    this.apply(HOME_POSE);
    // A new scene starts with a waiting keeper; tell the listener, which may still hold the last scene's phase.
    this.onPhase('idle');
  }

  get phase(): KeeperPhase {
    return this.current;
  }

  /** True when the waiting keeper covers none of the target and hint squares; false while he waits faded. */
  get isClear(): boolean {
    return this.clear;
  }

  /** Where he waits for the next shot. */
  get waitingPose(): KeeperPose {
    return this.home;
  }

  /** The depth he is drawn at now: behind the grid while he waits, in front of it otherwise (FR-120). */
  get depth(): number {
    return this.body.depth;
  }

  /** The opacity he is drawn with now: FADED_ALPHA while he waits without a free spot (FR-064). */
  get alpha(): number {
    return this.body.alpha;
  }

  /** Where he is drawn now. */
  get currentPose(): KeeperPose {
    return this.pose;
  }

  /** Stops any motion: the keeper waits in the middle until he hears the next squares. */
  reset(): void {
    this.stop();
    this.home = HOME_POSE;
    this.clear = true;
    this.squaresKey = '';
    this.apply(HOME_POSE);
    this.setFaded(false);
    this.setPhase('idle');
    this.setWaitingLayer(true);
  }

  /**
   * The target and hint squares of the current target (FR-064). The keeper's waiting spot moves so that he covers none
   * of them; when he is waiting, he shuffles there now, otherwise he walks there after the shot.
   */
  keepClear(squares: readonly Rect[]): void {
    const key = squares.map((r) => `${r.x},${r.y},${r.width},${r.height}`).join(';');
    if (key === this.squaresKey) return;
    // The first squares of a round, or of a restored round, place him at once: no shuffle that a paused scene would hold.
    const first = this.squaresKey === '';
    this.squaresKey = key;
    const spot = waitingSpot(squares);
    this.home = spot.pose;
    this.clear = spot.clear;
    // Already on his way back after a shot: the walk was headed for the last target's spot, so he turns toward the new
    // one now. Without this he ended on the old spot and covered the new hints (FR-121, keeper-blocks-bug.png).
    if (this.returning) {
      this.goHome();
      return;
    }
    if (this.current !== 'idle') return;
    this.setFaded(!spot.clear);
    if (first && this.tween === null) this.apply(spot.pose);
    else if (this.pose.x !== spot.pose.x || this.pose.y !== spot.pose.y) {
      this.moveTo(spot.pose, SHUFFLE_MS, () => {}, (k) => (1 - Math.cos(Math.PI * k)) / 2);
    }
  }

  /**
   * The shot flies to `square`: a ball he will `catch` (a wrong number), or one that beats him (the correct number).
   * The leap ends after FLIGHT_MS, when the ball arrives.
   */
  dive(square: Rect, outcome: 'catch' | 'beaten'): void {
    this.stop();
    this.setPhase('diving');
    this.setWaitingLayer(false);
    // He is drawn fully again once the child shoots (FR-064).
    this.setFaded(false);
    const from = this.pose;
    const to = diveEnd(square, outcome, from);
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

  /** The ball is in his gloves: he holds it, then goes back to his waiting spot. */
  catchBall(): void {
    this.setPhase('caught');
    this.moveTo(this.pose, HOLD_MS, () => this.goHome());
  }

  /** The ball went past him: he lands on the grass, waits, then goes back to his waiting spot. */
  beaten(): void {
    this.setPhase('beaten');
    this.moveTo(fallenPose(this.pose, this.home), FALL_MS, () => this.moveTo(this.pose, HOLD_MS, () => this.goHome()), (k) => k * k);
  }

  private goHome(): void {
    this.moveTo(this.home, RETURN_MS, () => {
      this.returning = false;
      this.setFaded(!this.clear);
      this.setPhase('idle');
      this.setWaitingLayer(true);
    }, (k) => (1 - Math.cos(Math.PI * k)) / 2);
    this.returning = true;
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
    this.returning = false;
  }

  /** Behind the grid while he waits, in front of it from the leap until he is back on his spot (FR-120). */
  private setWaitingLayer(waiting: boolean): void {
    const depth = waiting ? WAITING_DEPTH : KEEPER_DEPTH;
    this.body.setDepth(depth);
    this.shadow.setDepth(depth - 0.01);
  }

  private setPhase(phase: KeeperPhase): void {
    if (phase === this.current) return;
    this.current = phase;
    this.onPhase(phase);
  }

  private apply(pose: KeeperPose): void {
    this.pose = pose;
    this.body.setPosition(pose.x, pose.y).setRotation(pose.rotation);
    const arm = ARM_READY + (ARM_UP - ARM_READY) * pose.arms;
    this.leftArm.setRotation(arm);
    this.rightArm.setRotation(-arm);
    // The shadow stays on the grass below him and fades as he leaps up.
    const height = Math.max(0, HOME_POSE.y - pose.y);
    this.shadow.setPosition(pose.x, HOME_POSE.y + FEET_BELOW_HIPS * KEEPER_SCALE).setAlpha(Math.max(0.15, 1 - height / 300) * (this.faded ? FADED_ALPHA : 1));
  }

  /** Half transparent while he waits without a free spot (FR-064), fully drawn otherwise. */
  private setFaded(faded: boolean): void {
    this.faded = faded;
    this.body.setAlpha(faded ? FADED_ALPHA : 1);
    this.apply(this.pose);
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

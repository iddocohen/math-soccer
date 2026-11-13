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
 * - Cup (amendment 13, FR-107): `setTeam()` dresses him in the opponent's colors with the keeper's quirk: tall hair,
 *   a headband and a quicker shuffle (small and quick), a beard, a cap, a jump with the caught ball (celebrates saves),
 *   or a glance to the left before each leap (looks left first). Quirks are looks only: his size, his waiting spot and
 *   his leaps stay the same, and the waiting keeper stays behind the grid (FR-120).
 *
 * - "Selbst ins Tor" (amendment 21, FR-143): `setKit()` dresses him as the child: the shirt in the child's shirt color
 *   with the shirt number on the chest. The kit wins over a cup team's colors.
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
import type { Quirk } from '../core/cup/teams';
import { COLOR, css, hexColor } from './palette';
import { GAME_FONT, GAME_FONT_WEIGHT } from '../assets';

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

const GLOVE = COLOR.kit;
/** The arms' swing from the ready stance (gloves out low) to over the head, left arm; the right arm mirrors it. */
const ARM_READY = 0.9;
const ARM_UP = Math.PI + 0.3;
const SHOULDER = { x: 18, y: -38 } as const;
/** The small, quick keeper shuffles to a new spot in this time instead of SHUFFLE_MS (a look, not a reach). */
export const QUICK_SHUFFLE_MS = 200;
/** How far the eyes of the keeper who looks left first turn, in unscaled units. */
const LOOK_LEFT_PX = 3;
/** How high the keeper who celebrates saves jumps with the ball, in world pixels. */
const CELEBRATE_JUMP = 30;

/** Easing curves of his moves: slow at both ends, slowing down at the end, speeding up. */
const easeInOutSine = (k: number) => (1 - Math.cos(Math.PI * k)) / 2;
const easeOutQuad = (k: number) => 1 - (1 - k) * (1 - k);
const easeInQuad = (k: number) => k * k;

/** What a quirk changes in his moves (looks only, FR-107); the drawn look is in `paint`. */
interface QuirkProfile {
  shuffleMs: number;
  looksLeft: boolean;
  celebratesSaves: boolean;
}
const PLAIN: QuirkProfile = { shuffleMs: SHUFFLE_MS, looksLeft: false, celebratesSaves: false };
const QUIRK_PROFILE: Record<Quirk, QuirkProfile> = {
  tall: PLAIN,
  small: { ...PLAIN, shuffleMs: QUICK_SHUFFLE_MS },
  beard: PLAIN,
  cap: PLAIN,
  celebratesSaves: { ...PLAIN, celebratesSaves: true },
  looksLeft: { ...PLAIN, looksLeft: true },
};

/** What the keeper wears in a cup match: the opponent's colors (`#rrggbb`) and the keeper's quirk (FR-107). */
export interface KeeperTeam {
  color: string;
  trim: string;
  quirk: Quirk;
}

/** The child's kit when he is the keeper (amendment 21): the shirt color and the shirt number. */
export interface KeeperKit {
  color: number;
  number: number;
}

export class KeeperView {
  private readonly scene: Phaser.Scene;
  private readonly body: Phaser.GameObjects.Container;
  private readonly leftArm: Phaser.GameObjects.Graphics;
  private readonly rightArm: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly onPhase: (phase: KeeperPhase) => void;
  private readonly legs: Phaser.GameObjects.Graphics;
  private readonly torso: Phaser.GameObjects.Graphics;
  private readonly head: Phaser.GameObjects.Graphics;
  /** The quirk's beard, cap, hair or headband, over the head. */
  private readonly extras: Phaser.GameObjects.Graphics;
  /** The eyes, which the keeper who looks left first turns before a leap. */
  private readonly eyes: Phaser.GameObjects.Graphics;
  /** The shirt number on the chest of the child's kit. */
  private readonly number: Phaser.GameObjects.Text;
  /** The cup opponent's colors and quirk; null outside the cup (the blue keeper). */
  private team: KeeperTeam | null = null;
  /** The child's kit in "Selbst ins Tor"; null otherwise. */
  private kit: KeeperKit | null = null;
  /** What the team's quirk changes in his moves; PLAIN outside the cup. */
  private profile: QuirkProfile = PLAIN;
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

    this.legs = scene.add.graphics();
    this.torso = scene.add.graphics();
    this.head = scene.add.graphics();
    this.extras = scene.add.graphics();
    this.eyes = scene.add.graphics();
    this.number = scene.add
      .text(0, -26, '', { fontFamily: GAME_FONT, fontStyle: String(GAME_FONT_WEIGHT), fontSize: '20px', color: css(COLOR.ink) })
      .setOrigin(0.5, 0.5);

    this.leftArm = scene.add.graphics().setPosition(-SHOULDER.x, SHOULDER.y);
    this.rightArm = scene.add.graphics().setPosition(SHOULDER.x, SHOULDER.y);
    this.paint();

    this.shadow = scene.add
      .ellipse(HOME_POSE.x, GOAL_LINE, 70 * KEEPER_SCALE, 14 * KEEPER_SCALE, 0x000000, 0.28)
      .setDepth(WAITING_DEPTH - 0.01);
    this.body = scene.add
      .container(0, 0, [this.leftArm, this.rightArm, this.legs, this.torso, this.number, this.head, this.eyes, this.extras])
      .setDepth(WAITING_DEPTH)
      .setScale(KEEPER_SCALE);
    this.apply(HOME_POSE);
    // A new scene starts with a waiting keeper; tell the listener, which may still hold the last scene's phase.
    this.onPhase('idle');
  }

  get phase(): KeeperPhase {
    return this.current;
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

  /** The quirk he shows now; null outside the cup. */
  get quirk(): Quirk | null {
    return this.team?.quirk ?? null;
  }

  /**
   * Dresses the keeper as the cup opponent (FR-107): the shirt in the team color with trim, and the quirk's look. Null
   * gives the blue keeper back. Only the drawing changes: his size, his spots and his leaps stay the same (FR-062 to
   * FR-064), and the faster shuffle of the small, quick keeper only moves him sooner to the same spot.
   */
  setTeam(team: KeeperTeam | null): void {
    if (team?.color === this.team?.color && team?.trim === this.team?.trim && team?.quirk === this.team?.quirk) return;
    this.team = team ? { ...team } : null;
    this.profile = team ? QUIRK_PROFILE[team.quirk] : PLAIN;
    this.paint();
  }

  /** Dresses him in the child's kit with the shirt number (amendment 21); null takes the kit off again. */
  setKit(kit: KeeperKit | null): void {
    if (kit?.color === this.kit?.color && kit?.number === this.kit?.number) return;
    this.kit = kit ? { ...kit } : null;
    this.paint();
  }

  /** The shirt number he shows, '' without the child's kit. */
  get shirtNumber(): string {
    return this.number.text;
  }

  /** Hides the keeper and his shadow ("Torwandschießen" has no keeper, amendment 23); false shows him again. */
  setHidden(hidden: boolean): void {
    this.body.setVisible(!hidden);
    this.shadow.setVisible(!hidden);
  }

  /** True while the keeper is hidden. */
  get hidden(): boolean {
    return !this.body.visible;
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
      this.moveTo(spot.pose, this.profile.shuffleMs, () => {}, easeInOutSine);
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
    this.lookLeftFirst();
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
        this.eyes.setPosition(0, 0);
        this.apply(to);
      },
    });
  }

  /** The keeper who looks left first glances left while the ball flies, then back to the ball (looks only). */
  private lookLeftFirst(): void {
    if (!this.profile.looksLeft) return;
    this.eyes.setPosition(-LOOK_LEFT_PX, 0);
  }

  /**
   * The ball is in his gloves: he holds it, then goes back to his waiting spot. The keeper who celebrates saves jumps
   * with the ball over his head in the same hold time.
   */
  catchBall(): void {
    this.setPhase('caught');
    this.eyes.setPosition(0, 0);
    if (this.profile.celebratesSaves) {
      const held = this.pose;
      const jump: KeeperPose = { ...held, y: held.y - CELEBRATE_JUMP, arms: 1, rotation: 0 };
      this.moveTo(held, HOLD_MS / 2, () =>
        this.moveTo(jump, HOLD_MS / 4, () => this.moveTo(held, HOLD_MS / 4, () => this.goHome()), easeOutQuad),
      );
      return;
    }
    this.moveTo(this.pose, HOLD_MS, () => this.goHome());
  }

  /** The ball went past him: he lands on the grass, waits, then goes back to his waiting spot. */
  beaten(): void {
    this.setPhase('beaten');
    this.moveTo(fallenPose(this.pose, this.home), FALL_MS, () => this.moveTo(this.pose, HOLD_MS, () => this.goHome()), easeInQuad);
  }

  private goHome(): void {
    this.moveTo(this.home, RETURN_MS, () => {
      this.returning = false;
      this.setFaded(!this.clear);
      this.setPhase('idle');
      this.setWaitingLayer(true);
    }, easeInOutSine);
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

  /** Draws the kit in the team colors (or the blue keeper's) and the quirk's look. */
  private paint(): void {
    let jersey = this.team ? hexColor(this.team.color) : COLOR.keeperJersey;
    let trim = this.team ? hexColor(this.team.trim) : COLOR.chalk;
    if (this.kit) {
      jersey = this.kit.color;
      trim = COLOR.chalk;
    }
    this.number.setText(this.kit ? String(this.kit.number) : '');
    // A dark number on light shirts, a light one on dark shirts.
    const light = ((jersey >> 16) & 0xff) * 0.299 + ((jersey >> 8) & 0xff) * 0.587 + (jersey & 0xff) * 0.114 > 150;
    this.number.setColor(light ? css(COLOR.ink) : css(COLOR.chalk));
    drawLegs(this.legs.clear(), jersey, COLOR.ink);
    drawShirt(this.torso.clear(), jersey, trim);

    const head = this.head.clear();
    head.fillStyle(COLOR.skin, 1);
    head.fillCircle(0, -54, 13);
    const quirk = this.team?.quirk ?? null;
    // The cap and the tall hair replace the usual hair.
    if (quirk !== 'cap' && quirk !== 'tall') {
      head.fillStyle(COLOR.hair, 1);
      head.fillEllipse(0, -61, 26, 12);
    }

    const eyes = this.eyes.clear().setPosition(0, 0);
    eyes.fillStyle(COLOR.ink, 1);
    eyes.fillCircle(-4.5, -55, 1.8);
    eyes.fillCircle(4.5, -55, 1.8);

    const extras = this.extras.clear();
    switch (quirk) {
      case 'tall':
        // A tall flat top, so he reads tall without being drawn larger (FR-062).
        extras.fillStyle(COLOR.hair, 1);
        extras.fillRoundedRect(-12, -78, 24, 18, 4);
        break;
      case 'small':
        // A headband in the trim color; he is quick on his feet (QUICK_SHUFFLE_MS).
        extras.fillStyle(COLOR.hair, 1);
        extras.fillEllipse(0, -62, 24, 10);
        extras.fillStyle(trim, 1);
        extras.fillRect(-13, -62, 26, 4);
        break;
      case 'beard':
        extras.fillStyle(COLOR.hair, 1);
        extras.fillEllipse(0, -46, 24, 14);
        extras.fillStyle(COLOR.skin, 1);
        extras.fillEllipse(0, -49, 8, 3);
        break;
      case 'cap':
        extras.fillStyle(jersey, 1);
        extras.fillEllipse(0, -62, 28, 14);
        extras.fillStyle(trim, 1);
        extras.fillRoundedRect(-15, -60, 30, 5, 2);
        break;
      default:
        break;
    }

    for (const arm of [this.leftArm, this.rightArm]) {
      arm.clear();
      arm.fillStyle(jersey, 1);
      arm.fillRoundedRect(-5, -3, 10, 32, 4);
      arm.fillStyle(GLOVE, 1);
      arm.fillRoundedRect(-8, 28, 16, 16, 5);
      arm.lineStyle(1.5, COLOR.ink, 0.5);
      arm.strokeRoundedRect(-8, 28, 16, 16, 5);
    }
  }

  destroy(): void {
    this.stop();
    this.body.destroy();
    this.shadow.destroy();
  }
}

/**
 * The legs of the keeper's figure, hips at 0: skin, socks in the `kit` color, dark boots, and shorts in `shorts`. The
 * defenders of the wall (WallView.ts) wear the same.
 */
export function drawLegs(g: Phaser.GameObjects.Graphics, kit: number, shorts: number): void {
  g.fillStyle(COLOR.skin, 1);
  g.fillRect(-15, 12, 11, 14);
  g.fillRect(4, 12, 11, 14);
  g.fillStyle(kit, 1);
  g.fillRect(-15, 22, 11, 8);
  g.fillRect(4, 22, 11, 8);
  g.fillStyle(COLOR.ink, 1);
  g.fillRect(-17, 30, 14, 5);
  g.fillRect(3, 30, 14, 5);
  g.fillStyle(shorts, 1);
  g.fillRect(-18, 0, 36, 13);
}

/** The shirt of the keeper's figure in the `kit` color with a stripe in `trim`; the defenders wear the same. */
export function drawShirt(g: Phaser.GameObjects.Graphics, kit: number, trim: number): void {
  g.fillStyle(kit, 1);
  g.fillRoundedRect(-18, -42, 36, 44, 7);
  g.fillStyle(trim, 0.9);
  g.fillRect(-18, -12, 36, 4);
}

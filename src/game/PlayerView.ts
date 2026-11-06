/**
 * The child's player, seen from behind (FR-001, amendment 08): hair, a shirt in the shirt color with the name and the
 * shirt number on the back, shorts and the top of the legs. He stands to the lower left of the ball, drawn larger than
 * the keeper because he is closer to the viewer, and the bottom edge of the screen cuts off his lower legs. Where he
 * stands and how large he is comes from src/game/playerPose.ts; his head stays below the chart (FR-056, FR-083).
 * `kick()` takes one short step toward the ball and back (FR-084).
 * After a won cup final, `liftCup()` raises both arms with a gold cup over his head (amendment 13, FR-110).
 * After a goal, `celebrate()` plays the celebration chosen in the locker room (FR-113, FR-114): the figure moves and
 * turns, and the arms are drawn again on every frame from the pose keyframes in src/game/celebrationPose.ts.
 * Drawn with shapes in code (FR-048); the locker room (US6) changes the shirt color, the number and the name above it
 * with `setLook`.
 */
import Phaser from 'phaser';
import type { Look } from '../core/rewards/lockerRoom';
import { GAME_FONT, GAME_FONT_WEIGHT } from '../assets';
import { COLOR, css } from './palette';
import type { Celebration } from '../core/rewards/items';
import { armPoints, HEART_CENTER, poseAt, TURN_CENTER_Y, type CelebrationPose } from './celebrationPose';
import { BODY, KICKING, KICK_STEP_MS, PLAYER_FEET, PLAYER_SCALE } from './playerPose';

export const PLAYER_DEPTH = 6;

/** The parts of the figure, in units before scaling, feet at y 0 (BODY.height is the hair top). */
/** The head and shirt are large for the figure, so he reads closer than the keeper even with his legs cut off. */
const HEAD = { y: -BODY.height + 34, radius: 34 } as const;
const SHIRT = { top: -200, bottom: -108, halfWidth: 46 } as const;
const SHORTS = { top: -114, bottom: -64, halfWidth: 44 } as const;

export class PlayerView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly shirt: Phaser.GameObjects.Graphics;
  /** Sleeves and hanging arms, hidden while a celebration draws the arms in `poseArms`. */
  private readonly restArms: Phaser.GameObjects.Graphics;
  private readonly poseArms: Phaser.GameObjects.Graphics;
  private readonly heart: Phaser.GameObjects.Graphics;
  /** The running celebration: a counter from 0 to 1. */
  private celebration: Phaser.Tweens.Tween | null = null;
  private readonly number: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  /** Raised arms with the cup over the head, shown only after a won cup final (FR-110). */
  private readonly trophy: Phaser.GameObjects.Graphics;
  private shirtColor = 0xffffff;
  private lifting = false;

  constructor(scene: Phaser.Scene, look: Look) {
    this.scene = scene;
    // Children are placed relative to the feet, so a lean turns the player around them.
    const legs = scene.add.graphics();
    // Shoes, socks and knees; mostly below the bottom edge of the screen.
    legs.fillStyle(COLOR.ink, 1);
    legs.fillRect(-36, -12, 28, 12);
    legs.fillRect(8, -12, 28, 12);
    legs.fillStyle(COLOR.chalk, 1);
    legs.fillRect(-35, -44, 26, 32);
    legs.fillRect(9, -44, 26, 32);
    legs.fillStyle(COLOR.skin, 1);
    legs.fillRect(-34, -70, 24, 28);
    legs.fillRect(10, -70, 24, 28);
    // Shorts with a soft fold between the legs.
    legs.fillStyle(COLOR.chalk, 1);
    legs.fillRoundedRect(-SHORTS.halfWidth, SHORTS.top, SHORTS.halfWidth * 2, SHORTS.bottom - SHORTS.top, 8);
    legs.fillStyle(COLOR.chalkShade, 1);
    legs.fillRect(-1.5, SHORTS.top + 22, 3, SHORTS.bottom - SHORTS.top - 22);

    this.restArms = scene.add.graphics();
    this.shirt = scene.add.graphics();
    this.poseArms = scene.add.graphics().setVisible(false);
    this.heart = scene.add.graphics().setPosition(HEART_CENTER.x, HEART_CENTER.y).setVisible(false);
    PlayerView.drawHeartShape(this.heart);
    this.number = scene.add
      .text(0, -146, '', { fontFamily: GAME_FONT, fontStyle: String(GAME_FONT_WEIGHT), fontSize: '54px', color: css(COLOR.ink) })
      .setOrigin(0.5, 0.5);
    this.name = scene.add
      .text(0, -184, '', { fontFamily: GAME_FONT, fontStyle: String(GAME_FONT_WEIGHT), fontSize: '15px', color: css(COLOR.ink) })
      .setOrigin(0.5, 0.5);

    const head = scene.add.graphics();
    head.fillStyle(COLOR.skin, 1);
    // Neck and ears; the face looks at the goal.
    head.fillRect(-12, SHIRT.top - 10, 24, 14);
    head.fillCircle(-HEAD.radius + 1, HEAD.y + 6, 9);
    head.fillCircle(HEAD.radius - 1, HEAD.y + 6, 9);
    head.fillStyle(COLOR.hair, 1);
    head.fillCircle(0, HEAD.y, HEAD.radius);

    this.trophy = scene.add.graphics().setVisible(false);

    this.container = scene.add
      .container(PLAYER_FEET.x, PLAYER_FEET.y, [legs, this.restArms, this.shirt, this.number, this.name, this.poseArms, head, this.heart, this.trophy])
      .setScale(PLAYER_SCALE)
      .setDepth(PLAYER_DEPTH);
    this.setLook(look);
  }

  setLook(look: Look): void {
    const { top, bottom, halfWidth } = SHIRT;
    this.shirtColor = look.shirtColor;
    if (this.lifting) this.drawTrophy();
    this.restArms.clear();
    this.restArms.fillStyle(look.shirtColor, 1);
    // Sleeves, then arms below them, then the body of the shirt over both.
    this.restArms.fillRoundedRect(-BODY.halfWidth, top + 4, 28, 42, 9);
    this.restArms.fillRoundedRect(BODY.halfWidth - 28, top + 4, 28, 42, 9);
    this.restArms.fillStyle(COLOR.skin, 1);
    this.restArms.fillRect(-BODY.halfWidth + 1, top + 42, 12, 46);
    this.restArms.fillRect(BODY.halfWidth - 13, top + 42, 12, 46);
    this.shirt.clear();
    this.shirt.fillStyle(look.shirtColor, 1);
    this.shirt.fillRoundedRect(-halfWidth, top, halfWidth * 2, bottom - top, 12);
    this.number.setText(String(look.shirtNumber));
    this.name.setText(look.shirtName.toUpperCase());
    // Long names are squeezed to the shirt's width.
    this.name.setScale(Math.min(1, (halfWidth * 2 - 10) / Math.max(1, this.name.width)), 1);
    // A dark number and name on light shirts, light ones on dark shirts.
    const c = Phaser.Display.Color.IntegerToColor(look.shirtColor);
    const ink = c.v > 0.6 && c.s < 0.9 ? css(COLOR.ink) : css(COLOR.chalk);
    this.number.setColor(ink);
    this.name.setColor(ink);
  }

  /** One short step toward the ball with a slight lean, then back; the ball does not wait for it (FR-084). */
  kick(): void {
    this.stopCelebration();
    this.scene.tweens.killTweensOf(this.container);
    this.container.setPosition(PLAYER_FEET.x, PLAYER_FEET.y).setRotation(0);
    this.scene.tweens.add({
      targets: this.container,
      x: PLAYER_FEET.x + KICKING.dx,
      rotation: KICKING.lean,
      duration: KICK_STEP_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** True while he holds the cup up. */
  get isLifting(): boolean {
    return this.lifting;
  }

  /**
   * A won cup final (FR-110): he raises both arms with the cup over his head and bobs with joy until `lowerCup()` or a
   * new round.
   */
  liftCup(): void {
    if (this.lifting) return;
    this.stopCelebration();
    this.lifting = true;
    this.drawTrophy();
    this.trophy.setVisible(true);
    this.scene.tweens.killTweensOf(this.container);
    this.container.setPosition(PLAYER_FEET.x, PLAYER_FEET.y).setRotation(0);
    this.scene.tweens.add({ targets: this.container, y: PLAYER_FEET.y - 14, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  lowerCup(): void {
    if (!this.lifting) return;
    this.lifting = false;
    this.trophy.setVisible(false);
    this.scene.tweens.killTweensOf(this.container);
    this.container.setPosition(PLAYER_FEET.x, PLAYER_FEET.y).setRotation(0);
  }

  /** True while a goal celebration plays. */
  get isCelebrating(): boolean {
    return this.celebration !== null;
  }

  /**
   * Plays `celebration` over `durationMs` (FR-114), then stands again. Scene tweens stop while the round is paused, so
   * the celebration waits too.
   */
  celebrate(celebration: Celebration, durationMs: number): void {
    this.stopCelebration();
    if (this.lifting) return;
    this.scene.tweens.killTweensOf(this.container);
    this.celebration = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: durationMs,
      onUpdate: (tween) => this.showPose(poseAt(celebration, tween.getValue() ?? 0)),
      onComplete: () => this.stopCelebration(),
    });
    this.showPose(poseAt(celebration, 0));
  }

  /** Ends a celebration at once (skipped with Enter or a tap, a new shot or a new round) and stands again. */
  stopCelebration(): void {
    const tween = this.celebration;
    this.celebration = null;
    tween?.remove();
    this.poseArms.setVisible(false);
    this.heart.setVisible(false);
    this.restArms.setVisible(true);
    if (!this.lifting) this.container.setPosition(PLAYER_FEET.x, PLAYER_FEET.y).setRotation(0);
  }

  /** Moves and turns the figure around its middle and draws the arms (and the heart) of `pose`. */
  private showPose(pose: CelebrationPose): void {
    const pivot = TURN_CENTER_Y * PLAYER_SCALE;
    const cx = PLAYER_FEET.x + pose.x * PLAYER_SCALE;
    const cy = PLAYER_FEET.y + pose.y * PLAYER_SCALE + pivot;
    this.container.setRotation(pose.turn).setPosition(cx + pivot * Math.sin(pose.turn), cy - pivot * Math.cos(pose.turn));
    this.restArms.setVisible(false);
    const g = this.poseArms.clear().setVisible(true);
    for (const [side, arm] of [
      [-1, pose.left],
      [1, pose.right],
    ] as const) {
      const p = armPoints(side, arm);
      // The sleeve over the upper arm, then the bare forearm and the hand.
      g.lineStyle(26, this.shirtColor, 1);
      g.lineBetween(p.shoulder.x, p.shoulder.y, (p.shoulder.x + p.elbow.x) / 2, (p.shoulder.y + p.elbow.y) / 2);
      g.lineStyle(16, COLOR.skin, 1);
      g.lineBetween((p.shoulder.x + p.elbow.x) / 2, (p.shoulder.y + p.elbow.y) / 2, p.elbow.x, p.elbow.y);
      g.lineBetween(p.elbow.x, p.elbow.y, p.hand.x, p.hand.y);
      g.fillStyle(COLOR.skin, 1);
      g.fillCircle(p.elbow.x, p.elbow.y, 8);
      g.fillCircle(p.hand.x, p.hand.y, 11);
      g.fillStyle(this.shirtColor, 1);
      g.fillCircle(p.shoulder.x, p.shoulder.y, 14);
    }
    this.drawHeart(pose.heart);
  }

  /** The red heart of "Herz" between the hands, at `size` (0 hides it): the shape drawn once, scaled. */
  private drawHeart(size: number): void {
    if (size <= 0.05) {
      this.heart.setVisible(false);
      return;
    }
    this.heart.setScale(size).setVisible(true);
  }

  /** The heart at size 1 around its own origin, which sits at HEART_CENTER. */
  private static drawHeartShape(h: Phaser.GameObjects.Graphics): void {
    const r = 13;
    h.fillStyle(0xe0344a, 1);
    h.fillCircle(-r, 0, r);
    h.fillCircle(r, 0, r);
    h.fillTriangle(-2 * r, r * 0.35, 2 * r, r * 0.35, 0, 2.4 * r);
  }

  /** Both arms up in the shirt's sleeves, the hands on a gold cup above the head. */
  private drawTrophy(): void {
    const g = this.trophy.clear();
    const shoulderY = SHIRT.top + 14;
    const handY = HEAD.y - HEAD.radius - 40;
    for (const side of [-1, 1]) {
      const sx = side * (SHIRT.halfWidth - 8);
      const hx = side * 34;
      g.fillStyle(this.shirtColor, 1);
      g.fillTriangle(sx - 12, shoulderY, sx + 12, shoulderY, (sx + hx) / 2, (shoulderY + handY) / 2);
      g.lineStyle(20, COLOR.skin, 1);
      g.lineBetween((sx + hx) / 2, (shoulderY + handY) / 2, hx, handY);
      g.fillStyle(COLOR.skin, 1);
      g.fillCircle(hx, handY, 12);
    }
    // The cup: a bowl with two handles on a stem and a base.
    const gold = COLOR.gold;
    const shade = 0xc9971a;
    const top = handY - 70;
    g.lineStyle(8, gold, 1);
    g.strokeCircle(-44, top + 26, 16);
    g.strokeCircle(44, top + 26, 16);
    g.fillStyle(gold, 1);
    g.fillRoundedRect(-40, top, 80, 58, { tl: 6, tr: 6, bl: 36, br: 36 });
    g.fillStyle(shade, 1);
    g.fillRect(-9, top + 56, 18, 22);
    g.fillRoundedRect(-30, top + 76, 60, 14, 4);
    g.fillStyle(0xffffff, 0.45);
    g.fillRoundedRect(-28, top + 8, 12, 34, 5);
  }

  destroy(): void {
    this.stopCelebration();
    this.container.destroy();
  }
}

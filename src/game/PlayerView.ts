/**
 * The child's player, seen from behind (FR-001, amendment 08): hair, a shirt in the shirt color with the name and the
 * shirt number on the back, shorts and the top of the legs. He stands to the lower left of the ball, drawn larger than
 * the keeper because he is closer to the viewer, and the bottom edge of the screen cuts off his lower legs. Where he
 * stands and how large he is comes from src/game/playerPose.ts; his head stays below the chart (FR-056, FR-083).
 * `kick()` takes one short step toward the ball and back (FR-084).
 * Drawn with shapes in code (FR-048); the locker room (US6) changes the shirt color, the number and the name above it
 * with `setLook`.
 */
import Phaser from 'phaser';
import type { Look } from '../core/rewards/lockerRoom';
import { GAME_FONT, GAME_FONT_WEIGHT } from '../assets';
import { COLOR, css } from './palette';
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
  private readonly number: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;

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
    legs.fillStyle(0xc4c9bd, 1);
    legs.fillRect(-1.5, SHORTS.top + 22, 3, SHORTS.bottom - SHORTS.top - 22);

    this.shirt = scene.add.graphics();
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

    this.container = scene.add
      .container(PLAYER_FEET.x, PLAYER_FEET.y, [legs, this.shirt, this.number, this.name, head])
      .setScale(PLAYER_SCALE)
      .setDepth(PLAYER_DEPTH);
    this.setLook(look);
  }

  setLook(look: Look): void {
    const { top, bottom, halfWidth } = SHIRT;
    this.shirt.clear();
    this.shirt.fillStyle(look.shirtColor, 1);
    // Sleeves, then arms below them, then the body of the shirt over both.
    this.shirt.fillRoundedRect(-BODY.halfWidth, top + 4, 28, 42, 9);
    this.shirt.fillRoundedRect(BODY.halfWidth - 28, top + 4, 28, 42, 9);
    this.shirt.fillStyle(COLOR.skin, 1);
    this.shirt.fillRect(-BODY.halfWidth + 1, top + 42, 12, 46);
    this.shirt.fillRect(BODY.halfWidth - 13, top + 42, 12, 46);
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

  destroy(): void {
    this.container.destroy();
  }
}

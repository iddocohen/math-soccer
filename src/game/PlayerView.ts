/**
 * The child's player, seen from behind (FR-001): hair, a shirt in the shirt color with the shirt number on the back,
 * shorts and legs, standing left of the ball at the kick spot, below the goal line and clear of the chart (FR-056). `kick()` leans the player toward the ball for a moment.
 * Drawn with shapes in code (FR-048); the locker room (US6) changes the shirt color, the number and the name above it
 * with `setLook`.
 */
import Phaser from 'phaser';
import { KICK_SPOT } from '../core/match/world';
import type { Look } from '../core/rewards/lockerRoom';
import { COLOR, css } from './palette';

export const PLAYER_DEPTH = 6;

/** The player's feet, left of the ball, below the goal line. */
const FEET = { x: KICK_SPOT.x - 70, y: KICK_SPOT.y + 50 } as const;
/**
 * The player is drawn at this size, so his head (about 200 px above the feet at full size) stays below y 820 and never
 * covers a chart square (FR-056).
 */
const SCALE = 0.8;
const SHIRT = { width: 74, height: 84 } as const;

export class PlayerView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly shirt: Phaser.GameObjects.Graphics;
  private readonly number: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, look: Look) {
    this.scene = scene;
    // Children are placed relative to the feet, so a lean rotates the player around them.
    const legs = scene.add.graphics();
    legs.fillStyle(COLOR.skin, 1);
    legs.fillRect(-30, -40, 22, 40);
    legs.fillRect(8, -40, 22, 40);
    legs.fillStyle(COLOR.chalk, 1);
    legs.fillRect(-34, -72, 30, 36);
    legs.fillRect(4, -72, 30, 36);
    legs.fillStyle(COLOR.ink, 1);
    legs.fillRect(-32, -8, 26, 8);
    legs.fillRect(6, -8, 26, 8);

    this.shirt = scene.add.graphics();
    this.number = scene.add
      .text(0, -72 - SHIRT.height / 2 + 4, '', { fontFamily: 'system-ui, sans-serif', fontStyle: '800', fontSize: '38px', color: css(COLOR.ink) })
      .setOrigin(0.5, 0.5);
    this.name = scene.add
      .text(0, -72 - SHIRT.height + 14, '', { fontFamily: 'system-ui, sans-serif', fontStyle: '800', fontSize: '13px', color: css(COLOR.ink) })
      .setOrigin(0.5, 0.5);

    const head = scene.add.graphics();
    head.fillStyle(COLOR.skin, 1);
    head.fillCircle(-40, -72 - SHIRT.height + 40, 8);
    head.fillCircle(40, -72 - SHIRT.height + 40, 8);
    head.fillStyle(COLOR.hair, 1);
    head.fillCircle(0, -72 - SHIRT.height - 20, 25);

    this.container = scene.add.container(FEET.x, FEET.y, [legs, this.shirt, this.number, this.name, head]).setScale(SCALE).setDepth(PLAYER_DEPTH);
    this.setLook(look);
  }

  setLook(look: Look): void {
    this.shirt.clear();
    this.shirt.fillStyle(look.shirtColor, 1);
    this.shirt.fillRoundedRect(-SHIRT.width / 2, -72 - SHIRT.height, SHIRT.width, SHIRT.height, 12);
    // Sleeves.
    this.shirt.fillRect(-SHIRT.width / 2 - 10, -72 - SHIRT.height + 4, 14, 30);
    this.shirt.fillRect(SHIRT.width / 2 - 4, -72 - SHIRT.height + 4, 14, 30);
    this.number.setText(String(look.shirtNumber));
    this.name.setText(look.shirtName.toUpperCase());
    // Long names are squeezed to the shirt's width.
    this.name.setScale(Math.min(1, (SHIRT.width - 8) / Math.max(1, this.name.width)), 1);
    // A dark number and name on light shirts, light ones on dark shirts.
    const c = Phaser.Display.Color.IntegerToColor(look.shirtColor);
    const ink = c.v > 0.6 && c.s < 0.9 ? css(COLOR.ink) : css(COLOR.chalk);
    this.number.setColor(ink);
    this.name.setColor(ink);
  }

  /** Leans toward the ball and back. */
  kick(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setRotation(0);
    this.scene.tweens.add({ targets: this.container, rotation: 0.18, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }

  destroy(): void {
    this.container.destroy();
  }
}

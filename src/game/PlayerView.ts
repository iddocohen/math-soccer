/**
 * The child's player, seen from behind (FR-001): hair, a shirt in the shirt color with the shirt number on the back,
 * shorts and legs, standing left of the ball at the kick spot. `kick()` leans the player toward the ball for a moment.
 * Drawn with shapes in code (FR-048); the locker room (US6) changes the color and number with `setLook`.
 */
import Phaser from 'phaser';
import { KICK_SPOT } from '../core/match/world';
import { COLOR, type Look } from './palette';

export const PLAYER_DEPTH = 6;

/** The player's feet, left of the ball. */
const FEET = { x: KICK_SPOT.x - 70, y: KICK_SPOT.y + 30 } as const;
const SHIRT = { width: 74, height: 84 } as const;

export class PlayerView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly shirt: Phaser.GameObjects.Graphics;
  private readonly number: Phaser.GameObjects.Text;
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
      .text(0, -72 - SHIRT.height / 2 + 4, '', { fontFamily: 'system-ui, sans-serif', fontStyle: '800', fontSize: '38px', color: '#12202c' })
      .setOrigin(0.5, 0.5);

    const head = scene.add.graphics();
    head.fillStyle(COLOR.skin, 1);
    head.fillCircle(-40, -72 - SHIRT.height + 40, 8);
    head.fillCircle(40, -72 - SHIRT.height + 40, 8);
    head.fillStyle(COLOR.hair, 1);
    head.fillCircle(0, -72 - SHIRT.height - 20, 25);

    this.container = scene.add.container(FEET.x, FEET.y, [legs, this.shirt, this.number, head]).setDepth(PLAYER_DEPTH);
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
    // A dark number on light shirts, a light number on dark shirts.
    const c = Phaser.Display.Color.IntegerToColor(look.shirtColor);
    this.number.setColor(c.v > 0.6 && c.s < 0.9 ? '#12202c' : '#f4f6ef');
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

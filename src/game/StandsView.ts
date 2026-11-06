/**
 * The fans in the stands behind the goal (FR-001, FR-021, FR-022), drawn after the prototype
 * (specs/001-math-soccer/prototype/index.html): four rows of small fans in the distance.
 *
 * - Idle: every fan sways a little, each at its own pace.
 * - `cheer()` (a goal): the fans stand up, jump, raise their arms, and every third fan waves a scarf in the scarf
 *   color. It fades out over CHEER_MS.
 * - `ohh()` (a miss): the fans slump softly for OHH_MS, then clap.
 * - `clap()`: the fans clap for CLAP_MS, arms raised in front of them.
 *
 * The fans move only in `update`, which the scene calls every frame; a paused scene does not call it, so the fans stop.
 * The sounds come from src/audio/sfx.ts, not from this view.
 */
import Phaser from 'phaser';
import { WORLD_WIDTH } from '../core/match/world';
import { itemById } from '../core/rewards/items';
import { FAN_ARMS_SIZE, FAN_HEAD_SIZE, FAN_SIZE, SCARF_SIZE, TEX } from './textures';

/** How long the cheer, the slump and the clapping last, in milliseconds of game time. */
export const CHEER_MS = 1600;
export const OHH_MS = 900;
export const CLAP_MS = 1300;

const ROWS = 4;
const ROW_TOP = 60;
const ROW_GAP = 48;
const FAN_GAP = 34;
const SCALE = 1.6;
/** Fan shirts in the locker room's shirt colors. */
const SHIRTS = ['shirt.red', 'shirt.blue', 'shirt.yellow', 'shirt.white', 'shirt.green'].map((id) => itemById(id)!.color!);

interface Fan {
  x: number;
  /** Where the bottom of the shirt rests. */
  y: number;
  /** Each fan's own offset, so the crowd does not move in step. */
  phase: number;
  body: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  arms: Phaser.GameObjects.Image;
  scarf: Phaser.GameObjects.Image | null;
}

export class StandsView {
  private readonly fans: Fan[] = [];
  /** Game time in seconds, for the sway and the jumps. */
  private time = 0;
  /** 1 right after the event, down to 0 when it is over. */
  private cheering = 0;
  private slumping = 0;
  private clapping = 0;

  constructor(scene: Phaser.Scene, scarfColor: number, depth = 1) {
    const perRow = Math.ceil(WORLD_WIDTH / FAN_GAP) + 1;
    for (let row = 0; row < ROWS; row++) {
      // Back rows first, so the front rows cover them.
      const y = ROW_TOP + row * ROW_GAP + 36;
      for (let i = 0; i < perRow; i++) {
        const x = 10 + i * FAN_GAP + (row % 2) * (FAN_GAP / 2);
        const seed = (i * 7 + row * 13) % SHIRTS.length;
        const shirt = SHIRTS[seed]!;
        const body = scene.add.image(x, y, TEX.fan).setOrigin(0.5, 1).setScale(SCALE).setTint(shirt).setDepth(depth);
        const head = scene.add.image(x, y, TEX.fanHead).setOrigin(0.5, 1).setScale(SCALE).setDepth(depth);
        const arms = scene.add.image(x, y, TEX.fanArms).setOrigin(0.5, 1).setScale(SCALE).setTint(shirt).setDepth(depth).setVisible(false);
        const scarf =
          seed === 2 || seed === 4
            ? scene.add.image(x, y, TEX.scarf).setScale(SCALE * 0.9).setTint(scarfColor).setDepth(depth).setVisible(false)
            : null;
        this.fans.push({ x, y, phase: i * 0.7 + row * 1.3, body, head, arms, scarf });
      }
    }
    this.update(0);
  }

  /** The scarves in a new color (the locker room's scarf color). */
  setScarfColor(color: number): void {
    for (const fan of this.fans) fan.scarf?.setTint(color);
  }

  cheer(): void {
    this.cheering = 1;
    this.slumping = 0;
    this.clapping = 0;
  }

  /** A soft slump, then clapping. */
  ohh(): void {
    this.slumping = 1;
    this.cheering = 0;
    this.clapping = 0;
  }

  clap(): void {
    this.clapping = 1;
    this.slumping = 0;
  }

  /** Back to idle at once, for a new round. */
  calm(): void {
    this.cheering = 0;
    this.slumping = 0;
    this.clapping = 0;
    this.update(0);
  }

  /** Moves every fan; `deltaMs` is the game time since the last frame. */
  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.time += dt;
    this.cheering = Math.max(0, this.cheering - deltaMs / CHEER_MS);
    if (this.slumping > 0) {
      this.slumping = Math.max(0, this.slumping - deltaMs / OHH_MS);
      // The clapping follows the "ohhh", as the sound does.
      if (this.slumping === 0) this.clapping = 1;
    } else {
      this.clapping = Math.max(0, this.clapping - deltaMs / CLAP_MS);
    }

    const t = this.time;
    const bodyHeight = FAN_SIZE.height * SCALE;
    const headSize = FAN_HEAD_SIZE * SCALE;
    for (const fan of this.fans) {
      const sway = Math.sin(t * 1.4 + fan.phase) * 1.5;
      const jump = this.cheering > 0 ? Math.abs(Math.sin(t * 11 + fan.phase)) * 18 * this.cheering : 0;
      // Standing up on a cheer, slumping on an "ohhh".
      const stand = this.cheering > 0 ? 6 * Math.min(1, this.cheering * 3) : 0;
      const slump = 5 * this.slumping;
      const x = fan.x + sway;
      const bottom = fan.y - jump - stand + slump;
      fan.body.setPosition(x, bottom).setScale(SCALE, SCALE * (1 - 0.15 * this.slumping));
      const shoulders = bottom - fan.body.displayHeight;
      fan.head.setPosition(x, shoulders + 1);

      const armsUp = this.cheering > 0.05;
      const clapsNow = !armsUp && this.clapping > 0.05;
      fan.arms.setVisible(armsUp || clapsNow);
      if (armsUp) {
        fan.arms.setPosition(x, shoulders + bodyHeight * 0.4).setScale(SCALE, SCALE);
      } else if (clapsNow) {
        // Hands together in front of the chest, beating quickly.
        const beat = Math.abs(Math.sin(t * 22 + fan.phase)) * 3;
        fan.arms.setPosition(x, shoulders + bodyHeight * 0.6 - beat).setScale(SCALE * 0.5, SCALE * 0.6);
      }

      if (fan.scarf) {
        const waving = this.cheering > 0.05;
        fan.scarf.setVisible(waving);
        if (waving) {
          const lift = FAN_ARMS_SIZE.height * SCALE + headSize * 0.2;
          fan.scarf.setPosition(x, shoulders - lift + SCARF_SIZE.height).setRotation(Math.sin(t * 9 + fan.phase) * 0.35);
        }
      }
    }
  }

  destroy(): void {
    for (const fan of this.fans) {
      fan.body.destroy();
      fan.head.destroy();
      fan.arms.destroy();
      fan.scarf?.destroy();
    }
    this.fans.length = 0;
  }
}

/**
 * The fans in the stands behind the goal (FR-001, FR-021, FR-022), drawn after the prototype
 * (specs/001-math-soccer/prototype/index.html): four rows of small fans in the distance.
 *
 * - Idle: every fan sways a little, each at its own pace.
 * - `cheer()` (a goal): the fans stand up, jump, raise their arms, and every third fan waves a scarf in the scarf
 *   color. It fades out over CHEER_MS.
 * - `ohh()` (a miss): the fans slump softly for OHH_MS, then clap.
 *
 * - Cup (amendment 13): `setTeamColor()` gives some scarves the opponent's color (FR-107). `setFinal()` fills the stand
 *   with extra fans and keeps the scarves up for the final, and `chant()` makes the fans clap on the chant's beat (FR-110).
 *
 * The fans move only in `update`, which the scene calls every frame; a paused scene does not call it, so the fans stop.
 * The sounds come from src/audio/sfx.ts, not from this view.
 */
import Phaser from 'phaser';
import { WORLD_WIDTH } from '../core/match/world';
import { CHANT_BEAT_SECONDS } from '../core/cup/chant';
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

/** The beat of the stands' clapping during the final's chant, as the chant's sound (core/cup/chant.ts). */
const CHANT_BEAT_MS = CHANT_BEAT_SECONDS * 1000;

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
  /** A scarf in the cup opponent's color instead of the child's (FR-107). */
  away: boolean;
  /** One of the extra fans that fill the stand in the cup final (FR-110); hidden otherwise. */
  extra: boolean;
}

export class StandsView {
  private readonly fans: Fan[] = [];
  /** Game time in seconds, for the sway and the jumps. */
  private time = 0;
  /** 1 right after the event, down to 0 when it is over. */
  private cheering = 0;
  private slumping = 0;
  private clapping = 0;
  /** Whether the arms and the scarves show now; their visibility changes only when these change. */
  private armsShown = false;
  private scarvesShown = false;
  private scarfColor: number;
  private teamColor: number | null = null;
  /** The cup final: a full stand, and the scarves stay up (FR-110). */
  private final = false;
  /** Game time left of the chant's clapping, in milliseconds. */
  private chantLeft = 0;

  constructor(scene: Phaser.Scene, scarfColor: number, depth = 1) {
    this.scarfColor = scarfColor;
    const perRow = Math.ceil(WORLD_WIDTH / FAN_GAP) + 1;
    for (let row = 0; row < ROWS; row++) {
      // Back rows first, so the front rows cover them.
      const y = ROW_TOP + row * ROW_GAP + 36;
      // The extra fans of the final stand between the others, a little lower, so the stand looks full.
      for (const extra of [false, true]) {
        for (let i = 0; i < perRow; i++) {
          const x = 10 + i * FAN_GAP + (row % 2) * (FAN_GAP / 2) + (extra ? FAN_GAP / 2 : 0);
          const seed = (i * 7 + row * 13 + (extra ? 3 : 0)) % SHIRTS.length;
          const shirt = SHIRTS[seed]!;
          const fy = y + (extra ? 8 : 0);
          const d = depth + (extra ? 0.01 : 0);
          const body = scene.add.image(x, fy, TEX.fan).setOrigin(0.5, 1).setScale(SCALE).setTint(shirt).setDepth(d).setVisible(!extra);
          const head = scene.add.image(x, fy, TEX.fanHead).setOrigin(0.5, 1).setScale(SCALE).setDepth(d).setVisible(!extra);
          const arms = scene.add.image(x, fy, TEX.fanArms).setOrigin(0.5, 1).setScale(SCALE).setTint(shirt).setDepth(d).setVisible(false);
          const scarf =
            seed === 2 || seed === 4
              ? scene.add.image(x, fy, TEX.scarf).setScale(SCALE * 0.9).setTint(scarfColor).setDepth(d).setVisible(false)
              : null;
          this.fans.push({ x, y: fy, phase: i * 0.7 + row * 1.3 + (extra ? 0.4 : 0), body, head, arms, scarf, away: seed === 4, extra });
        }
      }
    }
    this.update(0);
  }

  /** The scarves in a new color (the locker room's scarf color). */
  setScarfColor(color: number): void {
    this.scarfColor = color;
    this.tintScarves();
  }

  /**
   * In a cup match, some scarves show the opponent's color (FR-107); null gives every scarf the child's color again.
   */
  setTeamColor(color: number | null): void {
    if (color === this.teamColor) return;
    this.teamColor = color;
    this.tintScarves();
  }

  private tintScarves(): void {
    for (const fan of this.fans) fan.scarf?.setTint(fan.away && this.teamColor !== null ? this.teamColor : this.scarfColor);
  }

  /** The cup final (FR-110): the extra fans fill the stand and the scarves stay up; false for every other match. */
  setFinal(final: boolean): void {
    if (final === this.final) return;
    this.final = final;
    for (const fan of this.fans) {
      if (!fan.extra) continue;
      fan.body.setVisible(final);
      fan.head.setVisible(final);
      if (!final) {
        fan.arms.setVisible(false);
        fan.scarf?.setVisible(false);
      }
    }
    // Arms and scarves are shown again on the next update with the new crowd.
    this.armsShown = false;
    this.scarvesShown = false;
    for (const fan of this.fans) {
      fan.arms.setVisible(false);
      fan.scarf?.setVisible(false);
    }
    this.update(0);
  }

  /** True while the stand is full for the final. */
  get isFinal(): boolean {
    return this.final;
  }

  /** The fans clap on the chant's beat for `ms` of game time (FR-110). */
  chant(ms: number): void {
    this.chantLeft = ms;
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

  /** Back to idle at once, for a new round. */
  calm(): void {
    this.cheering = 0;
    this.slumping = 0;
    this.clapping = 0;
    this.chantLeft = 0;
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
    this.chantLeft = Math.max(0, this.chantLeft - deltaMs);

    const t = this.time;
    const bodyHeight = FAN_SIZE.height * SCALE;
    const headSize = FAN_HEAD_SIZE * SCALE;
    const bodyScaleY = SCALE * (1 - 0.15 * this.slumping);
    // The body image's displayed height, without reading it from every fan.
    const bodyShown = bodyScaleY * FAN_SIZE.height;
    const armsUp = this.cheering > 0.05;
    const chanting = this.chantLeft > 0;
    const clapsNow = !armsUp && (this.clapping > 0.05 || chanting);
    // In the final the scarves stay up all match long (FR-110).
    const waving = this.cheering > 0.05 || this.final;
    if ((armsUp || clapsNow) !== this.armsShown) {
      this.armsShown = armsUp || clapsNow;
      for (const fan of this.fans) if (this.final || !fan.extra) fan.arms.setVisible(this.armsShown);
    }
    if (waving !== this.scarvesShown) {
      this.scarvesShown = waving;
      for (const fan of this.fans) if (this.final || !fan.extra) fan.scarf?.setVisible(waving);
    }
    // The chant's claps land on its beat, so the stands and the sound clap together.
    const chantBeat = chanting ? Math.max(0, 1 - ((this.time * 1000) % CHANT_BEAT_MS) / (CHANT_BEAT_MS * 0.4)) * 4 : 0;
    for (const fan of this.fans) {
      if (fan.extra && !this.final) continue;
      const sway = Math.sin(t * 1.4 + fan.phase) * 1.5;
      const jump = this.cheering > 0 ? Math.abs(Math.sin(t * 11 + fan.phase)) * 18 * this.cheering : 0;
      // Standing up on a cheer, slumping on an "ohhh".
      const stand = this.cheering > 0 ? 6 * Math.min(1, this.cheering * 3) : 0;
      const slump = 5 * this.slumping;
      const x = fan.x + sway;
      const bottom = fan.y - jump - stand + slump;
      fan.body.setPosition(x, bottom).setScale(SCALE, bodyScaleY);
      const shoulders = bottom - bodyShown;
      fan.head.setPosition(x, shoulders + 1);

      if (armsUp) {
        fan.arms.setPosition(x, shoulders + bodyHeight * 0.4).setScale(SCALE, SCALE);
      } else if (clapsNow) {
        // Hands together in front of the chest, beating quickly.
        const beat = chanting ? chantBeat : Math.abs(Math.sin(t * 22 + fan.phase)) * 3;
        fan.arms.setPosition(x, shoulders + bodyHeight * 0.6 - beat).setScale(SCALE * 0.5, SCALE * 0.6);
      }

      if (fan.scarf && waving) {
        const lift = FAN_ARMS_SIZE.height * SCALE + headSize * 0.2;
        // A cheer waves the scarves fast; in the final they sway slowly between the cheers.
        const speed = this.cheering > 0.05 ? 9 : 2;
        fan.scarf.setPosition(x, shoulders - lift + SCARF_SIZE.height).setRotation(Math.sin(t * speed + fan.phase) * 0.35);
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

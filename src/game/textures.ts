// Structure adapted from math-tank src/game/textures.ts; the shapes follow specs/001-math-soccer/prototype/index.html.
/**
 * Generated textures (research R2, FR-048): these shapes are drawn in code (the grass and the classic soccer ball are
 * image files since amendment 03, loaded by MatchScene; the drawn soccer ball stays as their fallback). Shirts, scarves
 * and the keeper's kit are drawn white and tinted by the views, so the locker room can recolor them at no cost.
 */
import Phaser from 'phaser';
import type { BallKind } from '../core/chart/layout';
import { COLOR } from './palette';

export const TEX = {
  ball: { soccer: 'ball-soccer', tennis: 'ball-tennis', pingpong: 'ball-pingpong' } satisfies Record<BallKind, string>,
  player: 'player',
  keeper: 'keeper',
  fan: 'fan',
  fanHead: 'fan-head',
  fanArms: 'fan-arms',
  scarf: 'scarf',
} as const;

/** Ball texture sizes in world pixels at the kick spot; the ball view scales it down along the flight. */
export const BALL_SIZE: Record<BallKind, number> = { soccer: 40, tennis: 30, pingpong: 24 };
export const PLAYER_SIZE = { width: 64, height: 112 } as const;
export const KEEPER_SIZE = { width: 120, height: 110 } as const;
export const FAN_SIZE = { width: 16, height: 14 } as const;
export const FAN_HEAD_SIZE = 12;
export const FAN_ARMS_SIZE = { width: 26, height: 18 } as const;
export const SCARF_SIZE = { width: 32, height: 6 } as const;

const WHITE = 0xffffff;

/** Creates any texture that does not exist yet; safe to call from every scene start. */
export function ensureTextures(scene: Phaser.Scene): void {
  const make = (key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  };

  make(TEX.ball.soccer, BALL_SIZE.soccer, BALL_SIZE.soccer, (g) => {
    const r = BALL_SIZE.soccer / 2;
    g.fillStyle(WHITE, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(COLOR.ink, 1);
    g.fillCircle(r, r, r * 0.35);
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      g.fillCircle(r + Math.cos(a) * r * 0.75, r + Math.sin(a) * r * 0.75, r * 0.18);
    }
  });

  make(TEX.ball.tennis, BALL_SIZE.tennis, BALL_SIZE.tennis, (g) => {
    const r = BALL_SIZE.tennis / 2;
    g.fillStyle(0xd4e157, 1);
    g.fillCircle(r, r, r);
    g.lineStyle(2, WHITE, 1);
    g.beginPath();
    g.arc(-r * 0.2, r, r * 0.9, -Math.PI / 3, Math.PI / 3);
    g.strokePath();
    g.beginPath();
    g.arc(r * 2.2, r, r * 0.9, (2 * Math.PI) / 3, (4 * Math.PI) / 3);
    g.strokePath();
  });

  make(TEX.ball.pingpong, BALL_SIZE.pingpong, BALL_SIZE.pingpong, (g) => {
    const r = BALL_SIZE.pingpong / 2;
    g.fillStyle(0xf28c28, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(WHITE, 0.5);
    g.fillCircle(r * 0.7, r * 0.7, r * 0.3);
  });

  // The player from behind: head, white shirt (tinted), white shorts and legs. The number is drawn by the view.
  make(TEX.player, PLAYER_SIZE.width, PLAYER_SIZE.height, (g) => {
    const cx = PLAYER_SIZE.width / 2;
    g.fillStyle(COLOR.hair, 1);
    g.fillCircle(cx, 18, 17);
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(cx - 26, 34, 52, 50, 8);
    g.fillStyle(0xdfe4e8, 1);
    g.fillRect(cx - 22, 84, 18, 26);
    g.fillRect(cx + 4, 84, 18, 26);
  });

  // The keeper facing the player: head, white jersey (tinted), dark shorts, yellow gloves out to the sides.
  make(TEX.keeper, KEEPER_SIZE.width, KEEPER_SIZE.height, (g) => {
    const cx = KEEPER_SIZE.width / 2;
    g.fillStyle(COLOR.skin, 1);
    g.fillCircle(cx, 16, 15);
    g.fillStyle(WHITE, 1);
    g.fillRect(cx - 22, 31, 44, 48);
    g.fillRect(cx - 44, 36, 22, 10);
    g.fillRect(cx + 22, 36, 22, 10);
    g.fillStyle(COLOR.ink, 1);
    g.fillRect(cx - 20, 79, 16, 30);
    g.fillRect(cx + 4, 79, 16, 30);
    g.fillStyle(COLOR.kit, 1);
    g.fillRect(cx - 58, 32, 16, 16);
    g.fillRect(cx + 42, 32, 16, 16);
  });

  // A fan in the stands is three images, so only the shirt and the arms take the fan's color: the white shirt
  // (tinted per fan), the head, and two raised arms in sleeves (tinted like the shirt) for cheering and clapping.
  make(TEX.fan, FAN_SIZE.width, FAN_SIZE.height, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(1, 0, FAN_SIZE.width - 2, FAN_SIZE.height, 3);
  });

  make(TEX.fanHead, FAN_HEAD_SIZE, FAN_HEAD_SIZE, (g) => {
    g.fillStyle(COLOR.skin, 1);
    g.fillCircle(FAN_HEAD_SIZE / 2, FAN_HEAD_SIZE / 2, FAN_HEAD_SIZE / 2);
  });

  make(TEX.fanArms, FAN_ARMS_SIZE.width, FAN_ARMS_SIZE.height, (g) => {
    const { width: w, height: h } = FAN_ARMS_SIZE;
    g.lineStyle(4, WHITE, 1);
    g.beginPath();
    g.moveTo(6, h);
    g.lineTo(2, 2);
    g.moveTo(w - 6, h);
    g.lineTo(w - 2, 2);
    g.strokePath();
  });

  // A scarf held up by cheering fans (tinted in the scarf color).
  make(TEX.scarf, SCARF_SIZE.width, SCARF_SIZE.height, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRect(0, 0, SCARF_SIZE.width, SCARF_SIZE.height);
    g.fillStyle(0xcccccc, 1);
    for (let x = 4; x < SCARF_SIZE.width; x += 8) g.fillRect(x, 0, 4, SCARF_SIZE.height);
  });
}

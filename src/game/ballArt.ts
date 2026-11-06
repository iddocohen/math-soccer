/**
 * The ball designs of the locker room (FR-043), drawn in code (FR-048). Every design comes in the three ball kinds:
 * the kind sets the size (BALL_SIZE), the design sets the colors and the pattern. The classic design keeps the look of
 * each kind: a black and white soccer ball, a yellow tennis ball, an orange ping-pong ball (textures.ts).
 *
 * `ballTexture` is the only way the scene gets a ball picture, so a recorded sprite can replace a drawn design here
 * later without changes to BallView.
 */
import Phaser from 'phaser';
import type { BallKind } from '../core/chart/layout';
import { BALL_COLORS, type BallDesign } from '../core/rewards/items';
import { BALL_SIZE, TEX } from './textures';

const WHITE = 0xffffff;

/** The texture key of a ball design in a ball kind; the texture is drawn the first time it is asked for. */
export function ballTexture(scene: Phaser.Scene, design: BallDesign, kind: BallKind): string {
  if (design === 'classic') return TEX.ball[kind];
  const key = `ball-${design}-${kind}`;
  if (scene.textures.exists(key)) return key;
  const size = BALL_SIZE[kind];
  const g = scene.make.graphics({}, false);
  drawDesign(g, design, size / 2);
  g.generateTexture(key, size, size);
  g.destroy();
  return key;
}

/** Five patches around a center patch, as on a soccer ball. */
function patches(g: Phaser.GameObjects.Graphics, r: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(r, r, r * 0.33);
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    g.fillCircle(r + Math.cos(a) * r * 0.75, r + Math.sin(a) * r * 0.75, r * 0.17);
  }
}

/** A five-pointed star around (x, y). */
function star(g: Phaser.GameObjects.Graphics, x: number, y: number, outer: number): void {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const d = i % 2 === 0 ? outer : outer * 0.45;
    points.push(new Phaser.Math.Vector2(x + Math.cos(a) * d, y + Math.sin(a) * d));
  }
  g.fillPoints(points, true);
}

function drawDesign(g: Phaser.GameObjects.Graphics, design: Exclude<BallDesign, 'classic'>, r: number): void {
  switch (design) {
    case 'blue':
      g.fillStyle(BALL_COLORS.blue.fill, 1);
      g.fillCircle(r, r, r);
      patches(g, r, BALL_COLORS.blue.mark);
      return;
    case 'stars':
      g.fillStyle(BALL_COLORS.stars.fill, 1);
      g.fillCircle(r, r, r);
      g.fillStyle(BALL_COLORS.stars.mark, 1);
      star(g, r, r, r * 0.42);
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2 + Math.PI / 5;
        star(g, r + Math.cos(a) * r * 0.7, r + Math.sin(a) * r * 0.7, r * 0.2);
      }
      return;
    case 'gold':
      g.fillStyle(BALL_COLORS.gold.fill, 1);
      g.fillCircle(r, r, r);
      g.fillStyle(0xf7d560, 1);
      g.fillCircle(r * 0.85, r * 0.85, r * 0.7);
      patches(g, r, BALL_COLORS.gold.mark);
      g.fillStyle(WHITE, 0.7);
      g.fillCircle(r * 0.6, r * 0.55, r * 0.15);
      return;
    case 'flames':
      g.fillStyle(BALL_COLORS.flames.fill, 1);
      g.fillCircle(r, r, r);
      // Three flame tongues from the bottom, red outside, orange and yellow inside.
      for (const [color, scale] of [
        [0xd8432b, 1],
        [BALL_COLORS.flames.mark, 0.7],
        [0xffd23f, 0.42],
      ] as const) {
        g.fillStyle(color, 1);
        for (const dx of [-0.5, 0, 0.5]) {
          const x = r + dx * r * 1.1;
          g.fillTriangle(x - r * 0.38 * scale, r * 1.85, x + r * 0.38 * scale, r * 1.85, x, r * (1.85 - 1.3 * scale - (dx === 0 ? 0.25 : 0)));
        }
      }
      return;
    case 'rainbow': {
      const bands = [BALL_COLORS.rainbow.fill, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6];
      bands.forEach((color, i) => {
        g.fillStyle(color, 1);
        g.fillCircle(r, r, r * (1 - i / bands.length));
      });
      g.fillStyle(WHITE, 1);
      g.fillCircle(r, r, r / bands.length);
      return;
    }
  }
}

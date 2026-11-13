/**
 * The ball trail and the goal effect in the match (amendment 20, FR-134, FR-137). The looks come from effects.ts and
 * the motion from particles.ts; this file only draws them with Phaser images.
 *
 * - The shapes are generated textures. The particle images of amendment 22 (FR-149) are bundled files that the scene
 *   loads in its preload (`loadParticleImages`); a particle with an image draws it, tinted, and falls back to its
 *   shape when the file did not load.
 *
 * - Each layer is a ParticlePool of images: an image is made the first time its slot is used and is reused for every
 *   later particle, so a shot or a goal makes no new objects after the first ones.
 * - The scene moves both views on in its update() with the frame time, and not while the round is paused, so a paused
 *   round holds the trail and the effect where they are.
 * - TrailView spawns particles along the path the ball took in the last frame, each as old as the moment it stands
 *   for, so the trail has no gaps and fades evenly even when frames are slow. It sits just under the ball, so it is
 *   drawn behind it.
 */
import Phaser from 'phaser';
import type { GoalEffect, Trail } from '../core/rewards/items';
import { assetUrl, PARTICLE_FILES } from '../assets';
import { BEAM_SIZE, EFFECT_CAPACITY, goalEffectParticles, imageScale, PARTICLE_TEXTURE_SIZE, PIECE_SIZE, TRAIL_CAPACITY, trailCount, trailParticle } from './effects';
import { CONFETTI_DEPTH, FIREWORKS_DEPTH } from './FinalShow';
import { ParticlePool, type ParticleImage, type ParticleShape } from './particles';

const KEY: Record<ParticleShape, string> = { dot: 'fx-dot', star: 'fx-star', piece: 'fx-piece', beam: 'fx-beam' };
const IMAGE_KEY: Record<ParticleImage, string> = {
  twinkle: 'fx-img-twinkle',
  star: 'fx-img-star',
  sparkle: 'fx-img-sparkle',
  fire: 'fx-img-fire',
  flare: 'fx-img-flare',
  light: 'fx-img-light',
};

/** Queues the particle images (amendment 22) that are not loaded yet; call it in the scene's preload. */
export function loadParticleImages(scene: Phaser.Scene): void {
  for (const [image, key] of Object.entries(IMAGE_KEY) as [ParticleImage, string][]) {
    if (!scene.textures.exists(key)) scene.load.image(key, assetUrl(PARTICLE_FILES[image]));
  }
}

/** Creates the particle textures that do not exist yet: a soft dot, a star, a confetti piece and a light beam. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  const paint = (key: string, width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) return;
    draw(texture.getContext());
    texture.refresh();
  };
  const S = PARTICLE_TEXTURE_SIZE;
  paint(KEY.dot, S, S, (g) => {
    const glow = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    glow.addColorStop(0, 'rgb(255 255 255 / 100%)');
    glow.addColorStop(0.45, 'rgb(255 255 255 / 85%)');
    glow.addColorStop(1, 'rgb(255 255 255 / 0%)');
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
  });
  paint(KEY.star, S, S, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? S / 2 : S / 5;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
  paint(KEY.piece, S, S, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect((S - PIECE_SIZE.width) / 2, (S - PIECE_SIZE.height) / 2, PIECE_SIZE.width, PIECE_SIZE.height);
  });
  paint(KEY.beam, BEAM_SIZE.width, BEAM_SIZE.height, (g) => {
    const { width: w, height: h } = BEAM_SIZE;
    const fade = g.createLinearGradient(0, h, 0, 0);
    fade.addColorStop(0, 'rgb(255 255 255 / 90%)');
    fade.addColorStop(1, 'rgb(255 255 255 / 0%)');
    g.fillStyle = fade;
    g.beginPath();
    g.moveTo(w / 2 - 8, h);
    g.lineTo(0, 0);
    g.lineTo(w, 0);
    g.lineTo(w / 2 + 8, h);
    g.closePath();
    g.fill();
  });
}

/** A pool of particle images at one depth. */
class ParticleLayer {
  readonly pool: ParticlePool<Phaser.GameObjects.Image>;

  constructor(scene: Phaser.Scene, capacity: number, depth: number) {
    this.pool = new ParticlePool(
      capacity,
      () => scene.add.image(0, 0, KEY.dot).setDepth(depth).setVisible(false),
      (image, p, s) => {
        if (p === null || s === null) {
          image.setVisible(false);
          return;
        }
        // The particle image when it loaded, otherwise the drawn shape (FR-149).
        const withImage = p.image !== undefined && scene.textures.exists(IMAGE_KEY[p.image]);
        const key = withImage ? IMAGE_KEY[p.image!] : KEY[p.shape];
        if (image.texture.key !== key) image.setTexture(key);
        const scale = withImage ? imageScale(p.image!, s.scale) : s.scale;
        // Glowing particles add up their light; the others keep their colors. A beam turns around its foot.
        image.setOrigin(0.5, p.shape === 'beam' ? 1 : 0.5).setBlendMode(p.glow ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
        image.setPosition(s.x, s.y).setScale(scale).setAlpha(s.alpha).setRotation(s.rotation).setTint(p.tint).setVisible(true);
      },
    );
  }

  destroy(): void {
    this.pool.forEachObject((image) => image.destroy());
  }
}

/** The flying ball: its middle and its drawn width. */
export interface BallPoint {
  x: number;
  y: number;
  size: number;
}

export class TrailView {
  private readonly layer: ParticleLayer;
  private trail: Trail = 'none';
  /** Parts of a particle owed from earlier frames. */
  private owed = 0;
  private spawned = 0;
  private last: BallPoint | null = null;

  constructor(scene: Phaser.Scene, depth: number) {
    this.layer = new ParticleLayer(scene, TRAIL_CAPACITY, depth);
  }

  setTrail(trail: Trail): void {
    this.trail = trail;
  }

  /** True while trail particles show (or wait to show). */
  get showing(): boolean {
    return this.layer.pool.active > 0;
  }

  /** One frame of `ms`: the particles move on, and new ones come along the ball's path while it flies (`ball`). */
  update(ms: number, ball: BallPoint | null): void {
    this.layer.pool.step(ms);
    if (ball === null || this.trail === 'none') {
      this.owed = 0;
      this.last = null;
      return;
    }
    const trail = this.trail;
    const from = this.last ?? ball;
    const { count, owed } = trailCount(trail, ms, Math.hypot(ball.x - from.x, ball.y - from.y), ball.size, this.owed);
    this.owed = owed;
    for (let i = 1; i <= count; i++) {
      const k = i / count;
      const p = trailParticle(trail, from.x + (ball.x - from.x) * k, from.y + (ball.y - from.y) * k, ball.size, this.spawned++, Math.random);
      this.layer.pool.spawn(p, (1 - k) * ms);
    }
    this.last = ball;
  }

  clear(): void {
    this.layer.pool.clear();
    this.owed = 0;
    this.last = null;
  }

  destroy(): void {
    this.layer.destroy();
  }
}

export class GoalEffectView {
  private readonly back: ParticleLayer;
  private readonly front: ParticleLayer;

  constructor(scene: Phaser.Scene) {
    this.back = new ParticleLayer(scene, EFFECT_CAPACITY.back, FIREWORKS_DEPTH);
    this.front = new ParticleLayer(scene, EFFECT_CAPACITY.front, CONFETTI_DEPTH);
  }

  /** True while the effect's particles show (or wait to show). */
  get running(): boolean {
    return this.back.pool.active + this.front.pool.active > 0;
  }

  /** Starts `effect` from the beginning; nothing for none. */
  play(effect: GoalEffect): void {
    this.clear();
    if (effect === 'none') return;
    const { back, front } = goalEffectParticles(effect, Math.random);
    for (const p of back) this.back.pool.spawn(p);
    for (const p of front) this.front.pool.spawn(p);
  }

  update(ms: number): void {
    this.back.pool.step(ms);
    this.front.pool.step(ms);
  }

  clear(): void {
    this.back.pool.clear();
    this.front.pool.clear();
  }

  destroy(): void {
    this.back.destroy();
    this.front.destroy();
  }
}

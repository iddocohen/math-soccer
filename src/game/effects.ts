/**
 * The looks of the ball trails and the goal effects (amendment 20, FR-134, FR-137), as particle lists (particles.ts).
 * No Phaser here: the match (TrailView, GoalEffectView) and the locker room previews (FR-139) draw the same particles.
 *
 * - Ball trails: while the ball flies, the match spawns `TRAIL_STYLE[trail].rate` particles per second at the ball
 *   (`trailParticle`). They stay where they were spawned and fade, so they lie behind the ball along its path. Every
 *   trail particle lives at most `TRAIL_FADE_MS` (0.4 s), so the trail is gone within 0.4 s after the ball lands.
 * - Goal effects: `goalEffectParticles` lays out the whole effect at once, about 1 s (`GOAL_EFFECT_MS`), with delays.
 *   Fireworks burst over the stands and the light show sweeps over them behind the goal (`back`), so neither covers a
 *   number; confetti flies up from both bottom corners over everything (`front`), as the final's confetti does.
 *
 * Sizes are scales of the particle textures, which are `PARTICLE_TEXTURE_SIZE` pixels wide (the beam is
 * BEAM_SIZE).
 *
 * Amendment 22 (FR-149): the sparkles, stars and fire trails, the fireworks and the light show's blinking lights draw
 * the Kenney particle images (`image`), tinted with the particle's color; `imageScale` turns a shape's scale into the
 * image's. The light beams, the rainbow and the confetti stay drawn in code.
 */
import type { GoalEffect, Trail } from '../core/rewards/items';
import { STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import type { ParticleImage, ParticleInit } from './particles';

/** The dot, star and confetti textures are this many pixels wide. */
export const PARTICLE_TEXTURE_SIZE = 32;
/** The particle images (amendment 22) are this many pixels wide. */
export const PARTICLE_IMAGE_SIZE = 64;
/**
 * How much of its width each particle image fills with its visible middle, so an image drawn for a particle looks
 * about as big as the drawn shape it replaces. The rays of the stars and the flash's glow reach further out.
 */
export const IMAGE_FILL: Record<ParticleImage, number> = { twinkle: 0.3, star: 0.6, sparkle: 0.22, fire: 0.7, flare: 0.15, light: 0.6 };

/** The scale of a particle's image for the scale `scale` of its drawn shape (amendment 22). */
export function imageScale(image: ParticleImage, scale: number): number {
  return (scale * PARTICLE_TEXTURE_SIZE) / (PARTICLE_IMAGE_SIZE * IMAGE_FILL[image]);
}
/** The light beam texture: narrow at its foot, wide at its top. */
export const BEAM_SIZE = { width: 140, height: 460 } as const;
/** A confetti piece in the texture: a rectangle this wide and high, centered. */
export const PIECE_SIZE = { width: 12, height: 20 } as const;

/** The trail is gone this long after the ball lands, at the latest (FR-134). */
export const TRAIL_FADE_MS = 400;
/** How long a goal effect plays, about (FR-137). */
export const GOAL_EFFECT_MS = 1000;

export type ShownTrail = Exclude<Trail, 'none'>;
export type ShownGoalEffect = Exclude<GoalEffect, 'none'>;

export interface TrailStyle {
  /** Particles per second while the ball flies. */
  rate: number;
  /** At most this far apart along the ball's path, as a part of the ball's width, however few frames are drawn. */
  spacing: number;
  /** Lifetime of a particle in milliseconds; below TRAIL_FADE_MS. */
  life: number;
  colors: readonly number[];
}

const RAINBOW = [0xe74c3c, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x3498db, 0x8e44ad] as const;
const FIRE = [0xfff1a8, 0xffc53a, 0xf5841f, 0xe0451c] as const;

export const TRAIL_STYLE: Record<ShownTrail, TrailStyle> = {
  sparkles: { rate: 60, spacing: 0.8, life: 380, colors: [0xffffff, 0xfff3a0, 0xbfe9ff] },
  stars: { rate: 30, spacing: 1.2, life: 380, colors: [0xffe066, 0xffffff, 0xffc93a] },
  fire: { rate: 110, spacing: 0.35, life: 380, colors: FIRE },
  rainbow: { rate: 100, spacing: 0.3, life: 380, colors: RAINBOW },
};

/** The most trail particles alive at once: the fastest trail's rate times the longest life, with room to spare. */
export const TRAIL_CAPACITY = 72;

/**
 * How many trail particles a frame spawns: by the rate over `ms`, and at least one per `spacing` along the `distance`
 * the ball moved, so the trail has no gaps when frames are slow.
 */
export function trailCount(trail: ShownTrail, ms: number, distance: number, ballSize: number, owed: number): { count: number; owed: number } {
  const style = TRAIL_STYLE[trail];
  const byRate = owed + (ms * style.rate) / 1000;
  const byDistance = distance / (style.spacing * ballSize);
  const want = Math.max(byRate, byDistance);
  const count = Math.floor(want);
  return { count, owed: byRate >= byDistance ? want - count : 0 };
}

const scaleFor = (diameter: number) => diameter / PARTICLE_TEXTURE_SIZE;
const spread = (rand: () => number, half: number) => (rand() * 2 - 1) * half;

/**
 * The `n`th trail particle of a shot, at the ball's middle `x`, `y`, for a ball `ballSize` world pixels wide. `rand`
 * gives numbers in [0, 1).
 */
export function trailParticle(trail: ShownTrail, x: number, y: number, ballSize: number, n: number, rand: () => number): ParticleInit {
  const style = TRAIL_STYLE[trail];
  switch (trail) {
    case 'sparkles': {
      const size = scaleFor(ballSize * (0.3 + rand() * 0.3));
      return {
        shape: 'dot',
        image: 'twinkle',
        x: x + spread(rand, ballSize * 0.5),
        y: y + spread(rand, ballSize * 0.5),
        vx: spread(rand, 40),
        vy: spread(rand, 40),
        life: style.life,
        size,
        endSize: size * 0.3,
        fadeFrom: 0.3,
        tint: style.colors[n % style.colors.length]!,
        glow: true,
      };
    }
    case 'stars': {
      const size = scaleFor(ballSize * 0.75);
      return {
        shape: 'star',
        image: 'star',
        x: x + spread(rand, ballSize * 0.3),
        y: y + spread(rand, ballSize * 0.3),
        life: style.life,
        size,
        endSize: size * 0.4,
        fadeFrom: 0.3,
        rotation: rand() * Math.PI,
        spin: spread(rand, 5),
        tint: style.colors[n % style.colors.length]!,
        glow: true,
      };
    }
    case 'fire': {
      const size = scaleFor(ballSize * (1.1 + rand() * 0.4));
      return {
        shape: 'dot',
        image: 'fire',
        x: x + spread(rand, ballSize * 0.15),
        y: y + spread(rand, ballSize * 0.15),
        vx: spread(rand, 25),
        // Flames rise a little.
        vy: -50 - rand() * 40,
        life: style.life,
        size,
        endSize: size * 0.45,
        fadeFrom: 0.35,
        tint: FIRE[Math.floor(rand() * FIRE.length)]!,
      };
    }
    case 'rainbow': {
      const size = scaleFor(ballSize * 0.95);
      return {
        shape: 'dot',
        x,
        y,
        life: style.life,
        size,
        endSize: size * 0.6,
        fadeFrom: 0.4,
        // Each color for a few particles in a row, so the colors form bands along the path.
        tint: RAINBOW[Math.floor(n / 3) % RAINBOW.length]!,
      };
    }
  }
}

/** The colors of fireworks bursts and of confetti. */
const SHOW_COLORS = [0xf2c230, 0xe74c3c, 0x3498db, 0x2ecc71, 0xf4f6ef, 0xe07fb0, 0x8a5cc2] as const;
const BEAM_COLORS = [0xff4fd8, 0x4fd8ff, 0xffe14f, 0x6bff7a] as const;

export interface EffectParticles {
  /** Behind the goal and its grid, over the fans. */
  back: ParticleInit[];
  /** Over everything. */
  front: ParticleInit[];
}

/** The most particles of one goal effect per layer. */
export const EFFECT_CAPACITY = { back: 100, front: 80 } as const;

const FIREWORK_BURSTS = [
  { x: 420, y: 120, delay: 0 },
  { x: 1180, y: 105, delay: 280 },
  { x: 800, y: 75, delay: 520 },
] as const;
const FIREWORK_SPARKS = 26;
const CONFETTI_PER_SIDE = 36;
const BEAM_FEET = [180, 600, 1000, 1420] as const;
const BLINK_LIGHTS = 24;

/** Every particle of one goal effect, laid out at once with delays. `rand` gives numbers in [0, 1). */
export function goalEffectParticles(effect: ShownGoalEffect, rand: () => number): EffectParticles {
  const back: ParticleInit[] = [];
  const front: ParticleInit[] = [];
  if (effect === 'fireworks') {
    FIREWORK_BURSTS.forEach((b, i) => {
      const tint = SHOW_COLORS[(i * 2) % SHOW_COLORS.length]!;
      back.push({ shape: 'dot', image: 'flare', x: b.x, y: b.y, delay: b.delay, life: 220, size: scaleFor(70), endSize: scaleFor(100), alpha: 0.8, tint: 0xffffff, glow: true });
      for (let k = 0; k < FIREWORK_SPARKS; k++) {
        const angle = (k / FIREWORK_SPARKS) * Math.PI * 2;
        const speed = 180 + rand() * 50;
        back.push({
          shape: 'dot',
          image: 'sparkle',
          x: b.x,
          y: b.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 160,
          delay: b.delay,
          life: 640,
          size: scaleFor(13),
          endSize: scaleFor(5),
          fadeFrom: 0.4,
          tint,
          glow: true,
        });
      }
    });
  } else if (effect === 'confetti') {
    for (const side of [-1, 1] as const) {
      const x0 = side < 0 ? 60 : WORLD_WIDTH - 60;
      for (let k = 0; k < CONFETTI_PER_SIDE; k++) {
        front.push({
          shape: 'piece',
          x: x0 + spread(rand, 30),
          y: WORLD_HEIGHT + 10,
          // Up and in toward the middle.
          vx: -side * (220 + rand() * 420),
          vy: -(880 + rand() * 280),
          gravity: 1100,
          delay: rand() * 120,
          life: 1000 + rand() * 100,
          size: 1,
          rotation: rand() * Math.PI,
          spin: spread(rand, 9),
          fadeFrom: 0.7,
          tint: SHOW_COLORS[k % SHOW_COLORS.length]!,
        });
      }
    }
  } else {
    // Light beams stand at the foot of the stands and sweep over them; small lights blink in the crowd.
    BEAM_FEET.forEach((x, i) => {
      const side = x < WORLD_WIDTH / 2 ? -1 : 1;
      back.push({
        shape: 'beam',
        x,
        y: STANDS_BOTTOM,
        life: GOAL_EFFECT_MS,
        size: 1,
        rotation: side * 0.55,
        spin: -side * 1.1,
        alpha: 0.45,
        fadeFrom: 0.75,
        tint: BEAM_COLORS[i]!,
        glow: true,
      });
    });
    for (let k = 0; k < BLINK_LIGHTS; k++) {
      back.push({
        shape: 'dot',
        image: 'light',
        x: 60 + rand() * (WORLD_WIDTH - 120),
        y: 40 + rand() * (STANDS_BOTTOM - 60),
        delay: rand() * (GOAL_EFFECT_MS - 220),
        life: 220,
        size: scaleFor(20),
        endSize: scaleFor(10),
        tint: BEAM_COLORS[k % BEAM_COLORS.length]!,
        glow: true,
      });
    }
  }
  return { back, front };
}

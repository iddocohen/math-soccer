/**
 * Particles for the ball trails and the goal effects (amendment 20, FR-134, FR-137), as plain data so the motion has
 * unit tests and the locker room previews draw the same particles as the match.
 *
 * - A particle moves on a closed formula of its age (`particleAt`): position from its start, speed and gravity, size
 *   and alpha from its start to its end value. No step adds up rounding, and a preview can ask for any moment.
 * - A particle can start late (`delay`): it stays hidden until then, so a goal effect lays out its bursts at once.
 * - `ParticlePool` keeps a fixed number of slots. Each slot makes its drawn object once, on first use, and reuses it
 *   for every later particle, so a shot or a goal creates no new objects after the first ones (plan "Performance
 *   Goals"). When every slot is busy, the oldest particle gives its slot to the new one.
 */

/** The drawn shape: a soft dot, a five-point star, a confetti piece, or a light beam standing on its foot. */
export type ParticleShape = 'dot' | 'star' | 'piece' | 'beam';

/**
 * The particle images of amendment 22 (FR-149), from the Kenney Particle Pack (src/assets.ts `PARTICLE_FILES`): a small
 * soft twinkle, a sharp four-point star, a bright sparkle, a fire puff, a flash and a ring of light.
 */
export type ParticleImage = 'twinkle' | 'star' | 'sparkle' | 'fire' | 'flare' | 'light';

export interface ParticleInit {
  /** The shape drawn in code; it also stands in for `image` while the image is not loaded. */
  shape: ParticleShape;
  /** The particle image to draw instead of the shape, tinted with `tint` (amendment 22). */
  image?: ParticleImage;
  x: number;
  y: number;
  /** Speed in world pixels per second. */
  vx?: number;
  vy?: number;
  /** Downward pull in world pixels per second squared. */
  gravity?: number;
  /** Lifetime in milliseconds after the delay. */
  life: number;
  /** Milliseconds before the particle shows. */
  delay?: number;
  /** Scale at the start and at the end of the life. */
  size: number;
  endSize?: number;
  /** Alpha at the start; it fades to 0 from `fadeFrom` (a part of the life, 0 by default) to the end. */
  alpha?: number;
  fadeFrom?: number;
  rotation?: number;
  /** Turn in radians per second. */
  spin?: number;
  /** 0xRRGGBB. */
  tint: number;
  /** Light that adds up where particles overlap (sparks, beams); otherwise plain color (flames, rainbow, paper). */
  glow?: boolean;
}

/** What a particle looks like at one moment. */
export interface ParticleState {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
}

/** The particle `ms` after it was spawned; null before its delay ends and after its life. */
export function particleAt(p: ParticleInit, ms: number): ParticleState | null {
  const age = ms - (p.delay ?? 0);
  if (age < 0 || age >= p.life) return null;
  const s = age / 1000;
  const k = age / p.life;
  const fadeFrom = p.fadeFrom ?? 0;
  const fade = k <= fadeFrom ? 1 : 1 - (k - fadeFrom) / (1 - fadeFrom);
  return {
    x: p.x + (p.vx ?? 0) * s,
    y: p.y + (p.vy ?? 0) * s + 0.5 * (p.gravity ?? 0) * s * s,
    scale: p.size + ((p.endSize ?? p.size) - p.size) * k,
    alpha: (p.alpha ?? 1) * fade,
    rotation: (p.rotation ?? 0) + (p.spin ?? 0) * s,
  };
}

/** The last moment a particle shows, in milliseconds after it was spawned. */
export function particleEnd(p: ParticleInit): number {
  return (p.delay ?? 0) + p.life;
}

interface Slot<T> {
  obj: T | null;
  p: ParticleInit | null;
  age: number;
}

/**
 * A fixed set of particle slots over drawn objects of type `T`. `make` creates a slot's object on its first use; `show`
 * draws a particle state on it, or hides it with null.
 */
export class ParticlePool<T> {
  private readonly slots: Slot<T>[];
  private readonly make: () => T;
  private readonly show: (obj: T, p: ParticleInit | null, state: ParticleState | null) => void;
  private made = 0;
  private live = 0;

  constructor(capacity: number, make: () => T, show: (obj: T, p: ParticleInit | null, state: ParticleState | null) => void) {
    this.slots = Array.from({ length: capacity }, () => ({ obj: null, p: null, age: 0 }));
    this.make = make;
    this.show = show;
  }

  get capacity(): number {
    return this.slots.length;
  }

  /** The drawn objects made so far; never more than the capacity. */
  get created(): number {
    return this.made;
  }

  /** The particles spawned and not yet over (also those still waiting for their delay). */
  get active(): number {
    return this.live;
  }

  /**
   * Starts a particle in a free slot, or in the slot of the oldest particle when all are busy. `age` starts it that
   * many milliseconds into its life, for a particle that belongs to a moment between two frames.
   */
  spawn(p: ParticleInit, age = 0): void {
    let slot = this.slots.find((s) => s.p === null);
    if (!slot) {
      slot = this.slots[0]!;
      for (const s of this.slots) if (s.age - (s.p!.delay ?? 0) > slot.age - (slot.p!.delay ?? 0)) slot = s;
    }
    if (slot.obj === null) {
      slot.obj = this.make();
      this.made += 1;
    }
    if (slot.p === null) this.live += 1;
    slot.p = p;
    slot.age = age;
    this.show(slot.obj, p, particleAt(p, age));
  }

  /** Moves every particle on by `ms` and frees the slots of the particles that are over. */
  step(ms: number): void {
    for (const slot of this.slots) {
      if (slot.p === null) continue;
      slot.age += ms;
      if (slot.age >= particleEnd(slot.p)) {
        slot.p = null;
        this.live -= 1;
        this.show(slot.obj!, null, null);
      } else {
        this.show(slot.obj!, slot.p, particleAt(slot.p, slot.age));
      }
    }
  }

  /** Ends every particle at once and hides it. */
  clear(): void {
    for (const slot of this.slots) {
      if (slot.p === null) continue;
      slot.p = null;
      this.show(slot.obj!, null, null);
    }
    this.live = 0;
  }

  /** Hands every drawn object to `fn`, for example to destroy them. */
  forEachObject(fn: (obj: T) => void): void {
    for (const slot of this.slots) if (slot.obj !== null) fn(slot.obj);
  }
}

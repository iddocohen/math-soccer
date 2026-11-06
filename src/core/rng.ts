// Copied from math-tank src/core/rng.ts.
/** Seeded random numbers. No module in src/core calls Math.random (contracts/core-api.md). */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** A copy of `items` in random order (Fisher-Yates). */
  shuffled<T>(items: readonly T[]): T[];
  /** Normal distribution sample (Box-Muller). */
  normal(mean: number, sd: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  // mulberry32
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi < lo) throw new RangeError(`int(${min}, ${max}): empty range`);
    return lo + Math.floor(next() * (hi - lo + 1));
  };

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('pick: empty list');
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffled<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    normal(mean, sd) {
      // 1 - next() is in (0, 1], so the logarithm is finite.
      const u1 = 1 - next();
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + sd * z;
    },
  };
}

/** Stable unsigned 32-bit hash of the parts (FNV-1a over each part's 32-bit words, then a final mix). */
export function deriveSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  const mix = (word: number) => {
    for (let i = 0; i < 4; i++) {
      h ^= (word >>> (i * 8)) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  mix(parts.length);
  for (const p of parts) {
    // Split into a low and a high word so non-32-bit integers and fractions still hash stably.
    const lo = p | 0;
    const hi = Math.floor(p / 4294967296) | 0;
    const frac = Math.floor((p - Math.floor(p)) * 4294967296) | 0;
    mix(lo);
    mix(hi);
    mix(frac);
  }
  // murmur3 finalizer
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

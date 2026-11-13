import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { CHART_RECT } from '../core/match/world';
import { EFFECT_CAPACITY, GOAL_EFFECT_MS, goalEffectParticles, IMAGE_FILL, imageScale, PARTICLE_IMAGE_SIZE, PARTICLE_TEXTURE_SIZE, TRAIL_CAPACITY, TRAIL_FADE_MS, TRAIL_STYLE, trailCount, trailParticle, type ShownGoalEffect, type ShownTrail } from './effects';
import { particleAt, particleEnd, type ParticleImage } from './particles';
import { PARTICLE_FILES } from '../assets';

const rand = () => {
  const rng = createRng(3);
  return () => rng.next();
};
const TRAILS = Object.keys(TRAIL_STYLE) as ShownTrail[];
const EFFECTS: ShownGoalEffect[] = ['confetti', 'fireworks', 'lightShow'];

describe('ball trails (FR-134)', () => {
  it('fade within 0.4 s: no trail particle lives longer', () => {
    const r = rand();
    for (const trail of TRAILS) {
      for (let n = 0; n < 50; n++) expect(particleEnd(trailParticle(trail, 500, 500, 40, n, r))).toBeLessThanOrEqual(TRAIL_FADE_MS);
    }
  });

  it('start near the ball', () => {
    const r = rand();
    for (const trail of TRAILS) {
      for (let n = 0; n < 50; n++) {
        const p = trailParticle(trail, 500, 600, 40, n, r);
        expect(Math.abs(p.x - 500)).toBeLessThanOrEqual(20);
        expect(Math.abs(p.y - 600)).toBeLessThanOrEqual(20);
      }
    }
  });

  it('fit in the pool: rate times life stays below its capacity', () => {
    for (const trail of TRAILS) expect((TRAIL_STYLE[trail].rate * TRAIL_STYLE[trail].life) / 1000 + 1).toBeLessThan(TRAIL_CAPACITY);
  });

  it('spawns by the rate, and by the distance when frames are slow', () => {
    expect(trailCount('fire', 1000 / 60, 10, 40, 0).count).toBe(1);
    // One frame of 100 ms in which the ball moved 300 world pixels: one particle per 14 pixels, no gap.
    expect(trailCount('fire', 100, 300, 40, 0).count).toBe(21);
    const a = trailCount('stars', 20, 0, 40, 0);
    const b = trailCount('stars', 20, 0, 40, a.owed);
    expect(a.count + b.count).toBe(1);
  });

  it('the rainbow trail goes through its colors in bands', () => {
    const r = rand();
    const tints = Array.from({ length: 18 }, (_, n) => trailParticle('rainbow', 0, 0, 40, n, r).tint);
    expect(new Set(tints).size).toBe(6);
    expect(tints[0]).toBe(tints[2]);
  });
});

describe('goal effects (FR-137)', () => {
  it('play for about 1 s', () => {
    for (const effect of EFFECTS) {
      const { back, front } = goalEffectParticles(effect, rand());
      const end = Math.max(...[...back, ...front].map(particleEnd));
      expect(end).toBeGreaterThanOrEqual(GOAL_EFFECT_MS * 0.9);
      expect(end).toBeLessThanOrEqual(GOAL_EFFECT_MS * 1.3);
    }
  });

  it('fit in their pools', () => {
    for (const effect of EFFECTS) {
      const { back, front } = goalEffectParticles(effect, rand());
      expect(back.length).toBeLessThanOrEqual(EFFECT_CAPACITY.back);
      expect(front.length).toBeLessThanOrEqual(EFFECT_CAPACITY.front);
    }
  });

  it('fireworks and the light show start above the chart, behind the goal; only confetti flies in front', () => {
    for (const effect of EFFECTS) {
      const { back, front } = goalEffectParticles(effect, rand());
      for (const p of back) expect(p.y).toBeLessThan(CHART_RECT.y);
      expect(front.length > 0).toBe(effect === 'confetti');
    }
  });

  it('fireworks sparks stay over the stands and the crossbar, never deep in the chart', () => {
    const { back } = goalEffectParticles('fireworks', rand());
    for (const p of back) {
      for (let ms = 0; ms < particleEnd(p); ms += 20) {
        const s = particleAt(p, ms);
        if (s) expect(s.y).toBeLessThan(CHART_RECT.y + 40);
      }
    }
  });
});

describe('particle images (amendment 22, FR-149)', () => {
  it('the sparkles, stars and fire trails use their images; the rainbow stays drawn', () => {
    const r = rand();
    const imageOf = (trail: ShownTrail) => new Set(Array.from({ length: 20 }, (_, n) => trailParticle(trail, 500, 500, 40, n, r).image));
    expect(imageOf('sparkles')).toEqual(new Set(['twinkle']));
    expect(imageOf('stars')).toEqual(new Set(['star']));
    expect(imageOf('fire')).toEqual(new Set(['fire']));
    expect(imageOf('rainbow')).toEqual(new Set([undefined]));
  });

  it('fireworks and the light show use the images, the light beams and the confetti stay drawn', () => {
    const images = (effect: ShownGoalEffect) => {
      const { back, front } = goalEffectParticles(effect, rand());
      return [...back, ...front].map((p) => `${p.shape}:${p.image ?? '-'}`);
    };
    expect(new Set(images('fireworks'))).toEqual(new Set(['dot:flare', 'dot:sparkle']));
    expect(new Set(images('lightShow'))).toEqual(new Set(['beam:-', 'dot:light']));
    expect(new Set(images('confetti'))).toEqual(new Set(['piece:-']));
  });

  it('every image has a bundled file, and imageScale draws its visible middle as wide as the shape it replaces', () => {
    expect(Object.keys(PARTICLE_FILES).sort()).toEqual(Object.keys(IMAGE_FILL).sort());
    for (const image of Object.keys(IMAGE_FILL) as ParticleImage[]) {
      const scale = 0.8;
      expect(imageScale(image, scale) * PARTICLE_IMAGE_SIZE * IMAGE_FILL[image]).toBeCloseTo(scale * PARTICLE_TEXTURE_SIZE);
    }
  });
});

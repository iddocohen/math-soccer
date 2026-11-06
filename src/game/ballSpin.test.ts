import { describe, expect, it } from 'vitest';
import { SPIN_FRAMES, spinFrame } from './ballSpin';

describe('spinFrame', () => {
  it('rests on frame 0 at the kick and at the arrival', () => {
    expect(spinFrame(0)).toBe(0);
    expect(spinFrame(1)).toBe(0);
  });

  it('stays within the 64 frames for any progress', () => {
    for (let i = -20; i <= 1020; i++) {
      const f = spinFrame(i / 1000);
      expect(Number.isInteger(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(SPIN_FRAMES);
    }
    expect(spinFrame(Number.NaN)).toBe(0);
    expect(spinFrame(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('advances through every frame in order during the flight', () => {
    expect(spinFrame(0.5)).toBe(32);
    expect(spinFrame(63.5 / 64)).toBe(63);
    let last = -1;
    for (let i = 0; i < SPIN_FRAMES; i++) {
      const f = spinFrame((i + 0.5) / SPIN_FRAMES);
      expect(f).toBe(last + 1);
      last = f;
    }
  });
});

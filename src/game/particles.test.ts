import { describe, expect, it } from 'vitest';
import { particleAt, particleEnd, ParticlePool, type ParticleInit } from './particles';

const base: ParticleInit = { shape: 'dot', x: 10, y: 20, vx: 100, vy: -50, gravity: 200, life: 500, size: 1, endSize: 0.5, tint: 0xffffff };

describe('particleAt', () => {
  it('moves by speed and gravity, and changes size and alpha over the life', () => {
    expect(particleAt(base, 0)).toEqual({ x: 10, y: 20, scale: 1, alpha: 1, rotation: 0 });
    const half = particleAt(base, 250)!;
    expect(half.x).toBeCloseTo(35);
    expect(half.y).toBeCloseTo(20 - 12.5 + 0.5 * 200 * 0.0625);
    expect(half.scale).toBeCloseTo(0.75);
    expect(half.alpha).toBeCloseTo(0.5);
    expect(particleAt(base, 500)).toBeNull();
  });

  it('stays hidden during its delay, and fades only from fadeFrom on', () => {
    const p = { ...base, delay: 100, fadeFrom: 0.5 };
    expect(particleAt(p, 50)).toBeNull();
    expect(particleAt(p, 100)!.x).toBe(10);
    expect(particleAt(p, 300)!.alpha).toBe(1);
    expect(particleAt(p, 475)!.alpha).toBeCloseTo(0.5);
    expect(particleAt(p, 550)!.alpha).toBeCloseTo(0.2);
    expect(particleEnd(p)).toBe(600);
  });
});

describe('ParticlePool', () => {
  const pool = () => {
    const shown: Array<{ id: number; visible: boolean }> = [];
    let next = 0;
    const p = new ParticlePool(
      3,
      () => {
        const obj = { id: next++, visible: false };
        shown.push(obj);
        return obj;
      },
      (obj, _p, state) => {
        obj.visible = state !== null;
      },
    );
    return { p, shown };
  };

  it('makes an object per slot once and reuses it for later particles', () => {
    const { p, shown } = pool();
    for (let shot = 0; shot < 5; shot++) {
      p.spawn(base);
      p.spawn(base);
      p.step(600);
    }
    expect(p.created).toBe(2);
    expect(shown.length).toBe(2);
    expect(p.active).toBe(0);
    expect(shown.every((o) => !o.visible)).toBe(true);
  });

  it('never makes more objects than its capacity: the oldest particle gives its slot', () => {
    const { p } = pool();
    for (let i = 0; i < 10; i++) {
      p.spawn(base);
      p.step(10);
    }
    expect(p.created).toBe(3);
    expect(p.active).toBe(3);
  });

  it('starts a particle part way into its life', () => {
    const { p } = pool();
    p.spawn(base, 450);
    expect(p.active).toBe(1);
    p.step(60);
    expect(p.active).toBe(0);
  });

  it('frees a particle after its delay and life, and clear hides everything', () => {
    const { p, shown } = pool();
    p.spawn({ ...base, delay: 200 });
    p.step(100);
    expect(shown[0]!.visible).toBe(false);
    p.step(200);
    expect(shown[0]!.visible).toBe(true);
    expect(p.active).toBe(1);
    p.step(500);
    expect(p.active).toBe(0);
    p.spawn(base);
    p.clear();
    expect(p.active).toBe(0);
    expect(shown[0]!.visible).toBe(false);
  });
});

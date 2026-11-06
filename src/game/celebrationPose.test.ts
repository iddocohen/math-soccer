import { describe, expect, it } from 'vitest';
import { CELEBRATIONS } from '../core/rewards/items';
import {
  armPoints,
  CELEBRATION_MS,
  celebrationMs,
  FOREARM,
  KEYFRAMES,
  poseAt,
  REST,
  SHOULDER,
  TIME_CHALLENGE_CELEBRATION_MS,
  UPPER_ARM,
} from './celebrationPose';

describe('celebration poses (amendment 13, FR-113, FR-114)', () => {
  it('lasts about 1.2 s, and 0.6 s in the time challenge', () => {
    expect(CELEBRATION_MS).toBe(1200);
    expect(TIME_CHALLENGE_CELEBRATION_MS).toBe(600);
    expect(celebrationMs(false)).toBe(1200);
    expect(celebrationMs(true)).toBe(600);
  });

  it('has keyframes from t 0 to t 1 in order for every celebration', () => {
    for (const c of CELEBRATIONS) {
      const ts = KEYFRAMES[c].map((k) => k.t);
      expect(ts[0]).toBe(0);
      expect(ts[ts.length - 1]).toBe(1);
      for (let i = 1; i < ts.length; i++) expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    }
  });

  it('starts and ends in the standing pose, so a skipped or finished celebration needs no jump', () => {
    for (const c of CELEBRATIONS) {
      expect(poseAt(c, 0)).toEqual(REST);
      expect(poseAt(c, 1)).toEqual(REST);
      // Outside 0 to 1, and for a broken time, the ends hold.
      expect(poseAt(c, -1)).toEqual(REST);
      expect(poseAt(c, 2)).toEqual(REST);
      expect(poseAt(c, Number.NaN)).toEqual(REST);
    }
  });

  it('moves away from the standing pose in the middle of every celebration', () => {
    for (const c of CELEBRATIONS) {
      const p = poseAt(c, 0.45);
      expect(p, c).not.toEqual(REST);
      expect(p.left.up > REST.left.up + 0.5 || p.right.up > REST.right.up + 0.5, c).toBe(true);
    }
  });

  it('shows each celebration in its own way', () => {
    // Arme hoch: both arms up.
    expect(poseAt('armsUp', 0.3).left.up).toBeGreaterThan(2.5);
    // Rutschen: down on the knees and sliding toward the ball.
    const slide = poseAt('slide', 0.65);
    expect(slide.y).toBeGreaterThan(30);
    expect(slide.x).toBeGreaterThan(100);
    // Flugzeug: arms straight out to the side while he runs a curve.
    const plane = poseAt('airplane', 0.4);
    expect(plane.left.up).toBeCloseTo(Math.PI / 2);
    expect(plane.right.up).toBeCloseTo(Math.PI / 2);
    expect(plane.x).toBeGreaterThan(100);
    // Salto: high in the air, more than half way round.
    const flip = poseAt('backflip', 0.5);
    expect(flip.y).toBeLessThan(-140);
    expect(Math.abs(flip.turn)).toBeGreaterThan(Math.PI);
    // Tanz: swaying one way and then the other.
    expect(Math.sign(poseAt('dance', 0.17).turn)).toBe(-Math.sign(poseAt('dance', 0.34).turn));
    // Herz: the heart shows above the head.
    expect(poseAt('heart', 0.45).heart).toBeGreaterThan(1);
    expect(poseAt('armsUp', 0.45).heart).toBe(0);
  });

  it('blends between keyframes without jumps', () => {
    for (const c of CELEBRATIONS) {
      for (let i = 1; i <= 100; i++) {
        const a = poseAt(c, (i - 1) / 100);
        const b = poseAt(c, i / 100);
        expect(Math.abs(b.x - a.x), c).toBeLessThan(30);
        expect(Math.abs(b.y - a.y), c).toBeLessThan(40);
        expect(Math.abs(b.left.up - a.left.up), c).toBeLessThan(0.5);
      }
    }
  });

  it('places the arm from the shoulder: hanging down, out to the side, or up', () => {
    const down = armPoints(1, { up: 0, bend: 0 });
    expect(down.shoulder).toEqual({ x: SHOULDER.x, y: SHOULDER.y });
    expect(down.hand.x).toBeCloseTo(SHOULDER.x);
    expect(down.hand.y).toBeCloseTo(SHOULDER.y + UPPER_ARM + FOREARM);
    const out = armPoints(-1, { up: Math.PI / 2, bend: 0 });
    expect(out.hand.x).toBeCloseTo(-SHOULDER.x - UPPER_ARM - FOREARM);
    expect(out.hand.y).toBeCloseTo(SHOULDER.y);
    const up = armPoints(1, { up: Math.PI, bend: 0 });
    expect(up.hand.y).toBeCloseTo(SHOULDER.y - UPPER_ARM - FOREARM);
    // "Herz": the forearms fold in, so the hands are closer to the middle than the elbows.
    const heart = armPoints(1, poseAt('heart', 0.45).right);
    expect(Math.abs(heart.hand.x)).toBeLessThan(Math.abs(heart.elbow.x));
  });
});

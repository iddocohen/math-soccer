/** The goal net as plain data (amendment 11, FR-096 to FR-098). */
import { describe, expect, it } from 'vitest';
import { GOAL_FRAME } from '../core/match/world';
import { bulgeAt, diamondMesh, goalCorners, NET_BULGE_MS, NET_MESH, netKey, sagOf, surfacePoint, type Surface } from './net';

const SURFACES: Surface[] = ['back', 'left', 'right', 'roof'];

describe('the net texture', () => {
  it('has a key that depends only on the goal layout, so it is painted once and not per frame', () => {
    expect(netKey()).toBe(netKey());
    expect(netKey()).toContain(String(GOAL_FRAME.width));
    expect(netKey()).toContain(String(NET_MESH));
  });
});

describe('the diamond mesh (FR-096)', () => {
  it('has lines in two directions on every surface', () => {
    for (const surface of SURFACES) {
      const lines = diamondMesh(surface);
      expect(lines.length, surface).toBeGreaterThan(4);
      const slopes = lines.map((l) => Math.sign((l.at(-1)!.x - l[0]!.x) * (l.at(-1)!.y - l[0]!.y)));
      expect(slopes, surface).toContain(1);
      expect(slopes, surface).toContain(-1);
    }
  });

  it('crosses the back net at about 45 degrees, with lines about NET_MESH apart', () => {
    const lines = diamondMesh('back');
    const rising = lines.filter((l) => l[0]!.y < l.at(-1)!.y && l[0]!.x < l.at(-1)!.x);
    // The rising lines, sorted by where they cross the middle row, are spaced NET_MESH apart along x times sqrt 2.
    for (const l of rising) {
      const dx = l.at(-1)!.x - l[0]!.x;
      const dy = l.at(-1)!.y - l[0]!.y;
      expect(Math.abs(Math.atan2(dy, dx))).toBeGreaterThan(Math.PI / 6);
      expect(Math.abs(Math.atan2(dy, dx))).toBeLessThan(Math.PI / 3);
    }
  });

  it('keeps every mesh point inside the goal frame', () => {
    for (const surface of SURFACES) {
      for (const line of diamondMesh(surface)) {
        for (const p of line) {
          expect(p.x).toBeGreaterThanOrEqual(GOAL_FRAME.x);
          expect(p.x).toBeLessThanOrEqual(GOAL_FRAME.x + GOAL_FRAME.width);
          expect(p.y).toBeGreaterThanOrEqual(GOAL_FRAME.y);
          expect(p.y).toBeLessThanOrEqual(GOAL_FRAME.y + GOAL_FRAME.height);
        }
      }
    }
  });

  it('sags in the middle of the roof and low on the back net, and not at the edges, so it meets the frame', () => {
    expect(sagOf('roof', 0.5, 0.5)).toBeGreaterThan(5);
    expect(sagOf('back', 0.5, 0.7)).toBeGreaterThan(sagOf('back', 0.5, 0.2));
    for (const surface of SURFACES) {
      for (const [u, v] of [
        [0, 0.5],
        [1, 0.5],
        [0.5, 0],
        [0.5, 1],
      ] as const) {
        expect(Math.abs(sagOf(surface, u, v)), `${surface} ${u} ${v}`).toBeLessThan(1e-3);
      }
    }
    expect(sagOf('left', 0.5, 0.5)).toBe(0);
    const { back } = goalCorners();
    expect(surfacePoint('back', 0, 0)).toEqual(back.tl);
  });
});

describe('the bulge after a goal (FR-098)', () => {
  it('pushes out and settles back within about 0.4 s', () => {
    expect(NET_BULGE_MS).toBe(400);
    expect(bulgeAt(0)).toBe(0);
    expect(bulgeAt(NET_BULGE_MS)).toBe(0);
    expect(bulgeAt(NET_BULGE_MS * 0.3)).toBeCloseTo(1);
    expect(bulgeAt(NET_BULGE_MS * 0.8)).toBeLessThan(bulgeAt(NET_BULGE_MS * 0.4));
  });
});

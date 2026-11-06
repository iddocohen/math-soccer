/**
 * The goal net as plain data (amendment 11, FR-096 to FR-098), for GoalView. No Phaser here, so the rules have unit
 * tests.
 *
 * - The net is a diamond mesh, like a real goal net: two families of lines at about 45 degrees on each net surface (the
 *   back net, the two side nets and the roof), mapped onto the surface's corners, so the side nets and the roof follow
 *   the perspective of the frame.
 * - The mesh hangs: the roof sags between the crossbar and the back bar, and the back net bellies a little toward its
 *   bottom (`sagOf`).
 * - GoalView paints the net once into a canvas texture named with `netKey()`, which depends only on the goal's layout,
 *   so the net is never redrawn per frame. Only the bulge after a goal moves (`startsBulge`, `bulgeAt`).
 */
import { GOAL_FRAME, POST_WIDTH } from '../core/match/world';
import { lerp } from '../core/util';

export interface Point {
  x: number;
  y: number;
}

export type Corners = Record<'tl' | 'tr' | 'bl' | 'br', Point>;

/** The net surfaces GoalView paints, from back to front. */
export type Surface = 'back' | 'left' | 'right' | 'roof';

/** Distance between two parallel mesh lines, in world pixels. */
export const NET_MESH = 24;
/** How far the roof hangs down in its middle, and how far the back net bellies toward its bottom, in world pixels. */
export const ROOF_SAG = 12;
export const BACK_SAG = 7;
/** Points along one mesh line, so a sagging line bends smoothly. */
const SAMPLES = 14;

/** How long the net bulges after a goal (FR-098). */
export const NET_BULGE_MS = 400;
/** How far the net stretches at the height of the bulge, as a part of the patch size. */
export const NET_BULGE_STRETCH = 0.14;
/** The radius of the bulging patch around the ball, in world pixels. */
export const NET_BULGE_RADIUS = 90;

/** Inner corners of the goal mouth (front) and of the back of the goal, which looks smaller and higher from the spot. */
export function goalCorners(): { front: Corners; back: Corners } {
  const left = GOAL_FRAME.x + POST_WIDTH;
  const right = GOAL_FRAME.x + GOAL_FRAME.width - POST_WIDTH;
  const top = GOAL_FRAME.y + POST_WIDTH;
  const line = GOAL_FRAME.y + GOAL_FRAME.height;
  const backLeft = left + 100;
  const backRight = right - 100;
  const backTop = top + 70;
  const backLine = line - 45;
  return {
    front: { tl: { x: left, y: top }, tr: { x: right, y: top }, bl: { x: left, y: line }, br: { x: right, y: line } },
    back: { tl: { x: backLeft, y: backTop }, tr: { x: backRight, y: backTop }, bl: { x: backLeft, y: backLine }, br: { x: backRight, y: backLine } },
  };
}

/**
 * The corners of a net surface as a quad: `a` and `b` along its top (u from 0 to 1), `d` and `c` along its bottom.
 * On the side nets u runs from the front post to the back; on the roof v runs from the crossbar to the back bar.
 */
export function surfaceQuad(surface: Surface): { a: Point; b: Point; c: Point; d: Point } {
  const { front: f, back: b } = goalCorners();
  switch (surface) {
    case 'back':
      return { a: b.tl, b: b.tr, c: b.br, d: b.bl };
    case 'left':
      return { a: f.tl, b: b.tl, c: b.bl, d: f.bl };
    case 'right':
      return { a: f.tr, b: b.tr, c: b.br, d: f.br };
    case 'roof':
      return { a: f.tl, b: f.tr, c: b.tr, d: b.tl };
  }
}

/** The texture name of the painted net; it changes only with the goal's layout and the mesh, never per frame. */
export function netKey(): string {
  return ['goal-net', GOAL_FRAME.x, GOAL_FRAME.y, GOAL_FRAME.width, GOAL_FRAME.height, POST_WIDTH, NET_MESH, ROOF_SAG, BACK_SAG].join('-');
}

/** How far the net hangs at (u, v) of a surface, in world pixels downward. 0 on every edge, so the mesh meets the frame. */
export function sagOf(surface: Surface, u: number, v: number): number {
  switch (surface) {
    case 'roof':
      // Flat where the roof meets the side nets, hanging soon after.
      return ROOF_SAG * Math.sin(Math.PI * v) * Math.sqrt(Math.sin(Math.PI * u));
    case 'back':
      // Largest at about two thirds down: the loose lower part of the net.
      return BACK_SAG * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * v * 1.6;
    default:
      return 0;
  }
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** The point at (u, v) of a surface, with its sag. */
export function surfacePoint(surface: Surface, u: number, v: number): Point {
  const q = surfaceQuad(surface);
  const p = lerpPoint(lerpPoint(q.a, q.b, u), lerpPoint(q.d, q.c, u), v);
  return { x: p.x, y: p.y + sagOf(surface, u, v) };
}

/**
 * The diamond mesh of a surface: polylines along u + v and u - v, measured in world pixels of the surface's mean
 * width and height so the diamonds are about square, and spaced NET_MESH apart.
 */
export function diamondMesh(surface: Surface): Point[][] {
  const q = surfaceQuad(surface);
  const width = (Math.hypot(q.b.x - q.a.x, q.b.y - q.a.y) + Math.hypot(q.c.x - q.d.x, q.c.y - q.d.y)) / 2;
  const height = (Math.hypot(q.d.x - q.a.x, q.d.y - q.a.y) + Math.hypot(q.c.x - q.b.x, q.c.y - q.b.y)) / 2;
  const step = NET_MESH * Math.SQRT2;
  const lines: Point[][] = [];
  for (const sign of [1, -1]) {
    // Lines U - sign * V = k, with U in [0, width] and V in [0, height].
    const kMin = sign === 1 ? -height : 0;
    const kMax = sign === 1 ? width : width + height;
    for (let k = kMin + step / 2; k < kMax; k += step) {
      // V range where U = k + sign * V lies in [0, width].
      const vLo = Math.max(0, sign === 1 ? -k : k - width);
      const vHi = Math.min(height, sign === 1 ? width - k : k);
      if (vHi - vLo < 1) continue;
      const line: Point[] = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const V = vLo + ((vHi - vLo) * i) / SAMPLES;
        const U = k + sign * V;
        line.push(surfacePoint(surface, U / width, V / height));
      }
      lines.push(line);
    }
  }
  return lines;
}

/** A goal moves the net; a caught ball does not (FR-098). */
export function startsBulge(outcome: 'goal' | 'miss' | null | undefined): boolean {
  return outcome === 'goal';
}

/** How far the net is pushed out at a time after the goal: 0 at the start, the most at about a third, 0 again at the end. */
export function bulgeAt(elapsedMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= NET_BULGE_MS) return 0;
  const t = elapsedMs / NET_BULGE_MS;
  // A quick push out and a slower settle.
  return t < 0.3 ? Math.sin((t / 0.3) * (Math.PI / 2)) : Math.cos(((t - 0.3) / 0.7) * (Math.PI / 2));
}

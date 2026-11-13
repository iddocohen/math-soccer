/**
 * The mascot (amendment 20, FR-136) as plain data: where it stands, how each animal is drawn, and how it moves. No
 * Phaser here, so the rules have unit tests, and the locker room preview (FR-139) draws the same shapes as the match.
 *
 * - It stands at the side of the pitch, left of the goal: `MASCOT_RECT` holds it in every pose, jumps and raised arms
 *   included. That rectangle lies outside the chart, the row and column scales, the goal posts, the top bar, the
 *   player and the overlay at the bottom right, so the mascot never covers a number, a helper or a button.
 * - It idles (breathes), jumps twice and waves on a goal (`cheer`), and covers its eyes with both paws for a moment on
 *   a miss (`eyes`), in a friendly way.
 * - Art units: the feet stand on (0, 0), up is negative y. The arms are drawn pointing down from the shoulder and turn
 *   around it; a turn of `a` radians points the arm along (-sin a, cos a), as Phaser and SVG turn clockwise.
 */
import type { Mascot } from '../core/rewards/items';
import type { Rect } from '../core/types';
import { clamp, lerp } from '../core/util';

export type ShownMascot = Exclude<Mascot, 'none'>;
export type MascotMood = 'idle' | 'cheer' | 'eyes';

export type MascotShape =
  | { type: 'circle'; x: number; y: number; r: number; color: number }
  | { type: 'ellipse'; x: number; y: number; rx: number; ry: number; color: number }
  | { type: 'triangle'; points: readonly [number, number, number, number, number, number]; color: number }
  /** A smile: the lower part of a circle's outline. */
  | { type: 'smile'; x: number; y: number; r: number; color: number; width: number };

export interface MascotArt {
  /** Drawn back to front, before the arms. */
  shapes: readonly MascotShape[];
  arm: { color: number; paw: number };
}

/** Where the mascot's feet stand in the world, left of the left post. */
export const MASCOT_FEET = { x: 150, y: 830 } as const;
export const MASCOT_SCALE = 0.95;
/** Over the stands and the pitch, under the goal's net (2), the player (6) and the ball (7). */
export const MASCOT_DEPTH = 1.8;

/** The shoulders, in art units; the left one mirrors it. */
export const SHOULDER = { x: 34, y: -92 } as const;
/** The eyes, in art units; the left one mirrors it. */
export const EYE = { x: 14, y: -148 } as const;
export const ARM_LENGTH = 52;
export const ARM_WIDTH = 18;
export const PAW_RADIUS = 12;
/** The height of a jump in art units. */
export const MASCOT_JUMP = 50;
/** Every shape of every animal lies inside this box, in art units (the tests check it). */
export const ART_BOUNDS = { left: -82, right: 82, top: -216, bottom: 12 } as const;

/** How long the cheer and the covered eyes last. */
export const MASCOT_CHEER_MS = 1000;
export const MASCOT_EYES_MS = 900;

/** The world rectangle the mascot stays inside in every pose. */
export const MASCOT_RECT: Rect = {
  x: MASCOT_FEET.x + ART_BOUNDS.left * MASCOT_SCALE,
  y: MASCOT_FEET.y + (ART_BOUNDS.top - MASCOT_JUMP) * MASCOT_SCALE,
  width: (ART_BOUNDS.right - ART_BOUNDS.left) * MASCOT_SCALE,
  height: (ART_BOUNDS.bottom - ART_BOUNDS.top + MASCOT_JUMP) * MASCOT_SCALE,
};

const INK = 0x1b1b1b;
const WHITE = 0xffffff;

/** Feet, body, belly, head and eyes, shared by every animal, with the animal's own shapes behind and on the head. */
function animal(c: { fur: number; dark: number; belly: number }, behindHead: MascotShape[], onHead: MascotShape[]): MascotShape[] {
  return [
    { type: 'ellipse', x: -20, y: -6, rx: 18, ry: 9, color: c.dark },
    { type: 'ellipse', x: 20, y: -6, rx: 18, ry: 9, color: c.dark },
    { type: 'ellipse', x: 0, y: -58, rx: 42, ry: 50, color: c.fur },
    { type: 'ellipse', x: 0, y: -54, rx: 26, ry: 34, color: c.belly },
    ...behindHead,
    { type: 'circle', x: 0, y: -140, r: 38, color: c.fur },
    ...onHead,
    { type: 'circle', x: -EYE.x, y: EYE.y, r: 5, color: INK },
    { type: 'circle', x: EYE.x, y: EYE.y, r: 5, color: INK },
    { type: 'circle', x: -EYE.x - 1.5, y: EYE.y - 2, r: 1.8, color: WHITE },
    { type: 'circle', x: EYE.x - 1.5, y: EYE.y - 2, r: 1.8, color: WHITE },
  ];
}

const muzzle = (color: number): MascotShape => ({ type: 'ellipse', x: 0, y: -124, rx: 21, ry: 15, color });
const smile: MascotShape = { type: 'smile', x: 0, y: -126, r: 9, color: INK, width: 3 };

const DOG = { fur: 0xc68a4e, dark: 0x7a4a26, belly: 0xf1d9b5 };
const LION = { fur: 0xe0a640, dark: 0x9a5a22, belly: 0xf6dca0 };
const MANE = 0xa8561f;
const PENGUIN = { fur: 0x1f2630, dark: 0xf29a2e, belly: 0xf4f6ef };
const BEAR = { fur: 0x8a5a35, dark: 0x5d3a20, belly: 0xd9b48a };

/** The lion's mane: a disc with a scalloped rim behind the head. */
const mane: MascotShape[] = [
  { type: 'circle', x: 0, y: -140, r: 56, color: MANE },
  ...Array.from({ length: 12 }, (_, i): MascotShape => {
    const a = (i / 12) * Math.PI * 2;
    return { type: 'circle', x: Math.cos(a) * 54, y: -140 + Math.sin(a) * 54, r: 15, color: MANE };
  }),
];

export const MASCOT_ART: Record<ShownMascot, MascotArt> = {
  dog: {
    shapes: animal(
      DOG,
      [],
      [
        { type: 'ellipse', x: -40, y: -130, rx: 13, ry: 28, color: DOG.dark },
        { type: 'ellipse', x: 40, y: -130, rx: 13, ry: 28, color: DOG.dark },
        muzzle(DOG.belly),
        { type: 'ellipse', x: 0, y: -133, rx: 8, ry: 6, color: INK },
        smile,
      ],
    ),
    arm: { color: DOG.fur, paw: DOG.dark },
  },
  lion: {
    shapes: animal(
      LION,
      [...mane, { type: 'circle', x: -28, y: -170, r: 10, color: LION.fur }, { type: 'circle', x: 28, y: -170, r: 10, color: LION.fur }],
      [muzzle(LION.belly), { type: 'triangle', points: [-8, -135, 8, -135, 0, -126], color: 0x5a3214 }, smile],
    ),
    arm: { color: LION.fur, paw: LION.dark },
  },
  penguin: {
    shapes: animal(
      PENGUIN,
      [],
      [
        { type: 'ellipse', x: 0, y: -136, rx: 28, ry: 25, color: PENGUIN.belly },
        { type: 'triangle', points: [-9, -131, 9, -131, 0, -116], color: PENGUIN.dark },
      ],
    ),
    arm: { color: PENGUIN.fur, paw: PENGUIN.fur },
  },
  bear: {
    shapes: animal(
      BEAR,
      [
        { type: 'circle', x: -30, y: -170, r: 14, color: BEAR.fur },
        { type: 'circle', x: 30, y: -170, r: 14, color: BEAR.fur },
        { type: 'circle', x: -30, y: -170, r: 7, color: BEAR.belly },
        { type: 'circle', x: 30, y: -170, r: 7, color: BEAR.belly },
      ],
      [muzzle(BEAR.belly), { type: 'ellipse', x: 0, y: -133, rx: 8, ry: 6, color: INK }, smile],
    ),
    arm: { color: BEAR.fur, paw: BEAR.dark },
  },
};

/** The turn that points an arm from `shoulder` toward `to` (see the module comment). */
export function armTurn(shoulder: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.atan2(-(to.x - shoulder.x), to.y - shoulder.y);
}

/** Where the paw of an arm on `side` (-1 left, 1 right) with turn `a` is, in art units, before the jump. */
export function pawAt(side: -1 | 1, a: number): { x: number; y: number } {
  return { x: side * SHOULDER.x - Math.sin(a) * ARM_LENGTH, y: SHOULDER.y + Math.cos(a) * ARM_LENGTH };
}

export interface MascotPose {
  /** How high the feet are off the ground, in art units. */
  lift: number;
  left: number;
  right: number;
}

/** The arms hang a little out from the body. */
const REST = { left: 0.18, right: -0.18 } as const;
/** The paws on the eyes. */
const COVER = { left: armTurn({ x: -SHOULDER.x, y: SHOULDER.y }, { x: -EYE.x, y: EYE.y }), right: armTurn(SHOULDER, EYE) } as const;
/**
 * In the cheer: the left arm up and out, the right arm waving above the head. The turns go the long way round, so the
 * arms come up in front of the body instead of swinging out wide.
 */
const CHEER = { left: -(Math.PI + 0.6), right: Math.PI + 0.35 } as const;
/** The arms move in and out of a pose over this many milliseconds. */
const BLEND_MS = 140;

/** How long a mood lasts; idle lasts until the next goal or miss. */
export function moodMs(mood: MascotMood): number {
  return mood === 'cheer' ? MASCOT_CHEER_MS : mood === 'eyes' ? MASCOT_EYES_MS : Infinity;
}

/** The pose `ms` into `mood`. */
export function mascotPose(mood: MascotMood, ms: number): MascotPose {
  if (mood === 'idle') return { lift: 2 + 2 * Math.sin((ms / 1600) * Math.PI * 2), ...REST };
  const total = moodMs(mood);
  const t = clamp(ms, 0, total);
  const w = Math.min(1, t / BLEND_MS, (total - t) / BLEND_MS);
  if (mood === 'eyes') return { lift: 0, left: lerp(REST.left, COVER.left, w), right: lerp(REST.right, COVER.right, w) };
  // Two hops, and the right paw waves.
  const wave = 0.3 * Math.sin(t / 80);
  return {
    lift: MASCOT_JUMP * Math.abs(Math.sin((t / total) * Math.PI * 2)),
    left: lerp(REST.left, CHEER.left, w),
    right: lerp(REST.right, CHEER.right + wave, w),
  };
}

// Structure adapted from math-tank src/core/rewards/items.ts (the garage items), with locker room items.
/**
 * The locker room items (FR-043, data-model.md "LockerRoom"). Pure data, no React or Phaser.
 *
 * Four kinds: ball designs, shirt colors, scarf colors and goal celebrations ("Jubel", amendment 13, FR-113). Each kind
 * has free items, owned from the start, and items that cost 5 to 40 stars (celebrations 10 to 30). The free items are
 * the classic ball, the yellow and the white shirt, the yellow scarves and the celebration "Arme hoch".
 *
 * Decision (T057): data-model.md names the white shirt as the free starter shirt. The game's own color is the yellow
 * kit (src/game/palette.ts), so the yellow shirt stays the shirt a new player wears, and the white shirt is free too.
 *
 * ITEMS is the locker room order: per kind, the free items first, then by price.
 */
export type ItemKind = 'ball' | 'shirt' | 'scarf' | 'celebration';

export const BALL_DESIGNS = ['classic', 'blue', 'stars', 'gold', 'flames', 'rainbow'] as const;
export type BallDesign = (typeof BALL_DESIGNS)[number];

/**
 * The two main colors of each ball design as 0xRRGGBB: the ball's `fill` and its `mark` (patches, stars or flames).
 * src/game/ballArt.ts draws the designs with them, the locker room's small pictures use them too. The rainbow ball's
 * fill is its outer band.
 */
export const BALL_COLORS: Record<BallDesign, { fill: number; mark: number }> = {
  classic: { fill: 0xffffff, mark: 0x12202c },
  blue: { fill: 0x3e8fd8, mark: 0xffffff },
  stars: { fill: 0x1b2f6b, mark: 0xffe066 },
  gold: { fill: 0xd4a017, mark: 0x8a6510 },
  flames: { fill: 0x12202c, mark: 0xf08a24 },
  rainbow: { fill: 0xe74c3c, mark: 0xffffff },
};

/**
 * The goal celebrations (FR-113): arms up, knee slide, airplane arms on a curve, backflip, dance, and hands forming a
 * heart. src/game/celebrationPose.ts holds their poses.
 */
export const CELEBRATIONS = ['armsUp', 'slide', 'airplane', 'backflip', 'dance', 'heart'] as const;
export type Celebration = (typeof CELEBRATIONS)[number];

export interface LockerItem {
  /** `<kind>.<name>`, for example `ball.gold`. */
  id: string;
  kind: ItemKind;
  /** Price in stars: 0 for a free item, otherwise 5 to 40. */
  price: number;
  /** A shirt or scarf color as 0xRRGGBB; null for a ball design or a celebration. */
  color: number | null;
}

const ball = (name: BallDesign, price: number): LockerItem => ({ id: `ball.${name}`, kind: 'ball', price, color: null });
const shirt = (name: string, price: number, color: number): LockerItem => ({ id: `shirt.${name}`, kind: 'shirt', price, color });
const scarf = (name: string, price: number, color: number): LockerItem => ({ id: `scarf.${name}`, kind: 'scarf', price, color });
const celebration = (name: Celebration, price: number): LockerItem => ({ id: `celebration.${name}`, kind: 'celebration', price, color: null });

export const ITEMS: readonly LockerItem[] = [
  ball('classic', 0),
  ball('blue', 5),
  ball('stars', 15),
  ball('gold', 20),
  ball('flames', 30),
  ball('rainbow', 40),
  shirt('yellow', 0, 0xe8b923),
  shirt('white', 0, 0xf4f6ef),
  shirt('red', 5, 0xc94f4f),
  shirt('blue', 5, 0x3e6fb0),
  shirt('green', 10, 0x4f9c5f),
  shirt('pink', 10, 0xe07fb0),
  shirt('black', 20, 0x22262b),
  shirt('orange', 20, 0xf08a24),
  scarf('yellow', 0, 0xe8b923),
  scarf('red', 5, 0xc94f4f),
  scarf('blue', 5, 0x3e6fb0),
  scarf('green', 10, 0x4f9c5f),
  scarf('white', 10, 0xf4f6ef),
  scarf('purple', 20, 0x8a5cc2),
  celebration('armsUp', 0),
  celebration('slide', 10),
  celebration('dance', 15),
  celebration('airplane', 15),
  celebration('heart', 20),
  celebration('backflip', 30),
];

export const ITEM_KINDS: readonly ItemKind[] = ['ball', 'shirt', 'scarf', 'celebration'];

/** The items a new player wears. */
export const STARTER = { ball: 'ball.classic', shirt: 'shirt.yellow', scarf: 'scarf.yellow', celebration: 'celebration.armsUp' } as const satisfies Record<ItemKind, string>;

export function itemById(id: string): LockerItem | undefined {
  return ITEMS.find((i) => i.id === id);
}

/** A free item: owned from the start. */
export function isFree(id: string): boolean {
  return itemById(id)?.price === 0;
}

/** The ball design of a `ball.<design>` id; the classic design for anything else. */
export function ballDesign(id: string): BallDesign {
  const name = id.startsWith('ball.') ? id.slice('ball.'.length) : '';
  return BALL_DESIGNS.find((d) => d === name) ?? 'classic';
}

/** The celebration of a `celebration.<name>` id; "Arme hoch" for anything else. */
export function celebrationOf(id: string): Celebration {
  const name = id.startsWith('celebration.') ? id.slice('celebration.'.length) : '';
  return CELEBRATIONS.find((c) => c === name) ?? 'armsUp';
}

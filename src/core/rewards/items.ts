// Structure adapted from math-tank src/core/rewards/items.ts (the garage items), with locker room items.
/**
 * The locker room items (FR-043, data-model.md "LockerRoom"). Pure data, no React or Phaser.
 *
 * Three kinds: ball designs, shirt colors and scarf colors. Each kind has free items, owned from the start, and items
 * that cost 5 to 40 stars. The free items are the classic ball, the yellow and the white shirt, and the yellow scarves.
 *
 * Decision (T057): data-model.md names the white shirt as the free starter shirt. The game's own color is the yellow
 * kit (src/game/palette.ts), so the yellow shirt stays the shirt a new player wears, and the white shirt is free too.
 *
 * ITEMS is the locker room order: per kind, the free items first, then by price.
 */
export type ItemKind = 'ball' | 'shirt' | 'scarf';

export const BALL_DESIGNS = ['classic', 'blue', 'stars', 'gold', 'flames', 'rainbow'] as const;
export type BallDesign = (typeof BALL_DESIGNS)[number];

export interface LockerItem {
  /** `<kind>.<name>`, for example `ball.gold`. */
  id: string;
  kind: ItemKind;
  /** Price in stars: 0 for a free item, otherwise 5 to 40. */
  price: number;
  /** A shirt or scarf color as 0xRRGGBB; null for a ball design. */
  color: number | null;
}

const ball = (name: BallDesign, price: number): LockerItem => ({ id: `ball.${name}`, kind: 'ball', price, color: null });
const shirt = (name: string, price: number, color: number): LockerItem => ({ id: `shirt.${name}`, kind: 'shirt', price, color });
const scarf = (name: string, price: number, color: number): LockerItem => ({ id: `scarf.${name}`, kind: 'scarf', price, color });

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
];

export const ITEM_KINDS: readonly ItemKind[] = ['ball', 'shirt', 'scarf'];

/** The items a new player wears. */
export const STARTER = { ball: 'ball.classic', shirt: 'shirt.yellow', scarf: 'scarf.yellow' } as const satisfies Record<ItemKind, string>;

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

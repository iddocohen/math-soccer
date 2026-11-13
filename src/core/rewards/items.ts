// Structure adapted from math-tank src/core/rewards/items.ts (the garage items), with locker room items.
/**
 * The locker room items (FR-043, data-model.md "LockerRoom"). Pure data, no React or Phaser.
 *
 * Seven kinds: ball designs, shirt colors, scarf colors, goal celebrations ("Jubel", amendment 13, FR-113), ball trails
 * ("Ballspur"), goal effects ("Tor-Effekt") and mascots ("Maskottchen", amendment 20). Each kind has free items, owned
 * from the start, and items that cost stars (amendment 19, FR-133; amendment 20): ball designs 30 to 120, shirt and
 * scarf colors 20 to 60, celebrations 50 to 150, ball trails 40 to 120, goal effects 60 to 120 and mascots 80 to 150,
 * spread from the cheapest to the most special item. The free items are the classic ball, the yellow and the white
 * shirt, the yellow scarves, the celebration "Arme hoch", and "Ohne" (none) for the trail, the goal effect and the
 * mascot. Trails, goal effects and mascots are looks only: they never change the math (amendment 20 "Rules").
 *
 * Decision (T057): data-model.md names the white shirt as the free starter shirt. The game's own color is the yellow
 * kit (src/game/palette.ts), so the yellow shirt stays the shirt a new player wears, and the white shirt is free too.
 *
 * ITEMS is the locker room order: per kind, the free items first, then by price.
 */
export type ItemKind = 'ball' | 'shirt' | 'scarf' | 'celebration' | 'trail' | 'goalEffect' | 'mascot';

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

/** Ball trails (amendment 20, FR-134): drawn behind the ball in flight; src/game/effects.ts holds their looks. */
export const TRAILS = ['none', 'sparkles', 'stars', 'fire', 'rainbow'] as const;
export type Trail = (typeof TRAILS)[number];

/** Goal effects (amendment 20, FR-137): played for about 1 s on every goal; src/game/effects.ts holds their looks. */
export const GOAL_EFFECTS = ['none', 'confetti', 'fireworks', 'lightShow'] as const;
export type GoalEffect = (typeof GOAL_EFFECTS)[number];

/** Mascots (amendment 20, FR-136): stand left of the goal; src/game/mascot.ts draws them. */
export const MASCOTS = ['none', 'dog', 'penguin', 'bear', 'lion'] as const;
export type Mascot = (typeof MASCOTS)[number];

export interface LockerItem {
  /** `<kind>.<name>`, for example `ball.gold`. */
  id: string;
  kind: ItemKind;
  /** Price in stars: 0 for a free item, otherwise within its kind's range in PRICE_RANGES. */
  price: number;
  /** A shirt or scarf color as 0xRRGGBB; null for every other kind. */
  color: number | null;
}

const ball = (name: BallDesign, price: number): LockerItem => ({ id: `ball.${name}`, kind: 'ball', price, color: null });
const shirt = (name: string, price: number, color: number): LockerItem => ({ id: `shirt.${name}`, kind: 'shirt', price, color });
const scarf = (name: string, price: number, color: number): LockerItem => ({ id: `scarf.${name}`, kind: 'scarf', price, color });
const celebration = (name: Celebration, price: number): LockerItem => ({ id: `celebration.${name}`, kind: 'celebration', price, color: null });
const trail = (name: Trail, price: number): LockerItem => ({ id: `trail.${name}`, kind: 'trail', price, color: null });
const goalEffect = (name: GoalEffect, price: number): LockerItem => ({ id: `goalEffect.${name}`, kind: 'goalEffect', price, color: null });
const mascot = (name: Mascot, price: number): LockerItem => ({ id: `mascot.${name}`, kind: 'mascot', price, color: null });

export const ITEMS: readonly LockerItem[] = [
  ball('classic', 0),
  ball('blue', 30),
  ball('stars', 55),
  ball('gold', 75),
  ball('flames', 100),
  ball('rainbow', 120),
  shirt('yellow', 0, 0xe8b923),
  shirt('white', 0, 0xf4f6ef),
  shirt('red', 20, 0xc94f4f),
  shirt('blue', 25, 0x3e6fb0),
  shirt('green', 35, 0x4f9c5f),
  shirt('pink', 45, 0xe07fb0),
  shirt('black', 50, 0x22262b),
  shirt('orange', 60, 0xf08a24),
  scarf('yellow', 0, 0xe8b923),
  scarf('red', 20, 0xc94f4f),
  scarf('blue', 30, 0x3e6fb0),
  scarf('green', 40, 0x4f9c5f),
  scarf('white', 50, 0xf4f6ef),
  scarf('purple', 60, 0x8a5cc2),
  celebration('armsUp', 0),
  celebration('slide', 50),
  celebration('dance', 75),
  celebration('airplane', 100),
  celebration('heart', 125),
  celebration('backflip', 150),
  trail('none', 0),
  trail('sparkles', 40),
  trail('stars', 65),
  trail('fire', 95),
  trail('rainbow', 120),
  goalEffect('none', 0),
  goalEffect('confetti', 60),
  goalEffect('fireworks', 90),
  goalEffect('lightShow', 120),
  mascot('none', 0),
  mascot('dog', 80),
  mascot('penguin', 105),
  mascot('bear', 125),
  mascot('lion', 150),
];

export const ITEM_KINDS: readonly ItemKind[] = ['ball', 'shirt', 'scarf', 'celebration', 'trail', 'goalEffect', 'mascot'];

/** The lowest and highest price of the items that are not free, per kind (amendment 19, FR-133; amendment 20). */
export const PRICE_RANGES: Record<ItemKind, { min: number; max: number }> = {
  ball: { min: 30, max: 120 },
  shirt: { min: 20, max: 60 },
  scarf: { min: 20, max: 60 },
  celebration: { min: 50, max: 150 },
  trail: { min: 40, max: 120 },
  goalEffect: { min: 60, max: 120 },
  mascot: { min: 80, max: 150 },
};

/** The items a new player wears. */
export const STARTER = {
  ball: 'ball.classic',
  shirt: 'shirt.yellow',
  scarf: 'scarf.yellow',
  celebration: 'celebration.armsUp',
  trail: 'trail.none',
  goalEffect: 'goalEffect.none',
  mascot: 'mascot.none',
} as const satisfies Record<ItemKind, string>;

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

/** The name in `list` of an id `<kind>.<name>`; `list[0]` (none) for anything else. */
function nameIn<T extends string>(kind: ItemKind, list: readonly T[], id: string): T {
  const name = id.startsWith(`${kind}.`) ? id.slice(kind.length + 1) : '';
  return list.find((n) => n === name) ?? list[0]!;
}

/** The trail of a `trail.<name>` id; no trail for anything else. */
export const trailOf = (id: string): Trail => nameIn('trail', TRAILS, id);
/** The goal effect of a `goalEffect.<name>` id; no effect for anything else. */
export const goalEffectOf = (id: string): GoalEffect => nameIn('goalEffect', GOAL_EFFECTS, id);
/** The mascot of a `mascot.<name>` id; no mascot for anything else. */
export const mascotOf = (id: string): Mascot => nameIn('mascot', MASCOTS, id);

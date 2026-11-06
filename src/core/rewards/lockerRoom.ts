// Structure adapted from math-tank src/core/rewards/garage.ts (the star shop), without giving items back.
/**
 * Stars and the locker room (FR-042, FR-043, data-model.md "LockerRoom"). Pure functions; the app stores the result
 * under `mathsoccer.lockerroom.v1` (src/core/storage/storage.ts).
 *
 * - Stars: 2 per goal (`GOAL_STARS`, amendment 05). The match controller counts them in `starsThisRound`; the app
 *   gives every new star to the locker room as soon as it is earned (`newStars`), so a refresh loses none and counts
 *   none twice.
 * - `award` adds stars to the balance and the total ever earned. Only `buy` takes stars away; nothing in the game does
 *   after a miss (FR-023).
 * - `buy` takes the price and equips the item; `equip` chooses an owned or free item. Celebrations ("Jubel",
 *   amendment 13, FR-113) are bought and chosen like the other items.
 * - The shirt number is 1 to 99 and the shirt name up to 10 letters.
 *
 * Nothing here reaches target selection or the difficulty: looks never change the math (FR-043, plan "Rewards never
 * make the math easier").
 */
import type { LockerRoom } from '../storage/schemas';
import { ballDesign, celebrationOf, isFree, itemById, STARTER, type BallDesign, type Celebration, type ItemKind } from './items';

/** Stars for a goal. */
export const GOAL_STARS = 2;

export const SHIRT_NUMBER_MIN = 1;
export const SHIRT_NUMBER_MAX = 99;
export const SHIRT_NAME_MAX = 10;

/**
 * The stars to award after `starsThisRound` changed from `seen` to `current`. A new round starts again at 0, so a
 * smaller value gives nothing.
 */
export function newStars(seen: number, current: number): number {
  return current > seen ? current - seen : 0;
}

/** Adds `n` stars to the balance and the total ever earned; anything but a whole number above 0 changes nothing. */
export function award(locker: LockerRoom, n: number): LockerRoom {
  if (!Number.isInteger(n) || n <= 0) return locker;
  return { ...locker, owned: [...locker.owned], stars: locker.stars + n, totalEarned: locker.totalEarned + n };
}

export function isOwned(locker: LockerRoom, id: string): boolean {
  return isFree(id) || locker.owned.includes(id);
}

/** Stars still needed for an item ("noch N Sterne"); 0 when the balance reaches its price. */
export function starsNeeded(locker: LockerRoom, id: string): number {
  const item = itemById(id);
  return item ? Math.max(0, item.price - locker.stars) : 0;
}

export function canBuy(locker: LockerRoom, id: string): boolean {
  const item = itemById(id);
  return item !== undefined && !isOwned(locker, id) && item.price <= locker.stars;
}

/** The locker room field that holds the chosen item of a kind. */
const FIELD = { ball: 'ball', shirt: 'shirtColor', scarf: 'scarfColor', celebration: 'celebration' } as const satisfies Record<ItemKind, keyof LockerRoom>;

/** The chosen item id of a kind. */
export function chosen(locker: LockerRoom, kind: ItemKind): string {
  return locker[FIELD[kind]];
}

/** Takes the price from the balance, adds the item and equips it; unchanged when `canBuy` is false. */
export function buy(locker: LockerRoom, id: string): LockerRoom {
  if (!canBuy(locker, id)) return locker;
  const item = itemById(id)!;
  return { ...locker, stars: locker.stars - item.price, owned: [...locker.owned, id], [FIELD[item.kind]]: id };
}

/** Chooses an owned or free item for `slot`; an item of another kind, unknown or not owned changes nothing. */
export function equip(locker: LockerRoom, slot: ItemKind, id: string): LockerRoom {
  const item = itemById(id);
  if (!item || item.kind !== slot || !isOwned(locker, id)) return locker;
  return { ...locker, owned: [...locker.owned], [FIELD[slot]]: id };
}

/** Sets the shirt number; anything but a whole number from 1 to 99 changes nothing. */
export function setShirtNumber(locker: LockerRoom, n: number): LockerRoom {
  if (!Number.isInteger(n) || n < SHIRT_NUMBER_MIN || n > SHIRT_NUMBER_MAX) return locker;
  return { ...locker, owned: [...locker.owned], shirtNumber: n };
}

/** The typed name with everything but letters, spaces and hyphens removed, cut to 10 characters. */
export function cleanShirtName(typed: string): string {
  return Array.from(typed.replace(/[^\p{L} -]/gu, ''))
    .slice(0, SHIRT_NAME_MAX)
    .join('');
}

export function setShirtName(locker: LockerRoom, typed: string): LockerRoom {
  return { ...locker, owned: [...locker.owned], shirtName: cleanShirtName(typed) };
}

/**
 * Stored data after the schema check: bought ids that are unknown, free or repeated are dropped, and a chosen item that
 * is unknown, of the wrong kind or not owned becomes the starter item of its kind.
 */
export function cleanLockerRoom(locker: LockerRoom): LockerRoom {
  const owned = [...new Set(locker.owned)].filter((id) => itemById(id) !== undefined && !isFree(id));
  const pick = (kind: ItemKind): string => {
    const id = locker[FIELD[kind]];
    const item = itemById(id);
    return item && item.kind === kind && (item.price === 0 || owned.includes(id)) ? id : STARTER[kind];
  };
  return { ...locker, owned, ball: pick('ball'), shirtColor: pick('shirt'), scarfColor: pick('scarf'), celebration: pick('celebration') };
}

/** What the scene draws from the locker room. */
export interface Look {
  ball: BallDesign;
  shirtColor: number;
  shirtNumber: number;
  /** Shown on the shirt in capitals; empty for no name. */
  shirtName: string;
  scarfColor: number;
  /** Played after every goal (FR-114). */
  celebration: Celebration;
}

export function lookOf(locker: LockerRoom): Look {
  const color = (id: string, fallback: string) => itemById(id)?.color ?? itemById(fallback)!.color!;
  return {
    ball: ballDesign(locker.ball),
    shirtColor: color(locker.shirtColor, STARTER.shirt),
    shirtNumber: locker.shirtNumber,
    shirtName: locker.shirtName,
    scarfColor: color(locker.scarfColor, STARTER.scarf),
    celebration: celebrationOf(locker.celebration),
  };
}

/** One string per drawn look, so a view redraws only when the look changed; the celebration is read at each goal. */
export function lookKey(look: Look): string {
  return `${look.ball}|${look.shirtColor}|${look.shirtNumber}|${look.shirtName}|${look.scarfColor}`;
}

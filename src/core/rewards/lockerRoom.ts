// Structure adapted from math-tank src/core/rewards/garage.ts (the star shop), without giving items back.
/**
 * Stars and the locker room (FR-042, FR-043, data-model.md "LockerRoom"). Pure functions; the app stores the result
 * under `mathsoccer.lockerroom.v1` (src/core/storage/storage.ts).
 *
 * - Stars: 1 per goal (`GOAL_STARS`, amendment 05, lowered by amendment 19, FR-132). The match controller counts them in `starsThisRound`; the app
 *   gives every new star to the locker room as soon as it is earned (`newStars`), so a refresh loses none and counts
 *   none twice.
 * - `award` adds stars to the balance and the total ever earned. Only `buy` takes stars away; nothing in the game does
 *   after a miss (FR-023).
 * - `buy` takes the price and equips the item; `equip` chooses an owned or free item. Celebrations ("Jubel",
 *   amendment 13, FR-113) are bought and chosen like the other items.
 * - The shirt number is 1 to 99 and the shirt name up to 10 letters.
 * - The stadium name (amendment 20, FR-135) is up to 14 letters, digits, spaces or hyphens; "Mathe-Arena" shows while it
 *   is empty.
 *
 * Nothing here reaches target selection or the difficulty: looks never change the math (FR-043, plan "Rewards never
 * make the math easier").
 */
import type { LockerRoom } from '../storage/schemas';
import {
  ballDesign,
  celebrationOf,
  floodlightOf,
  goalEffectOf,
  isFree,
  itemById,
  ITEM_KINDS,
  mascotOf,
  STARTER,
  standsOf,
  trailOf,
  weatherOf,
  type BallDesign,
  type Celebration,
  type Floodlight,
  type GoalEffect,
  type ItemKind,
  type Mascot,
  type Stands,
  type Trail,
  type Weather,
} from './items';
import { cleanModes } from './modes';

/** Stars for a goal (FR-132). */
export const GOAL_STARS = 1;

export const SHIRT_NUMBER_MIN = 1;
export const SHIRT_NUMBER_MAX = 99;
export const SHIRT_NAME_MAX = 10;
/** The stadium name on the scoreboard (amendment 20, FR-135): up to 14 letters, "Mathe-Arena" for a new player. */
export const STADIUM_NAME_MAX = 14;
export const DEFAULT_STADIUM_NAME = 'Mathe-Arena';

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
const FIELD = {
  ball: 'ball',
  shirt: 'shirtColor',
  scarf: 'scarfColor',
  celebration: 'celebration',
  trail: 'trail',
  goalEffect: 'goalEffect',
  mascot: 'mascot',
  stands: 'stands',
  floodlight: 'floodlight',
  weather: 'weather',
} as const satisfies Record<ItemKind, keyof LockerRoom>;

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

/** The typed stadium name with everything but letters, digits, spaces and hyphens removed, cut to 14 characters. */
export function cleanStadiumName(typed: string): string {
  return Array.from(typed.replace(/[^\p{L}\p{N} -]/gu, ''))
    .slice(0, STADIUM_NAME_MAX)
    .join('');
}

export function setStadiumName(locker: LockerRoom, typed: string): LockerRoom {
  return { ...locker, owned: [...locker.owned], stadiumName: cleanStadiumName(typed) };
}

/** The name the scoreboard shows: the typed name, or "Mathe-Arena" while the field is empty. */
export function stadiumNameShown(name: string): string {
  return name.trim() === '' ? DEFAULT_STADIUM_NAME : name.trim();
}

/**
 * Stored data after the schema check: bought ids that are unknown, free or repeated are dropped, and a chosen item that
 * is unknown, of the wrong kind or not owned becomes the starter item of its kind. Unknown or repeated game modes are
 * dropped (amendment 21).
 */
export function cleanLockerRoom(locker: LockerRoom): LockerRoom {
  const owned = [...new Set(locker.owned)].filter((id) => itemById(id) !== undefined && !isFree(id));
  const pick = (kind: ItemKind): string => {
    const id = locker[FIELD[kind]];
    const item = itemById(id);
    return item && item.kind === kind && (item.price === 0 || owned.includes(id)) ? id : STARTER[kind];
  };
  const cleaned: LockerRoom = { ...locker, owned, modes: cleanModes(locker.modes) };
  for (const kind of ITEM_KINDS) cleaned[FIELD[kind]] = pick(kind);
  return cleaned;
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
  /** Drawn behind the ball in flight (amendment 20, FR-134). */
  trail: Trail;
  /** Played on every goal (FR-137). */
  goalEffect: GoalEffect;
  /** Stands left of the goal (FR-136). */
  mascot: Mascot;
  /** The usual or the bigger stands (FR-135). */
  stands: Stands;
  /** Tints the floodlights' light cones (FR-135). */
  floodlight: Floodlight;
  /** The sky, the light and the overlay of every round (FR-138). */
  weather: Weather;
  /** The name on the scoreboard, never empty (FR-135). */
  stadiumName: string;
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
    trail: trailOf(locker.trail),
    goalEffect: goalEffectOf(locker.goalEffect),
    mascot: mascotOf(locker.mascot),
    stands: standsOf(locker.stands),
    floodlight: floodlightOf(locker.floodlight),
    weather: weatherOf(locker.weather),
    stadiumName: stadiumNameShown(locker.stadiumName),
  };
}

/**
 * One string per drawn look of the player, the scarves and the ball, so a view redraws only when it changed. The
 * celebration and the goal effect are read at each goal; the scene follows the trail, the mascot, the stands, the
 * floodlights and the weather itself.
 */
export function lookKey(look: Look): string {
  return `${look.ball}|${look.shirtColor}|${look.shirtNumber}|${look.shirtName}|${look.scarfColor}`;
}

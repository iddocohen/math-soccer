/**
 * Game modes to unlock with stars (amendment 21, FR-140, FR-141). Pure data and functions, no React or Phaser.
 *
 * Five modes, in the locker room group "Spielarten":
 * - "Freistoß mit Mauer" (`wall`): 200 stars.
 * - "Selbst ins Tor" (`keeper`): 300 stars.
 * - "Elfmeterschießen" (`shootout`): 600 stars, only after "Selbst ins Tor" is owned.
 * - "Torwandschießen" (`torwand`, amendment 23, FR-154): 150 stars.
 * - "Papa gegen Kind" (`family`, amendment 23, FR-154): 250 stars.
 *
 * The modes are not locker room items (src/core/rewards/items.ts): nothing is chosen or worn, a bought mode only gives
 * its start screen button. The locker room keeps them in `modes`, apart from `owned`. Once bought, a mode stays
 * unlocked; only `unlockMode` takes stars.
 *
 * `playable` is false for a mode whose game is not built yet: it can be bought, and the start screen button says
 * "kommt bald". All modes are playable.
 */
import type { LockerRoom } from '../storage/schemas';

export const UNLOCK_MODES = ['wall', 'keeper', 'shootout', 'torwand', 'family'] as const;
export type UnlockMode = (typeof UNLOCK_MODES)[number];

export interface ModeOffer {
  mode: UnlockMode;
  /** Price in stars. */
  price: number;
  /** The mode that must be owned before this one can be bought; null when none is needed. */
  requires: UnlockMode | null;
  /** The start screen key, as shown on the button (FR-141). */
  key: 'M' | 'T' | 'E' | 'W' | 'F';
  /** False while the mode's game is not built yet: the start button says "kommt bald". */
  playable: boolean;
}

/** The modes in locker room order (FR-140). */
export const MODE_OFFERS: Record<UnlockMode, ModeOffer> = {
  wall: { mode: 'wall', price: 200, requires: null, key: 'M', playable: true },
  keeper: { mode: 'keeper', price: 300, requires: null, key: 'T', playable: true },
  shootout: { mode: 'shootout', price: 600, requires: 'keeper', key: 'E', playable: true },
  torwand: { mode: 'torwand', price: 150, requires: null, key: 'W', playable: true },
  family: { mode: 'family', price: 250, requires: null, key: 'F', playable: true },
};

export function isUnlockMode(value: string): value is UnlockMode {
  return (UNLOCK_MODES as readonly string[]).includes(value);
}

export function isModeUnlocked(locker: Pick<LockerRoom, 'modes'>, mode: UnlockMode): boolean {
  return locker.modes.includes(mode);
}

/**
 * Where a mode stands for the child:
 * - `unlocked`: bought;
 * - `needs`: another mode must be bought first ("Erst Selbst ins Tor freischalten");
 * - `affordable`: the balance reaches the price;
 * - `stars`: `needed` more stars are missing.
 */
export type ModeLock =
  | { kind: 'unlocked' }
  | { kind: 'needs'; mode: UnlockMode }
  | { kind: 'affordable'; price: number }
  | { kind: 'stars'; price: number; needed: number };

export function modeLock(locker: Pick<LockerRoom, 'modes' | 'stars'>, mode: UnlockMode): ModeLock {
  if (isModeUnlocked(locker, mode)) return { kind: 'unlocked' };
  const offer = MODE_OFFERS[mode];
  if (offer.requires !== null && !isModeUnlocked(locker, offer.requires)) return { kind: 'needs', mode: offer.requires };
  if (locker.stars >= offer.price) return { kind: 'affordable', price: offer.price };
  return { kind: 'stars', price: offer.price, needed: offer.price - locker.stars };
}

export function canUnlockMode(locker: Pick<LockerRoom, 'modes' | 'stars'>, mode: UnlockMode): boolean {
  return modeLock(locker, mode).kind === 'affordable';
}

/** Takes the price and unlocks the mode; unchanged when `canUnlockMode` is false. */
export function unlockMode(locker: LockerRoom, mode: UnlockMode): LockerRoom {
  if (!canUnlockMode(locker, mode)) return locker;
  return { ...locker, owned: [...locker.owned], stars: locker.stars - MODE_OFFERS[mode].price, modes: [...locker.modes, mode] };
}

/** Stored modes after the schema check: unknown and repeated names are dropped, in locker room order. */
export function cleanModes(modes: readonly string[]): UnlockMode[] {
  return UNLOCK_MODES.filter((m) => modes.includes(m));
}

/**
 * A start screen button of a mode (FR-141):
 * - `ready`: unlocked and playable, it starts the mode;
 * - `soon`: unlocked, but its game comes later ("kommt bald");
 * - `locked`: not bought yet, greyed with a lock and the price; it opens the locker room at "Spielarten".
 */
export interface ModeButton {
  mode: UnlockMode;
  key: ModeOffer['key'];
  state: 'ready' | 'soon' | 'locked';
  price: number;
}

/**
 * The mode buttons of the start screen, in locker room order. A mode the parent turned off in "Spielarten erlauben"
 * has no button. Locked modes show only while the locker room is on, since only there can they be bought.
 */
export function modeButtons(
  locker: Pick<LockerRoom, 'modes'>,
  allowed: Readonly<Record<UnlockMode, boolean>>,
  lockerRoomOn: boolean,
): ModeButton[] {
  const buttons: ModeButton[] = [];
  for (const mode of UNLOCK_MODES) {
    if (!allowed[mode]) continue;
    const offer = MODE_OFFERS[mode];
    const unlocked = isModeUnlocked(locker, mode);
    if (!unlocked && !lockerRoomOn) continue;
    const state = !unlocked ? 'locked' : offer.playable ? 'ready' : 'soon';
    buttons.push({ mode, key: offer.key, state, price: offer.price });
  }
  return buttons;
}

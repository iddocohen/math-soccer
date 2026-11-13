/**
 * What each start button begins (FR-068, FR-075, FR-105, amendment 21 FR-141), in one table, so the app, the keyboard
 * map and the controller ask the table instead of checking round types one by one.
 *
 * - `play` ("Spielen"), `time` ("Zeit-Challenge") and `cup` ("Pokal") are always there (the time challenge only when the
 *   parent allows it).
 * - `wall` ("Mauer"), `keeper` ("Torwart") and `shootout` ("Elfmeter") are the modes bought in the locker room
 *   (src/core/rewards/modes.ts). Their `mode` is the match mode the controller plays; null while the mode's game is not
 *   built yet (amendment 21 parts 2 and 3).
 *
 * A round's round type stays the one the parent chose for "Spielen", except in the time challenge and the cup. The match
 * mode is a separate field of the round, so "Freistoß mit Mauer" follows the parent's round type (FR-142).
 */
import type { Settings } from '../settings/schema';
import { isModeUnlocked, type UnlockMode } from '../rewards/modes';
import type { LockerRoom } from '../storage/schemas';
import type { RoundType } from '../types';

export const START_KINDS = ['play', 'time', 'cup', 'wall', 'keeper', 'shootout'] as const;
export type StartKind = (typeof START_KINDS)[number];

/** The match modes the controller plays: the usual game, and the free kick with the wall (FR-142). */
export const MATCH_MODES = ['normal', 'wall'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export interface StartKindInfo {
  /** The match mode; null while the mode's game is not built yet ("kommt bald"). */
  mode: MatchMode | null;
  /** The mode to buy in the locker room first; null for the kinds every child has. */
  unlock: UnlockMode | null;
  /** Where the round type comes from: the parent's choice for "Spielen", the time challenge or the cup. */
  roundType: 'settings' | 'time' | 'cup';
}

export const START_KIND_INFO: Record<StartKind, StartKindInfo> = {
  play: { mode: 'normal', unlock: null, roundType: 'settings' },
  time: { mode: 'normal', unlock: null, roundType: 'time' },
  cup: { mode: 'normal', unlock: null, roundType: 'cup' },
  wall: { mode: 'wall', unlock: 'wall', roundType: 'settings' },
  keeper: { mode: null, unlock: 'keeper', roundType: 'settings' },
  shootout: { mode: null, unlock: 'shootout', roundType: 'settings' },
};

/** The kinds `MatchController.start` begins; the cup starts through `startCup`, and modes not built yet not at all. */
export type ControllerKind = 'play' | 'time' | 'wall';

/** The round type of a round started as `kind`. */
export function roundTypeOf(kind: StartKind, settings: Pick<Settings, 'roundType'>): RoundType {
  const from = START_KIND_INFO[kind].roundType;
  return from === 'settings' ? settings.roundType : from;
}

/** The start kind that begins a round like `s` again ("Nochmal"): its round type and its match mode. */
export function startKindOf(s: { roundType: RoundType; mode: MatchMode }): StartKind {
  if (s.roundType === 'time' || s.roundType === 'cup') return s.roundType;
  return START_KINDS.find((k) => START_KIND_INFO[k].roundType === 'settings' && START_KIND_INFO[k].mode === s.mode) ?? 'play';
}

/** True for the kinds `MatchController.start` begins. */
export function isControllerKind(kind: StartKind): kind is ControllerKind {
  return kind === 'play' || kind === 'time' || kind === 'wall';
}

/**
 * True when `kind` can start now: its game is built, the time challenge is allowed, and a mode to unlock is bought and
 * allowed by the parent ("Spielarten erlauben"). A locked mode is never startable (FR-141).
 */
export function canStart(kind: StartKind, locker: Pick<LockerRoom, 'modes'>, settings: Pick<Settings, 'timeChallenge' | 'modesAllowed'>): boolean {
  const info = START_KIND_INFO[kind];
  if (info.mode === null) return false;
  if (kind === 'time' && !settings.timeChallenge.allowed) return false;
  if (info.unlock === null) return true;
  return settings.modesAllowed[info.unlock] && isModeUnlocked(locker, info.unlock);
}

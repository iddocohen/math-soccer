/**
 * What each start button begins (FR-068, FR-075, FR-105, amendment 21 FR-141), in one table, so the app, the keyboard
 * map and the controller ask the table instead of checking round types one by one.
 *
 * - `play` ("Spielen"), `time` ("Zeit-Challenge") and `cup` ("Pokal") are always there (the time challenge only when the
 *   parent allows it).
 * - `wall` ("Mauer"), `keeper` ("Torwart"), `shootout` ("Elfmeter"), `torwand` ("Torwand") and `family` ("Papa gegen
 *   Kind", amendment 23) are the modes bought in the locker room
 *   (src/core/rewards/modes.ts). Their `mode` is the match mode the controller plays.
 *
 * A round's round type stays the one the parent chose for "Spielen", except in the time challenge and the cup. The match
 * mode is a separate field of the round, so "Freistoß mit Mauer" follows the parent's round type (FR-142).
 *
 * `MODE_INFO` holds what differs between the match modes, so the controller, the scene and the screens read one table
 * instead of comparing mode names.
 */
import type { Settings } from '../settings/schema';
import { isModeUnlocked, UNLOCK_MODES, type UnlockMode } from '../rewards/modes';
import type { LockerRoom } from '../storage/schemas';
import type { RoundType } from '../types';
import { KEEPER_SHOTS } from './keeper';
import { TORWAND_SHOTS } from './torwand';

export const START_KINDS = ['play', 'time', 'cup', 'wall', 'keeper', 'shootout', 'torwand', 'family'] as const;
export type StartKind = (typeof START_KINDS)[number];

/**
 * The match modes the controller plays: the usual game, then the modes to unlock: the free kick with the wall
 * (FR-142), the child in goal (FR-143), the penalty shootout (FR-147), the shooting wall (FR-155) and the shootout of
 * the child against a grown-up (FR-158).
 */
export const MATCH_MODES = ['normal', ...UNLOCK_MODES] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export interface StartKindInfo {
  /** The match mode. */
  mode: MatchMode;
  /** Where the round type comes from: the parent's choice for "Spielen", the time challenge or the cup. */
  roundType: 'settings' | 'time' | 'cup';
}

export const START_KIND_INFO: Record<StartKind, StartKindInfo> = {
  play: { mode: 'normal', roundType: 'settings' },
  time: { mode: 'normal', roundType: 'time' },
  cup: { mode: 'normal', roundType: 'cup' },
  wall: { mode: 'wall', roundType: 'settings' },
  keeper: { mode: 'keeper', roundType: 'settings' },
  shootout: { mode: 'shootout', roundType: 'settings' },
  torwand: { mode: 'torwand', roundType: 'settings' },
  family: { mode: 'family', roundType: 'settings' },
};

/** The kinds `MatchController.start` begins; the cup starts through `startCup`. */
export type ControllerKind = Exclude<StartKind, 'cup'>;

/** How the round end tells the result of a mode: goals, saves (FR-146), hits at the board (FR-157), or a shootout. */
export type ModeOutcome = 'goals' | 'saves' | 'hits' | 'shootout';

export interface MatchModeInfo {
  /** The opponent shoots at every target and the child keeps ("Selbst ins Tor"). */
  childKeeps: boolean;
  /** Who takes the kicks of side 1 of a shootout: the opponent team or the grown-up; null without a shootout. */
  kicks: 'opponent' | 'grownup' | null;
  /** The shots of one round ("Selbst ins Tor", "Torwandschießen"); null for the modes that do not count shots. */
  shotLimit: number | null;
  /** The opponent is a cup team (`keeperOpponent`). */
  opponentTeam: boolean;
  /** Hearts show and count with the round types that have them. */
  hearts: boolean;
  /** The personal best's key names only the mode, not the round type (core/records/records.ts). */
  ownRecordKey: boolean;
  /** The mode asks for its setup on a start card first ("Papa gegen Kind"). */
  needsSetup: boolean;
  /** How the round end tells the result. */
  outcome: ModeOutcome;
}

const PLAIN: MatchModeInfo = {
  childKeeps: false,
  kicks: null,
  shotLimit: null,
  opponentTeam: false,
  hearts: true,
  ownRecordKey: false,
  needsSetup: false,
  outcome: 'goals',
};

/** What differs between the match modes. */
export const MODE_INFO: Record<MatchMode, MatchModeInfo> = {
  normal: PLAIN,
  wall: PLAIN,
  keeper: { ...PLAIN, childKeeps: true, shotLimit: KEEPER_SHOTS, opponentTeam: true, hearts: false, ownRecordKey: true, outcome: 'saves' },
  shootout: { ...PLAIN, kicks: 'opponent', opponentTeam: true, hearts: false, ownRecordKey: true, outcome: 'shootout' },
  torwand: { ...PLAIN, shotLimit: TORWAND_SHOTS, hearts: false, ownRecordKey: true, outcome: 'hits' },
  family: { ...PLAIN, kicks: 'grownup', hearts: false, ownRecordKey: true, needsSetup: true, outcome: 'shootout' },
};

/** The mode to buy in the locker room before `kind` starts; null for the kinds every child has. */
function unlockOf(kind: StartKind): UnlockMode | null {
  const mode = START_KIND_INFO[kind].mode;
  return mode === 'normal' ? null : mode;
}

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

/**
 * True when `kind` can start now: the time challenge is allowed, and a mode to unlock is bought and allowed by the
 * parent ("Spielarten erlauben"). A locked mode is never startable (FR-141).
 */
export function canStart(kind: StartKind, locker: Pick<LockerRoom, 'modes'>, settings: Pick<Settings, 'timeChallenge' | 'modesAllowed'>): boolean {
  if (kind === 'time' && !settings.timeChallenge.allowed) return false;
  const unlock = unlockOf(kind);
  if (unlock === null) return true;
  return settings.modesAllowed[unlock] && isModeUnlocked(locker, unlock);
}

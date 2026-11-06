/**
 * Builds the AttemptRecord of one finished target (T043, FR-037, FR-038; data-model "AttemptRecord").
 *
 * Directions (FR-038): a target counts toward each direction its hints point from, which `Target.directions` already
 * holds. A target whose hints never showed (hints on request and no help asked) counts toward every direction the
 * parent allows ("Richtungen", FR-066). Every new record has the mode `keeper` (amendment 05).
 */
import { hintsVisible, targetHintDisplay } from '../match/help';
import type { Settings } from '../settings/schema';
import type { AttemptRecord } from '../storage/schemas';
import { allowedDirections } from './ladder';
import { PLAYED_MODE, type Direction, type Target } from '../types';
import { classifyAttempt } from './classify';

export interface FinishedTarget {
  min: number;
  max: number;
  target: Target;
  settings: Settings;
  solved: boolean;
  /** Highest help step used, 0 to 3. */
  helpStep: number;
  misses: number;
  /** Play time when the target appeared. */
  startedAt: number;
  /** Play time of the scoring shot, or of the end of the round for a target left unsolved. */
  endedAt: number;
  /** Play times of the misses on this target. */
  missTimes: readonly number[];
  /** Wall clock time, for `at`. */
  now: Date;
}

/** The directions an attempt counts toward (FR-038). */
export function attemptDirections(target: Target, settings: Settings, helpStep: number): Direction[] {
  const display = targetHintDisplay(settings, target);
  const shown = hintsVisible(display, helpStep);
  if (shown && target.directions.length > 0) return [...target.directions];
  return allowedDirections(settings);
}

export function makeAttemptRecord(f: FinishedTarget): AttemptRecord {
  const responseMs = Math.max(0, f.endedAt - f.startedAt);
  const { guess } = classifyAttempt({
    solved: f.solved,
    helpStep: f.helpStep,
    misses: f.misses,
    responseMs,
    missTimes: f.missTimes,
    shotAt: f.endedAt,
  });
  return {
    at: f.now.toISOString(),
    mode: PLAYED_MODE,
    min: f.min,
    max: f.max,
    target: f.target.number,
    directions: attemptDirections(f.target, f.settings, f.helpStep),
    hintDistance: { ...f.settings.hintDistance },
    hintDisplay: targetHintDisplay(f.settings, f.target),
    difficultyStep: f.target.difficultyStep,
    solved: f.solved,
    helpStep: f.helpStep,
    misses: f.misses,
    responseMs,
    guess,
  };
}

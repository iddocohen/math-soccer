/**
 * The cup journey (amendment 13, FR-105 to FR-112). Pure functions over the stored cup (`mathsoccer.cup.v1`,
 * storage/schemas.ts `cupSchema`); the app stores the result.
 *
 * - A cup has five matches in a fixed order (CUP_STAGES): two group games, the quarter final, the semi final and the
 *   final (FR-106). Each match is against one of the made-up teams of teams.ts (FR-107).
 * - A match is won by scoring the parent's "Tore pro Spiel" before the 3 hearts are gone (FR-108). A win moves the cup
 *   to the next match; a loss counts one more try of the same match. There is never a step back.
 * - Each match plays one level (FR-109). The stages spread over the parent's level range: the group games at the lowest
 *   level of the cup, the final at the hardest level. After EASIER_AFTER_TRIES lost tries of the same match it plays one
 *   level easier, never below the start level (design call of the amendment).
 * - Each new cup sits one level higher (FR-111): its group games start one level above the last cup's, until they reach
 *   the hardest level. The levels come from the cup number, so they follow the parent's range when it changes.
 * - Stars (FR-112): goals earn their usual stars in the match; a won match adds MATCH_WIN_STARS and a won cup
 *   CUP_WIN_STARS on top.
 */
import { levelRange, type Level } from '../progress/levels';
import type { Settings } from '../settings/schema';
import { CUP_MATCHES, type Cup } from '../storage/schemas';
import { TEAMS, type CupTeam } from './teams';

export { CUP_MATCHES };

/** The five matches of a cup in bracket order, from left to right (FR-106). */
export const CUP_STAGES = ['group1', 'group2', 'quarterFinal', 'semiFinal', 'final'] as const;
export type CupStage = (typeof CUP_STAGES)[number];

/** Stars for a won match and, on top, for a won cup (FR-112). */
export const MATCH_WIN_STARS = 5;
export const CUP_WIN_STARS = 20;

/** After this many lost tries of the same match, it plays one level easier (FR-109). */
export const EASIER_AFTER_TRIES = 2;

type LevelSettings = Pick<Settings, 'levels' | 'shapes'>;

/** The opponent of match `stage` (0 to 4) in cup number `cup`; the teams take turns over the cups. */
export function teamOf(cup: number, stage: number): CupTeam {
  return TEAMS[((cup - 1) * CUP_MATCHES + stage) % TEAMS.length]!;
}

/** The position in the parent's level range (`levelRange`) that match `stage` of cup `cup` plays, before any easing. */
function stageIndex(cup: number, stage: number, rangeLength: number): number {
  const last = rangeLength - 1;
  // Each cup's group games start one level above the last cup's, up to the hardest level (FR-111).
  const first = Math.min(cup - 1, last);
  return first + Math.round((stage * (last - first)) / (CUP_MATCHES - 1));
}

/**
 * The level the next match plays: its stage level, or one level easier after EASIER_AFTER_TRIES lost tries, never below
 * the start level (FR-109).
 */
export function matchLevel(cup: Cup, settings: LevelSettings): Level {
  const range = levelRange(settings);
  const index = stageIndex(cup.cup, cup.stage, range.length);
  const eased = cup.tries >= EASIER_AFTER_TRIES ? Math.max(0, index - 1) : index;
  return range[eased]!;
}

/** What the next match of the cup is: its stage, the opponent, its level and the goals that win it. */
export interface CupMatch {
  stage: number;
  team: CupTeam;
  level: Level;
  /** "Tore pro Spiel" (FR-108). */
  goals: number;
}

export function nextMatch(cup: Cup, settings: LevelSettings & Pick<Settings, 'cupGoals'>): CupMatch {
  return {
    stage: cup.stage,
    team: teamOf(cup.cup, cup.stage),
    level: matchLevel(cup, settings),
    goals: settings.cupGoals,
  };
}

/** How a cup match ended: the child's goals, the hearts lost (the opponent's score), and whether it was won. */
export interface MatchResult {
  won: boolean;
  goals: number;
  against: number;
}

/** What a finished match did to the cup. */
export interface CupUpdate {
  cup: Cup;
  /** Bonus stars on top of the goal stars: MATCH_WIN_STARS for a win, plus CUP_WIN_STARS when it won the cup. */
  stars: number;
  /** The match won the final: the cup went on the trophy shelf and the next cup starts. */
  cupWon: boolean;
}

/**
 * The cup after a finished match (FR-108, FR-111, FR-112). A loss adds a try of the same match. A win records its score
 * and moves to the next match; a won final puts the cup on the trophy shelf and starts the next cup at its first match.
 * A match left with "Zum Start" never reaches here (FR-118).
 */
export function recordMatch(cup: Cup, result: MatchResult, now: Date = new Date()): CupUpdate {
  if (!result.won) return { cup: { ...cup, scores: [...cup.scores], trophies: [...cup.trophies], tries: cup.tries + 1 }, stars: 0, cupWon: false };
  const scores = [...cup.scores, { goals: result.goals, against: result.against }];
  if (cup.stage < CUP_MATCHES - 1) {
    return { cup: { ...cup, stage: cup.stage + 1, tries: 0, scores, trophies: [...cup.trophies] }, stars: MATCH_WIN_STARS, cupWon: false };
  }
  const trophies = [...cup.trophies, { cup: cup.cup, at: now.toISOString() }];
  return {
    cup: { version: 1, cup: cup.cup + 1, stage: 0, tries: 0, scores: [], trophies },
    stars: MATCH_WIN_STARS + CUP_WIN_STARS,
    cupWon: true,
  };
}

import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { cupSchema, emptyCup, type Cup } from '../storage/schemas';
import { CUP_STAGES, CUP_WIN_STARS, matchLevel, MATCH_WIN_STARS, nextMatch, recordMatch, stageLevel, teamOf } from './cup';
import { QUIRKS, TEAMS } from './teams';

function settings(start: Settings['levels']['start'], hardest: Settings['levels']['hardest'], over: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), levels: { start, hardest }, ...over };
}

function cupAt(over: Partial<Cup>): Cup {
  return { ...emptyCup(), ...over };
}

const NOW = new Date('2026-11-06T12:00:00.000Z');

describe('cup bracket (FR-106, FR-107)', () => {
  it('has five matches in bracket order', () => {
    expect(CUP_STAGES).toEqual(['group1', 'group2', 'quarterFinal', 'semiFinal', 'final']);
  });

  it('has 8 made-up teams with names, colors and a look-only quirk', () => {
    expect(TEAMS).toHaveLength(8);
    expect(new Set(TEAMS.map((t) => t.name)).size).toBe(8);
    expect(TEAMS.map((t) => t.name)).toEqual(['FC Blitz', 'Rote Löwen', 'Adler 09', 'Blaue Haie', 'Turbo Kicker', 'Grüne Frösche', 'Sternenelf', 'Wilde Wölfe']);
    for (const team of TEAMS) {
      expect(team.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(team.trim).toMatch(/^#[0-9a-f]{6}$/);
      expect(QUIRKS).toContain(team.quirk);
    }
    // Every quirk of the amendment is used by at least one team.
    expect(new Set(TEAMS.map((t) => t.quirk))).toEqual(new Set(QUIRKS));
  });

  it('meets five different teams in a cup, and the teams take turns over the cups', () => {
    const first = [0, 1, 2, 3, 4].map((stage) => teamOf(1, stage).id);
    expect(new Set(first).size).toBe(5);
    expect(teamOf(2, 0).id).toBe(TEAMS[5]!.id);
    expect(teamOf(1, 0).id).not.toBe(teamOf(2, 0).id);
  });

  it('the next match names its stage, opponent, level and goals', () => {
    const m = nextMatch(cupAt({ stage: 2, scores: [{ goals: 5, against: 0 }, { goals: 5, against: 1 }] }), settings(1, 5, { cupGoals: 3 }));
    expect(m).toMatchObject({ stage: 2, stageName: 'quarterFinal', level: 3, goals: 3, tries: 0 });
    expect(m.team).toBe(teamOf(1, 2));
  });
});

describe('match levels (FR-109, FR-111)', () => {
  it('spreads the first cup from the start level (group games) to the hardest level (final)', () => {
    expect([0, 1, 2, 3, 4].map((stage) => stageLevel(1, stage, settings(1, 5)))).toEqual([1, 2, 3, 4, 5]);
    expect([0, 1, 2, 3, 4].map((stage) => stageLevel(1, stage, settings(2, 3)))).toEqual([2, 2, 3, 3, 3]);
    expect([0, 1, 2, 3, 4].map((stage) => stageLevel(1, stage, settings(4, 4)))).toEqual([4, 4, 4, 4, 4]);
  });

  it('skips levels 3 and 4 when every shape is off', () => {
    const noShapes = settings(1, 5, { shapes: { I: false, O: false, T: false, L: false, J: false, S: false, Z: false } });
    expect([0, 1, 2, 3, 4].map((stage) => stageLevel(1, stage, noShapes))).toEqual([1, 2, 2, 5, 5]);
  });

  it('starts each new cup one level higher, up to the hardest level', () => {
    const s = settings(1, 5);
    expect(stageLevel(2, 0, s)).toBe(2);
    expect(stageLevel(3, 0, s)).toBe(3);
    expect(stageLevel(5, 0, s)).toBe(5);
    expect(stageLevel(9, 0, s)).toBe(5);
    // The final is always at the hardest level.
    for (const cup of [1, 2, 3, 7]) expect(stageLevel(cup, 4, s)).toBe(5);
    // Within the parent's range: start 2, hardest 3.
    expect(stageLevel(4, 0, settings(2, 3))).toBe(3);
  });

  it('plays one level easier after 2 lost tries of the same match, never below the start level', () => {
    const s = settings(2, 5);
    expect(matchLevel(cupAt({ stage: 4, tries: 0, scores: Array(4).fill({ goals: 5, against: 0 }) }), s)).toBe(5);
    expect(matchLevel(cupAt({ stage: 4, tries: 1, scores: Array(4).fill({ goals: 5, against: 0 }) }), s)).toBe(5);
    expect(matchLevel(cupAt({ stage: 4, tries: 2, scores: Array(4).fill({ goals: 5, against: 0 }) }), s)).toBe(4);
    expect(matchLevel(cupAt({ stage: 4, tries: 6, scores: Array(4).fill({ goals: 5, against: 0 }) }), s)).toBe(4);
    // Group game 1 already at the start level stays there.
    expect(matchLevel(cupAt({ stage: 0, tries: 3 }), s)).toBe(2);
  });
});

describe('match results (FR-108, FR-111, FR-112)', () => {
  it('a loss adds a try of the same match, no stars, and never a step back', () => {
    const before = cupAt({ stage: 1, tries: 0, scores: [{ goals: 5, against: 2 }] });
    const r = recordMatch(before, { won: false, goals: 2, against: 3 }, NOW);
    expect(r).toEqual({ cup: { ...before, tries: 1 }, stars: 0, cupWon: false });
    expect(recordMatch(r.cup, { won: false, goals: 0, against: 3 }, NOW).cup).toMatchObject({ stage: 1, tries: 2 });
  });

  it('a win records the score, moves to the next match, clears the tries and gives 5 stars', () => {
    const r = recordMatch(cupAt({ stage: 0, tries: 2 }), { won: true, goals: 5, against: 1 }, NOW);
    expect(r).toEqual({ cup: cupAt({ stage: 1, tries: 0, scores: [{ goals: 5, against: 1 }] }), stars: MATCH_WIN_STARS, cupWon: false });
    expect(MATCH_WIN_STARS).toBe(5);
  });

  it('a won final puts the cup on the trophy shelf, starts the next cup and gives 5 + 20 stars', () => {
    const final = cupAt({ cup: 2, stage: 4, scores: Array(4).fill({ goals: 5, against: 0 }), trophies: [{ cup: 1, at: '2026-11-01T10:00:00.000Z' }] });
    const r = recordMatch(final, { won: true, goals: 5, against: 2 }, NOW);
    expect(r.cupWon).toBe(true);
    expect(r.stars).toBe(MATCH_WIN_STARS + CUP_WIN_STARS);
    expect(CUP_WIN_STARS).toBe(20);
    expect(r.cup).toEqual({
      version: 1,
      cup: 3,
      stage: 0,
      tries: 0,
      scores: [],
      trophies: [
        { cup: 1, at: '2026-11-01T10:00:00.000Z' },
        { cup: 2, at: NOW.toISOString() },
      ],
    });
  });

  it('a whole cup won in a row: five matches, the trophy and 45 bonus stars', () => {
    let cup = emptyCup();
    let stars = 0;
    for (let i = 0; i < 5; i++) {
      const r = recordMatch(cup, { won: true, goals: 5, against: 0 }, NOW);
      cup = r.cup;
      stars += r.stars;
    }
    expect(stars).toBe(5 * MATCH_WIN_STARS + CUP_WIN_STARS);
    expect(cup).toMatchObject({ cup: 2, stage: 0, trophies: [{ cup: 1 }] });
  });

  it('never changes the cup it gets', () => {
    const before = cupAt({ stage: 4, scores: Array(4).fill({ goals: 5, against: 0 }) });
    const copy = structuredClone(before);
    recordMatch(before, { won: true, goals: 5, against: 0 }, NOW);
    recordMatch(before, { won: false, goals: 1, against: 3 }, NOW);
    expect(before).toEqual(copy);
  });
});

describe('stored cup (mathsoccer.cup.v1)', () => {
  it('accepts the empty cup and every result of recordMatch', () => {
    expect(cupSchema.safeParse(emptyCup()).success).toBe(true);
    let cup = emptyCup();
    for (let i = 0; i < 7; i++) {
      cup = recordMatch(cup, { won: i !== 2, goals: 5, against: 1 }, NOW).cup;
      expect(cupSchema.safeParse(cup).success).toBe(true);
    }
  });

  it('refuses a stage outside the bracket and scores that do not match the stage', () => {
    expect(cupSchema.safeParse({ ...emptyCup(), stage: 5, scores: Array(5).fill({ goals: 1, against: 0 }) }).success).toBe(false);
    expect(cupSchema.safeParse({ ...emptyCup(), stage: 2, scores: [] }).success).toBe(false);
    expect(cupSchema.safeParse({ ...emptyCup(), cup: 0 }).success).toBe(false);
    expect(cupSchema.safeParse({ ...emptyCup(), version: 2 }).success).toBe(false);
  });
});

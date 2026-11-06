import { describe, expect, it } from 'vitest';
import { layoutChart } from '../core/chart/layout';
import { CHART_RECT } from '../core/match/world';
import type { Target } from '../core/types';
import { boardKey, buildBoard, type BoardInput } from './board';

const target: Target = { number: 46, hints: [45, 47, 36, 56], directions: ['right'], difficultyStep: 0, pattern: 'neighbors' };

function input(over: Partial<BoardInput> = {}): BoardInput {
  return { layout: layoutChart(1, 100), goal: CHART_RECT, target, hintsVisible: true, helpStep: 0, shown: null, hintFrom: null, ...over };
}

const square = (b: ReturnType<typeof buildBoard>, n: number) => b.squares.find((s) => s.n === n)!;

describe('buildBoard: the open goal (FR-013, FR-019)', () => {
  it('has one square per number, the target outlined and the hints lit', () => {
    const b = buildBoard(input());
    expect(b.squares).toHaveLength(100);
    expect(b.squares.filter((s) => s.outlined).map((s) => s.n)).toEqual([46]);
    expect(b.squares.filter((s) => s.lit).map((s) => s.n).sort()).toEqual([36, 45, 47, 56]);
  });

  it('shows only the hint numbers; the target square stays empty before help step 3', () => {
    const b = buildBoard(input());
    const labelled = b.squares.filter((s) => s.label).map((s) => s.n);
    expect(labelled.sort((a, z) => a! - z!)).toEqual([36, 45, 47, 56]);
    expect(square(b, 46).label).toBeNull();
  });

  it('shows and lights no hints while they are hidden ("auf Wunsch" before help)', () => {
    const b = buildBoard(input({ hintsVisible: false }));
    expect(b.squares.some((s) => s.label)).toBe(false);
    expect(b.squares.some((s) => s.lit)).toBe(false);
  });

  it('the shown square of a miss is orange with its number (FR-004)', () => {
    const s = square(buildBoard(input({ shown: 73 })), 73);
    expect(s.shown).toBe(true);
    expect(s.label).toEqual({ text: '73', style: 'shown' });
  });

  it('squares outside the range in a partial row carry no number (FR-007)', () => {
    const b = buildBoard(input({ layout: layoutChart(5, 98), target: null }));
    const empty = b.squares.filter((s) => s.n === null);
    expect(empty).toHaveLength(4 + 2);
    expect(empty.every((s) => s.label === null && !s.lit && !s.outlined)).toBe(true);
  });

  it('numbers fit in squares of 14 world pixels or more; smaller squares put labels on a badge (R4)', () => {
    expect(buildBoard(input()).numbersFit).toBe(true);
    expect(buildBoard(input({ layout: layoutChart(0, 1000), target: null })).numbersFit).toBe(false);
  });
});

describe('boardKey (plan decision 9)', () => {
  it('changes with the target, the hints shown, the help step and the shown square, and only then', () => {
    const base = boardKey(input());
    expect(boardKey(input())).toBe(base);
    expect(boardKey(input({ target: { ...target, number: 47 } }))).not.toBe(base);
    expect(boardKey(input({ hintsVisible: false }))).not.toBe(base);
    expect(boardKey(input({ helpStep: 1 }))).not.toBe(base);
    expect(boardKey(input({ shown: 12 }))).not.toBe(base);
  });
});

describe('buildBoard: help on the board (T040)', () => {
  it('draws an arrow from the hint square to the target at help steps 1 and 2 only', () => {
    expect(buildBoard(input({ helpStep: 0, hintFrom: 36 })).arrow).toBeNull();
    const arrow = buildBoard(input({ helpStep: 1, hintFrom: 36 })).arrow;
    expect(arrow).not.toBeNull();
    // 36 is straight above 46: same x, and the arrow points down.
    expect(arrow!.from.x).toBeCloseTo(arrow!.to.x);
    expect(arrow!.to.y).toBeGreaterThan(arrow!.from.y);
    expect(buildBoard(input({ helpStep: 2, hintFrom: 36 })).arrow).not.toBeNull();
    expect(buildBoard(input({ helpStep: 3, hintFrom: 36 })).arrow).toBeNull();
  });

  it('writes the answer in the target square at help step 3', () => {
    expect(square(buildBoard(input({ helpStep: 2 })), 46).label).toBeNull();
    expect(square(buildBoard(input({ helpStep: 3 })), 46).label).toEqual({ text: '46', style: 'answer' });
  });

  it('the board key changes with the arrow start', () => {
    expect(boardKey(input({ helpStep: 1, hintFrom: 36 }))).not.toBe(boardKey(input({ helpStep: 1, hintFrom: 45 })));
  });
});

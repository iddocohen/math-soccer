import { describe, expect, it } from 'vitest';
import { layoutChart } from '../core/chart/layout';
import { CHART_RECT } from '../core/match/world';
import type { Target } from '../core/types';
import { boardKey, buildBoard, type BoardInput } from './board';

const target: Target = { mode: 'holes', number: 46, hints: [45, 47, 36, 56], patchedHoles: [12, 83], directions: ['right'], difficultyStep: 0 };

function input(over: Partial<BoardInput> = {}): BoardInput {
  return { layout: layoutChart(1, 100), goal: CHART_RECT, mode: 'holes', target, hintsVisible: true, helpStep: 0, shown: null, hintFrom: null, line: null, ...over };
}

const square = (b: ReturnType<typeof buildBoard>, n: number) => b.squares.find((s) => s.n === n)!;

describe('buildBoard: hole mode (FR-011, FR-013)', () => {
  it('has one square per number, one open hole at the target with an outline, and the patched holes', () => {
    const b = buildBoard(input());
    expect(b.squares).toHaveLength(100);
    expect(b.squares.filter((s) => s.kind === 'hole').map((s) => s.n)).toEqual([46]);
    expect(square(b, 46).outlined).toBe(true);
    expect(b.squares.filter((s) => s.kind === 'patch').map((s) => s.n)).toEqual([12, 83]);
  });

  it('prints only the hint numbers; the hole stays blank before help step 3', () => {
    const b = buildBoard(input());
    const labelled = b.squares.filter((s) => s.label).map((s) => s.n);
    expect(labelled.sort((a, z) => a! - z!)).toEqual([36, 45, 47, 56]);
    expect(square(b, 46).label).toBeNull();
  });

  it('prints no hints while they are hidden ("auf Wunsch" before help)', () => {
    expect(buildBoard(input({ hintsVisible: false })).squares.some((s) => s.label)).toBe(false);
  });

  it('help step 3 writes the answer in the hole', () => {
    expect(square(buildBoard(input({ helpStep: 3 })), 46).label).toEqual({ text: '46', style: 'answer' });
  });

  it('the shown square of a miss is orange with its number (FR-004)', () => {
    const s = square(buildBoard(input({ shown: 73 })), 73);
    expect(s.shown).toBe(true);
    expect(s.label).toEqual({ text: '73', style: 'shown' });
  });

  it('squares outside the range in a partial row are empty and carry no number (FR-007)', () => {
    const b = buildBoard(input({ layout: layoutChart(5, 98), target: null }));
    const empty = b.squares.filter((s) => s.kind === 'empty');
    expect(empty).toHaveLength(4 + 2);
    expect(empty.every((s) => s.n === null && s.label === null)).toBe(true);
  });

  it('numbers fit in squares of 14 world pixels or more; smaller squares put labels on a badge (R4)', () => {
    expect(buildBoard(input()).numbersFit).toBe(true);
    expect(buildBoard(input({ layout: layoutChart(0, 1000), target: null })).numbersFit).toBe(false);
  });
});

describe('buildBoard: goalkeeper mode (FR-019)', () => {
  it('the goal is open, the hints are lit and patched holes are not drawn', () => {
    const b = buildBoard(input({ mode: 'keeper' }));
    expect(b.squares.every((s) => s.kind === 'open')).toBe(true);
    expect(b.squares.filter((s) => s.lit).map((s) => s.n).sort()).toEqual([36, 45, 47, 56]);
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
  it('draws an arrow from the hint square to the hole at help steps 1 and 2 only', () => {
    expect(buildBoard(input({ helpStep: 0, hintFrom: 36 })).arrow).toBeNull();
    const arrow = buildBoard(input({ helpStep: 1, hintFrom: 36 })).arrow;
    expect(arrow).not.toBeNull();
    // 36 is straight above 46: same x, and the arrow points down.
    expect(arrow!.from.x).toBeCloseTo(arrow!.to.x);
    expect(arrow!.to.y).toBeGreaterThan(arrow!.from.y);
    expect(buildBoard(input({ helpStep: 2, hintFrom: 36 })).arrow).not.toBeNull();
    expect(buildBoard(input({ helpStep: 3, hintFrom: 36 })).arrow).toBeNull();
  });

  it('writes the answer in the hole at help step 3', () => {
    expect(square(buildBoard(input({ helpStep: 2 })), 46).label).toBeNull();
    expect(square(buildBoard(input({ helpStep: 3 })), 46).label).toEqual({ text: '46', style: 'answer' });
  });

  it('the board key changes with the arrow start', () => {
    expect(boardKey(input({ helpStep: 1, hintFrom: 36 }))).not.toBe(boardKey(input({ helpStep: 1, hintFrom: 45 })));
  });
});

describe('buildBoard: line mode (FR-015, FR-016)', () => {
  const line = { squares: [3, 13, 23, 33, 43], given: 2, index: 3 };
  const lineTarget = { mode: 'lines' as const, number: 33, hints: [23], patchedHoles: [], directions: ['down' as const], difficultyStep: 0 };
  const lines = (over: Partial<BoardInput> = {}) => buildBoard(input({ mode: 'lines', target: lineTarget, line, ...over }));

  it('the board is mostly blank: only the given and shot squares of the line carry numbers', () => {
    const b = lines();
    expect(b.squares.filter((s) => s.label).map((s) => s.n)).toEqual([3, 13, 23]);
    expect(b.squares.every((s) => s.kind === 'printed')).toBe(true);
  });

  it('given squares are printed, shot squares lit, and the target outlined', () => {
    const b = lines();
    expect(square(b, 3)).toMatchObject({ lit: false, label: { text: '3', style: 'ink' } });
    expect(square(b, 13).lit).toBe(false);
    expect(square(b, 23)).toMatchObject({ lit: true, label: { text: '23', style: 'ink' } });
    expect(square(b, 33)).toMatchObject({ outlined: true, lit: false, label: null });
    expect(square(b, 43)).toMatchObject({ outlined: false, lit: false, label: null });
  });

  it('a finished line lights every shot square and outlines none', () => {
    const b = lines({ line: { ...line, index: 5 }, target: { ...lineTarget, number: 43 } });
    expect([23, 33, 43].every((n) => square(b, n).lit)).toBe(true);
    expect(b.squares.some((s) => s.outlined)).toBe(false);
  });

  it('the key changes when the line moves on', () => {
    expect(boardKey(input({ mode: 'lines', line }))).not.toBe(boardKey(input({ mode: 'lines', line: { ...line, index: 4 } })));
  });
});

/**
 * Hint patterns end to end (T090; amendment 05, FR-065; amendment 09): for each pattern of level 1 "Gerade Linien", a
 * seed whose first target has that pattern (worked out as the game does it), Enter starts "Spielen", the target carries
 * the pattern (`data-pattern`) and its hint numbers (`data-hints`) sit where the pattern says, and shooting the target
 * scores the round's one goal. Level 4 "Formen mit 2 Lücken" gets its own round (T091): a shape with two empty squares
 * scores two goals, one after the other. Keys drive the game; waits are on data-* state, never fixed sleeps.
 */
import type { Locator } from '@playwright/test';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings, type Level } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { layoutChart } from '../../src/core/chart/layout';
import { createRng, deriveSeed } from '../../src/core/rng';
import { nextTarget } from '../../src/core/targets/nextTarget';
import type { Target } from '../../src/core/types';

/** The first seed whose first target at `level` passes `ok`, worked out as the game does it for a child without progress. */
function seedFor(settings: Settings, level: Level, ok: (t: Target) => boolean): number {
  const layout = layoutChart(settings.range.min, settings.range.max);
  const first = (seed: number) => nextTarget({ layout, settings, progress: { mastered: [], level, xTwoEmpties: false }, rng: createRng(deriveSeed(seed, 0)) });
  let seed = 1;
  while (!ok(first(seed))) seed++;
  return seed;
}

/** The hint numbers of the current target, in the order the pattern gives them. */
async function hintsOf(match: Locator): Promise<number[]> {
  await expect(match).toHaveAttribute('data-hints', /^\d+(,\d+)*$/);
  return (await match.getAttribute('data-hints'))!.split(',').map(Number);
}

const CASES = [
  {
    pattern: 'neighbors',
    name: 'Nachbarn',
    // Direct neighbors only: at least two hints, each one square across or down from the target.
    check: (target: number, hints: number[]) => {
      expect(hints.length).toBeGreaterThanOrEqual(2);
      for (const h of hints) expect([1, 10]).toContain(Math.abs(h - target));
    },
    extra: { hintDistance: { direct: true, vertical: false, diagonal: false, far: false } },
  },
  {
    pattern: 'middle',
    name: 'Mitte',
    // One square on each side in one direction: the target is the middle.
    check: (target: number, hints: number[]) => {
      expect(hints).toHaveLength(2);
      expect(hints[0]! + hints[1]!).toBe(2 * target);
    },
    extra: {},
  },
  {
    pattern: 'row',
    name: 'Reihe',
    // Two or three squares before the target in one direction: the target continues the row.
    check: (target: number, hints: number[]) => {
      expect([2, 3]).toContain(hints.length);
      const step = hints[1]! - hints[0]!;
      expect(step).not.toBe(0);
      for (let i = 1; i < hints.length; i++) expect(hints[i]! - hints[i - 1]!).toBe(step);
      expect(target - hints.at(-1)!).toBe(step);
    },
    extra: {},
  },
] as const;

for (const c of CASES) {
  test(`at level 1, a round of one goal with a ${c.name} target`, async ({ page }) => {
    const settings: Settings = {
      ...defaultSettings(),
      ...c.extra,
      levels: { start: 1, hardest: 1 },
      adaptive: false,
      roundType: 'goalCount',
      goalsPerRound: 1,
    };
    const seed = seedFor(settings, 1, (t) => t.pattern === c.pattern);
    await seedStorage(page, { [SETTINGS_KEY]: settings });
    await page.goto(`/?start=play&seed=${seed}`);
    const match = await startRound(page);
    await expect(match).toHaveAttribute('data-pattern', c.pattern);
    await expect(match).toHaveAttribute('data-level', '1');
    const target = await targetNumber(match);
    c.check(target, await hintsOf(match));

    await typeAndShoot(page, target);
    await expect(match).toHaveAttribute('data-goals', '1');
    await expect(page.getByTestId('round-end')).toBeVisible();
  });
}

test('at level 4 "Formen mit 2 Lücken", a shape with two empty squares scores two goals in a row', async ({ page }) => {
  const settings: Settings = {
    ...defaultSettings(),
    levels: { start: 4, hardest: 4 },
    adaptive: false,
    roundType: 'goalCount',
    goalsPerRound: 2,
  };
  const seed = seedFor(settings, 4, (t) => t.queue !== undefined);

  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto(`/?start=play&seed=${seed}`);
  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-pattern', 'shape');
  await expect(match).toHaveAttribute('data-level', '4');
  await expect(match).toHaveAttribute('data-queue', /^\d+$/);
  const target = await targetNumber(match);
  const second = Number(await match.getAttribute('data-queue'));
  const hints = await hintsOf(match);
  expect(hints).toHaveLength(2);

  await typeAndShoot(page, target);
  await expect(match).toHaveAttribute('data-goals', '1');
  // The second empty square is the target now, and the first one lights up with the other two squares.
  await expect(match).toHaveAttribute('data-target', String(second));
  await expect(match).toHaveAttribute('data-hints', [...hints, target].join(','));
  await expect(match).toHaveAttribute('data-queue', '');

  await typeAndShoot(page, second);
  await expect(match).toHaveAttribute('data-goals', '2');
  await expect(page.getByTestId('round-end')).toBeVisible();
});

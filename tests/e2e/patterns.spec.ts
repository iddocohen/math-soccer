/**
 * Hint patterns end to end (T090; amendment 05, FR-065, FR-066): for each pattern, the settings allow only that
 * pattern, Enter starts "Spielen", the target carries the pattern (`data-pattern`) and its hint numbers (`data-hints`)
 * sit where the pattern says, and shooting the target scores the round's one goal. "Formen" gets its own round with
 * the shapes (T091): a shape with two empty squares scores two goals, one after the other. Keys drive the game; waits are on data-* state, never fixed sleeps.
 */
import type { Locator } from '@playwright/test';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { layoutChart } from '../../src/core/chart/layout';
import { createRng, deriveSeed } from '../../src/core/rng';
import { nextTarget, NO_PROGRESS } from '../../src/core/targets/nextTarget';

const NONE = { neighbors: false, middle: false, row: false, shape: false };

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
  test(`with only "${c.name}" allowed, a round of one goal has ${c.name} targets`, async ({ page }) => {
    await seedStorage(page, {
      [SETTINGS_KEY]: {
        ...defaultSettings(),
        ...c.extra,
        patterns: { ...NONE, [c.pattern]: true },
        adaptive: false,
        roundType: 'goalCount',
        goalsPerRound: 1,
      },
    });
    await page.goto('/?start=play&seed=6');
    const match = await startRound(page);
    await expect(match).toHaveAttribute('data-pattern', c.pattern);
    const target = await targetNumber(match);
    c.check(target, await hintsOf(match));

    await typeAndShoot(page, target);
    await expect(match).toHaveAttribute('data-goals', '1');
    await expect(page.getByTestId('round-end')).toBeVisible();
  });
}

test('with only "Formen" allowed, a shape with two empty squares scores two goals in a row', async ({ page }) => {
  const settings = {
    ...defaultSettings(),
    patterns: { ...NONE, shape: true },
    adaptive: false,
    roundType: 'goalCount' as const,
    goalsPerRound: 2,
  };
  // The first seed whose first target is a shape with two empty squares, worked out as the game does it.
  const layout = layoutChart(settings.range.min, settings.range.max);
  const first = (seed: number) => nextTarget({ layout, settings, progress: NO_PROGRESS, rng: createRng(deriveSeed(seed, 0)) });
  let seed = 1;
  while (!first(seed).queue) seed++;

  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto(`/?start=play&seed=${seed}`);
  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-pattern', 'shape');
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

/**
 * Cutouts of level 6 "Ausschnitte" end to end (T109, amendment 18, FR-125 to FR-127): with start and hardest level 6 and
 * a seed whose first target is a 3×3 box, the child fills the box square by square. The first seven squares light up
 * one after the other without a keeper dive (`data-keeper` stays `idle` the whole time, watched with a
 * MutationObserver), and the eighth is a keeper shot that scores the cutout's one goal (`data-goals` 0 to 1). Keys
 * drive the game; waits are on data-* state, never fixed sleeps.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { layoutChart } from '../../src/core/chart/layout';
import { createRng, deriveSeed } from '../../src/core/rng';
import { nextTarget } from '../../src/core/targets/nextTarget';

test('at level 6, a 3×3 box fills square by square without the keeper, and its last square is the goal', async ({ page }) => {
  const settings: Settings = {
    ...defaultSettings(),
    levels: { start: 6, hardest: 6 },
    adaptive: false,
    roundType: 'goalCount',
    goalsPerRound: 2,
  };
  const layout = layoutChart(settings.range.min, settings.range.max);
  const first = (seed: number) => nextTarget({ layout, settings, progress: { mastered: [], level: 6, xTwoEmpties: false }, rng: createRng(deriveSeed(seed, 0)) });
  let seed = 1;
  while (first(seed).cutout?.squares.length !== 9) seed++;
  const box = first(seed);

  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto(`/?start=play&seed=${seed}`);
  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-pattern', 'cutout');
  await expect(match).toHaveAttribute('data-level', '6');
  await expect(match).toHaveAttribute('data-cutout', box.cutout!.squares.join(','));
  await expect(match).toHaveAttribute('data-hints', box.cutout!.given.join(','));
  await expect(match).toHaveAttribute('data-keeper', 'idle');

  // Every value `data-keeper` takes from now on.
  await match.evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { keeperSeen: string[] }).keeperSeen = seen;
    new MutationObserver(() => seen.push(el.getAttribute('data-keeper') ?? '')).observe(el, { attributes: true, attributeFilter: ['data-keeper'] });
  });
  const keeperSeen = () => page.evaluate(() => (window as unknown as { keeperSeen: string[] }).keeperSeen);

  const filled: number[] = [];
  for (let i = 0; i < 7; i++) {
    const n = await targetNumber(match);
    await typeAndShoot(page, n);
    filled.push(n);
    // The square lights up and the next one is the target at once; no goal yet.
    await expect(match).toHaveAttribute('data-hints', [...box.cutout!.given, ...filled].join(','));
    await expect(match).toHaveAttribute('data-goals', '0');
    await expect(match).toHaveAttribute('data-phase', 'aiming');
    await expect(page.getByTestId('message')).toHaveText(`Richtig, ${n}!`);
    if (i === 3) {
      // The half-filled box at 1280×800, once the ball has faded from the filled square (only for the screenshot).
      await page.waitForTimeout(800);
      await page.screenshot({ path: test.info().outputPath('cutout.png') });
    }
  }
  expect(await keeperSeen()).toEqual([]);
  await expect(match).toHaveAttribute('data-keeper', 'idle');
  await expect(match).toHaveAttribute('data-queue', '');

  // The last square: the keeper dives, the ball beats him and the cutout scores its one goal.
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');
  expect(await keeperSeen()).toContain('diving');
});

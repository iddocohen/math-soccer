// Copied from math-tank tests/e2e/offline.spec.ts; a round of two goals replaces the tank round.
/**
 * Offline play (T064, FR-046). Against the production build: the first load installs the service worker, which
 * precaches the whole game; once it controls the page, the browser goes offline, the page reloads from the cache, and
 * a whole round (2 goals) is played with the keyboard. Each answer is the target from `data-target`.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

test('after one load the game starts and plays a whole round offline, also after a reload', async ({ page, context, browserName }) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 2 } });
  await page.goto('/?start=play&seed=4');
  await expect(page.getByTestId('start')).toBeVisible();
  const supported = await page.evaluate(() => 'serviceWorker' in navigator);
  // As math-tank: only where the browser under Playwright offers service workers at all.
  test.skip(!supported, `${browserName} under Playwright offers no service worker here (checked on a real iPad instead)`);

  // The service worker installs and precaches; after a reload it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  // The game chunk (Phaser) also comes from the cache: the match starts and the ball flies.
  const match = await startRound(page);
  for (let goals = 0; goals < 2; goals++) {
    await typeAndShoot(page, await targetNumber(match));
    await expect(match).toHaveAttribute('data-goals', String(goals + 1));
  }
  await expect(match).toHaveAttribute('data-phase', 'roundOver');
  await expect(page.getByTestId('round-end')).toBeVisible();
  await context.setOffline(false);
});

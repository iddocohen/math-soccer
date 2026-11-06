// Copied from math-tank tests/e2e/basePath.spec.ts; /math-soccer/ replaces /math-tank/ and a one-goal round the tank
// round.
/**
 * The published game under a sub-path (T064, FR-047). GitHub Pages serves the game at
 * https://iddocohen.github.io/math-soccer/, built with `vite build --base=/math-soccer/` (.github/workflows/pages.yml).
 * The Playwright project `base-path` builds the game the same way into `dist-base/` and serves it at
 * http://localhost:4274/math-soccer/ (playwright.config.ts). This smoke test loads the game there, plays one whole
 * round with the keyboard, and checks that every request stays under /math-soccer/ and succeeds, and that the service
 * worker and the web app manifest use the sub-path.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

const BASE = '/math-soccer/';

test('the game built for /math-soccer/ loads, plays a round and requests nothing outside /math-soccer/', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  expect(new URL(baseURL!).pathname).toBe(BASE);
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  const failed: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 } });

  // Relative to baseURL, so the page opens at /math-soccer/.
  await page.goto('./?mode=holes&seed=8');
  expect(new URL(page.url()).pathname).toBe(BASE);
  await expect(page.getByTestId('start')).toBeVisible();

  // The manifest and its start address stay under /math-soccer/, so "Zum Home-Bildschirm" opens the game there.
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(manifestHref!, page.url());
  expect(manifestUrl.pathname.startsWith(BASE)).toBe(true);
  const manifest = (await (await page.request.get(manifestUrl.href)).json()) as { start_url: string };
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(BASE);

  // The service worker controls only /math-soccer/.
  const scope = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.scope));
  expect(new URL(scope).pathname).toBe(BASE);

  const match = await startRound(page);
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(page.getByTestId('round-end')).toBeVisible();

  const outside = requests.filter((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return false;
    const u = new URL(url);
    return u.origin !== origin || !u.pathname.startsWith(BASE);
  });
  expect(outside).toEqual([]);
  expect(failed).toEqual([]);
});

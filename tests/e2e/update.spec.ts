// Adapted from math-tank tests/e2e/update.spec.ts: the first test is math-tank's; the others cover amendment 12.
/**
 * New versions reach open pages (amendment 12, FR-051a, FR-102 to FR-104). The spec builds the game twice, as version
 * `e2e-v1` and `e2e-v2` (APP_VERSION, vite.config.ts), into temporary folders and serves them from its own small
 * server on port 4275 (tests/e2e/updateServer.mjs), first v1, then v2 at the same address. main.tsx writes the running
 * build to `<html data-version>`.
 *
 * - Reload on the start screen: one reload shows v2, and the old caches are gone (math-tank's test).
 * - Reload during a round (FR-104): the stored round restores on the match screen, and v2 still applies.
 * - "Zurück" (FR-102, FR-103): v1 sits open, v2 appears during a round; back on the start screen the app asks for a new
 *   version and applies it.
 * - "Nochmal" (FR-103): a check during the round (the tab comes back to the front) finds v2; the round end shows
 *   "Neue Version, startet gleich"; "Nochmal" reloads with v2 and starts the new round there.
 *
 * Runs wherever the browser under Playwright offers service workers (decision D6), otherwise skipped with the reason.
 */
import type { Page } from '@playwright/test';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { startUpdateServer, type UpdateServer } from './updateServer.mjs';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

let server: UpdateServer | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  server = await startUpdateServer(['e2e-v1', 'e2e-v2']);
});

test.afterAll(async () => {
  await server?.stop();
});

test.beforeEach(() => {
  server!.serve('e2e-v1');
});

const version = (page: Page) => page.locator('html');

/** Opens v1 and waits until its service worker controls the page. */
async function openV1(page: Page, browserName: string, goals = 1): Promise<void> {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: goals } }, { once: true });
  await page.goto(`${server!.url}/`);
  await expect(page.getByTestId('start')).toBeVisible();
  const supported = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!supported, `${browserName} under Playwright offers no service worker here (decision D6)`);
  await expect(version(page)).toHaveAttribute('data-version', 'e2e-v1');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test('a new build shows after one load, and the old caches are gone', async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await openV1(page, browserName);
  const v1Scripts = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    return urls.filter((u) => /\/assets\/index-[^/]+\.js/.test(u)).map((u) => new URL(u).pathname);
  });
  expect(v1Scripts.length).toBeGreaterThan(0);
  // A precache as an older Workbox version named it.
  const outdated = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const name = `workbox-precache-${reg.scope}`;
    await (await caches.open(name)).put('/old-file', new Response('old'));
    return name;
  });

  // The server now serves v2. One load: the page finds the waiting worker and reloads once by itself.
  server!.serve('e2e-v2');
  await page.reload();
  await expect(version(page)).toHaveAttribute('data-version', 'e2e-v2', { timeout: 30_000 });
  await expect(page.getByTestId('start')).toBeVisible();

  const after = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    return { names, urls };
  });
  expect(after.names).not.toContain(outdated);
  for (const script of v1Scripts) expect(after.urls).not.toContain(script);
});

test('a reload during a round applies the new build and keeps the round (FR-104)', async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await openV1(page, browserName, 3);
  const match = await startRound(page);
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');

  server!.serve('e2e-v2');
  await page.reload();
  await expect(version(page)).toHaveAttribute('data-version', 'e2e-v2', { timeout: 30_000 });
  // The stored round comes back in the new build.
  await expect(page.getByTestId('match')).toHaveAttribute('data-goals', '1');
});

test('"Zurück" after a round applies a build that appeared during it (FR-102, FR-103)', async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await openV1(page, browserName);
  const match = await startRound(page);
  server!.serve('e2e-v2');
  await typeAndShoot(page, await targetNumber(match));
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(version(page)).toHaveAttribute('data-version', 'e2e-v1');

  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(version(page)).toHaveAttribute('data-version', 'e2e-v2', { timeout: 30_000 });
  await expect(page.getByTestId('start')).toBeVisible();
});

test('the round end names a waiting build, and "Nochmal" applies it and starts the round (FR-103)', async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await openV1(page, browserName);
  const match = await startRound(page);
  server!.serve('e2e-v2');
  // The tab comes back to the front: the app asks for a new version, and v2 installs and waits.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting !== null), { timeout: 30_000 })
    .toBe(true);
  await expect(version(page)).toHaveAttribute('data-version', 'e2e-v1');

  await typeAndShoot(page, await targetNumber(match));
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(page.getByTestId('update-note')).toHaveText('Neue Version, startet gleich');

  await page.getByRole('button', { name: 'Nochmal' }).click();
  await expect(version(page)).toHaveAttribute('data-version', 'e2e-v2', { timeout: 30_000 });
  await expect(page.getByTestId('match')).toHaveAttribute('data-phase', 'aiming');
  await expect(page.getByTestId('round-end')).toHaveCount(0);
});

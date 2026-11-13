// Copied from math-tank tests/e2e/no-external-requests.spec.ts; a round of two goals replaces the tank round.
/**
 * No external services (T064): every request made while the game loads and while one whole round is played goes to
 * the game's own origin (or is a data: or blob: URL). No analytics, fonts, CDNs or tracking; all art and sound are
 * bundled files (amendments 03 and 22) or made in code.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { CLIP_FILES, PARTICLE_FILES } from '../../src/assets';

test('loading and playing a whole round sends no request to another origin', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 2 } });
  await page.goto('/?start=play&seed=8');
  const match = await startRound(page);
  for (let goals = 0; goals < 2; goals++) {
    await typeAndShoot(page, await targetNumber(match));
    await expect(match).toHaveAttribute('data-goals', String(goals + 1));
  }
  await expect(page.getByTestId('round-end')).toBeVisible();

  expect(requests.length).toBeGreaterThan(0);
  const foreign = requests.filter((url) => !url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin);
  expect(foreign).toEqual([]);
  // The sound clips and particle images of amendment 22 come from the game's own files (FR-153).
  const own = requests.filter((url) => url.startsWith(origin)).map((url) => new URL(url).pathname);
  for (const file of [...Object.values(CLIP_FILES), ...Object.values(PARTICLE_FILES)]) expect(own.some((path) => path.endsWith(`/assets/${file}`)), file).toBe(true);
});

/**
 * Time challenge end to end (T092; amendment 07, FR-075 to FR-081): Z starts a 1-minute challenge, the child scores
 * twice, and the test speed-up hook (`?speed=` with `window.mathSoccerSpeed`) lets the rest of the minute run out. The
 * countdown turns to its last-seconds look (`data-last`), no hearts show, and the round end says "2 Tore in 1 Minute"
 * with a new record. Keys drive the game; waits are on data-* state, never fixed sleeps.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

/** Sets the play speed of the test hook while the page runs. */
async function setSpeed(page: import('@playwright/test').Page, speed: number): Promise<void> {
  await page.evaluate((s) => {
    window.mathSoccerSpeed = s;
  }, speed);
}

test('Z starts a 1-minute challenge; two goals, then the time runs out: "2 Tore in 1 Minute"', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), timeChallenge: { allowed: true, minutes: 1 } } });
  await page.goto('/?seed=4&speed=1');
  const match = await startRound(page, 'z');
  await expect(match).toHaveAttribute('data-round-type', 'time');
  const countdown = page.getByTestId('countdown');
  await expect(countdown).toBeVisible();
  await expect(countdown).toHaveAttribute('data-last', 'false');
  await expect(page.getByTestId('hearts')).toHaveCount(0);

  for (const goals of ['1', '2']) {
    await typeAndShoot(page, await targetNumber(match));
    await expect(match).toHaveAttribute('data-goals', goals);
  }

  // The last seconds: kit yellow and a gentle pulse, frozen here with speed 0 to look at it.
  await setSpeed(page, 40);
  await expect(countdown).toHaveAttribute('data-last', 'true');
  await setSpeed(page, 0);
  await expect(countdown).toHaveClass(/countdown-last/);
  const color = await countdown.evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe('rgb(232, 185, 35)');

  await setSpeed(page, 40);
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(page.getByTestId('round-result')).toHaveText('2 Tore in 1 Minute');
  await expect(page.getByTestId('new-record')).toBeVisible();
});

test('a refresh during a time challenge continues its countdown', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), timeChallenge: { allowed: true, minutes: 2 } } }, { once: true });
  await page.goto('/?seed=5&speed=1');
  const match = await startRound(page, 'z');
  await expect(match).toHaveAttribute('data-round-type', 'time');
  const countdown = page.getByTestId('countdown');
  // Two seconds of play time are stored with the round (it saves every second of play).
  await setSpeed(page, 20);
  await expect.poll(async () => Number(await countdown.getAttribute('data-left'))).toBeLessThan(100);
  await setSpeed(page, 0);
  const before = Number(await countdown.getAttribute('data-left'));

  await page.reload();
  const again = page.getByTestId('match');
  await expect(again).toHaveAttribute('data-round-type', 'time');
  const after = Number(await page.getByTestId('countdown').getAttribute('data-left'));
  expect(after).toBeLessThanOrEqual(before + 1);
  expect(after).toBeLessThan(120);
});

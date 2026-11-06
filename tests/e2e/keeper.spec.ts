/**
 * US5 end to end with the keyboard only (T056; acceptance scenarios US5-2 and US5-3, FR-019, FR-020): Enter starts
 * "Spielen", the goalkeeper game (amendment 05). The correct number goes past the diving keeper and scores; a wrong number
 * lands in the keeper's gloves (`data-keeper="caught"`) and the miss message names its square. The keeper then walks
 * back to the middle (`data-keeper="idle"`).
 * Game state is read from the overlay's data-* attributes; there are no fixed waits.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { OVERLAY_LEFT, WORLD_WIDTH } from '../../src/core/match/world';
import { t } from '../../src/i18n';

const text = t();
const keeperOnly = {
  ...defaultSettings(),
  roundType: 'goalCount' as const,
  goalsPerRound: 3,
};

test.beforeEach(async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: keeperOnly });
  await page.goto('/?start=play&seed=5');
});

test('the correct number goes past the keeper and scores', async ({ page }) => {
  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-keeper', 'idle');
  const n = await targetNumber(match);

  await typeAndShoot(page, n);
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-keeper', 'beaten');
  // He gets up and walks back to the middle, and the next target follows.
  await expect(match).toHaveAttribute('data-keeper', 'idle');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  expect(await targetNumber(match)).not.toBe(n);
});

test('a wrong number is caught by the keeper and shows the miss message', async ({ page }) => {
  const match = await startRound(page);
  const n = await targetNumber(match);
  const wrong = n === 100 ? 99 : n + 1;

  await typeAndShoot(page, wrong);
  await expect(match).toHaveAttribute('data-keeper', 'caught');
  await expect(page.getByTestId('message')).toHaveText(text.feedback.miss(wrong));
  await expect(match).toHaveAttribute('data-goals', '0');
  await expect(match).toHaveAttribute('data-target', String(n));
  await expect(match).toHaveAttribute('data-keeper', 'idle');
});

test('the number box shows a faint "?" before the child types; the first digit replaces it (FR-100)', async ({ page }) => {
  const match = await startRound(page);
  const entry = page.getByTestId('entry');
  const placeholder = () => entry.evaluate((el) => getComputedStyle(el, '::before').content);
  await expect(entry).toHaveText('');
  expect(await placeholder()).toBe('"?"');
  const n = await targetNumber(match);
  await page.keyboard.press(String(n)[0]!);
  await expect(entry).toHaveText(String(n)[0]!);
  expect(await placeholder()).toBe('none');
});

test('the typed number and the message lie right of the player and the ball (amendment 08)', async ({ page }) => {
  const match = await startRound(page);
  await page.keyboard.press('h');
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '2');
  await page.keyboard.press('1');
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas).not.toBeNull();
  // World x to screen x with the canvas scale.
  const minX = canvas!.x + (OVERLAY_LEFT * canvas!.width) / WORLD_WIDTH - 1;
  for (const id of ['entry', 'message']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.x, `${id} right of the ball`).toBeGreaterThanOrEqual(minX);
    expect(box!.x + box!.width, `${id} inside the screen`).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});

test('the start screen has "Spielen" and "Zeit-Challenge"; keys 1 to 3 start nothing (FR-068)', async ({ page }) => {
  const start = page.getByTestId('start');
  await expect(start).toBeVisible();
  await expect(page.locator('[data-mode]')).toHaveCount(0);
  await expect(page.locator('[data-start="play"]')).toContainText(text.start.play);
  // Both buttons show their key hint (FR-101); the hint is not part of the button's name.
  await expect(page.locator('[data-start="play"] .start-key')).toHaveText('Enter');
  await expect(page.locator('[data-start="time"] .start-key')).toHaveText('Z');
  await expect(page.getByRole('button', { name: text.start.play, exact: true })).toBeVisible();
  await expect(page.locator('[data-start="time"]')).toContainText(text.start.timeChallenge);
  for (const key of ['1', '2', '3']) await page.keyboard.press(key);
  await expect(start).toBeVisible();
  await page.locator('[data-start="play"]').click();
  await expect(page.getByTestId('match')).toHaveAttribute('data-phase', 'aiming');
});

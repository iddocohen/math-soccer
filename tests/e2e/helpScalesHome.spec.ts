/**
 * Amendment 14 end to end: the row and column scales show only with help (FR-115), and the home button and the pause
 * screen lead back to the start screen (FR-116 to FR-118). Game state is read from the overlay's data-* attributes
 * (`data-scales`: none, row or both); there are no fixed waits.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { ROUND_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();
const threeGoals = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 3 };

test('no scale before a miss, the row scale after one miss, both after two, none after the goal (FR-115)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: threeGoals });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?start=play&seed=4');
  const match = await startRound(page);
  const target = await targetNumber(match);
  const wrong = target === 100 ? 99 : target + 1;

  await expect(match).toHaveAttribute('data-scales', 'none');
  await expect(match).toHaveAttribute('data-help-row', '');
  await page.screenshot({ path: test.info().outputPath('no-scales.png') });

  await typeAndShoot(page, wrong);
  await expect(match).toHaveAttribute('data-help', '1');
  await expect(match).toHaveAttribute('data-scales', 'row');
  await expect(match).not.toHaveAttribute('data-help-row', '');
  await expect(match).toHaveAttribute('data-help-col', '');

  await typeAndShoot(page, wrong);
  await expect(match).toHaveAttribute('data-help', '2');
  await expect(match).toHaveAttribute('data-scales', 'both');
  await expect(match).not.toHaveAttribute('data-help-col', '');

  await typeAndShoot(page, target);
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-scales', 'none');
  await expect(match).toHaveAttribute('data-help-row', '');
  await expect(match).toHaveAttribute('data-help-col', '');
});

test('the home button asks "Runde beenden?"; "Weiter" goes on and "Zum Start" shows the start screen (FR-116, FR-118)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: threeGoals });
  await page.goto('/?start=play&seed=2');
  const match = await startRound(page);

  await page.getByRole('button', { name: text.match.home }).click();
  const pauseScreen = page.getByTestId('pause-screen');
  await expect(pauseScreen).toHaveAttribute('data-kind', 'quit');
  await expect(page.getByRole('dialog', { name: text.match.quitAsk })).toBeVisible();
  // Enter goes on.
  await page.keyboard.press('Enter');
  await expect(pauseScreen).toBeHidden();
  await expect(match).toHaveAttribute('data-phase', 'aiming');

  await page.getByRole('button', { name: text.match.home }).click();
  await pauseScreen.getByRole('button', { name: text.match.home }).click();
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByTestId('round-end')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), ROUND_KEY)).toBeNull();
  // A reload does not bring the round back.
  await page.reload();
  await expect(page.getByTestId('start')).toBeVisible();
});

test('Escape shows the pause screen with "Weiter" and "Zum Start"; "Zum Start" shows the start screen (FR-117)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: threeGoals });
  await page.goto('/?start=play&seed=2');
  await startRound(page);

  await page.keyboard.press('Escape');
  const pauseScreen = page.getByTestId('pause-screen');
  await expect(pauseScreen).toHaveAttribute('data-kind', 'pause');
  await expect(pauseScreen.getByRole('button', { name: text.match.resume })).toBeVisible();
  await pauseScreen.getByRole('button', { name: text.match.home }).click();
  await expect(page.getByTestId('start')).toBeVisible();
});

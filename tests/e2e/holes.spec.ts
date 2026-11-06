/**
 * US1 end to end with the keyboard only (T026; acceptance scenarios US1-3 to US1-7, FR-004, FR-005): start hole mode
 * with `?mode=holes` and Enter, shoot the target from `data-target` for a goal, shoot a wrong number in the range and
 * read the miss message, play the round to the end screen and start another with Enter, without a page reload.
 * The round is two goals (`goalCount`, `goalsPerRound` 2) through stored settings, as math-tank's specs do.
 * Game state is read from the overlay's data-* attributes; there are no fixed waits.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();
const twoGoals = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 2 };

test('hole mode: a goal, a miss, the round end and "Nochmal" with the keyboard only', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.goto('/?mode=holes&seed=1');
  let reloads = 0;
  page.on('load', () => reloads++);

  const match = await startRound(page);

  // The target scores a goal (US1-3).
  const first = await targetNumber(match);
  await typeAndShoot(page, first);
  await expect(match).toHaveAttribute('data-goals', '1');

  // After the celebration a new target follows (US1-6); a wrong number in the range is a miss that names its square (US1-4).
  const second = await targetNumber(match);
  expect(second).not.toBe(first);
  const wrong = second === 100 ? 99 : second + 1;
  await typeAndShoot(page, wrong);
  await expect(page.getByTestId('message')).toHaveText(text.feedback.miss(wrong));
  await expect(page.getByTestId('message')).toHaveText(`Hier ist ${wrong}. Nochmal!`);
  await expect(match).toHaveAttribute('data-target', String(second));
  await expect(match).toHaveAttribute('data-hearts', '3');

  // A number outside the range is not shot (US1-5).
  await typeAndShoot(page, 101);
  await expect(page.getByTestId('message')).toHaveText(text.feedback.outOfRange(1, 100));
  await expect(match).toHaveAttribute('data-phase', 'aiming');

  // The second goal ends the round; Enter on the end screen starts a new one (US1-7).
  await typeAndShoot(page, second);
  await expect(match).toHaveAttribute('data-goals', '2');
  await expect(page.getByTestId('round-end')).toBeVisible();
  await expect(match).toHaveAttribute('data-phase', 'roundOver');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('round-end')).toBeHidden();
  await expect(match).toHaveAttribute('data-goals', '0');
  await targetNumber(match);
  expect(reloads).toBe(0);
});

test('hole mode: a refresh continues the round', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.goto('/?mode=holes&seed=2');
  const match = await startRound(page);
  const first = await targetNumber(match);
  await typeAndShoot(page, first);
  await expect(match).toHaveAttribute('data-goals', '1');
  const second = await targetNumber(match);

  await page.reload();
  const again = page.getByTestId('match');
  await expect(again).toHaveAttribute('data-goals', '1');
  await expect(again).toHaveAttribute('data-target', String(second));
});

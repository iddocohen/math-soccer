/**
 * US2 end to end with the keyboard only (T040; acceptance scenarios US2-1 to US2-4, FR-024, FR-025, FR-025a): three H
 * presses walk through the help steps. H once shows the hint line; H twice opens the help chart with the target
 * outlined; Enter closes the chart and does not shoot; H a third time writes the answer, and shooting it scores
 * without costing a heart. A second test opens the chart after a miss and checks the last typed number is marked.
 * Game state is read from the overlay's data-* attributes; there are no fixed waits.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();
const twoGoals = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 2 };

test('three H presses: hint, help chart, answer; Enter closes the chart without shooting', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.goto('/?mode=holes&seed=1');
  const match = await startRound(page);
  const target = await targetNumber(match);
  const helpText = page.getByTestId('help-text');
  const chart = page.getByTestId('help-chart');

  // Step 1: a hint line that starts at a hint number (US2-1).
  await expect(helpText).toBeHidden();
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '1');
  await expect(helpText).toHaveText(/^Von \d+/);
  await expect(chart).toBeHidden();

  // Step 2: the full chart with the target outlined (US2-2).
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '2');
  await expect(chart).toBeVisible();
  await expect(chart.locator('[data-n]')).toHaveCount(100);
  await expect(chart.locator('[data-mark="target"]')).toHaveAttribute('data-n', String(target));

  // Enter closes the chart; the help step stays and no ball flies.
  await page.keyboard.press('Enter');
  await expect(chart).toBeHidden();
  await expect(match).toHaveAttribute('data-help-chart', 'closed');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(match).toHaveAttribute('data-help', '2');

  // Step 3: the answer (US2-3); shooting it scores and costs nothing (US2-4).
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '3');
  await expect(helpText).toHaveText(text.help.answer(target));
  await expect(chart).toBeHidden();
  await typeAndShoot(page, target);
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-hearts', '3');
  // The next target starts without help.
  await expect(match).toHaveAttribute('data-help', '0');
  await expect(helpText).toBeHidden();
});

test('a miss after the hint opens the chart with the last typed number marked; Escape closes it', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.goto('/?mode=holes&seed=2');
  const match = await startRound(page);
  const target = await targetNumber(match);
  const wrong = target === 100 ? 99 : target + 1;

  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '1');
  await typeAndShoot(page, wrong);
  await expect(page.getByTestId('message')).toHaveText(text.feedback.miss(wrong));
  await expect(match).toHaveAttribute('data-help', '2');

  const chart = page.getByTestId('help-chart');
  await expect(chart).toBeVisible();
  await expect(chart.locator('[data-mark="last"]')).toHaveAttribute('data-n', String(wrong));
  await expect(chart.locator('[data-mark="target"]')).toHaveAttribute('data-n', String(target));

  await page.keyboard.press('Escape');
  await expect(chart).toBeHidden();
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(page.getByTestId('message')).not.toHaveText(text.match.paused);
});

test('a tap on the help chart closes it', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.goto('/?mode=holes&seed=3');
  const match = await startRound(page);
  await page.getByTestId('help-button').click();
  await page.getByTestId('help-button').click();
  const chart = page.getByTestId('help-chart');
  await expect(chart).toBeVisible();
  await chart.click({ position: { x: 5, y: 5 } });
  await expect(chart).toBeHidden();
  await expect(match).toHaveAttribute('data-help', '2');
});

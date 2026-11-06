/**
 * US2 end to end with the keyboard only (T040, T096; acceptance scenarios US2-1 to US2-4, FR-024, FR-025, FR-025a,
 * FR-094, amendment 10): four H presses walk through the help steps. H once shows the hint line and lights the target's
 * row; H twice lights its column; H a third time opens the help chart with the target outlined; Enter closes the chart
 * and does not shoot; H a fourth time writes the answer, and shooting it scores without costing a heart. Other tests
 * check that a miss lights the row and a second miss the column (`data-help-row`, `data-help-col`), and that the chart
 * opened after misses marks the last typed number. Game state is read from the overlay's data-* attributes; there are
 * no fixed waits.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();
const twoGoals = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 2 };

/** The tens label of the row of `n` and its column, 1 to 10, on the chart 1 to 100. */
function rowAndColumn(n: number): { row: string; col: string } {
  return { row: String(Math.floor((n - 1) / 10) * 10), col: String(((n - 1) % 10) + 1) };
}

test('four H presses: row, column, help chart, answer; Enter closes the chart without shooting', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.goto('/?start=play&seed=1');
  const match = await startRound(page);
  const target = await targetNumber(match);
  const { row, col } = rowAndColumn(target);
  const helpText = page.getByTestId('help-text');
  const chart = page.getByTestId('help-chart');

  // Step 1: a hint line that starts at a hint number and names the row (US2-1, FR-094).
  await expect(helpText).toBeHidden();
  await expect(match).toHaveAttribute('data-help-row', '');
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '1');
  await expect(helpText).toHaveText(new RegExp(`^Von \\d+.*${text.help.inRow(Number(row))}\\.$`));
  await expect(match).toHaveAttribute('data-help-row', row);
  await expect(match).toHaveAttribute('data-help-col', '');
  await expect(chart).toBeHidden();

  // Step 2: the column joins the row.
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '2');
  await expect(match).toHaveAttribute('data-help-col', col);
  await expect(helpText).toContainText(text.help.inRowAndColumn(Number(row), Number(col)));
  await expect(chart).toBeHidden();

  // Step 3: the full chart with the target outlined (US2-2).
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '3');
  await expect(chart).toBeVisible();
  await expect(chart.locator('[data-n]')).toHaveCount(100);
  await expect(chart.locator('[data-mark="target"]')).toHaveAttribute('data-n', String(target));

  // Enter closes the chart; the help step stays and no ball flies.
  await page.keyboard.press('Enter');
  await expect(chart).toBeHidden();
  await expect(match).toHaveAttribute('data-help-chart', 'closed');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(match).toHaveAttribute('data-help', '3');

  // Step 4: the answer (US2-3); shooting it scores and costs nothing (US2-4).
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '4');
  await expect(helpText).toHaveText(text.help.answer(target));
  await expect(chart).toBeHidden();
  await typeAndShoot(page, target);
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-hearts', '3');
  // The next target starts without help.
  await expect(match).toHaveAttribute('data-help', '0');
  await expect(match).toHaveAttribute('data-help-row', '');
  await expect(helpText).toBeHidden();
});

test('a miss lights the target row and its label; a second miss lights the column (amendment 10)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?start=play&seed=4');
  const match = await startRound(page);
  const target = await targetNumber(match);
  const { row, col } = rowAndColumn(target);
  const wrong = target === 100 ? 99 : target + 1;

  await typeAndShoot(page, wrong);
  await expect(page.getByTestId('message')).toHaveText(text.feedback.miss(wrong));
  await expect(match).toHaveAttribute('data-help', '1');
  await expect(match).toHaveAttribute('data-help-row', row);
  await expect(match).toHaveAttribute('data-help-col', '');

  await typeAndShoot(page, wrong);
  await expect(match).toHaveAttribute('data-help', '2');
  await expect(match).toHaveAttribute('data-help-row', row);
  await expect(match).toHaveAttribute('data-help-col', col);
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(page.getByTestId('help-chart')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('row-and-column.png') });
});

test('misses after the hint open the chart with the last typed number marked; Escape closes it', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: twoGoals });
  await page.goto('/?start=play&seed=2');
  const match = await startRound(page);
  const target = await targetNumber(match);
  const wrong = target === 100 ? 99 : target + 1;

  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '1');
  await page.keyboard.press('h');
  await expect(match).toHaveAttribute('data-help', '2');
  await typeAndShoot(page, wrong);
  await expect(page.getByTestId('message')).toHaveText(text.feedback.miss(wrong));
  await expect(match).toHaveAttribute('data-help', '3');

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
  await page.goto('/?start=play&seed=3');
  const match = await startRound(page);
  for (let i = 0; i < 3; i++) await page.getByTestId('help-button').click();
  const chart = page.getByTestId('help-chart');
  await expect(chart).toBeVisible();
  await chart.click({ position: { x: 5, y: 5 } });
  await expect(chart).toBeHidden();
  await expect(match).toHaveAttribute('data-help', '3');
});

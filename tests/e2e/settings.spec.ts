/**
 * US3 end to end (T047; quickstart scenarios 4 and 5, FR-034, FR-035, FR-036): the gear held for 2 seconds opens the
 * parent menu, a custom range of 200 to 500 saved on the settings page gives the next round its chart rows, the
 * settings survive a reload, and the range 0 to 1000 plays a shot without page errors.
 *
 * Rows for 200 to 500: the chart layout (data-model "ChartLayout") starts rows at multiples of 10 plus 1, so 200 sits
 * in the row 191 to 200 and 500 in the row 491 to 500: 31 rows. spec.md US3 scenario 2 and quickstart scenario 5 say
 * 30; the spec text and the data model disagree, and this spec checks what the layout gives.
 * Game state is read from the overlay's data-* attributes; there are no fixed waits.
 */
import type { Page } from '@playwright/test';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';

/** Holds the gear with the mouse until the parent menu shows (the gate needs 2 seconds), then releases it. */
async function holdGear(page: Page): Promise<void> {
  await page.getByTestId('parent-gate').hover();
  await page.mouse.down();
  await expect(page.getByRole('dialog', { name: 'Für Eltern' })).toBeVisible();
  await page.mouse.up();
}

test('the gear opens the settings; 200 to 500 gives its chart rows and survives a reload', async ({ page }) => {
  await page.goto('/?mode=holes&seed=3');
  await expect(page.getByTestId('start')).toBeVisible();

  // A short click on the gear opens nothing.
  await page.getByTestId('parent-gate').click();
  await expect(page.getByRole('dialog', { name: 'Für Eltern' })).toHaveCount(0);

  await holdGear(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  const settings = page.getByTestId('settings-page');
  await expect(settings).toBeVisible();
  await settings.getByRole('combobox', { name: 'Zahlenraum' }).selectOption('custom');
  await settings.getByRole('spinbutton', { name: 'Von' }).fill('200');
  await settings.getByRole('spinbutton', { name: 'Bis' }).fill('500');
  await settings.getByRole('button', { name: 'Speichern' }).click();
  await expect(settings.getByText('Gespeichert.', { exact: false })).toBeVisible();
  await settings.getByRole('button', { name: 'Schließen' }).click();
  await expect(settings).toHaveCount(0);

  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-rows', '31');
  const target = await targetNumber(match);
  expect(target).toBeGreaterThanOrEqual(200);
  expect(target).toBeLessThanOrEqual(500);

  // After a reload the stored round continues on the saved range, and the settings page shows the saved values.
  await page.reload();
  await expect(page.getByTestId('match')).toHaveAttribute('data-rows', '31');
  await holdGear(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Von' })).toHaveValue('200');
  await expect(page.getByRole('spinbutton', { name: 'Bis' })).toHaveValue('500');
});

test('the range 0 to 1000 plays a shot without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), range: { preset: '0-1000', min: 0, max: 1000 } } });
  await page.goto('/?mode=holes&seed=5');

  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-rows', '101');
  const target = await targetNumber(match);
  await typeAndShoot(page, target);
  await expect(match).toHaveAttribute('data-goals', '1');
  expect(errors).toEqual([]);
});

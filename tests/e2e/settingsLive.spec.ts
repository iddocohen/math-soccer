/**
 * Amendment 01 (FR-052) end to end: during a round the parent changes the range from 1 to 100 to 1 to 20 and saves.
 * When the settings page closes, the round has a board of 2 rows and a target from 1 to 20, the goal stays, and the
 * round continues. Keys drive the game; waits are on data-* state, never fixed sleeps.
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

test('a range saved mid-round gives a new target on the new board; the goals stay', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: defaultSettings() }, { once: true });
  await page.goto('/?seed=5');
  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-rows', '10');
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');
  await targetNumber(match);

  await holdGear(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  const settings = page.getByTestId('settings-page');
  await settings.getByRole('combobox', { name: 'Zahlenraum' }).selectOption('custom');
  await settings.getByRole('spinbutton', { name: 'Von' }).fill('1');
  await settings.getByRole('spinbutton', { name: 'Bis' }).fill('20');
  await settings.getByRole('button', { name: 'Speichern' }).click();
  await expect(settings.getByText('Gespeichert.', { exact: false })).toBeVisible();
  // Nothing changes while the page is open.
  await expect(match).toHaveAttribute('data-rows', '10');
  await settings.getByRole('button', { name: 'Schließen' }).click();
  await expect(settings).toHaveCount(0);

  await expect(match).toHaveAttribute('data-rows', '2');
  await expect(match).toHaveAttribute('data-goals', '1');
  const target = await targetNumber(match);
  expect(target).toBeGreaterThanOrEqual(1);
  expect(target).toBeLessThanOrEqual(20);

  // The round continues on the new board.
  await typeAndShoot(page, target);
  await expect(match).toHaveAttribute('data-goals', '2');
});

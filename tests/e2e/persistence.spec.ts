/**
 * Amendment 01 (FR-050) end to end: a locker room copy kept under `mathsoccer.lockerroom.v1.unreadable` is offered on
 * the settings page; "Kopie wiederherstellen" saves it, the page reloads, and the start screen shows its stars.
 */
import type { Page } from '@playwright/test';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY } from '../../src/core/storage/storage';
import { expect, seedStorage, test } from './fixtures';

async function holdGear(page: Page): Promise<void> {
  await page.getByTestId('parent-gate').hover();
  await page.mouse.down();
  await expect(page.getByRole('dialog', { name: 'Für Eltern' })).toBeVisible();
  await page.mouse.up();
}

test('restores a kept locker room copy and shows its stars on the start screen', async ({ page }) => {
  await seedStorage(page, { [`${LOCKER_ROOM_KEY}.unreadable`]: { ...emptyLockerRoom(), stars: 17, totalEarned: 17 } }, { once: true });
  await page.goto('/');
  await expect(page.getByTestId('star-total')).toHaveText('★ 0');

  await holdGear(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  const notice = page.getByTestId('backup-notice');
  await expect(notice).toContainText('Sterne und Kabine');
  await notice.getByRole('button', { name: 'Kopie wiederherstellen' }).click();

  // The page reloads with the restored data.
  await expect(page.getByTestId('star-total')).toHaveText('★ 17');
  expect(await page.evaluate((key) => localStorage.getItem(key), `${LOCKER_ROOM_KEY}.unreadable`)).toBeNull();
});

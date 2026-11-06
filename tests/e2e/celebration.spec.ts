/**
 * Goal celebrations end to end (amendment 13, T103, FR-113, FR-114). The locker room has the group "Jubel" with "Arme
 * hoch" chosen; a tap on "Rutschen" plays it on the preview, buys it and chooses it. After a goal the match plays it
 * (`data-celebration` on the match), and the next target comes when it ends. Enter or a tap during the celebration
 * skips it and shoots nothing. Keys drive the game; waits are on data-* state, never fixed sleeps.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';

const settings = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 5 };

test.beforeEach(async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 12, totalEarned: 12 } });
  await page.goto('/?seed=11');
});

test('buy and choose "Rutschen" in the locker room, and it plays after a goal', async ({ page }) => {
  await page.keyboard.press('k');
  const jubel = page.getByRole('region', { name: 'Jubel' });
  await expect(jubel.getByRole('heading', { name: 'Jubel' })).toBeVisible();
  await expect(page.getByTestId('item-celebration.armsUp')).toHaveAttribute('data-chosen', 'true');
  await expect(page.getByTestId('item-celebration.backflip')).toContainText('noch 18 Sterne');

  // A tap on a celebration plays it on the preview player, also before it is bought.
  await page.getByTestId('item-celebration.slide').click();
  await expect(page.getByTestId('locker-preview')).toHaveAttribute('data-celebration', 'slide');
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('item-celebration.slide')).toHaveAttribute('data-chosen', 'true');
  await expect(page.getByTestId('locker-room')).toHaveAttribute('data-stars', '2');
  // The preview ends by itself.
  await expect(page.getByTestId('locker-preview')).toHaveAttribute('data-celebration', '');

  await page.keyboard.press('Escape');
  const match = await startRound(page);
  const scene = page.locator('main.match');
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-phase', 'celebrating');
  await expect(scene).toHaveAttribute('data-celebration', 'slide');
  // It ends by itself and the next target comes.
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(scene).toHaveAttribute('data-celebration', '');
  await expect(match).toHaveAttribute('data-goals', '1');
});

test('Enter or a tap skips the celebration and shoots nothing', async ({ page }) => {
  const match = await startRound(page);
  const scene = page.locator('main.match');

  await typeAndShoot(page, await targetNumber(match));
  await expect(scene).toHaveAttribute('data-celebration', 'armsUp');
  // A digit typed during the celebration is not taken, and Enter skips instead of shooting. The celebration lasts
  // 1.2 s; the skip shows well before that.
  await page.keyboard.press('7');
  await page.keyboard.press('Enter');
  await expect(match).toHaveAttribute('data-phase', 'aiming', { timeout: 700 });
  await expect(scene).toHaveAttribute('data-celebration', '');
  await expect(page.getByTestId('entry')).toHaveText('');
  await expect(match).toHaveAttribute('data-goals', '1');

  await typeAndShoot(page, await targetNumber(match));
  await expect(scene).toHaveAttribute('data-celebration', 'armsUp');
  const view = page.viewportSize()!;
  await page.mouse.click(view.width / 2, view.height / 2);
  await expect(match).toHaveAttribute('data-phase', 'aiming', { timeout: 700 });
  await expect(scene).toHaveAttribute('data-celebration', '');
  await expect(match).toHaveAttribute('data-goals', '2');
});

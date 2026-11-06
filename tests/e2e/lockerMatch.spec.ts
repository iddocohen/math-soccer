/**
 * Amendment 01 (FR-049) end to end: the "Kabine" icon opens the locker room over a running round, which pauses; the
 * child buys and equips a ball, "Zurück" closes the locker room, the round continues and `data-ball` shows the new
 * ball. Keys drive the game; waits are on data-* state, never fixed sleeps.
 */
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';

test('open the locker room from a running round, equip a ball, close, and the round continues with it', async ({ page }) => {
  await seedStorage(
    page,
    {
      [SETTINGS_KEY]: { ...defaultSettings(), modes: { holes: true, lines: false, keeper: false } },
      [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 25, totalEarned: 25 },
    },
    { once: true },
  );
  await page.goto('/?seed=9');
  const match = await startRound(page, '1');
  await expect(match).toHaveAttribute('data-ball', 'ball.classic');
  const target = await targetNumber(match);

  await page.getByRole('button', { name: 'Kabine' }).click();
  const room = page.getByTestId('locker-room');
  await expect(room).toBeVisible();
  await expect(page.getByTestId('message')).toHaveText('Pause. Weiter mit Enter.');
  await page.getByTestId('item-ball.gold').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('item-ball.gold')).toHaveAttribute('data-chosen', 'true');
  await room.getByRole('button', { name: 'Zurück' }).click();
  await expect(room).toHaveCount(0);

  await expect(match).toHaveAttribute('data-ball', 'ball.gold');
  await expect(page.getByTestId('message')).toHaveText('');
  await expect(match).toHaveAttribute('data-target', String(target));
  await typeAndShoot(page, target);
  await expect(match).toHaveAttribute('data-goals', '1');
});

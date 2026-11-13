/**
 * US6 end to end (T060; acceptance scenarios US6-1 and US6-2, FR-042, FR-043): the child starts with 30 stars, scores
 * 3 goals and earns 1 star per goal (amendment 19, FR-132), the round end shows "+3 Sterne" and the start screen the
 * star total. K opens the locker room, the child buys the blue ball for 30 stars (FR-133) and it is chosen; Escape goes back, and the next round's ball carries
 * the new design (`data-ball="ball.blue"`). Keys drive the game; waits are on data-* state, never fixed sleeps.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';

const threeGoals = {
  ...defaultSettings(),
  roundType: 'goalCount' as const,
  goalsPerRound: 3,
};

test.beforeEach(async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: threeGoals, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 30, totalEarned: 30 } });
  await page.goto('/?seed=11');
});

test('earn stars, buy and choose a ball, and the next round shows it', async ({ page }) => {
  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-ball', 'ball.classic');
  await expect(match).toHaveAttribute('data-ball-kind', 'soccer');

  for (let goal = 1; goal <= 3; goal++) {
    await typeAndShoot(page, await targetNumber(match));
    await expect(match).toHaveAttribute('data-goals', String(goal));
  }
  await expect(page.getByTestId('round-stars')).toHaveText('+3 Sterne');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('star-total')).toHaveText('★ 33');

  await page.keyboard.press('k');
  const room = page.getByTestId('locker-room');
  await expect(room).toHaveAttribute('data-stars', '33');
  await expect(page.getByTestId('item-ball.gold')).toContainText('noch 42 Sterne');
  await page.getByTestId('item-ball.blue').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('item-ball.blue')).toHaveAttribute('data-chosen', 'true');
  await expect(room).toHaveAttribute('data-stars', '3');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('star-total')).toHaveText('★ 3');
  const next = await startRound(page);
  await expect(next).toHaveAttribute('data-ball', 'ball.blue');
});

/**
 * US6 end to end (T060; acceptance scenarios US6-1 and US6-2, FR-042, FR-043): the child scores 3 goals in hole mode
 * and earns 2 stars per goal, the round end shows "+6 Sterne" and the start screen the star total. K opens the locker
 * room, the child buys the blue ball for 5 stars and it is chosen; Escape goes back, and the next round's ball carries
 * the new design (`data-ball="ball.blue"`). Keys drive the game; waits are on data-* state, never fixed sleeps.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

const threeGoals = {
  ...defaultSettings(),
  modes: { holes: true, lines: false, keeper: false },
  roundType: 'goalCount' as const,
  goalsPerRound: 3,
};

test.beforeEach(async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: threeGoals });
  await page.goto('/?seed=11');
});

test('earn stars, buy and choose a ball, and the next round shows it', async ({ page }) => {
  const match = await startRound(page, '1');
  await expect(match).toHaveAttribute('data-ball', 'ball.classic');
  await expect(match).toHaveAttribute('data-ball-kind', 'soccer');

  for (let goal = 1; goal <= 3; goal++) {
    await typeAndShoot(page, await targetNumber(match));
    await expect(match).toHaveAttribute('data-goals', String(goal));
  }
  await expect(page.getByTestId('round-stars')).toHaveText('+6 Sterne');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('star-total')).toHaveText('★ 6');

  await page.keyboard.press('k');
  const room = page.getByTestId('locker-room');
  await expect(room).toHaveAttribute('data-stars', '6');
  await expect(page.getByTestId('item-ball.gold')).toContainText('noch 14 Sterne');
  await page.getByTestId('item-ball.blue').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('item-ball.blue')).toHaveAttribute('data-chosen', 'true');
  await expect(room).toHaveAttribute('data-stars', '1');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('star-total')).toHaveText('★ 1');
  const next = await startRound(page, '1');
  await expect(next).toHaveAttribute('data-ball', 'ball.blue');
});

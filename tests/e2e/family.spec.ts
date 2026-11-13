/**
 * "Papa gegen Kind" end to end (amendment 23, T117, FR-154, FR-158 to FR-161).
 *
 * - With seeded stars the child unlocks "Papa gegen Kind" in the locker room; "Papa gegen Kind" (F) opens its start
 *   card with "Papa" and level 6; "Los geht's" starts the shootout.
 * - The match carries `data-mode="family"`, `data-turn` (`child` or `grownup`), `data-turn-card` and
 *   `data-shootout-score`. Before each kick the turn card names the shooter; Enter or a tap on it starts the turn.
 * - The child scores every kick and the grown-up misses every one: "LEO gewinnt!" with 5 + 3 stars. "Nochmal" starts
 *   a rematch without the start card.
 * - The screenshot `family.png` shows the turn card of the child before round 2.
 *
 * Every wait is on data-* state or text, never a fixed sleep. The speed-up hook shortens the shown square of a miss.
 */
import { expect, seedStorage, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import type { Page } from '@playwright/test';

/** Waits for the turn card of `turn`, starts the turn with Enter (or a tap on the card) and returns the target number. */
async function startTurn(page: Page, turn: 'child' | 'grownup', name: string, tap = false): Promise<number> {
  const scene = page.locator('main.match');
  const match = page.getByTestId('match');
  await expect(scene).toHaveAttribute('data-turn', turn);
  await expect(scene).toHaveAttribute('data-turn-card', 'true');
  await expect(page.getByTestId('turn-card')).toContainText(`${name} ist dran!`);
  if (tap) await page.getByTestId('turn-card').click();
  else await page.keyboard.press('Enter');
  await expect(scene).toHaveAttribute('data-turn-card', 'false');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  return Number(await match.getAttribute('data-target'));
}

test('unlock "Papa gegen Kind", play to the end with turn cards, and see the winner card', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStorage(
    page,
    { [SETTINGS_KEY]: defaultSettings(), [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 260, totalEarned: 600, shirtName: 'LEO' } },
    { once: true },
  );
  await page.goto('/?seed=5&speed=4');

  await expect(page.locator('[data-start="family"]')).toHaveAttribute('data-mode-state', 'locked');
  await page.keyboard.press('f');
  await page.getByTestId('mode-family').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('mode-family')).toHaveAttribute('data-unlocked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-start="family"]')).toHaveAttribute('data-mode-state', 'ready');

  // The start card: "Papa" at level 6 by default.
  await page.keyboard.press('f');
  const card = page.getByTestId('family-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('family-name')).toHaveValue('Papa');
  await expect(page.getByTestId('family-level-6')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('family-start').click();

  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-mode', 'family');
  await expect(scene).toHaveAttribute('data-shootout-score', '0:0');
  const board = page.getByTestId('shootout-score');
  await expect(board.locator('[data-kick="open"]')).toHaveCount(10);
  await expect(board.locator('[data-side="0"] .shootout-name')).toHaveText('LEO');
  await expect(board.locator('[data-side="1"] .shootout-name')).toHaveText('Papa');
  await expect(page.getByTestId('hearts')).toHaveCount(0);

  for (let round = 1; round <= 5; round++) {
    await typeAndShoot(page, await startTurn(page, 'child', 'LEO'));
    await expect(scene).toHaveAttribute('data-shootout-score', `${round}:0`);
    const grownup = await startTurn(page, 'grownup', 'Papa', round === 3);
    // The grown-up shoots at level 6, the hardest one.
    await expect(page.getByTestId('match')).toHaveAttribute('data-level', '6');
    await typeAndShoot(page, grownup === 1 ? 2 : grownup - 1);
    await expect(board.locator('[data-side="1"] [data-kick="miss"]')).toHaveCount(round);
    if (round === 1) {
      await expect(scene).toHaveAttribute('data-turn-card', 'true');
      await expect(scene).toHaveAttribute('data-turn', 'child');
      await page.screenshot({ path: test.info().outputPath('family.png') });
    }
  }

  const end = page.getByTestId('round-end');
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute('data-family-winner', 'child');
  await expect(end.getByRole('heading')).toHaveText('LEO gewinnt!');
  await expect(page.getByTestId('round-result')).toHaveText('LEO 5:0 Papa');
  await expect(page.getByTestId('round-stars')).toHaveText('+8 Sterne');
  await expect(page.getByTestId('record')).toHaveText('1 Mal gewonnen');
  await expect(scene).toHaveAttribute('data-turn', '');

  // "Nochmal" starts a rematch at once, with the same grown-up and no start card.
  await page.getByRole('button', { name: 'Nochmal' }).click();
  await expect(scene).toHaveAttribute('data-shootout-score', '0:0');
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId('turn-card')).toContainText('LEO ist dran!');
});

/**
 * "Torwandschießen" end to end (amendment 23, T117, FR-154 to FR-157).
 *
 * - With seeded stars the child unlocks "Torwandschießen" in the locker room; "Torwand" (W) starts it.
 * - The match carries `data-mode="torwand"`, `data-holes` (the target's hole first) and `data-shots`; the message line
 *   asks "Triff die N!". There are no hearts.
 * - The target hole scores; a decoy hole misses with its own line and no goal.
 * - The screenshot `torwand.png` shows the board with its holes while the child aims.
 *
 * Every wait is on data-* state or text, never a fixed sleep.
 */
import { expect, seedStorage, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import type { Page } from '@playwright/test';

/** The holes once the child aims at a new target and the task shows; the target's hole is first. */
async function aimingHoles(page: Page): Promise<number[]> {
  const match = page.getByTestId('match');
  const message = page.getByTestId('message');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(message).toHaveText(/^Triff die \d+!$/);
  const holes = (await page.locator('main.match').getAttribute('data-holes'))!.split(',').map(Number);
  expect(holes[0]).toBe(Number(await match.getAttribute('data-target')));
  await expect(message).toHaveText(`Triff die ${holes[0]}!`);
  return holes;
}

test('unlock "Torwand", score through the asked hole, and miss through a decoy', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStorage(page, { [SETTINGS_KEY]: defaultSettings(), [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 170, totalEarned: 400 } }, { once: true });
  await page.goto('/?seed=9&speed=2');

  // Locked: W opens the locker room at "Spielarten", where the child buys "Torwandschießen" for 150 stars.
  await expect(page.locator('[data-start="torwand"]')).toHaveAttribute('data-mode-state', 'locked');
  await page.keyboard.press('w');
  await page.getByTestId('mode-torwand').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('mode-torwand')).toHaveAttribute('data-unlocked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('star-total')).toContainText('20');
  await expect(page.locator('[data-start="torwand"]')).toHaveAttribute('data-mode-state', 'ready');
  await page.keyboard.press('w');

  const scene = page.locator('main.match');
  const match = page.getByTestId('match');
  await expect(scene).toHaveAttribute('data-mode', 'torwand');
  await expect(scene).toHaveAttribute('data-shots', '0');
  await expect(page.getByTestId('hearts')).toHaveCount(0);
  await expect(page.getByTestId('goal-count')).toHaveText('0 Treffer · Schuss 1 von 10');

  // The asked hole scores.
  const first = await aimingHoles(page);
  expect(first.length).toBeGreaterThanOrEqual(2);
  await typeAndShoot(page, first[0]!);
  await expect(page.getByTestId('message')).toHaveText('TOR!');
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(scene).toHaveAttribute('data-shots', '1');

  // The holes move; a decoy hole misses with its own line.
  const second = await aimingHoles(page);
  await expect(page.getByTestId('goal-count')).toHaveText('1 Treffer · Schuss 2 von 10');
  const decoy = second[1]!;
  // The scene has drawn (the weather shows once it has): the board with its holes is captured.
  await expect(scene).toHaveAttribute('data-weather', /.+/);
  await page.screenshot({ path: test.info().outputPath('torwand.png') });
  await typeAndShoot(page, decoy);
  await expect(page.getByTestId('message')).toHaveText(`Das andere Loch! Das war die ${decoy}.`);
  await expect(scene).toHaveAttribute('data-shots', '2');
  await expect(match).toHaveAttribute('data-goals', '1');
  // Then the next target comes, with new holes.
  await aimingHoles(page);
  await expect(page.getByTestId('goal-count')).toHaveText('1 Treffer · Schuss 3 von 10');
});

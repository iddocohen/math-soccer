/**
 * Modes to unlock and "Freistoß mit Mauer" end to end (amendment 21 part 1, T113, FR-140 to FR-142).
 *
 * - The start screen shows the three modes greyed with a lock and their price; a tap on "Mauer" opens the locker room
 *   at "Spielarten". With seeded stars the child unlocks "Freistoß mit Mauer"; "Elfmeterschießen" says it needs
 *   "Selbst ins Tor" first. Back on the start screen "Mauer" starts with M.
 * - In the match `data-mode="wall"` and `data-wall-cols` name the covered columns; the target and its hints are never
 *   in them. A shot at a number behind the wall is a miss with "Die Mauer! Hier ist N."; a goal moves the wall.
 * - "Selbst ins Tor" can be bought and says "kommt bald" until its game exists; "Spielarten erlauben" hides a button.
 *
 * Every wait is on data-* state or text, never a fixed sleep.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, seedStorage, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';

const settings = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 5 };

/** The covered columns of the wall, 0 to 9. */
async function wallCols(scene: Locator): Promise<number[]> {
  await expect(scene).toHaveAttribute('data-wall-cols', /^\d(,\d)*$/);
  return (await scene.getAttribute('data-wall-cols'))!.split(',').map(Number);
}

/** The column of `n` on the chart 1 to 100. */
const colOf = (n: number) => (n - 1) % 10;

async function expectClearOfWall(page: Page, scene: Locator): Promise<number> {
  const match = page.getByTestId('match');
  const target = await targetNumber(match);
  const cols = await wallCols(scene);
  const hints = ((await match.getAttribute('data-hints')) ?? '').split(',').filter(Boolean).map(Number);
  for (const n of [target, ...hints]) expect(cols).not.toContain(colOf(n));
  return target;
}

test('unlock "Mauer" with stars, then score past the wall and hit it once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 250, totalEarned: 250 } }, { once: true });
  await page.goto('/?seed=5');

  // The three modes show locked, with their price and key.
  for (const [mode, price] of [['wall', 200], ['keeper', 300], ['shootout', 600]] as const) {
    const button = page.locator(`[data-start="${mode}"]`);
    await expect(button).toHaveAttribute('data-mode-state', 'locked');
    await expect(button).toContainText(`★ ${price}`);
  }
  // A locked mode opens the locker room at "Spielarten".
  await page.locator('[data-start="wall"]').click();
  const modes = page.getByTestId('locker-modes');
  await expect(modes.getByRole('heading', { name: 'Spielarten' })).toBeInViewport();
  await expect(page.getByTestId('mode-shootout')).toHaveAttribute('data-lock', 'needs');
  await expect(page.getByTestId('mode-shootout')).toContainText('Erst Selbst ins Tor freischalten');
  await expect(page.getByTestId('mode-keeper')).toHaveAttribute('data-lock', 'stars');
  await expect(page.getByTestId('mode-keeper')).toContainText('noch 50 Sterne');

  await page.getByTestId('mode-wall').click();
  await expect(page.getByTestId('buy-question')).toContainText('Für 200 Sterne freischalten?');
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('mode-wall')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('locker-room')).toHaveAttribute('data-stars', '50');

  // Back on the start screen "Mauer" starts with M.
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-start="wall"]')).toHaveAttribute('data-mode-state', 'ready');
  await page.keyboard.press('m');
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-mode', 'wall');
  const match = page.getByTestId('match');
  await expect(match).toHaveAttribute('data-round-type', 'goalCount');
  const first = await expectClearOfWall(page, scene);
  const cols = await wallCols(scene);
  expect(cols.length).toBeGreaterThanOrEqual(1);
  expect(cols.length).toBeLessThanOrEqual(4);
  await expect(page.locator('main.match')).toHaveAttribute('data-stadium-name', /.+/);
  await page.screenshot({ path: test.info().outputPath('wall.png') });

  // A number behind the wall hits the wall: a miss, and the typed number's square is named.
  const behind = cols[0]! + 1 + 10 * 4;
  await typeAndShoot(page, behind);
  await expect(page.getByTestId('message')).toHaveText(`Die Mauer! Hier ist ${behind}.`);
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(match).toHaveAttribute('data-misses', '1');
  await expect(match).toHaveAttribute('data-goals', '0');
  await expect(scene).toHaveAttribute('data-wall-cols', cols.join(','));

  // A goal past the wall; the wall moves for the next target.
  await typeAndShoot(page, first);
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expectClearOfWall(page, scene);
  await expect(scene).not.toHaveAttribute('data-wall-cols', cols.join(','));
});

test('"Selbst ins Tor" unlocks and says "kommt bald"; "Elfmeterschießen" follows it; the parent can hide a mode', async ({ page }) => {
  await seedStorage(
    page,
    { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 900, totalEarned: 900, modes: ['wall'] } },
    { once: true },
  );
  await page.goto('/');
  await page.keyboard.press('t');
  await expect(page.getByTestId('locker-modes')).toBeVisible();
  await page.getByTestId('mode-keeper').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('mode-keeper')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('mode-shootout')).toHaveAttribute('data-lock', 'affordable');
  await page.getByTestId('mode-shootout').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('mode-shootout')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('locker-room')).toHaveAttribute('data-stars', '0');
  await page.keyboard.press('Escape');

  // Bought, but their games come later: "kommt bald", and T and E start nothing.
  for (const mode of ['keeper', 'shootout']) {
    await expect(page.locator(`[data-start="${mode}"]`)).toHaveAttribute('data-mode-state', 'soon');
    await expect(page.locator(`[data-start="${mode}"]`)).toContainText('kommt bald');
  }
  await page.keyboard.press('t');
  await page.keyboard.press('e');
  // The button is marked disabled for screen readers; a tap on it still does nothing.
  await expect(page.locator('[data-start="keeper"]')).toHaveAttribute('aria-disabled', 'true');
  await page.locator('[data-start="keeper"]').click({ force: true });
  await expect(page.getByTestId('start')).toBeVisible();

  // "Spielarten erlauben": with "Freistoß mit Mauer" off, its button is gone and M does nothing.
  await seedStorage(page, { [SETTINGS_KEY]: { ...settings, modesAllowed: { wall: false, keeper: true, shootout: true } } });
  await page.reload();
  await expect(page.locator('[data-start="keeper"]')).toBeVisible();
  await expect(page.locator('[data-start="wall"]')).toHaveCount(0);
  await page.keyboard.press('m');
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByTestId('match')).toHaveCount(0);
});

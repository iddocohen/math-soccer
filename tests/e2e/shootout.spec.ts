/**
 * "Elfmeterschießen" end to end (amendment 21 part 3, T115, FR-147, FR-148).
 *
 * - With seeded stars and "Selbst ins Tor" owned, the child unlocks "Elfmeterschießen" in the locker room; "Elfmeter"
 *   (E) starts it.
 * - The match carries `data-mode="shootout"`, `data-shootout-score` (the child's goals first) and `data-shootout-turn`
 *   (`child` or `opponent`). The child shoots as in "Spielen" (`data-target` on the overlay) and keeps as in "Selbst ins
 *   Tor" (`data-shot-target`). The score circles show two rows of five.
 * - A won shootout ends with "Elfmeter-Sieger!" and 5 stars; with the speed-up hook, a shootout where every kick
 *   misses and every shot comes too late ends with "Knapp! Noch mal?" and no stars.
 * - The screenshot `shootout.png` shows the shootout in round 4, while the opponent's shot flies.
 *
 * Every wait is on data-* state or text, never a fixed sleep.
 */
import { expect, seedStorage, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import type { Page } from '@playwright/test';

const settings = defaultSettings();

/** Sets how fast play time runs (the speed-up hook); 0 stops it. */
async function setSpeed(page: Page, speed: number): Promise<void> {
  await page.evaluate((s) => {
    window.mathSoccerSpeed = s;
  }, speed);
}

/**
 * The number of the child's target, once it is his turn and he aims: no opponent's shot shows, the ball waits and the
 * message line is empty. One poll reads all of it, so a state between two turns never passes.
 */
async function childTarget(page: Page): Promise<number> {
  const scene = page.locator('main.match');
  const match = page.getByTestId('match');
  const message = page.getByTestId('message');
  await expect
    .poll(async () =>
      [await scene.getAttribute('data-shootout-turn'), await scene.getAttribute('data-shot-state'), await match.getAttribute('data-phase'), await message.textContent()].join('|'),
    )
    .toBe('child||aiming|');
  return Number(await match.getAttribute('data-target'));
}

/** The number of the square the opponent's ball flies at. */
async function shotTarget(page: Page): Promise<number> {
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-shootout-turn', 'opponent');
  await expect(scene).toHaveAttribute('data-shot-state', 'flying');
  await expect(scene).toHaveAttribute('data-shot-target', /^\d+$/);
  return Number(await scene.getAttribute('data-shot-target'));
}

test('unlock "Elfmeter", score every kick and save every shot: "Elfmeter-Sieger!" with 5 stars', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStorage(
    page,
    { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 650, totalEarned: 950, modes: ['keeper'], shirtName: 'LEO' } },
    { once: true },
  );
  await page.goto('/?seed=5&speed=2');

  // Locked: E opens the locker room at "Spielarten", where the child buys "Elfmeterschießen".
  await expect(page.locator('[data-start="shootout"]')).toHaveAttribute('data-mode-state', 'locked');
  await page.keyboard.press('e');
  await page.getByTestId('mode-shootout').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('mode-shootout')).toHaveAttribute('data-unlocked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-start="shootout"]')).toHaveAttribute('data-mode-state', 'ready');
  await page.keyboard.press('e');

  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-mode', 'shootout');
  await expect(scene).toHaveAttribute('data-opponent', /.+/);
  await expect(scene).toHaveAttribute('data-shootout-score', '0:0');
  await expect(scene).toHaveAttribute('data-shootout-turn', 'child');
  const board = page.getByTestId('shootout-score');
  await expect(board.locator('[data-kick="open"]')).toHaveCount(10);
  await expect(board.locator('[data-side="0"] .shootout-name')).toHaveText('LEO');
  await expect(page.getByTestId('goal-count')).toHaveText('Elfmeter · Runde 1 von 5');
  await expect(page.getByTestId('hearts')).toHaveCount(0);

  for (let round = 1; round <= 5; round++) {
    await typeAndShoot(page, await childTarget(page));
    await expect(scene).toHaveAttribute('data-shootout-score', `${round}:0`);
    const shot = await shotTarget(page);
    if (round === 4) {
      // Mid-shootout: play time stands still while the ring and the score circles are captured.
      await setSpeed(page, 0);
      await expect(board.locator('[data-side="0"] [data-kick="goal"]')).toHaveCount(4);
      await expect(board.locator('[data-side="1"] [data-kick="miss"]')).toHaveCount(3);
      await page.keyboard.type(String(shot).slice(0, 1));
      await page.screenshot({ path: test.info().outputPath('shootout.png') });
      await page.keyboard.press('Backspace');
      await setSpeed(page, 2);
    }
    await typeAndShoot(page, shot);
    await expect(board.locator('[data-side="1"] [data-kick="miss"]')).toHaveCount(round);
  }

  const end = page.getByTestId('round-end');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toHaveAttribute('data-shootout-won', 'true');
  await expect(end.getByRole('heading')).toHaveText('Elfmeter-Sieger!');
  await expect(page.getByTestId('round-result')).toHaveText(/^5:0 gegen .+/);
  await expect(page.getByTestId('round-stars')).toHaveText('+5 Sterne');
  await expect(page.getByTestId('record')).toHaveText('1 Elfmeterschießen gewonnen');
  await expect(scene).toHaveAttribute('data-shootout-turn', '');
  await expect(board.locator('[data-kick="goal"]')).toHaveCount(5);
});

test('with the speed-up hook, a shootout of missed kicks and late saves ends with "Knapp! Noch mal?" and no stars', async ({ page }) => {
  test.setTimeout(120_000);
  await seedStorage(page, {
    [SETTINGS_KEY]: { ...settings, keeperSpeed: 'fast' },
    [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 40, totalEarned: 940, modes: ['keeper', 'shootout'] },
  });
  // 40 times as fast: each shot of the opponent arrives in a fraction of a second, before anything is typed.
  await page.goto('/?seed=5&speed=40');
  await page.keyboard.press('e');
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-mode', 'shootout');
  for (let round = 1; round <= 5; round++) {
    const n = await childTarget(page);
    await typeAndShoot(page, n === 1 ? 2 : n - 1);
    // The kick misses; then the opponent's shot arrives before anything is typed and scores.
    await expect(scene).toHaveAttribute('data-shootout-score', `0:${round}`);
  }
  const end = page.getByTestId('round-end');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toHaveAttribute('data-shootout-won', 'false');
  await expect(end.getByRole('heading')).toHaveText('Knapp! Noch mal?');
  await expect(page.getByTestId('round-result')).toHaveText(/^0:5 gegen .+/);
  await expect(page.getByTestId('round-stars')).toHaveText('+0 Sterne');
  await expect(page.getByTestId('record')).toHaveCount(0);
  const board = page.getByTestId('shootout-score');
  await expect(board.locator('[data-side="0"] [data-kick="miss"]')).toHaveCount(5);
  await expect(board.locator('[data-side="1"] [data-kick="goal"]')).toHaveCount(5);

  // "Nochmal" starts a new shootout.
  await page.getByRole('button', { name: 'Nochmal' }).click();
  await expect(scene).toHaveAttribute('data-shootout-score', '0:0');
  await expect(scene).toHaveAttribute('data-mode', 'shootout');
});

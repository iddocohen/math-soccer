/**
 * "Selbst ins Tor" end to end (amendment 21 part 2, T114, FR-143 to FR-146).
 *
 * - With seeded stars the child unlocks "Selbst ins Tor" in the locker room; "Torwart" (T) starts it.
 * - The match carries `data-mode="keeper"`, `data-shot-target` (the square the ball flies at, '' between shots),
 *   `data-shot-state`, `data-saves` and `data-shots`. Typing the flashing square's number and Enter saves; a wrong
 *   number concedes and names the square. Help holds the shot until the next key.
 * - With the speed-up hook, a round of 10 unanswered shots ends with "0 von 10 gehalten".
 * - A stored round in mid-flight, with play time stopped (`?speed=0`), gives the screenshot of the countdown ring.
 *
 * The speed-up hook stops play time while a decided shot is checked, so its short result stays on screen.
 * Every wait is on data-* state or text, never a fixed sleep.
 */
import { expect, seedStorage, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, ROUND_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import type { Page } from '@playwright/test';

const settings = defaultSettings();

/** Sets how fast play time runs (the speed-up hook); 0 stops it, so a decided shot stays on screen for the checks. */
async function setSpeed(page: Page, speed: number): Promise<void> {
  await page.evaluate((s) => {
    window.mathSoccerSpeed = s;
  }, speed);
}

async function shotTarget(page: Page): Promise<number> {
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-shot-state', 'flying');
  await expect(scene).toHaveAttribute('data-shot-target', /^\d+$/);
  return Number(await scene.getAttribute('data-shot-target'));
}

test('unlock "Torwart", save a shot with the flashing square\'s number, concede one with a wrong number', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 350, totalEarned: 350 } }, { once: true });
  await page.goto('/?seed=5&speed=1');

  // Locked: T opens the locker room at "Spielarten", where the child buys "Selbst ins Tor".
  await expect(page.locator('[data-start="keeper"]')).toHaveAttribute('data-mode-state', 'locked');
  await page.keyboard.press('t');
  await page.getByTestId('mode-keeper').click();
  await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
  await expect(page.getByTestId('mode-keeper')).toHaveAttribute('data-unlocked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-start="keeper"]')).toHaveAttribute('data-mode-state', 'ready');
  await page.keyboard.press('t');

  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-mode', 'keeper');
  await expect(scene).toHaveAttribute('data-opponent', /.+/);
  await expect(scene).toHaveAttribute('data-shots', '0');
  await expect(page.getByTestId('goal-count')).toHaveText('0 gehalten · Schuss 1 von 10');

  // The correct number saves.
  const first = await shotTarget(page);
  await setSpeed(page, 0);
  await typeAndShoot(page, first);
  await expect(scene).toHaveAttribute('data-shot-state', 'saved');
  await expect(scene).toHaveAttribute('data-saves', '1');
  await expect(scene).toHaveAttribute('data-shots', '1');
  await expect(page.getByTestId('message')).toHaveText('Gehalten!');
  await setSpeed(page, 1);

  // Help holds the next shot until the next key; a wrong number then concedes and names the square.
  const second = await shotTarget(page);
  await page.keyboard.press('h');
  await expect(scene).toHaveAttribute('data-shot-state', 'held');
  const wrong = second === 1 ? 2 : second - 1;
  await setSpeed(page, 0);
  await typeAndShoot(page, wrong);
  await expect(scene).toHaveAttribute('data-shot-state', 'wrong');
  await expect(scene).toHaveAttribute('data-saves', '1');
  await expect(scene).toHaveAttribute('data-shots', '2');
  await expect(page.getByTestId('message')).toHaveText(`Tor! Hier war ${second}.`);
  await expect(scene).toHaveAttribute('data-shot-target', '');
});

test('a round of 10 shots ends with "N von 10 gehalten"', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...settings, keeperSpeed: 'fast' }, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), modes: ['keeper'] } });
  // 40 times as fast: a 5 s shot flies in an eighth of a second, so every shot comes too late.
  await page.goto('/?seed=5&speed=40');
  await page.keyboard.press('t');
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-mode', 'keeper');
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 30_000 });
  await expect(scene).toHaveAttribute('data-shots', '10');
  await expect(page.getByTestId('round-result')).toHaveText('0 von 10 gehalten');
});

test('screenshot: the flashing square with the countdown ring, mid-flight', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const round = {
    version: 1,
    seed: 5,
    roundType: 'untilHearts',
    challengeMinutes: null,
    goalsPerRound: settings.goalsPerRound,
    min: 1,
    max: 100,
    goals: 2,
    hearts: 3,
    missesInRow: 0,
    helpStep: 0,
    target: { number: 47, hints: [46, 48, 37, 57], directions: ['right', 'left', 'down', 'up'], level: 1, pattern: 'neighbors' },
    targetCount: 4,
    starsThisRound: 2,
    elapsedMs: 30_000,
    targetStartMs: 28_000,
    targetMisses: 0,
    missTimes: [],
    cupMatch: null,
    mode: 'keeper',
    wall: null,
    shots: 3,
    keeperShot: { totalMs: 8_000, leftMs: 3_000, held: false, result: null, typed: null, resultLeftMs: 0 },
    phase: 'aiming',
  };
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), modes: ['keeper'] }, [ROUND_KEY]: round });
  // Play time stands still, so the ring stays where the stored shot is.
  await page.goto('/?speed=0');
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-mode', 'keeper');
  await expect(scene).toHaveAttribute('data-shot-target', '47');
  await expect(page.getByTestId('match')).toHaveAttribute('data-keeper', 'idle');
  await page.keyboard.type('4');
  await expect(page.getByTestId('entry')).toHaveText('4');
  await page.screenshot({ path: test.info().outputPath('keeper-mode.png') });
});

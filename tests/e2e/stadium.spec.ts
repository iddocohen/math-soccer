/**
 * The stadium and the weather end to end (amendment 20 part 2, T112, FR-135, FR-138, FR-139). The child names the
 * stadium, buys the bigger stands, purple floodlights and snow in the locker room; each tap shows the item on the
 * stadium preview. In the match `data-stands`, `data-floodlight`, `data-weather` and `data-stadium-name` name them,
 * the snow falls, and the scoreboard shows the name next to the goal counter without touching a button or the column
 * scale.
 *
 * Every weather is also started once at 1280 by 800 with the hints showing. With WEATHER_SHOTS set to a folder, each
 * case saves `weather-<name>.png` there, for checking by eye that the numbers stay readable, and the first test saves
 * the locker room and the match with the bought stadium.
 */
import type { Page } from '@playwright/test';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { boxOf, overlap } from './layout';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { WEATHERS } from '../../src/core/rewards/items';
import { COLUMN_STRIP } from '../../src/game/scales';
import { WORLD_WIDTH } from '../../src/core/match/world';

// The e2e files are typed without Node's types; Playwright runs them in Node, where `process` exists.
declare const process: { env: Record<string, string | undefined> };

const settings = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 5, hintDisplay: 'always' as const };

test.use({ viewport: { width: 1280, height: 800 } });

/** With WEATHER_SHOTS set to a folder, saves a screenshot `<name>.png` there. */
async function shot(page: Page, name: string): Promise<void> {
  const folder = process.env.WEATHER_SHOTS;
  if (folder) await page.screenshot({ path: `${folder}/${name}.png` });
}

/** The scoreboard lies inside the screen, clear of every top button, and above the column scale's strip. */
async function expectScoreboardClear(page: Page): Promise<void> {
  const board = await boxOf(page.getByTestId('scoreboard'));
  const { width } = page.viewportSize()!;
  expect(board.x + board.width).toBeLessThanOrEqual(width);
  for (const button of await page.locator('.overlay-buttons > *').all()) {
    expect(overlap(board, await boxOf(button)), 'scoreboard clear of a top button').toBe(false);
  }
  const canvas = await boxOf(page.locator('canvas'));
  const strip = canvas.y + COLUMN_STRIP.y * (canvas.width / WORLD_WIDTH);
  expect(board.y + board.height, 'scoreboard above the column scale').toBeLessThanOrEqual(strip);
}

test('name the stadium, buy bigger stands, purple floodlights and snow; the match shows them', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 300, totalEarned: 300 } });
  await page.goto('/?seed=11');
  await page.keyboard.press('k');
  const preview = page.getByTestId('stadium-preview');
  for (const heading of ['Stadion', 'Wetter']) {
    await expect(page.getByRole('region', { name: heading }).getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  for (const id of ['stands.normal', 'floodlight.white', 'weather.evening']) await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-chosen', 'true');
  await expect(preview).toHaveAttribute('data-weather', 'evening');
  await expect(page.getByTestId('stadium-name')).toHaveValue('Mathe-Arena');

  // The name takes up to 14 characters and shows on the preview's scoreboard.
  await page.getByTestId('stadium-name').fill('Sonnenschein-Stadion');
  await expect(page.getByTestId('stadium-name')).toHaveValue('Sonnenschein-S');
  await page.getByTestId('stadium-name').fill('Mias Arena');
  await expect(page.getByTestId('stadium-preview-name')).toHaveText('MIAS ARENA');

  // A tap shows the item on the preview, also before it is bought, and asks to buy it.
  for (const [id, attribute, value] of [
    ['stands.big', 'data-stands', 'big'],
    ['floodlight.purple', 'data-floodlight', 'purple'],
    ['weather.snow', 'data-weather', 'snow'],
  ] as const) {
    await page.getByTestId(`item-${id}`).click();
    await expect(preview).toHaveAttribute('data-playing', id);
    await expect(preview).toHaveAttribute(attribute, value);
    await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
    await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-chosen', 'true');
  }
  await expect(page.getByTestId('locker-room')).toHaveAttribute('data-stars', String(300 - 150 - 40 - 100));
  await shot(page, 'locker-stadium');
  // A weather the child cannot buy yet shows on the preview for a moment, then the chosen snow again. The locked
  // button is aria-disabled, so the tap is sent as a plain click event.
  await page.getByTestId('item-weather.rain').dispatchEvent('click');
  await expect(preview).toHaveAttribute('data-weather', 'rain');
  await expect(page.getByTestId('buy-question')).toHaveCount(0);
  await expect(preview).toHaveAttribute('data-playing', '');
  await expect(preview).toHaveAttribute('data-weather', 'snow');

  await page.keyboard.press('Escape');
  const match = await startRound(page);
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-weather', 'snow');
  await expect(scene).toHaveAttribute('data-floodlight', 'purple');
  await expect(scene).toHaveAttribute('data-stands', 'big');
  await expect(scene).toHaveAttribute('data-stadium-name', 'Mias Arena');
  await expect(scene).toHaveAttribute('data-weather-drops', /^[1-9]\d*$/);
  await expect(page.getByTestId('scoreboard')).toHaveText('Mias Arena');
  await expectScoreboardClear(page);
  await shot(page, 'stadium-big-purple-snow');

  // With both scales showing (help step 2) the scoreboard still clears the column scale.
  await page.getByTestId('help-button').click();
  await page.getByTestId('help-button').click();
  await expect(match).toHaveAttribute('data-scales', 'both');
  await expectScoreboardClear(page);

  // The weather stays for the next target.
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');
  await targetNumber(match);
  await expect(scene).toHaveAttribute('data-weather', 'snow');
});

test('a new player plays in the evening in the "Mathe-Arena" with white floodlights', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: emptyLockerRoom() });
  await page.goto('/?seed=11');
  await startRound(page);
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-weather', 'evening');
  await expect(scene).toHaveAttribute('data-floodlight', 'white');
  await expect(scene).toHaveAttribute('data-stands', 'normal');
  await expect(scene).toHaveAttribute('data-weather-drops', '0');
  await expect(page.getByTestId('scoreboard')).toHaveText('Mathe-Arena');
  await expectScoreboardClear(page);
});

for (const weather of WEATHERS) {
  test(`the ${weather} weather shows with the hints readable`, async ({ page }) => {
    const owned = WEATHERS.filter((w) => w !== 'evening').map((w) => `weather.${w}`);
    await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), owned, weather: `weather.${weather}` } });
    await page.goto('/?seed=11');
    const match = await startRound(page);
    const scene = page.locator('main.match');
    await expect(scene).toHaveAttribute('data-weather', weather);
    await expect(scene).toHaveAttribute('data-weather-drops', weather === 'snow' || weather === 'rain' ? /^[1-9]\d*$/ : '0');
    await expect(match).not.toHaveAttribute('data-hints', '');
    await shot(page, `weather-${weather}`);
  });
}

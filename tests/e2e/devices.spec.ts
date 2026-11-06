// Structure adapted from math-tank tests/e2e/devices.spec.ts: iPad only (phones are not a target of math-soccer).
/**
 * T065 (FR-031, FR-045): the game on an iPad held sideways (1024 by 768) and upright (768 by 1024), in WebKit with
 * touch. Runs only in the ipad projects of playwright.config.ts. Every action is a tap; no keyboard call is made.
 * With the number pad setting "automatic", the pad shows because the device has no mouse or trackpad.
 * Each case saves a screenshot in its test output folder.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, seedStorage, targetNumber, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { boxOf, expectMatchFits, expectNoScroll, expectPadKeys, inside } from './layout';

async function startPlay(page: Page): Promise<Locator> {
  await page.goto('/?seed=3');
  await page.locator('[data-start="play"]').tap();
  const match = page.getByTestId('match');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(page.locator('canvas')).toBeVisible();
  return match;
}

async function tapNumber(page: Page, n: number): Promise<void> {
  for (const digit of String(n)) await page.locator(`[data-key="${digit}"]`).tap();
}

test('the start screen fits and a tap on "Spielen" starts the match with the number pad', async ({ page }) => {
  await page.goto('/');
  const { width, height } = page.viewportSize()!;
  for (const start of ['play', 'time']) {
    expect(inside(await boxOf(page.locator(`[data-start="${start}"]`)), width, height), `${start} button inside`).toBe(true);
  }
  await expectNoScroll(page);
  const match = await startPlay(page);
  await expect(match).toHaveAttribute('data-number-pad', 'true');
  await expectPadKeys(page);
  await expectMatchFits(page);
  await expectNoScroll(page);
  await page.screenshot({ path: test.info().outputPath('match.png') });
});

test('a round of two goals is played with taps on the number pad only', async ({ page }) => {
  test.setTimeout(120_000);
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 2 } });
  const match = await startPlay(page);
  for (let goals = 0; goals < 2; goals++) {
    const target = await targetNumber(match);
    // A wrong digit first, deleted with ⌫.
    await page.locator('[data-key="9"]').tap();
    await page.locator('[data-key="backspace"]').tap();
    await expect(page.getByTestId('entry')).toHaveText('');
    await tapNumber(page, target);
    await expect(page.getByTestId('entry')).toHaveText(String(target));
    await page.locator('[data-key="shoot"]').tap();
    await expect(match).toHaveAttribute('data-goals', String(goals + 1));
  }
  await expect(page.getByTestId('round-end')).toBeVisible();
});

test('the full help chart (help step 3) fits on the screen', async ({ page }) => {
  const match = await startPlay(page);
  const help = page.getByTestId('help-button');
  await help.tap();
  await expect(match).toHaveAttribute('data-help', '1');
  await help.tap();
  await expect(match).toHaveAttribute('data-help', '2');
  await help.tap();
  await expect(match).toHaveAttribute('data-help-chart', 'open');
  const chart = page.locator('.help-chart');
  await expect(chart).toBeVisible();
  const { width, height } = page.viewportSize()!;
  expect(inside(await boxOf(chart), width, height), 'help chart inside the screen').toBe(true);
  // The whole chart shows without scrolling inside it.
  expect(await chart.evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('help-chart.png') });
});

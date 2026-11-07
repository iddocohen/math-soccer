// Adapted from math-tank tests/e2e/fire.spec.ts (amendment 16 there): the number pad part only.
/**
 * Amendment 16 (FR-031): with "Zahlenfeld: Automatisch" the number pad shows on an iPad and on Amazon Fire tablets in
 * Silk, and a shot is played by tapping its keys. Runs only in the ipad and Fire projects of playwright.config.ts
 * (WebKit iPad sizes; Chromium with Silk's user agent, touch and the Fire 7, Fire HD 8 and Fire HD 10 sizes held
 * sideways and upright, tests/e2e/silk.ts).
 *
 * The second test makes the browser report a fine pointer, as an iPad with a trackpad, keyboard cover or Pencil and a
 * Fire tablet in Silk can: an init script answers the query `(pointer: fine)` with a list that always matches. The
 * pad then shows because the screen is narrower than 1100 CSS px (PAD_WIDTH_LIMIT), as in math-tank. The Fire HD 10
 * held sideways is 1280 CSS px wide, so with a fine pointer it gets no pad, by the same rule.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, targetNumber, test } from './fixtures';
import { PAD_QUERIES, PAD_WIDTH_LIMIT } from '../../src/core/view/screen';

async function startPlay(page: Page): Promise<Locator> {
  await page.goto('/?seed=3');
  await page.locator('[data-start="play"]').tap();
  const match = page.getByTestId('match');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(page.locator('canvas')).toBeVisible();
  return match;
}

/** Taps the target's digits and the shoot key on the number pad, and waits for the goal. */
async function shootWithPad(page: Page, match: Locator): Promise<void> {
  const target = await targetNumber(match);
  for (const digit of String(target)) await page.locator(`[data-key="${digit}"]`).tap();
  await expect(page.getByTestId('entry')).toHaveText(String(target));
  await page.locator('[data-key="shoot"]').tap();
  await expect(match).toHaveAttribute('data-goals', '1');
}

test('"Automatisch" shows the number pad and a shot is played by tapping its keys', async ({ page }) => {
  const match = await startPlay(page);
  await expect(match).toHaveAttribute('data-number-pad', 'true');
  await shootWithPad(page, match);
});

test('with a fine pointer reported, "Automatisch" still shows the pad on a screen narrower than 1100 px', async ({ page }) => {
  await page.addInitScript((fineQuery) => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => (query === fineQuery ? original('(min-width: 0px)') : original(query));
  }, PAD_QUERIES.finePointer);
  const match = await startPlay(page);
  expect(await page.evaluate((q) => window.matchMedia(q).matches, PAD_QUERIES.finePointer)).toBe(true);
  const { width } = page.viewportSize()!;
  if (width >= PAD_WIDTH_LIMIT) {
    await expect(match).toHaveAttribute('data-number-pad', 'false');
    return;
  }
  await expect(match).toHaveAttribute('data-number-pad', 'true');
  await shootWithPad(page, match);
});

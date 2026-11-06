/**
 * Difficulty levels end to end (T095; amendment 09, FR-086 to FR-088): with "Stufe am Anfang" 1 and "Schwerste Stufe"
 * 2, three goals in a row scored alone show "Neue Stufe: Schräge Linien!", and the next target has diagonal hints at
 * level 2. Each goal waits 2 seconds of play time first, so it is not a guess (classify.ts). Keys drive the game;
 * waits are on data-* state and the shown clock, never fixed sleeps.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

/** Seconds of play time on the shown clock ("m:ss"). */
async function clockSeconds(page: Page): Promise<number> {
  const [m, s] = (await page.getByTestId('clock').innerText()).split(':').map(Number);
  return m! * 60 + s!;
}

/** Waits until the shown clock has moved on by at least `seconds` of play time. */
async function waitPlayTime(page: Page, seconds: number): Promise<void> {
  const from = await clockSeconds(page);
  await expect.poll(() => clockSeconds(page)).toBeGreaterThanOrEqual(from + seconds);
}

async function hintsOf(match: Locator): Promise<number[]> {
  await expect(match).toHaveAttribute('data-hints', /^\d+(,\d+)*$/);
  return (await match.getAttribute('data-hints'))!.split(',').map(Number);
}

test('three goals alone at level 1 show "Neue Stufe: Schräge Linien!", then diagonal hints', async ({ page }) => {
  await seedStorage(page, {
    [SETTINGS_KEY]: { ...defaultSettings(), levels: { start: 1, hardest: 2 }, adaptive: true, showClock: true, roundType: 'untilHearts' },
  });
  await page.goto('/?start=play&seed=3');
  const match = await startRound(page);

  for (const goals of ['1', '2', '3']) {
    await expect(match).toHaveAttribute('data-level', '1');
    const target = await targetNumber(match);
    await waitPlayTime(page, 2);
    await typeAndShoot(page, target);
    // The third goal raises the level: its message replaces "TOR!" while the goal is celebrated.
    if (goals === '3') await expect(page.getByTestId('message')).toHaveText('Neue Stufe: Schräge Linien!');
    await expect(match).toHaveAttribute('data-goals', goals);
  }

  // The next target is at level 2: every hint sits on a diagonal line with the target.
  await expect(match).toHaveAttribute('data-level', '2');
  const target = await targetNumber(match);
  const hints = await hintsOf(match);
  for (const h of hints) {
    const diff = Math.abs(target - h);
    expect(diff % 11 === 0 || diff % 9 === 0).toBe(true);
  }
});

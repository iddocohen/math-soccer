/**
 * Amendment 13, cup core (T101) end to end: "Pokal" (P) starts the cup's next match with "Tore pro Spiel", a win moves
 * the cup on with its bonus stars, a loss keeps the same match, and "Zum Start" leaves the cup as it was (FR-118). The
 * bracket screen and the team looks are tested in `cup.spec.ts` (T102). Game state is read from data-* attributes; there are
 * no fixed waits.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { teamOf } from '../../src/core/cup/cup';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyCup } from '../../src/core/storage/schemas';
import { CUP_KEY, ROUND_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();
/** Three goals win a match; three misses lose a heart. */
// Levels 1 to 5: every shot at a target is a goal. The cutouts of level 6 take several shots per goal (amendment 18);
// cutouts.spec.ts and the cup unit tests cover them.
const cupSettings = { ...defaultSettings(), levels: { start: 1 as const, hardest: 5 as const }, cupGoals: 3, difficulty: 'challenging' as const };

async function storedCup(page: Page): Promise<unknown> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as unknown, CUP_KEY);
}

/** Scores `n` goals in a row, waiting on the goal counter after each one. */
async function scoreGoals(page: Page, match: Locator, n: number): Promise<void> {
  for (let i = 1; i <= n; i++) {
    await typeAndShoot(page, await targetNumber(match));
    if (i < n) await expect(match).toHaveAttribute('data-goals', String(i));
  }
}

test('P and Enter start group game 1 at the start level; 3 goals win it and move the cup on with 3 bonus stars (FR-105, FR-108, FR-112, FR-132)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: cupSettings });
  await page.goto('/?seed=3');
  const cupButton = page.locator('[data-start="cup"]');
  await expect(cupButton).toHaveAttribute('data-cup-stage', '0');
  await expect(cupButton).toHaveText(/Pokal/);

  // P opens the bracket screen (T102); Enter there starts the highlighted match.
  await page.keyboard.press('p');
  await expect(page.getByTestId('cup-bracket')).toBeVisible();
  await page.keyboard.press('Enter');
  const match = page.getByTestId('match');
  await expect(match).toHaveAttribute('data-round-type', 'cup');
  await expect(match).toHaveAttribute('data-cup-level', '1');
  await expect(match).toHaveAttribute('data-level', '1');
  await expect(page.getByTestId('goal-count')).toHaveText(text.match.goalsOf(0, 3));
  await expect(page.getByTestId('hearts')).toBeVisible();

  await scoreGoals(page, match, 3);
  const result = page.getByTestId('cup-result');
  await expect(result).toHaveText(text.cup.won(text.cup.onTo.group2));
  await expect(result).toHaveAttribute('data-cup-won', 'true');
  // 3 goals of 1 star and the match bonus of 3 (amendment 19, FR-132).
  await expect(page.getByTestId('round-stars')).toHaveText(text.roundEnd.stars(3 * 1 + 3));
  await expect(page.getByTestId('record')).toHaveCount(0);
  expect(await storedCup(page)).toMatchObject({ cup: 1, stage: 1, tries: 0, scores: [{ goals: 3, against: 0 }] });

  // "Weiter" goes to the bracket, Escape from there to the start screen.
  await page.getByRole('button', { name: text.cup.next }).click();
  await expect(page.getByTestId('cup-bracket')).toHaveAttribute('data-cup-stage', '1');
  await page.keyboard.press('Escape');
  await expect(cupButton).toHaveAttribute('data-cup-stage', '1');
  await expect(page.getByTestId('star-total')).toHaveText(text.start.stars(6));
});

test('a loss says "Knapp!" with the same opponent and keeps the match; "Nochmal" replays it (FR-108)', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: cupSettings });
  await page.goto('/?start=cup&seed=5');
  const match = await startRound(page);
  await expect(match).toHaveAttribute('data-round-type', 'cup');
  const target = await targetNumber(match);
  const wrong = target === 100 ? 99 : target + 1;
  // 3 hearts of 3 misses each.
  for (let i = 1; i <= 9; i++) {
    await typeAndShoot(page, wrong);
    if (i < 9) {
      await expect(match).toHaveAttribute('data-misses', String(i));
      await expect(match).toHaveAttribute('data-phase', 'aiming');
    }
  }
  const result = page.getByTestId('cup-result');
  await expect(result).toHaveText(text.cup.lost(teamOf(1, 0).name));
  await expect(result).toHaveAttribute('data-cup-won', 'false');
  expect(await storedCup(page)).toMatchObject({ cup: 1, stage: 0, tries: 1, scores: [] });

  // "Nochmal" (Enter) plays the same match again.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('round-end')).toHaveCount(0);
  await expect(match).toHaveAttribute('data-round-type', 'cup');
  await expect(match).toHaveAttribute('data-goals', '0');
  await expect(match).toHaveAttribute('data-hearts', '3');
});

test('"Zum Start" during a cup match leaves the cup as it was (FR-118)', async ({ page }) => {
  const cup = { ...emptyCup(), stage: 2, tries: 1, scores: [{ goals: 3, against: 0 }, { goals: 3, against: 1 }] };
  await seedStorage(page, { [SETTINGS_KEY]: cupSettings, [CUP_KEY]: cup });
  await page.goto('/?start=cup&seed=2');
  const match = await startRound(page);
  // The quarter final of the first cup plays level 3 of 1 to 5.
  await expect(match).toHaveAttribute('data-cup-level', '3');
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');

  await page.getByRole('button', { name: text.match.home }).click();
  await page.getByTestId('pause-screen').getByRole('button', { name: text.match.home }).click();
  await expect(page.getByTestId('start')).toBeVisible();
  expect(await storedCup(page)).toEqual(cup);
  expect(await page.evaluate((key) => localStorage.getItem(key), ROUND_KEY)).toBeNull();
  await expect(page.locator('[data-start="cup"]')).toHaveAttribute('data-cup-stage', '2');
});

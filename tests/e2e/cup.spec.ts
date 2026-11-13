/**
 * Amendment 13, cup screens and scene (T102): the bracket screen from "Pokal" (P), the match intro with the opponent,
 * the win and loss lines with the way back to the bracket, the opponent's keeper and scarves, the final (full stand,
 * chant, confetti, fireworks, cup lift) and the trophy shelf in the locker room. Game state is read from data-*
 * attributes; there are no fixed waits.
 *
 * The final test saves the bracket screen and the won final at 1280 by 800 in its output folder (cup-bracket.png and
 * cup-final.png), for a look at the drawing.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, seedStorage, targetNumber, test, typeAndShoot } from './fixtures';
import { teamOf } from '../../src/core/cup/cup';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyCup } from '../../src/core/storage/schemas';
import { CUP_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();
/** Three goals win a match; three misses lose a heart. */
// Levels 1 to 5: every shot at a target is a goal. The cutouts of level 6 take several shots per goal (amendment 18);
// cutouts.spec.ts and the cup unit tests cover them.
const cupSettings = { ...defaultSettings(), levels: { start: 1 as const, hardest: 5 as const }, cupGoals: 3, difficulty: 'challenging' as const };

async function scoreGoals(page: Page, match: Locator, n: number): Promise<void> {
  for (let i = 1; i <= n; i++) {
    await typeAndShoot(page, await targetNumber(match));
    if (i < n) await expect(match).toHaveAttribute('data-goals', String(i));
  }
}

/** Opens the bracket with P from the start screen. */
async function openBracket(page: Page): Promise<Locator> {
  await expect(page.getByTestId('start')).toBeVisible();
  await page.keyboard.press('p');
  const bracket = page.getByTestId('cup-bracket');
  await expect(bracket).toBeVisible();
  return bracket;
}

test('P opens the bracket of five matches; Enter starts the highlighted one after a short intro; a win goes back to the bracket with a check mark (FR-105, FR-106, FR-108)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStorage(page, { [SETTINGS_KEY]: cupSettings });
  await page.goto('/?seed=3');
  const bracket = await openBracket(page);
  const matches = bracket.getByTestId('bracket-match');
  await expect(matches).toHaveCount(5);
  await expect(matches).toHaveText([
    new RegExp(text.cup.stages.group1),
    new RegExp(text.cup.stages.group2),
    new RegExp(text.cup.stages.quarterFinal),
    new RegExp(text.cup.stages.semiFinal),
    new RegExp(text.cup.stages.final),
  ]);
  await expect(matches.nth(0)).toHaveAttribute('data-state', 'next');
  await expect(matches.nth(1)).toHaveAttribute('data-state', 'later');
  await expect(matches.nth(0)).toContainText(teamOf(1, 0).name);

  // Escape goes back to the start screen, P opens the bracket again.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('start')).toBeVisible();
  await openBracket(page);

  await page.keyboard.press('Enter');
  const match = page.getByTestId('match');
  const intro = page.getByTestId('cup-intro');
  await expect(intro).toHaveText(text.cup.intro(text.cup.stages.group1, teamOf(1, 0).name));
  // The opponent's keeper and scarves (FR-107): FC Blitz has the small, quick keeper.
  await expect(match).toHaveAttribute('data-cup-team', teamOf(1, 0).id);
  await expect(match).toHaveAttribute('data-keeper-quirk', teamOf(1, 0).quirk);
  await expect(match).toHaveAttribute('data-cup-show', 'match');
  // The card goes by itself after about 1.5 s.
  await expect(intro).toHaveCount(0);

  await scoreGoals(page, match, 3);
  await expect(page.getByTestId('cup-result')).toHaveText(text.cup.won(text.cup.onTo.group2));
  await expect(page.getByRole('button', { name: text.roundEnd.again })).toHaveCount(0);
  // Enter ("Weiter") goes back to the bracket: the first match shows its check mark and score, the second is next.
  await page.keyboard.press('Enter');
  await expect(bracket).toHaveAttribute('data-cup-stage', '1');
  await expect(matches.nth(0)).toHaveAttribute('data-state', 'won');
  await expect(matches.nth(0)).toContainText(`✓ ${text.cup.score(3, 0)}`);
  await expect(matches.nth(1)).toHaveAttribute('data-state', 'next');
});

test('Enter skips the intro without shooting; a loss says "Knapp!" and "Zurück" goes to the bracket at the same match (FR-108)', async ({ page }) => {
  const cup = { ...emptyCup(), stage: 1, scores: [{ goals: 3, against: 1 }] };
  await seedStorage(page, { [SETTINGS_KEY]: cupSettings, [CUP_KEY]: cup });
  await page.goto('/?seed=5');
  const bracket = await openBracket(page);
  // A tap on the highlighted match starts it as well.
  await bracket.locator('[data-state="next"] button').click();
  const match = page.getByTestId('match');
  const intro = page.getByTestId('cup-intro');
  await expect(intro).toHaveText(text.cup.intro(text.cup.stages.group2, teamOf(1, 1).name));
  await expect(match).toHaveAttribute('data-keeper-quirk', teamOf(1, 1).quirk);
  await page.keyboard.press('Enter');
  await expect(intro).toHaveCount(0);
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(match).toHaveAttribute('data-misses', '0');

  const target = await targetNumber(match);
  const wrong = target === 100 ? 99 : target + 1;
  for (let i = 1; i <= 9; i++) {
    await typeAndShoot(page, wrong);
    if (i < 9) {
      await expect(match).toHaveAttribute('data-misses', String(i));
      await expect(match).toHaveAttribute('data-phase', 'aiming');
    }
  }
  await expect(page.getByTestId('cup-result')).toHaveText(text.cup.lost(teamOf(1, 1).name));
  await page.getByRole('button', { name: text.roundEnd.back }).click();
  await expect(bracket).toHaveAttribute('data-cup-stage', '1');
  await expect(bracket.getByTestId('bracket-match').nth(1)).toHaveAttribute('data-state', 'next');
});

test('the final: full stand and chant; the win brings confetti, fireworks and the cup lift; the cup lands on the trophy shelf (FR-110, FR-111)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const won = [
    { goals: 3, against: 0 },
    { goals: 3, against: 1 },
    { goals: 3, against: 0 },
    { goals: 3, against: 2 },
  ];
  await seedStorage(page, { [SETTINGS_KEY]: cupSettings, [CUP_KEY]: { ...emptyCup(), stage: 4, scores: won } });
  await page.goto('/?seed=7');
  const bracket = await openBracket(page);
  await expect(bracket.getByTestId('bracket-match').nth(4)).toHaveAttribute('data-state', 'next');
  await page.screenshot({ path: testInfo.outputPath('cup-bracket.png') });

  await page.keyboard.press('Enter');
  const match = page.getByTestId('match');
  await expect(page.getByTestId('cup-intro')).toHaveText(text.cup.intro(text.cup.stages.final, teamOf(1, 4).name));
  await expect(match).toHaveAttribute('data-cup-show', 'final');
  await page.keyboard.press('Enter');
  await scoreGoals(page, match, 3);

  await expect(match).toHaveAttribute('data-cup-show', 'won');
  await expect(page.getByTestId('cup-result')).toHaveText(text.cup.cupWon(1));
  await expect(page.getByTestId('round-end')).toHaveClass(/cup-final-won/);
  // 3 goals of 2 stars, the match bonus of 5 and the cup bonus of 20.
  await expect(page.getByTestId('round-stars')).toHaveText(text.roundEnd.stars(3 * 2 + 5 + 20));
  await page.screenshot({ path: testInfo.outputPath('cup-final.png') });

  // "Weiter" goes to the bracket of the next cup.
  await page.keyboard.press('Enter');
  await expect(bracket).toHaveAttribute('data-cup-number', '2');
  await expect(bracket).toHaveAttribute('data-cup-stage', '0');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('start')).toBeVisible();
  await page.keyboard.press('k');
  const shelf = page.getByTestId('trophy-shelf');
  await expect(shelf).toHaveAttribute('data-trophies', '1');
  await expect(shelf.getByTestId('trophy')).toHaveText([text.lockerRoom.trophy(1)]);
});

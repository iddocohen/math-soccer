/**
 * US4 end to end with the keyboard only (T052; acceptance scenarios US4-1 to US4-4, FR-015 to FR-018, FR-026): with
 * only line mode and only the direction "down" on, key 2 starts a line. Two squares are printed and the third is the
 * target. Each correct square says "Richtig!" and moves the target down one row; a wrong number is a miss that leaves
 * the target. The last square of the line (5 squares by default) scores one goal, and a new line follows.
 * Game state is read from the overlay's data-* attributes; there are no fixed waits.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();
const downLines = {
  ...defaultSettings(),
  modes: { holes: false, lines: true, keeper: false },
  lineDirections: { right: false, down: true, downRight: false, downLeft: false, left: false, up: false, upLeft: false, upRight: false },
  roundType: 'goalCount' as const,
  goalsPerRound: 2,
};

test('line mode with only "down": shoot the line squares and score one goal', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: downLines });
  await page.goto('/?seed=3');
  const match = await startRound(page, '2');

  const squares = (await match.getAttribute('data-line'))!.split(',').map(Number);
  expect(squares).toHaveLength(5);
  // Every step of the line goes one row down (US4-1).
  expect(squares.slice(1).map((n, i) => n - squares[i]!)).toEqual([10, 10, 10, 10]);
  await expect(match).toHaveAttribute('data-line-index', '2');
  expect(await targetNumber(match)).toBe(squares[2]);

  // A wrong number is a miss, and the target stays (US4-4).
  const wrong = squares[2]! === 100 ? 99 : squares[2]! + 1;
  await typeAndShoot(page, wrong);
  await expect(page.getByTestId('message')).toHaveText(text.feedback.miss(wrong));
  await expect(match).toHaveAttribute('data-target', String(squares[2]));

  // Each correct square lights and the next one becomes the target (US4-2).
  for (const index of [2, 3]) {
    await expect(match).toHaveAttribute('data-phase', 'aiming');
    await typeAndShoot(page, squares[index]!);
    await expect(match).toHaveAttribute('data-line-index', String(index + 1));
    await expect(page.getByTestId('message')).toHaveText(text.feedback.correctSquare);
    await expect(match).toHaveAttribute('data-goals', '0');
    await expect(match).toHaveAttribute('data-target', String(squares[index + 1]));
  }

  // The last square finishes the line: one goal, then a new line (US4-3).
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await typeAndShoot(page, squares[4]!);
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(page.getByTestId('message')).toHaveText(text.feedback.goal);
  await expect(match).toHaveAttribute('data-line-index', '2');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(page.getByTestId('round-end')).toBeHidden();
});

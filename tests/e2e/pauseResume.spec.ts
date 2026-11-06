// Structure adapted from math-tank tests/e2e/pauseResume.spec.ts.
/**
 * Pause and resume (T063, FR-029, FR-033): Escape and the pause button pause the round; while paused keys type
 * nothing, the message says how to go on and the pause screen shows; Escape (or its "Weiter") resumes. The clock shows because the
 * stored settings turn it on.
 */
import { expect, seedStorage, startRound, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();

test('Escape and the pause button pause the round; Escape and the resume button go on', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), showClock: true } });
  await page.goto('/?start=play&seed=2');
  await startRound(page);
  const clock = page.getByTestId('clock');
  const message = page.getByTestId('message');
  // The clock runs: it reaches 0:01.
  await expect(clock).toHaveText('0:01');

  await page.keyboard.press('Escape');
  await expect(message).toHaveText(text.match.paused);
  // Keys type nothing while paused. That the clock stands still is checked in MatchController.test.ts (no fixed waits
  // here).
  await page.keyboard.type('5');
  await expect(page.getByTestId('entry')).toHaveText('');

  await page.keyboard.press('Escape');
  await expect(message).not.toHaveText(text.match.paused);
  await page.keyboard.type('5');
  await expect(page.getByTestId('entry')).toHaveText('5');

  await page.getByRole('button', { name: text.match.pause }).click();
  await expect(message).toHaveText(text.match.paused);
  // The pause screen lies over the match; its "Weiter" goes on (amendment 14, FR-117).
  await page.getByTestId('pause-screen').getByRole('button', { name: text.match.resume }).click();
  await expect(message).not.toHaveText(text.match.paused);
});

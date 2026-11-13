/**
 * Refactor R3 (T120): one game stays alive for the whole session, so the second round of a session starts without
 * loading the game chunk or booting a new game. The page measures the time from Enter on "Spielen" to
 * `data-phase="aiming"` with `performance.now()` for the first and the second round, the test prints both and checks
 * that the second is not slower than the first. It also prints the time until the match screen holds the game's
 * canvas, which shows what keeping the game saves. Chromium only, as every timing check here.
 */
import { expect, seedStorage, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();

declare global {
  interface Window {
    __roundStarts?: number[];
    __canvasShown?: number[];
  }
}

test('the second round of a session is ready no slower than the first (R3)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'timing is checked in Chromium only');
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 3 } });
  await page.addInitScript(() => {
    window.__roundStarts = [];
    window.__canvasShown = [];
    let pressed: number | null = null;
    let canvasFrom: number | null = null;
    // Enter on the start screen starts "Spielen"; the time runs until the match aims at its first target.
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' && document.querySelector('[data-testid="start"]')) pressed = canvasFrom = performance.now();
      },
      { capture: true },
    );
    new MutationObserver(() => {
      if (canvasFrom !== null && document.querySelector('main.match canvas')) {
        window.__canvasShown!.push(performance.now() - canvasFrom);
        canvasFrom = null;
      }
      if (pressed === null) return;
      const match = document.querySelector<HTMLElement>('[data-testid="match"]');
      if (match?.dataset.phase !== 'aiming') return;
      window.__roundStarts!.push(performance.now() - pressed);
      pressed = null;
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase'] });
  });
  await page.goto('/?start=play&seed=4');

  const match = page.getByTestId('match');
  for (let round = 1; round <= 2; round++) {
    await expect(page.getByTestId('start')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(match).toHaveAttribute('data-phase', 'aiming');
    await expect.poll(() => page.evaluate(() => [window.__roundStarts?.length, window.__canvasShown?.length])).toEqual([round, round]);
    if (round === 1) {
      // "Zum Start" from the pause screen ends the round without a round end (FR-117, FR-118).
      await page.keyboard.press('Escape');
      await page.getByTestId('pause-screen').getByRole('button', { name: text.match.home }).click();
    }
  }

  const [first, second] = await page.evaluate(() => window.__roundStarts ?? []);
  const canvas = await page.evaluate(() => window.__canvasShown ?? []);
  const line = `first round ${first!.toFixed(0)} ms, second round ${second!.toFixed(0)} ms`;
  console.log(`Enter to aiming: ${line}`);
  console.log(`Enter to canvas: first round ${canvas[0]!.toFixed(0)} ms, second round ${canvas[1]!.toFixed(0)} ms`);
  test.info().annotations.push({ type: 'round start', description: line });
  expect(second).toBeLessThanOrEqual(first!);
});

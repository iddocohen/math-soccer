/**
 * Leaving the first match before the game has run a frame (refactor R3, code review fix in createGame.ts). The game is
 * created when the match screen first shows and boots a moment later. A match left before the boot is put to sleep
 * after the game's first frame; the scene removal must not be queued then, or it removes the next match's scene when
 * the game wakes, and the next shot never lands.
 *
 * An init script leaves the match as soon as the game's canvas is in the page: it presses Escape and clicks
 * "Zum Start" in the same task, before the game's textures are ready. The test then lets the game boot, starts a new
 * round and checks that a shot flies and lands. Every wait is on data-* state, never a fixed sleep.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

declare global {
  interface Window {
    /** True once the init script left the match before the game booted. */
    __leftEarly?: boolean;
    /** The `data-phase` values of the match, in order. */
    __phases?: string[];
  }
}

test('a match left before the game ran a frame does not break the next round', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 3 } });
  await page.addInitScript(() => {
    window.__leftEarly = false;
    window.__phases = [];
    let pressed = false;
    new MutationObserver(() => {
      if (window.__leftEarly) return;
      if (!pressed && document.querySelector('main.match canvas')) {
        pressed = true;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      const home = document.querySelector<HTMLElement>('[data-testid="pause-home"]');
      if (pressed && home) {
        home.click();
        window.__leftEarly = true;
      }
    }).observe(document, { childList: true, subtree: true });
    new MutationObserver((records) => {
      for (const r of records) window.__phases!.push((r.target as Element).getAttribute('data-phase') ?? '');
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-phase'] });
  });
  await page.goto('/?seed=11');
  await expect(page.getByTestId('start')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__leftEarly === true);
  await expect(page.getByTestId('start')).toBeVisible();
  // The game boots and runs its first frame while the start screen shows; then it sleeps. Ten frames of the page give
  // it that time.
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let n = 0;
        const frame = () => (++n >= 10 ? done() : requestAnimationFrame(frame));
        requestAnimationFrame(frame);
      }),
  );

  const match = await startRound(page);
  await page.evaluate(() => window.__phases!.splice(0));
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  const phases = await page.evaluate(() => window.__phases!);
  expect(phases).toContain('ballInFlight');
  expect(phases.at(-1)).toBe('aiming');
});

// Structure adapted from math-tank tests/e2e/performance.spec.ts: the frame rate during a shot, measured from
// requestAnimationFrame timestamps, in Chromium with the graphics card, skipped without one.
/**
 * Frame rate (T066, plan "Performance Goals"): in a 1 to 200 round (20 rows) and a 0 to 1000 round (the largest chart),
 * the frame rate while the ball flies (`data-phase="ballInFlight"`) averages at least 55 frames per second, and the
 * match is ready within 3 seconds of Enter on the start screen.
 *
 * Frame rates depend on the machine being idle, so this spec runs in its own Playwright project `performance`, after
 * every other project has finished (playwright.config.ts). `pnpm exec playwright test --project=performance --no-deps`
 * runs it alone. Its tests run one after the other in one worker, so they never measure each other.
 */
import type { Page } from '@playwright/test';
import { expect, seedStorage, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import type { Settings } from '../../src/core/settings/schema';
import { SETTINGS_KEY } from '../../src/core/storage/storage';

test.describe.configure({ mode: 'default' });

declare global {
  interface Window {
    __shotFrames?: number[];
  }
}

const ROUNDS: Array<{ name: string; range: Settings['range'] }> = [
  { name: '1 to 200', range: { preset: 'custom', min: 1, max: 200 } },
  { name: '0 to 1000', range: { preset: '0-1000', min: 0, max: 1000 } },
];

/** The WebGL renderer's name, to tell a graphics card from software drawing. */
function renderer(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
}

for (const round of ROUNDS) {
  test(`a ${round.name} round is ready within 3 s of Enter, and the ball flies at 55 frames per second or more`, async ({ page }) => {
    test.setTimeout(90_000);
    await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), range: round.range, roundType: 'goalCount', goalsPerRound: 5 } });
    await page.addInitScript(() => {
      // Every animation frame while the ball flies, by its requestAnimationFrame timestamp.
      window.__shotFrames = [];
      const sample = (ts: number) => {
        const match = document.querySelector<HTMLElement>('[data-testid="match"]');
        if (match?.dataset.phase === 'ballInFlight') window.__shotFrames!.push(ts);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto('/?mode=holes&seed=8');
    await expect(page.getByTestId('start')).toBeVisible();

    const match = page.getByTestId('match');
    const pressed = Date.now();
    await page.keyboard.press('Enter');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 3_000 });
    await expect(match).toHaveAttribute('data-phase', 'aiming', { timeout: 3_000 });
    expect(Date.now() - pressed).toBeLessThan(3_000);

    // Without a graphics card, Chromium draws WebGL in software (SwiftShader); that says nothing about a child's
    // computer, so the frame rate is measured only on a real graphics card (as math-tank).
    const name = await renderer(page);
    test.skip(/SwiftShader|llvmpipe|software/i.test(name), `no graphics card in this browser (${name}); the frame rate is not measured`);

    // Two goals: the first warms up the drawing code, the second is measured.
    for (let shot = 0; shot < 2; shot++) {
      const target = await targetNumber(match);
      await page.evaluate(() => {
        window.__shotFrames = [];
      });
      await typeAndShoot(page, target);
      await expect(match).toHaveAttribute('data-goals', String(shot + 1));
    }

    const frames = await page.evaluate(() => window.__shotFrames ?? []);
    expect(frames.length).toBeGreaterThan(10);
    const fps = ((frames.length - 1) * 1000) / (frames.at(-1)! - frames[0]!);
    test.info().annotations.push({ type: 'fps', description: `${round.name}: ${fps.toFixed(1)} frames per second (${name})` });
    expect(fps).toBeGreaterThanOrEqual(55);
  });
}

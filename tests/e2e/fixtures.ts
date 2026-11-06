// Copied from math-tank tests/e2e/fixtures.ts, trimmed to what math-soccer specs use so far: silenced audio, stored
// data before load, and starting a round with a key.
/**
 * Shared Playwright fixture: every page is silent, in every browser including WebKit.
 * - speechSynthesis.speak does nothing (getVoices still works).
 * - Every AudioContext is suspended at once, and resume() resolves without resuming it.
 * All e2e specs import `test` and `expect` from here instead of @playwright/test.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { GAME_WAIT } from './gameWait';

export function silenceAudio(): void {
  const w = window as unknown as Record<string, unknown>;
  // WebKit ignores a plain assignment on the instance, so the prototype is patched as well.
  const noSpeak = { value: () => {}, configurable: true, writable: true };
  if (typeof SpeechSynthesis !== 'undefined') Object.defineProperty(SpeechSynthesis.prototype, 'speak', noSpeak);
  if (window.speechSynthesis) Object.defineProperty(window.speechSynthesis, 'speak', noSpeak);
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Original = w[name] as (new (...args: unknown[]) => AudioContext) | undefined;
    if (typeof Original !== 'function') continue;
    class SilentAudioContext extends Original {
      constructor(...args: unknown[]) {
        super(...args);
        void AudioContext.prototype.suspend.call(this).catch(() => {});
      }
      override resume(): Promise<void> {
        return Promise.resolve();
      }
    }
    w[name] = SilentAudioContext;
  }
}

export { GAME_WAIT };

function toPairs(entries: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(entries).map(([k, v]): [string, string] => [k, JSON.stringify(v)]);
}

/**
 * Stores each entry as JSON in localStorage before the page's scripts run. By default this happens on every load.
 * With `once`, it happens only on the first load in the tab, so a reload keeps what the game stored.
 */
export async function seedStorage(page: Page, entries: Record<string, unknown>, { once = false }: { once?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    ([pairs, onlyOnce]) => {
      if (onlyOnce) {
        if (window.sessionStorage.getItem('e2e-seeded')) return;
        window.sessionStorage.setItem('e2e-seeded', '1');
      }
      for (const [k, v] of pairs) window.localStorage.setItem(k, v);
    },
    [toPairs(entries), once] as const,
  );
}

/**
 * Starts a round from the start screen with a key (Enter, or 1, 2 and 3 for a mode) and waits on game state until the
 * match aims at a target, which it returns. The app attaches its key listener before the start screen is painted, so
 * the key is pressed once, as soon as the start screen is visible.
 */
export async function startRound(page: Page, key = 'Enter'): Promise<Locator> {
  await expect(page.getByTestId('start')).toBeVisible();
  await page.keyboard.press(key);
  const match = page.getByTestId('match');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(match).toHaveAttribute('data-target', /^\d+$/);
  return match;
}

/** The target number from the match overlay (`data-target`), once the match aims at one. */
export async function targetNumber(match: Locator): Promise<number> {
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(match).toHaveAttribute('data-target', /^\d+$/);
  return Number(await match.getAttribute('data-target'));
}

/** Types n, checks the typed number shows, and shoots with Enter. */
export async function typeAndShoot(page: Page, n: number): Promise<void> {
  await page.keyboard.type(String(n));
  await expect(page.getByTestId('entry')).toHaveText(String(n));
  await page.keyboard.press('Enter');
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(silenceAudio);
    await use(page);
  },
});

export { expect };

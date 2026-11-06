// Copied from math-tank tests/e2e/speech.spec.ts; the soccer task replaces the tank challenge.
/**
 * Spoken tasks (T062, FR-032). The test browser gets a German voice and a speak() that only records the text, so
 * nothing is heard. "Vorlesen" is off by default. With it on, the start (here Enter) speaks a short greeting and then
 * the task, which never says the target number; the speaker icon repeats it. With it off nothing is spoken and the
 * icon is hidden.
 */
import type { Page } from '@playwright/test';
import { expect, seedStorage, startRound, targetNumber, test } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { t } from '../../src/i18n';

const text = t();

/** `speech` null stores no settings, so the defaults apply. */
async function prepare(page: Page, speech: boolean | null): Promise<void> {
  if (speech !== null) await seedStorage(page, { [SETTINGS_KEY]: { ...defaultSettings(), sound: { ...defaultSettings().sound, speech } } });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __spoken: string[] };
    w.__spoken = [];
    const voice = { lang: 'de-DE', name: 'Test-Stimme', default: true, localService: true, voiceURI: 'test' };
    const synth = {
      getVoices: () => [voice],
      speak: (u: { text: string }) => w.__spoken.push(u.text),
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    class Utterance {
      text: string;
      lang = '';
      voice: unknown = null;
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true });
  });
}

function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
}

test('with "Vorlesen" on, starting speaks a greeting and the task, and the speaker icon repeats it', async ({ page }) => {
  await prepare(page, true);
  await page.goto('/?mode=holes&seed=4');
  const match = await startRound(page);
  const target = await targetNumber(match);
  await expect.poll(() => spoken(page)).toEqual([text.start.greeting, text.match.task.holes]);
  expect((await spoken(page)).join(' ')).not.toContain(String(target));

  await page.getByTestId('speaker-button').click();
  await expect.poll(() => spoken(page)).toEqual([text.start.greeting, text.match.task.holes, text.match.task.holes]);
});

test('"Vorlesen" is off by default: nothing is spoken and there is no speaker icon', async ({ page }) => {
  await prepare(page, null);
  await page.goto('/?mode=holes&seed=4');
  await startRound(page);
  await expect(page.getByTestId('speaker-button')).toHaveCount(0);
  expect(await spoken(page)).toEqual([]);
});

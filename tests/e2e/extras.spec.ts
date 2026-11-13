/**
 * Ball trails, goal effects and mascots end to end (amendment 20 part 1, T111, FR-134, FR-136, FR-137, FR-139). The
 * child buys and chooses a fire trail, fireworks and the lion in the locker room; each tap plays it on the preview. In
 * the match `data-trail`, `data-goal-effect` and `data-mascot` name them. A goal shows the trail in flight, gone within
 * about 0.4 s after the landing, runs the fireworks and makes the lion cheer; a miss makes it cover its eyes.
 *
 * The short states (the trail, the effect, the mascot's mood) are recorded by a MutationObserver with the scene's game
 * time (`data-extras-at`), so no wait can miss them and slow frames do not stretch the measured times; every other wait
 * is on data-* state, never fixed sleeps.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import { defaultSettings } from '../../src/core/settings/defaults';
import { emptyLockerRoom } from '../../src/core/storage/schemas';
import { LOCKER_ROOM_KEY, SETTINGS_KEY } from '../../src/core/storage/storage';

/** One recorded change: `at` is the scene's game time in ms (`data-extras-at` on the match) when it was seen. */
type Seen = { name: string; value: string; at: number };

declare global {
  interface Window {
    __seen?: Seen[];
  }
}

const settings = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 5 };
const WATCHED = ['data-phase', 'data-trail-showing', 'data-goal-effect-playing', 'data-mascot-mood'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((names) => {
    window.__seen = [];
    new MutationObserver((records) => {
      const at = Number(document.querySelector('main.match')?.getAttribute('data-extras-at') ?? 0);
      for (const r of records) {
        const value = (r.target as Element).getAttribute(r.attributeName!) ?? '';
        window.__seen!.push({ name: r.attributeName!, value, at });
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: names });
  }, WATCHED);
});

/** The recorded changes of the watched attributes since the last call. */
async function seen(page: import('@playwright/test').Page): Promise<Seen[]> {
  return page.evaluate(() => window.__seen!.splice(0));
}

test('buy a fire trail, fireworks and the lion; they show in the match, on a goal and on a miss', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: { ...emptyLockerRoom(), stars: 400, totalEarned: 400 } });
  await page.goto('/?seed=11');
  await page.keyboard.press('k');
  const preview = page.getByTestId('extras-preview');
  for (const heading of ['Ballspur', 'Tor-Effekt', 'Maskottchen']) {
    await expect(page.getByRole('region', { name: heading }).getByRole('heading', { name: heading })).toBeVisible();
  }
  for (const id of ['trail.none', 'goalEffect.none', 'mascot.none']) await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-chosen', 'true');
  await expect(preview).toHaveAttribute('data-mascot', 'none');

  // Each tap plays the item on the preview, also before it is bought, and asks to buy it.
  for (const id of ['trail.fire', 'goalEffect.fireworks', 'mascot.lion']) {
    await page.getByTestId(`item-${id}`).click();
    await expect(preview).toHaveAttribute('data-playing', id);
    // The fire trail and the fireworks draw the particle images, tinted (amendment 22, FR-149).
    if (id !== 'mascot.lion') await expect(preview.locator('[data-image]').first()).toBeAttached();
    await page.getByTestId('buy-question').getByRole('button', { name: 'Ja' }).click();
    await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-chosen', 'true');
  }
  await expect(page.getByTestId('locker-room')).toHaveAttribute('data-stars', String(400 - 95 - 90 - 150));
  // The preview ends by itself and keeps the chosen lion beside the goal.
  await expect(preview).toHaveAttribute('data-playing', '');
  await expect(preview).toHaveAttribute('data-mascot', 'lion');

  await page.keyboard.press('Escape');
  const match = await startRound(page);
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-trail', 'fire');
  await expect(scene).toHaveAttribute('data-goal-effect', 'fireworks');
  await expect(scene).toHaveAttribute('data-mascot', 'lion');
  await expect(scene).toHaveAttribute('data-mascot-mood', 'idle');
  await seen(page);

  // A goal: the trail follows the ball, the fireworks run, the lion cheers; then all goes quiet again.
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(scene).toHaveAttribute('data-goal-effect-playing', 'false');
  await expect(scene).toHaveAttribute('data-trail-showing', 'false');
  await expect(scene).toHaveAttribute('data-mascot-mood', 'idle');
  const goal = await seen(page);
  const first = (name: string, value: string) => goal.find((c) => c.name === name && c.value === value);
  const flying = first('data-phase', 'ballInFlight');
  const trailOn = first('data-trail-showing', 'true');
  expect(flying, 'the ball flew').toBeDefined();
  expect(trailOn, 'the trail showed').toBeDefined();
  expect(first('data-goal-effect-playing', 'true'), 'the fireworks ran').toBeDefined();
  expect(first('data-mascot-mood', 'cheer'), 'the lion cheered').toBeDefined();
  // The trail starts during the flight and is gone within about 0.4 s of the landing (TRAIL_FADE_MS). Times are the
  // scene's game time, which slow frames do not stretch. The lion's cheer starts at the landing and lasts 1 s
  // (MASCOT_CHEER_MS), and the effect runs about 1 s (GOAL_EFFECT_MS).
  const after = (from: Seen, name: string, value: string) => goal.slice(goal.indexOf(from) + 1).find((c) => c.name === name && c.value === value)!;
  const landed = first('data-mascot-mood', 'cheer')!;
  const trailOff = after(trailOn!, 'data-trail-showing', 'false');
  const cheerOff = after(landed, 'data-mascot-mood', 'idle');
  expect(trailOn!.at).toBeLessThan(landed.at);
  expect(trailOff.at - landed.at).toBeLessThan(400 + 100);
  expect(cheerOff.at - landed.at).toBeGreaterThan(900);
  expect(cheerOff.at - landed.at).toBeLessThan(1200);
  const effectOn = first('data-goal-effect-playing', 'true')!;
  const effectOff = after(effectOn, 'data-goal-effect-playing', 'false');
  expect(effectOff.at - effectOn.at).toBeGreaterThan(900);
  expect(effectOff.at - effectOn.at).toBeLessThan(1400);

  // A miss: the lion covers its eyes, and no goal effect plays.
  const target = await targetNumber(match);
  await typeAndShoot(page, target === 1 ? 2 : target - 1);
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  await expect(scene).toHaveAttribute('data-mascot-mood', 'idle');
  const miss = await seen(page);
  expect(miss.some((c) => c.name === 'data-mascot-mood' && c.value === 'eyes'), 'the lion covered its eyes').toBe(true);
  expect(miss.some((c) => c.name === 'data-goal-effect-playing' && c.value === 'true'), 'no effect on a miss').toBe(false);
  expect(miss.some((c) => c.name === 'data-trail-showing' && c.value === 'true'), 'the trail follows every shot').toBe(true);
});

test('without a trail, effect or mascot nothing extra shows on a goal', async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings, [LOCKER_ROOM_KEY]: emptyLockerRoom() });
  await page.goto('/?seed=11');
  const match = await startRound(page);
  const scene = page.locator('main.match');
  await expect(scene).toHaveAttribute('data-trail', 'none');
  await expect(scene).toHaveAttribute('data-goal-effect', 'none');
  await expect(scene).toHaveAttribute('data-mascot', 'none');
  await seen(page);
  await typeAndShoot(page, await targetNumber(match));
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-phase', 'aiming');
  const changes = await seen(page);
  expect(changes.some((c) => c.name !== 'data-phase' && c.value === 'true')).toBe(false);
});

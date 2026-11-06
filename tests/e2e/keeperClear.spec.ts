/**
 * The keeper never hides numbers (amendment 15, FR-120, FR-121; keeper-blocks-bug.png). With `?seed=49` the first
 * target (31) leaves the keeper on his spot in the middle; after the goal the next target is 75 with the small plus
 * 74, 76, 65 and 85, all on that middle spot. Before the fix he walked back to the middle while the new target came and
 * covered these hints, fully drawn. The check reads the screen's pixel colours inside each hint square where the
 * waiting keeper would stand in the middle, and expects the hint colour, never the keeper's shirt.
 */
import { expect, seedStorage, startRound, targetNumber, test, typeAndShoot } from './fixtures';
import type { Page } from '@playwright/test';
import { cellRect, layoutChart } from '../../src/core/chart/layout';
import { CHART_RECT, WORLD_WIDTH } from '../../src/core/match/world';
import { defaultSettings } from '../../src/core/settings/defaults';
import { SETTINGS_KEY } from '../../src/core/storage/storage';
import { HOME_POSE, idleBounds } from '../../src/game/keeperDive';
import { COLOR } from '../../src/game/palette';
import type { Rect } from '../../src/core/types';

test.use({ viewport: { width: 1280, height: 800 } });

const settings = { ...defaultSettings(), roundType: 'goalCount' as const, goalsPerRound: 5 };
const chart = layoutChart(1, 100);
/** The keeper's shirt (KeeperView's JERSEY). */
const JERSEY = [0x3e, 0x6f, 0xb0] as const;
const KIT = [(COLOR.kit >> 16) & 255, (COLOR.kit >> 8) & 255, COLOR.kit & 255] as const;

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x;
  const h = Math.min(a.y + a.height, b.y + b.height) - y;
  return w > 0 && h > 0 ? { x, y, width: w, height: h } : null;
}

/** World points inside hint `n`'s square where the waiting keeper in the middle of the goal would stand. */
function pointsUnderKeeper(n: number): Array<{ x: number; y: number }> {
  const square = cellRect(chart, CHART_RECT, n);
  const inner = { x: square.x + 4, y: square.y + 4, width: square.width - 8, height: square.height - 8 };
  const points: Array<{ x: number; y: number }> = [];
  for (const part of idleBounds(HOME_POSE.x)) {
    const r = intersect(inner, part);
    if (!r) continue;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) points.push({ x: r.x + (r.width * (i + 0.5)) / 5, y: r.y + (r.height * (j + 0.5)) / 5 });
  }
  return points;
}

/** The screen colours at the world points, read from a screenshot. */
async function coloursAt(page: Page, points: Array<{ x: number; y: number }>): Promise<Array<[number, number, number]>> {
  const box = (await page.locator('canvas').boundingBox())!;
  const scale = box.width / WORLD_WIDTH;
  const screen = points.map((p) => ({ x: Math.round(box.x + p.x * scale), y: Math.round(box.y + p.y * scale) }));
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ png, screen }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      return screen.map(({ x, y }) => {
        const d = g.getImageData(x, y, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!] as [number, number, number];
      });
    },
    { png, screen },
  );
}

const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

test.beforeEach(async ({ page }) => {
  await seedStorage(page, { [SETTINGS_KEY]: settings });
  await page.goto('/?start=play&seed=49');
});

test('after a goal the waiting keeper leaves the new hints readable, even where he stood in the middle', async ({ page }) => {
  const match = await startRound(page);
  expect(await targetNumber(match)).toBe(31);
  await typeAndShoot(page, 31);
  await expect(match).toHaveAttribute('data-goals', '1');
  await expect(match).toHaveAttribute('data-target', '75');
  await expect(match).toHaveAttribute('data-keeper', 'idle');
  await expect(match).toHaveAttribute('data-phase', 'aiming');

  const hints = [74, 76, 65, 85];
  for (const n of hints) {
    const points = pointsUnderKeeper(n);
    expect(points.length, `hint ${n} lies on the keeper's middle spot`).toBeGreaterThan(0);
    const colours = await coloursAt(page, points);
    for (const c of colours) expect(distance(c, JERSEY), `hint ${n} at ${c.join(',')} is not the keeper's shirt`).toBeGreaterThan(60);
    // Most of the sampled points show the hint square's team colour; the others are its dark number.
    const kit = colours.filter((c) => distance(c, KIT) < 90).length;
    expect(kit, `hint ${n}: team colour in ${kit} of ${colours.length} points`).toBeGreaterThan(colours.length / 2);
  }
});

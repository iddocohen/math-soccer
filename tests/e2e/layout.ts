// Copied from math-tank tests/e2e/layout.ts, trimmed to the checks math-soccer's device spec uses.
/**
 * Checks that the match screen fits the viewport: nothing is cut off and no two controls overlap (FR-031). Used by
 * tests/e2e/devices.spec.ts (iPad held sideways and upright, WebKit with touch).
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  return box!;
}

export function inside(box: Box, width: number, height: number): boolean {
  const e = 0.5;
  return box.x >= -e && box.y >= -e && box.x + box.width <= width + e && box.y + box.height <= height + e;
}

export function overlap(a: Box, b: Box): boolean {
  const e = 0.5;
  return a.x + e < b.x + b.width && b.x + e < a.x + a.width && a.y + e < b.y + b.height && b.y + e < a.y + a.height;
}

export async function expectNoScroll(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  expect(size.sw).toBeLessThanOrEqual(size.w);
  expect(size.sh).toBeLessThanOrEqual(size.h);
}

/** Every number-pad key is at least 48 by 48 CSS pixels (FR-031). Returns the keys. */
export async function expectPadKeys(page: Page): Promise<Locator[]> {
  const keys = await page.getByTestId('pad-key').all();
  expect(keys.length).toBe(12);
  for (const key of keys) {
    const b = await boxOf(key);
    expect(b.width, `pad key ${await key.getAttribute('data-key')}`).toBeGreaterThanOrEqual(48);
    expect(b.height, `pad key ${await key.getAttribute('data-key')}`).toBeGreaterThanOrEqual(48);
  }
  return keys;
}

/**
 * The match fits: the canvas, the pad, the typed number, the message line and every top button lie inside the
 * viewport, and the pad overlaps none of the others.
 */
export async function expectMatchFits(page: Page): Promise<void> {
  const { width, height } = page.viewportSize()!;
  const canvas = await boxOf(page.locator('canvas'));
  expect(inside(canvas, width, height), 'canvas inside the screen').toBe(true);
  const pad = await boxOf(page.getByTestId('number-pad'));
  expect(inside(pad, width, height), 'number pad inside the screen').toBe(true);
  const others: Array<[string, Locator]> = [
    ['entry', page.getByTestId('entry')],
    ['goal counter', page.getByTestId('goal-count')],
    ['help button', page.getByTestId('help-button')],
    ['gear', page.getByTestId('parent-gate')],
  ];
  for (const [name, locator] of others) {
    const box = await boxOf(locator);
    expect(inside(box, width, height), `${name} inside the screen`).toBe(true);
    expect(overlap(box, pad), `${name} clear of the number pad`).toBe(false);
  }
}

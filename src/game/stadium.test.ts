import { describe, expect, it, vi } from 'vitest';
import { WEATHERS } from '../core/rewards/items';
import { GOAL_FRAME, STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import { createRng } from '../core/rng';
import { BOARD_DEPTH, NET_DEPTH, POSTS_DEPTH } from './GoalView';
import { HELPER_DEPTH } from './HelperView';
import { MASCOT_DEPTH } from './mascot';
import { COLUMN_STRIP } from './scales';
vi.mock('phaser', () => ({ default: {} }));

import { backdropKey, coneLight, DROP_COUNT, dropAt, makeDrops, standRows, STANDS_EDGE, WEATHER_DEPTH, WEATHER_STYLE } from './stadium';

describe('stands (amendment 20, FR-135)', () => {
  it('has four rows, or six with the bigger stands', () => {
    expect(standRows('normal')).toHaveLength(4);
    expect(standRows('big')).toHaveLength(6);
  });

  it('keeps the usual rows where they always were', () => {
    expect(standRows('normal').map((r) => r.fanBottom)).toEqual([96, 144, 192, 240]);
    expect(standRows('normal').map((r) => r.bandTop)).toEqual([74, 122, 170, 218]);
  });

  it('grows the bigger stands upward: the front row stays, so they reach neither the goal nor the column scale further', () => {
    const normal = standRows('normal');
    const big = standRows('big');
    const bottom = (rows: typeof big) => Math.max(...rows.map((r) => r.bandTop + r.bandHeight));
    expect(big.at(-1)!.fanBottom).toBe(normal.at(-1)!.fanBottom);
    expect(bottom(big)).toBe(bottom(normal));
    expect(bottom(big)).toBeLessThanOrEqual(STANDS_EDGE);
    expect(STANDS_EDGE).toBeLessThanOrEqual(STANDS_BOTTOM + 6);
    // Every row of fans stands at or above the front row, which already stood behind the crossbar and the column scale.
    for (const row of big) {
      expect(row.fanBottom).toBeLessThanOrEqual(normal.at(-1)!.fanBottom);
      expect(row.bandTop).toBeGreaterThanOrEqual(0);
    }
    expect(normal.at(-1)!.fanBottom).toBeGreaterThan(GOAL_FRAME.y);
    expect(COLUMN_STRIP.y).toBeLessThan(normal.at(-1)!.fanBottom);
  });
});

describe('floodlights (FR-135)', () => {
  it('tints the cones in the floodlight color, a little stronger than white', () => {
    expect(coneLight('white', 'evening')).toEqual({ color: 0xfff8d6, alpha: 0.06 });
    const blue = coneLight('blue', 'evening')!;
    expect(blue.color).toBe(0x6fb4ff);
    expect(blue.alpha).toBeGreaterThan(0.06);
  });

  it('has no cones on a day match', () => {
    expect(coneLight('gold', 'day')).toBeNull();
    for (const weather of WEATHERS.filter((w) => w !== 'day')) expect(coneLight('gold', weather)).not.toBeNull();
  });

  it('paints one backdrop per stands, floodlight and weather', () => {
    expect(backdropKey({ stands: 'big', floodlight: 'purple', weather: 'snow' })).toBe('stadium-snow-purple-big');
    expect(backdropKey({ stands: 'normal', floodlight: 'white', weather: 'evening' })).not.toBe(backdropKey({ stands: 'normal', floodlight: 'white', weather: 'day' }));
  });
});

describe('weather (FR-138)', () => {
  it('gives the evening the look of the stadium before amendment 20', () => {
    expect(WEATHER_STYLE.evening).toMatchObject({ sky: ['#0b1622', '#1b3247'], cones: true, overlay: 'none' });
  });

  it('has a blue sky with lighter grass by day, an orange sky at sunset, snow with a white cover, and wet rain', () => {
    const blue = (hex: string) => Number.parseInt(hex.slice(5, 7), 16) > Number.parseInt(hex.slice(1, 3), 16);
    expect(WEATHER_STYLE.day.sky.every(blue)).toBe(true);
    const shadeAlpha = (rgb: string) => Number(/\/ (\d+)%/.exec(rgb)![1]);
    expect(shadeAlpha(WEATHER_STYLE.day.grassShade[0])).toBeLessThan(shadeAlpha(WEATHER_STYLE.evening.grassShade[0]));
    const red = Number.parseInt(WEATHER_STYLE.sunset.sky[1].slice(1, 3), 16);
    expect(red).toBeGreaterThan(0xc0);
    expect(WEATHER_STYLE.snow).toMatchObject({ overlay: 'snow', snowCover: true });
    expect(WEATHER_STYLE.rain).toMatchObject({ overlay: 'rain', wet: true });
    expect(shadeAlpha(WEATHER_STYLE.rain.grassShade[0])).toBeGreaterThan(shadeAlpha(WEATHER_STYLE.evening.grassShade[0]));
    for (const weather of ['evening', 'day', 'sunset'] as const) expect(WEATHER_STYLE[weather].overlay).toBe('none');
  });

  it('draws the snow and the rain behind the net, the chart, the posts and the helper, and over the stands and the mascot', () => {
    expect(WEATHER_DEPTH).toBeLessThan(NET_DEPTH);
    expect(WEATHER_DEPTH).toBeLessThan(BOARD_DEPTH);
    expect(WEATHER_DEPTH).toBeLessThan(POSTS_DEPTH);
    expect(WEATHER_DEPTH).toBeLessThan(HELPER_DEPTH);
    expect(WEATHER_DEPTH).toBeGreaterThan(MASCOT_DEPTH);
    expect(WEATHER_DEPTH).toBeGreaterThan(1);
  });

  it('makes no drops without snow or rain, and a fixed number with them', () => {
    const rng = createRng(1);
    const rand = () => rng.next();
    expect(makeDrops('none', rand)).toEqual([]);
    expect(makeDrops('snow', rand)).toHaveLength(DROP_COUNT.snow);
    expect(makeDrops('rain', rand)).toHaveLength(DROP_COUNT.rain);
  });

  it('lets snow fall slowly and rain fast, and keeps every drop in or just around the world forever', () => {
    const rng = createRng(2);
    const rand = () => rng.next();
    const snow = makeDrops('snow', rand);
    const rain = makeDrops('rain', rand);
    expect(Math.max(...snow.map((d) => d.speed))).toBeLessThan(Math.min(...rain.map((d) => d.speed)));
    for (const [overlay, drops] of [
      ['snow', snow],
      ['rain', rain],
    ] as const) {
      for (const ms of [0, 16, 1000, 60_000, 3_600_000]) {
        for (const d of drops) {
          const p = dropAt(overlay, d, ms);
          expect(p.y).toBeGreaterThanOrEqual(-40);
          expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT + 40);
          expect(p.x).toBeGreaterThanOrEqual(-40);
          expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH + 40);
        }
      }
    }
    // A raindrop falls down within a short frame, unless it just wrapped to the top.
    const d = rain[0]!;
    const a = dropAt('rain', d, 100);
    const b = dropAt('rain', d, 116);
    if (b.y > a.y) expect(b.y - a.y).toBeCloseTo((d.speed * 16) / 1000, 5);
  });
});

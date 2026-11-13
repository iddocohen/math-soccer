/**
 * The stadium and the weather of the match as plain data (amendment 20 part 2, FR-135, FR-138). No Phaser here, so
 * the rules have unit tests; MatchScene paints the backdrop from it and WeatherView moves the snow or the rain.
 *
 * - Stands: the usual four rows of fans, or six rows for the bigger stands. The front row stays where it is, so the
 *   bigger stands grow upward and never reach the goal or the column scale; the rows stand a little closer instead.
 * - Floodlights: they stand above the top edge, out of view (FR-099); only their light cones fall in, tinted in the
 *   floodlight color. White is the warm white of the evening stadium.
 * - Weather: the sky and the light of each weather. The day has a blue sky, lighter grass and no light cones; the
 *   sunset an orange sky; rain a gray sky and darker, wet grass with falling streaks; snow falling flakes and a light
 *   white cover on the grass edges.
 * - The snow and the rain fall at WEATHER_DEPTH: over the stands and the grass, but behind the net, the chart, the hints
 *   and the scales, so they never cover a number.
 */
import { FLOODLIGHT_COLORS, type Floodlight, type Stands, type Weather } from '../core/rewards/items';
import { STANDS_BOTTOM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';

/** The depth of the falling snow and rain: above the stands (1), the fireworks (1.5) and the mascot (1.8), below the net (2). */
export const WEATHER_DEPTH = 1.9;

/** The bottom edge of the stand rows' bands; the grass starts here. */
export const STANDS_EDGE = STANDS_BOTTOM + 6;

export interface StandRow {
  /** The top of the row's band in the backdrop. */
  bandTop: number;
  bandHeight: number;
  /** Where the fans' shirts end in this row. */
  fanBottom: number;
}

/** The rows of the stands, back row first: four rows 48 apart, or six rows 36 apart for the bigger stands. */
export function standRows(stands: Stands): StandRow[] {
  const count = stands === 'big' ? 6 : 4;
  const gap = stands === 'big' ? 36 : 48;
  const top = STANDS_EDGE - count * gap;
  return Array.from({ length: count }, (_, row) => {
    const bandTop = top + row * gap;
    return { bandTop, bandHeight: gap - 4, fanBottom: bandTop + gap - 26 };
  });
}

export type WeatherOverlay = 'none' | 'snow' | 'rain';

export interface WeatherStyle {
  /** The sky from the top edge down to the stands. */
  sky: readonly [string, string];
  /** The shade over the grass, far (at the stands) and near (at the player). */
  grassShade: readonly [string, string];
  /** A light wash over the grass in daylight; null otherwise. */
  grassWash: string | null;
  /** False on a day match: no light cones. */
  cones: boolean;
  overlay: WeatherOverlay;
  /** Wet grass: soft light streaks on the pitch. */
  wet: boolean;
  /** A light white cover on the grass edges. */
  snowCover: boolean;
}

export const WEATHER_STYLE: Record<Weather, WeatherStyle> = {
  evening: { sky: ['#0b1622', '#1b3247'], grassShade: ['rgb(6 20 14 / 62%)', 'rgb(6 20 14 / 38%)'], grassWash: null, cones: true, overlay: 'none', wet: false, snowCover: false },
  day: { sky: ['#4f9de0', '#a9d6f5'], grassShade: ['rgb(6 20 14 / 18%)', 'rgb(6 20 14 / 0%)'], grassWash: 'rgb(200 240 160 / 14%)', cones: false, overlay: 'none', wet: false, snowCover: false },
  sunset: { sky: ['#8a3f5c', '#f39a45'], grassShade: ['rgb(30 16 10 / 50%)', 'rgb(30 16 10 / 28%)'], grassWash: 'rgb(255 150 70 / 6%)', cones: true, overlay: 'none', wet: false, snowCover: false },
  rain: { sky: ['#1a2128', '#3a454f'], grassShade: ['rgb(4 14 12 / 72%)', 'rgb(4 14 12 / 52%)'], grassWash: null, cones: true, overlay: 'rain', wet: true, snowCover: false },
  snow: { sky: ['#202a38', '#56657a'], grassShade: ['rgb(10 22 20 / 48%)', 'rgb(10 22 20 / 26%)'], grassWash: null, cones: true, overlay: 'snow', wet: false, snowCover: true },
};

/** The floodlights' cones stand at these x, out of view above the top edge. */
export const FLOODLIGHT_X = [130, WORLD_WIDTH - 130] as const;

/** The light cones' color as 0xRRGGBB and their opacity; null when the weather has no cones (the day). */
export function coneLight(floodlight: Floodlight, weather: Weather): { color: number; alpha: number } | null {
  if (!WEATHER_STYLE[weather].cones) return null;
  // A colored light shows a little stronger than the white one, so its color reads over the dark sky.
  return { color: FLOODLIGHT_COLORS[floodlight], alpha: floodlight === 'white' ? 0.06 : 0.11 };
}

/** What the backdrop shows; one painted texture per combination. */
export interface StadiumLook {
  stands: Stands;
  floodlight: Floodlight;
  weather: Weather;
}

export function backdropKey(look: StadiumLook): string {
  return `stadium-${look.weather}-${look.floodlight}-${look.stands}`;
}

/** One snowflake or raindrop. It falls forever: below the bottom edge it starts again above the top edge. */
export interface WeatherDrop {
  x: number;
  /** The height at time 0. */
  y: number;
  /** Pixels per second downward. */
  speed: number;
  /** Pixels per second sideways. */
  drift: number;
  /** Image scale. */
  scale: number;
  alpha: number;
  /** The sway's own offset, so the flakes do not move in step. */
  phase: number;
}

/** How many flakes or streaks fall at once. */
export const DROP_COUNT: Record<Exclude<WeatherOverlay, 'none'>, number> = { snow: 80, rain: 90 };

/** The rain streaks lean this far from upright, in radians, and fall along it. */
export const RAIN_ANGLE = 0.22;

/** The drops of an overlay, spread over the whole world; none without an overlay. */
export function makeDrops(overlay: WeatherOverlay, rand: () => number): WeatherDrop[] {
  if (overlay === 'none') return [];
  return Array.from({ length: DROP_COUNT[overlay] }, () => {
    const near = rand();
    if (overlay === 'snow') {
      return { x: rand() * WORLD_WIDTH, y: rand() * WORLD_HEIGHT, speed: 50 + near * 70, drift: -10 + rand() * 20, scale: 0.35 + near * 0.45, alpha: 0.65 + near * 0.3, phase: rand() * Math.PI * 2 };
    }
    const speed = 950 + near * 450;
    return { x: rand() * WORLD_WIDTH, y: rand() * WORLD_HEIGHT, speed, drift: -Math.tan(RAIN_ANGLE) * speed, scale: 0.7 + near * 0.5, alpha: 0.35 + near * 0.3, phase: 0 };
  });
}

/** How far above the top and below the bottom a drop may be while it wraps around. */
const WRAP_MARGIN = 40;

const wrap = (v: number, min: number, size: number) => min + ((((v - min) % size) + size) % size);

/**
 * Where a drop is `ms` after time 0; it wraps around the world, so it is always somewhere inside or just outside it.
 * With `out` the place is written into it and `out` is returned, so a frame makes no new objects.
 */
export function dropAt(
  overlay: Exclude<WeatherOverlay, 'none'>,
  d: WeatherDrop,
  ms: number,
  out: { x: number; y: number; rotation: number } = { x: 0, y: 0, rotation: 0 },
): { x: number; y: number; rotation: number } {
  const s = ms / 1000;
  const sway = overlay === 'snow' ? Math.sin(s * 1.3 + d.phase) * 14 : 0;
  out.y = wrap(d.y + d.speed * s, -WRAP_MARGIN, WORLD_HEIGHT + 2 * WRAP_MARGIN);
  out.x = wrap(d.x + d.drift * s + sway, -WRAP_MARGIN, WORLD_WIDTH + 2 * WRAP_MARGIN);
  out.rotation = overlay === 'rain' ? RAIN_ANGLE : 0;
  return out;
}

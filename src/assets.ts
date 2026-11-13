/**
 * The bundled asset files in public/assets (amendment 03, FR-057 to FR-060). Their URLs follow the Vite base path, so
 * the build for GitHub Pages under /math-soccer/ finds them too. Every file ships with the build: no request leaves the
 * site. Authors and licenses are listed in the README section "Assets and licenses".
 */
import type { ClipName } from './audio/sfx';
import type { ParticleImage } from './game/particles';

/** The URL of a file in public/assets under the base path of the build. */
export function assetUrl(name: string): string {
  return `${import.meta.env.BASE_URL}assets/${name}`;
}

export const ASSET = {
  grass: 'grass004_512.jpg',
  ballSprite: 'ball_rolling_grid.png',
} as const;

/** The recorded sound clips (FR-059), by the sound they play. */
export const CLIP_FILES: Record<ClipName, string> = {
  kick: 'kick.mp3',
  cheer: 'cheer.mp3',
  clap: 'clap.mp3',
  ohh: 'ohh.mp3',
  // Amendment 22 (FR-150 to FR-153).
  whistle: 'whistle.mp3',
  catch: 'catch.mp3',
  wall: 'wall.mp3',
  firework: 'firework.mp3',
  pop: 'pop.mp3',
  coin: 'coin.mp3',
  fanfare: 'fanfare.mp3',
  rain: 'rain.mp3',
  murmur: 'murmur.mp3',
};

/** The Kenney particle images (amendment 22, FR-149), white on transparent and 64 px wide, tinted in code. */
export const PARTICLE_FILES: Record<ParticleImage, string> = {
  twinkle: 'star_04.png',
  star: 'star_07.png',
  sparkle: 'star_06.png',
  fire: 'fire_01.png',
  flare: 'flare_01.png',
  light: 'light_01.png',
};

/** Fredoka with the system fonts as fallback (FR-060); the same list as `font-family` in src/app/styles.css. */
export const GAME_FONT = "Fredoka, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
/** Fredoka's heaviest weight; the variable font goes from 300 to 700. */
export const GAME_FONT_WEIGHT = 700;

/**
 * Resolves when Fredoka is loaded, or after `timeoutMs` (or at once without the Font Loading API), so a canvas drawn
 * after it uses the font when it is there and the system font when it is not.
 */
export function fontReady(timeoutMs = 1500): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts) return Promise.resolve();
  const loaded = fonts.load(`${GAME_FONT_WEIGHT} 32px Fredoka`).then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([loaded, timeout]);
}

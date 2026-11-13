/**
 * The falling snow or rain of the weather (amendment 20 part 2, FR-138). stadium.ts holds the drops and their motion;
 * this view draws them with Phaser images on generated textures (no image files).
 *
 * - The images are made the first time a weather needs them and reused for every later weather, so a change of weather
 *   makes no new objects once enough exist. Images that are not needed are hidden.
 * - They lie at WEATHER_DEPTH, behind the net, the chart, the hints and the scales, so numbers stay readable.
 * - The scene moves them in its update() with the frame time, and not while the round is paused.
 */
import Phaser from 'phaser';
import { createRng } from '../core/rng';
import type { Weather } from '../core/rewards/items';
import { dropAt, makeDrops, WEATHER_DEPTH, WEATHER_STYLE, type WeatherDrop, type WeatherOverlay } from './stadium';

const FLAKE = 'weather-flake';
const STREAK = 'weather-streak';
const FLAKE_SIZE = 24;
const STREAK_SIZE = { width: 4, height: 46 } as const;

function ensureWeatherTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FLAKE)) {
    const t = scene.textures.createCanvas(FLAKE, FLAKE_SIZE, FLAKE_SIZE);
    if (t) {
      const g = t.getContext();
      const r = FLAKE_SIZE / 2;
      const glow = g.createRadialGradient(r, r, 0, r, r, r);
      glow.addColorStop(0, 'rgb(255 255 255 / 100%)');
      glow.addColorStop(0.5, 'rgb(255 255 255 / 90%)');
      glow.addColorStop(1, 'rgb(255 255 255 / 0%)');
      g.fillStyle = glow;
      g.fillRect(0, 0, FLAKE_SIZE, FLAKE_SIZE);
      t.refresh();
    }
  }
  if (!scene.textures.exists(STREAK)) {
    const t = scene.textures.createCanvas(STREAK, STREAK_SIZE.width, STREAK_SIZE.height);
    if (t) {
      const g = t.getContext();
      const fade = g.createLinearGradient(0, 0, 0, STREAK_SIZE.height);
      fade.addColorStop(0, 'rgb(210 225 240 / 0%)');
      fade.addColorStop(1, 'rgb(210 225 240 / 100%)');
      g.fillStyle = fade;
      g.fillRect(0, 0, STREAK_SIZE.width, STREAK_SIZE.height);
      t.refresh();
    }
  }
}

export class WeatherView {
  private readonly scene: Phaser.Scene;
  private readonly images: Phaser.GameObjects.Image[] = [];
  private drops: WeatherDrop[] = [];
  private overlay: WeatherOverlay = 'none';
  private weather: Weather | null = null;
  /** Game time since the weather was set, in milliseconds. */
  private ms = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureWeatherTextures(scene);
  }

  /** The number of drops falling now, for tests. */
  get falling(): number {
    return this.drops.length;
  }

  setWeather(weather: Weather): void {
    if (weather === this.weather) return;
    this.weather = weather;
    this.overlay = WEATHER_STYLE[weather].overlay;
    // The same drops for the same weather in every round.
    const rng = createRng(weather.length * 97 + 5);
    this.drops = makeDrops(this.overlay, () => rng.next());
    const key = this.overlay === 'rain' ? STREAK : FLAKE;
    while (this.images.length < this.drops.length) this.images.push(this.scene.add.image(0, 0, key).setDepth(WEATHER_DEPTH).setVisible(false));
    this.images.forEach((image, i) => {
      const d = this.drops[i];
      if (d === undefined) {
        image.setVisible(false);
        return;
      }
      if (image.texture.key !== key) image.setTexture(key);
      image.setScale(d.scale).setAlpha(d.alpha).setVisible(true);
    });
    this.ms = 0;
    this.update(0);
  }

  update(deltaMs: number): void {
    if (this.overlay === 'none') return;
    this.ms += deltaMs;
    const overlay = this.overlay;
    for (let i = 0; i < this.drops.length; i++) {
      const p = dropAt(overlay, this.drops[i]!, this.ms);
      this.images[i]!.setPosition(p.x, p.y).setRotation(p.rotation);
    }
  }
}

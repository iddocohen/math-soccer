// Copied from math-tank playwright.config.ts. Phone and Fire tablet projects are left out: phones and
// Fire tablets are not targets of math-soccer. The ports are 4273 and 4274, not math-tank's 4173 and 4174, so
// `reuseExistingServer` never tests math-tank's build (amendment 01 section 4).
import { defineConfig, devices } from '@playwright/test';
import { GAME_WAIT } from './tests/e2e/gameWait';

/** Specs that run only in the iPad projects. */
const DEVICE_SPECS = /(devices|touch|rotation)\.spec\.ts$/;
/** The smoke test of the build for GitHub Pages runs only in the `base-path` project. */
const BASE_PATH_SPEC = /basePath\.spec\.ts$/;
/** The frame rate check runs only in the `performance` project, after every other project (T066). */
const PERFORMANCE_SPEC = /performance\.spec\.ts$/;
/**
 * As math-tank: Chromium draws WebGL with the graphics card only when asked; headless it uses software rendering
 * (SwiftShader). On macOS the performance project uses Metal through ANGLE.
 */
const GPU_ARGS = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [];
/** The game as GitHub Pages serves it: built with `--base=/math-soccer/` into its own folder, on its own port. */
const BASE_PATH_URL = 'http://localhost:4274/math-soccer/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Every worker runs a browser that renders the match scene; PW_WORKERS changes the number for one run.
  workers: Number(process.env.PW_WORKERS) || 4,
  // Specs that play a round wait on game state for up to GAME_WAIT (tests/e2e/gameWait.ts) per step.
  timeout: 60_000,
  expect: { timeout: GAME_WAIT },
  use: {
    baseURL: 'http://localhost:4273',
    trace: 'on-first-retry',
  },
  projects: [
    // Test runs stay silent.
    { name: 'chromium', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC, PERFORMANCE_SPEC], use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } } },
    { name: 'firefox', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC, PERFORMANCE_SPEC], use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } } } },
    { name: 'webkit', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC, PERFORMANCE_SPEC], use: { ...devices['Desktop Safari'] } },
    // iPad held sideways and upright, in WebKit with touch. They run only the device specs.
    { name: 'ipad-landscape', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini landscape'] } },
    { name: 'ipad-portrait', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini'] } },
    // The build for GitHub Pages under /math-soccer/, in Chromium.
    { name: 'base-path', testMatch: BASE_PATH_SPEC, use: { ...devices['Desktop Chrome'], baseURL: BASE_PATH_URL, launchOptions: { args: ['--mute-audio'] } } },
    // T066: the frame rate in Chromium, after all other projects so no other browser renders at the same time.
    // `--no-deps` runs it alone.
    {
      name: 'performance',
      testMatch: PERFORMANCE_SPEC,
      dependencies: ['chromium', 'firefox', 'webkit', 'ipad-landscape', 'ipad-portrait', 'base-path'],
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio', ...GPU_ARGS] } },
    },
  ],
  webServer: [
    {
      command: 'pnpm build && pnpm preview --port 4273 --strictPort',
      url: 'http://localhost:4273',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Its own output folder, so the two builds do not overwrite each other.
      command: 'pnpm exec vite build --base=/math-soccer/ --outDir dist-base && pnpm exec vite preview --base=/math-soccer/ --outDir dist-base --port 4274 --strictPort',
      url: BASE_PATH_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

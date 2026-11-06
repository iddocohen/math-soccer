// Copied from math-tank playwright.config.ts. Phone, Fire tablet and performance projects are left out: phones and
// Fire tablets are not targets of math-soccer.
import { defineConfig, devices } from '@playwright/test';
import { GAME_WAIT } from './tests/e2e/gameWait';

/** Specs that run only in the iPad projects. */
const DEVICE_SPECS = /(devices|touch|rotation)\.spec\.ts$/;
/** The smoke test of the build for GitHub Pages runs only in the `base-path` project. */
const BASE_PATH_SPEC = /basePath\.spec\.ts$/;
/** The game as GitHub Pages serves it: built with `--base=/math-soccer/` into its own folder, on its own port. */
const BASE_PATH_URL = 'http://localhost:4174/math-soccer/';

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
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    // Test runs stay silent.
    { name: 'chromium', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC], use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } } },
    { name: 'firefox', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC], use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0' } } } },
    { name: 'webkit', testIgnore: [DEVICE_SPECS, BASE_PATH_SPEC], use: { ...devices['Desktop Safari'] } },
    // iPad held sideways and upright, in WebKit with touch. They run only the device specs.
    { name: 'ipad-landscape', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini landscape'] } },
    { name: 'ipad-portrait', testMatch: DEVICE_SPECS, use: { ...devices['iPad Mini'] } },
    // The build for GitHub Pages under /math-soccer/, in Chromium.
    { name: 'base-path', testMatch: BASE_PATH_SPEC, use: { ...devices['Desktop Chrome'], baseURL: BASE_PATH_URL, launchOptions: { args: ['--mute-audio'] } } },
  ],
  webServer: [
    {
      command: 'pnpm build && pnpm preview --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Its own output folder, so the two builds do not overwrite each other.
      command: 'pnpm exec vite build --base=/math-soccer/ --outDir dist-base && pnpm exec vite preview --base=/math-soccer/ --outDir dist-base --port 4174 --strictPort',
      url: BASE_PATH_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

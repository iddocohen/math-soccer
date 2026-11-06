/// <reference types="vitest/config" />
// Copied from math-tank vite.config.ts: names and colors changed for Mathe-Kicker.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * The build version (src/app/buildInfo.ts): APP_VERSION when set, the short GITHUB_SHA in CI, the short git commit
 * locally, or the package version without git.
 */
function buildVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg'],
      workbox: {
        // The bundled assets (amendment 03): grass, ball sprite, sound clips and the font are precached for offline play.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,mp3,ttf,webmanifest}'],
        // A new worker removes caches of older Workbox versions, and the precache drops the files of the old build
        // when it activates; it takes control of open pages at once after activation. The worker still waits until
        // the app applies it on the start screen (src/app/swUpdate.ts).
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Mathe-Kicker',
        short_name: 'Mathe-Kicker',
        lang: 'de',
        start_url: '.',
        display: 'fullscreen',
        background_color: '#0f1d2b',
        theme_color: '#0f1d2b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    // The setup chunk has few tests; a project without test files must not fail the run.
    passWithNoTests: true,
    // Vitest 5 removed environmentMatchGlobs; projects split node and jsdom tests.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/app/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/app/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});

// Copied from math-tank src/app/buildInfo.ts.
/**
 * The build's version and date, set by vite.config.ts at build time: the short git commit (GITHUB_SHA in CI,
 * `git rev-parse --short HEAD` locally, APP_VERSION when set, the package version without git) and the day of the
 * build. The settings page shows them, so a parent can check which build a device runs.
 */
export const BUILD_VERSION: string = __APP_VERSION__;
export const BUILD_DATE: string = __BUILD_DATE__;

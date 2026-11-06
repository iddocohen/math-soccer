// Copied from math-tank src/globals.d.ts.
/** Set by `define` in vite.config.ts (src/app/buildInfo.ts). */
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

interface Window {
  /** The test speed-up hook at run time (src/app/App.tsx `playSpeed`); read only when the page has `?speed=`. */
  mathSoccerSpeed?: number;
}

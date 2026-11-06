// Copied from math-tank src/core/util.ts.
/** Small helpers shared by the core modules. No Phaser, no React, no Math.random. */

/** A plain object (not null, not an array). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `v` limited to [lo, hi]; `hi` wins when lo > hi. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The value `t` of the way from `a` to `b` (0 gives `a`, 1 gives `b`). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * `base` with every part of `over` laid over it: values from `over` replace those in `base`, nested objects merge key
 * by key. Keys that would change an object's prototype are skipped.
 */
export function mergeDeep(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, v] of Object.entries(over)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const b = Object.hasOwn(base, key) ? base[key] : undefined;
    out[key] = isRecord(v) && isRecord(b) ? mergeDeep(b, v) : v;
  }
  return out;
}

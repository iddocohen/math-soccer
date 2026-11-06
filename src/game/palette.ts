/**
 * Colors of the evening stadium, from specs/001-math-soccer/prototype/index.html. The same values are CSS variables in
 * src/app/styles.css. A missed square is warm orange, never red (spec "Feedback contract").
 */
export const COLOR = {
  night: 0x0f1d2b,
  pitch: 0x2f7a3c,
  chalk: 0xf4f6ef,
  kit: 0xe8b923,
  miss: 0xd9733b,
  ink: 0x12202c,
  net: 0x0e1a14,
  skin: 0xe9c4a0,
  hair: 0x5b3b26,
  /** The keeper's shirt outside the cup. */
  keeperJersey: 0x3e6fb0,
  /** The shaded inner side of white posts and shorts. */
  chalkShade: 0xc4c9bd,
  /** The cup and the first confetti color. */
  gold: 0xf2c230,
} as const;

/** `#rrggbb` as a number for Phaser's fill colors. */
export function hexColor(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

/** A 0xRRGGBB color as a CSS color string, for canvas drawing. */
export function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

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
  board: 0xeef1e8,
  skin: 0xe9c4a0,
  hair: 0x5b3b26,
} as const;

/** A 0xRRGGBB color as a CSS color string, for canvas drawing. */
export function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** The child's look in the scene. The locker room (US6) chooses it; until then the defaults apply. */
export interface Look {
  shirtColor: number;
  shirtNumber: number;
  scarfColor: number;
}

export const DEFAULT_LOOK: Look = { shirtColor: COLOR.kit, shirtNumber: 10, scarfColor: COLOR.kit };

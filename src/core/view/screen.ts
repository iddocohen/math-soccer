// Copied from math-tank src/core/view/screen.ts (amendment 12 item 1, amendment 16 items 2 and 4), trimmed to the
// number pad: math-soccer has one match layout, so the layout rule (wide, portrait, side) is left out.
/**
 * Whether the on-screen number pad shows (FR-031, amendment 16). Pure, no DOM: the app passes the results of the CSS
 * media queries of PAD_QUERIES (src/app/useScreen.ts).
 *
 * With "Automatisch" the pad shows when the main pointer is not fine (touch) OR the screen is narrower than
 * PAD_WIDTH_LIMIT CSS pixels. The width check matters because an iPad with a trackpad, keyboard cover or Pencil, and an
 * Amazon Fire tablet in Silk, can report a fine pointer. "Immer" and "Nie" ignore the device.
 */
import type { Settings } from '../settings/schema';

export type NumberPadSetting = Settings['numberPad'];

/** Below this width the number pad shows with the setting "Automatisch" (math-tank FR-102). */
export const PAD_WIDTH_LIMIT = 1100;

/** The media query results the number pad follows. Each is true when its query in PAD_QUERIES matches. */
export interface PadMedia {
  /** Narrower than PAD_WIDTH_LIMIT. */
  padWidth: boolean;
  /** The main pointer is a mouse or a trackpad. */
  finePointer: boolean;
}

/**
 * The CSS media queries for PadMedia. "Narrower than" ends 0.02 px below the limit, so a width with a fraction of a
 * pixel (zoom) still counts.
 */
export const PAD_QUERIES: Readonly<Record<keyof PadMedia, string>> = {
  padWidth: `(max-width: ${PAD_WIDTH_LIMIT - 0.02}px)`,
  finePointer: '(pointer: fine)',
};

/** What the media queries of PAD_QUERIES report for a width; used where no matchMedia exists. */
export function padMediaFromWidth(width: number, finePointer: boolean): PadMedia {
  return { padWidth: width < PAD_WIDTH_LIMIT, finePointer };
}

/** Whether the number pad shows: always, never, or with "automatic" without a fine pointer or on a narrow screen. */
export function numberPadShown(setting: NumberPadSetting, device: PadMedia): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  return !device.finePointer || device.padWidth;
}

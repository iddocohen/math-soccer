// Copied from math-tank src/core/transfer/qr.ts.
/**
 * The QR code of a transfer link (FR-041, as math-tank). Drawn in the browser with the bundled library uqr 0.1.3
 * (MIT license, https://github.com/unjs/uqr), so it works offline and sends nothing anywhere.
 */
import { encode } from 'uqr';

/** Error correction level M recovers about 15 % of damaged modules (FR-118). */
export const QR_ECC = 'M';
/** The light border scanners need around the code, in modules (the QR standard asks for 4). */
export const QR_QUIET_ZONE = 4;

export interface QrMatrix {
  /** Modules per side, the quiet zone included. */
  size: number;
  /** `true` for a dark module; rows from top to bottom. */
  modules: boolean[][];
}

export function qrMatrix(text: string): QrMatrix {
  const r = encode(text, { ecc: QR_ECC, border: QR_QUIET_ZONE });
  return { size: r.size, modules: r.data };
}

/** SVG path data with one unit square per dark module, for a `viewBox` of `0 0 size size`. */
export function qrPath(m: QrMatrix): string {
  let d = '';
  m.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return d;
}

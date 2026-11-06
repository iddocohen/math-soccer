// Copied from math-tank src/core/transfer/qr.test.ts.
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { QR_ECC, QR_QUIET_ZONE, qrMatrix, qrPath, type QrMatrix } from './qr';
import { TRANSFER_MAX_LINK_BYTES } from './transfer';

const SCALE = 4;

/** Draws the matrix as RGBA pixels, `SCALE` pixels per module, the way a screen shows it to a camera. */
function render(m: QrMatrix): { data: Uint8ClampedArray; width: number } {
  const width = m.size * SCALE;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const dark = m.modules[Math.floor(y / SCALE)]![Math.floor(x / SCALE)];
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = dark ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return { data, width };
}

function decode(m: QrMatrix): string | null {
  const { data, width } = render(m);
  return jsQR(data, width, width)?.data ?? null;
}

/** A link of exactly `n` bytes, with base64url characters like a real code. */
function linkOfBytes(n: number): string {
  const head = 'https://iddocohen.github.io/math-soccer/#save=v1.';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let body = '';
  for (let i = 0; body.length < n - head.length; i++) body += chars[(i * 37 + 11) % chars.length];
  return head + body;
}

describe('qrMatrix (FR-118)', () => {
  it('uses error correction M and a 4-module quiet zone', () => {
    expect(QR_ECC).toBe('M');
    expect(QR_QUIET_ZONE).toBe(4);
    const m = qrMatrix('https://example.org/#save=v1.abc');
    expect(m.modules).toHaveLength(m.size);
    for (const row of m.modules) expect(row).toHaveLength(m.size);
    // The quiet zone is light on every side.
    for (let i = 0; i < m.size; i++) {
      for (let k = 0; k < QR_QUIET_ZONE; k++) {
        expect(m.modules[k]![i]).toBe(false);
        expect(m.modules[m.size - 1 - k]![i]).toBe(false);
        expect(m.modules[i]![k]).toBe(false);
        expect(m.modules[i]![m.size - 1 - k]).toBe(false);
      }
    }
  });

  it('a short link decodes back to itself', () => {
    const link = 'http://localhost:4173/#save=v1.q1ZKz8_PSVWyMjQwMDA1tDQ0MjAwqgUA';
    expect(decode(qrMatrix(link))).toBe(link);
  });

  it(`a link of ${TRANSFER_MAX_LINK_BYTES} bytes still fits one QR code and decodes back to itself`, () => {
    const link = linkOfBytes(TRANSFER_MAX_LINK_BYTES);
    expect(link).toHaveLength(TRANSFER_MAX_LINK_BYTES);
    const m = qrMatrix(link);
    // Version 40 has 177 modules, plus the quiet zone on both sides.
    expect(m.size).toBeLessThanOrEqual(177 + 2 * QR_QUIET_ZONE);
    expect(decode(m)).toBe(link);
  });
});

describe('qrPath', () => {
  it('has one unit square per dark module', () => {
    const m = qrMatrix('hello');
    const dark = m.modules.flat().filter(Boolean).length;
    const squares = qrPath(m).match(/M/g) ?? [];
    expect(squares).toHaveLength(dark);
    expect(qrPath(m)).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});

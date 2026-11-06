// Adapted from math-tank src/core/transfer/transfer.ts: one code version, the locker room instead of the garage, the
// direction states instead of skills and sessions.
/**
 * Moving a save to another browser with a link or a QR code (FR-041, as math-tank). Engine-free: no React, no
 * Phaser, no storage access.
 *
 * The transfer holds the settings, the locker room, the personal bests and the progress per direction, without the
 * attempt history. It is compressed with `deflate-raw` through the browser's CompressionStream (or sent uncompressed
 * when there is none), encoded as base64url and put into the link's fragment as `#save=v1.<data>`. Browsers never send
 * the fragment to the server.
 *
 * Receiving checks every part with the same schemas and migrations as loading from storage, so a damaged or foreign
 * code is refused as a whole and changes nothing.
 */
import { z } from 'zod';
import type { SaveData } from '../storage/exportImport';
import { emptyProgress, type Outcome } from '../storage/schemas';
import { LOCKER_ROOM, PROGRESS, RECORDS, SETTINGS } from '../storage/storage';

export type { SaveData };

export const TRANSFER_VERSION = 1;
/** The whole link, in bytes: below the 2331 bytes of a version 40 QR code with error correction M (as math-tank). */
export const TRANSFER_MAX_LINK_BYTES = 2300;
/** Longest code read: about 3.5 times the longest link written. */
export const TRANSFER_MAX_CODE_LENGTH = 8192;
/** Most bytes of JSON read from a compressed code; unpacking stops there, so a crafted code cannot freeze the tab. */
export const TRANSFER_MAX_JSON_BYTES = 65_536;
const WINDOW_MAX = 10;
const FRAGMENT = 'save=';
const intMin0 = () => z.number().int().min(0);

type DirectionTuple = [step: number, attempts: number, independent: number, assisted: number, guesses: number, window: string];

/** The transfer before it is compressed. */
export interface TransferData {
  v: 1;
  settings: SaveData['settings'];
  lockerRoom: SaveData['lockerRoom'];
  records: SaveData['records']['bests'];
  directions: Record<string, DirectionTuple>;
}

/** What the receive dialog shows. */
export interface TransferSummary {
  stars: number;
  /** The most goals of any personal best; 0 without one. */
  record: number;
  min: number;
  max: number;
}

export interface Codec {
  deflate(bytes: Uint8Array): Promise<Uint8Array>;
  /** Rejects when the unpacked data would be longer than `maxBytes`. */
  inflate(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>;
}

export interface EncodedTransfer {
  link: string;
  /** `v1.<data>`, the part after `#save=`. */
  code: string;
  /** False when the link is longer than the limit even with empty mastery windows; `link` is then the shortest link. */
  fits: boolean;
  /** Length every mastery window was cut to; 10 when no window was shortened. */
  windowLength: number;
}

export type DecodedTransfer = { ok: true; data: SaveData; summary: TransferSummary } | { ok: false };

const LETTER: Record<Outcome, string> = { independent: 'i', assisted: 'a', unsolved: 'u' };
const OUTCOME: Record<string, Outcome> = { i: 'independent', a: 'assisted', u: 'unsolved' };

/** The transfer of a save, without the attempt history and the `recent` lists; windows cut to `windowLength`. */
export function toTransfer(data: SaveData, windowLength = WINDOW_MAX): TransferData {
  const directions: Record<string, DirectionTuple> = {};
  for (const [key, ds] of Object.entries(data.progress.directions)) {
    const window = windowLength > 0 ? ds.masteryWindow.slice(-windowLength) : [];
    directions[key] = [ds.step, ds.attempts, ds.independent, ds.assisted, ds.guesses, window.map((o) => LETTER[o]).join('')];
  }
  return { v: 1, settings: data.settings, lockerRoom: data.lockerRoom, records: data.records.bests, directions };
}

async function pipe(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const body = new Response(bytes as BodyInit).body!;
  return new Uint8Array(await new Response(body.pipeThrough(stream)).arrayBuffer());
}

/** Unpacks chunk by chunk and stops as soon as the output passes `maxBytes`. */
async function pipeLimited(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = new Response(bytes as BodyInit).body!.pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RangeError('transfer data too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** `deflate-raw` through CompressionStream and DecompressionStream; null when the browser has neither. */
export function browserCodec(): Codec | null {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') return null;
  return {
    deflate: (bytes) => pipe(bytes, new CompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>),
    inflate: (bytes, maxBytes) => pipeLimited(bytes, new DecompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>, maxBytes),
  };
}

function toBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The page address without its fragment, plus `#save=<code>`. */
export function transferLink(pageHref: string, code: string): string {
  const hash = pageHref.indexOf('#');
  return `${hash < 0 ? pageHref : pageHref.slice(0, hash)}#${FRAGMENT}${code}`;
}

/** The code of a `#save=` fragment, or null for any other fragment. */
export function saveCodeFromHash(hash: string): string | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  return body.startsWith(FRAGMENT) ? body.slice(FRAGMENT.length) : null;
}

async function codeOf(t: TransferData, codec: Codec | null): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(t));
  const bytes = codec ? await codec.deflate(json) : json;
  return `v${TRANSFER_VERSION}.${toBase64url(bytes)}`;
}

/**
 * The link for `data`. When the full transfer is too long for one QR code, the mastery windows are cut shorter until it
 * fits; `fits` is false when even empty windows do not fit.
 */
export async function encodeTransfer(
  data: SaveData,
  pageHref: string,
  opts: { codec?: Codec | null; maxBytes?: number } = {},
): Promise<EncodedTransfer> {
  const codec = opts.codec === undefined ? browserCodec() : opts.codec;
  const maxBytes = opts.maxBytes ?? TRANSFER_MAX_LINK_BYTES;
  let last: EncodedTransfer | null = null;
  for (let windowLength = WINDOW_MAX; windowLength >= 0; windowLength--) {
    const code = await codeOf(toTransfer(data, windowLength), codec);
    const link = transferLink(pageHref, code);
    last = { link, code, fits: new TextEncoder().encode(link).length <= maxBytes, windowLength };
    if (last.fits) return last;
  }
  return last!;
}

const transferSchema = z.object({
  v: z.literal(1),
  settings: z.unknown(),
  lockerRoom: z.unknown(),
  records: z.unknown(),
  directions: z.record(z.string(), z.tuple([intMin0(), intMin0(), intMin0(), intMin0(), intMin0(), z.string().regex(/^[iau]{0,10}$/)])),
});

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

async function readJson(bytes: Uint8Array, codec: Codec | null): Promise<unknown> {
  // Uncompressed data starts with '{'; anything else is compressed.
  if (bytes.length > 0 && bytes[0] === 0x7b && bytes.length <= TRANSFER_MAX_JSON_BYTES) {
    const plain = parseJson(bytes);
    if (plain !== undefined) return plain;
  }
  if (!codec) return undefined;
  try {
    return parseJson(await codec.inflate(bytes, TRANSFER_MAX_JSON_BYTES));
  } catch {
    return undefined;
  }
}

/** Reads `v1.<data>` with the same schemas and migrations as storage; any failure refuses the whole code. */
export async function decodeTransfer(code: string, opts: { codec?: Codec | null } = {}): Promise<DecodedTransfer> {
  const codec = opts.codec === undefined ? browserCodec() : opts.codec;
  if (code.length > TRANSFER_MAX_CODE_LENGTH) return { ok: false };
  const m = /^v1\.(.+)$/.exec(code);
  if (!m) return { ok: false };
  const bytes = fromBase64url(m[1]!);
  if (!bytes) return { ok: false };
  const parsed = transferSchema.safeParse(await readJson(bytes, codec));
  if (!parsed.success) return { ok: false };
  const t = parsed.data;

  const settings = SETTINGS.parse(t.settings);
  const lockerRoom = LOCKER_ROOM.parse(t.lockerRoom);
  const records = RECORDS.parse({ version: 1, bests: t.records });
  const directions: Record<string, unknown> = {};
  for (const [key, [step, attempts, independent, assisted, guesses, window]] of Object.entries(t.directions)) {
    directions[key] = { step, recent: [], masteryWindow: [...window].map((c) => OUTCOME[c]), attempts, independent, assisted, guesses };
  }
  const progress = PROGRESS.parse({ ...emptyProgress(), directions });
  if (!settings || !lockerRoom || !records || !progress) return { ok: false };

  const data: SaveData = { settings, progress, records, lockerRoom };
  return { ok: true, data, summary: transferSummary(data) };
}

export function transferSummary(data: SaveData): TransferSummary {
  const record = Object.values(data.records.bests).reduce((most, b) => Math.max(most, b.goals), 0);
  return { stars: data.lockerRoom.stars, record, min: data.settings.range.min, max: data.settings.range.max };
}

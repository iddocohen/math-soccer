// Adapted from math-tank src/core/transfer/transfer.test.ts: code version 1 since the stored data baseline (T106).
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { emptyCup, emptyLockerRoom, emptyProgress, emptyRecords } from '../storage/schemas';
import type { SaveData } from './transfer';
import {
  browserCodec,
  decodeTransfer,
  encodeTransfer,
  saveCodeFromHash,
  toTransfer,
  TRANSFER_MAX_CODE_LENGTH,
  transferLink,
  transferSummary,
} from './transfer';

const PAGE = 'https://iddocohen.github.io/math-soccer/';

function saveData(): SaveData {
  const progress = emptyProgress();
  progress.level = 3;
  progress.levelRecent = ['independent'];
  progress.levelWins = 1;
  progress.levels['3'] = { independent: 4, assisted: 1, guesses: 0 };
  progress.directions['keeper|down'] = {
    masteryWindow: ['independent', 'assisted', 'unsolved'],
    attempts: 5,
    independent: 3,
    assisted: 2,
    guesses: 1,
  };
  progress.attempts.push({
    at: '2026-11-06T12:00:00.000Z',
    mode: 'keeper',
    min: 1,
    max: 100,
    target: 46,
    directions: ['down'],
    hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
    hintDisplay: 'always',
    level: 1,
    solved: true,
    helpStep: 0,
    misses: 0,
    responseMs: 4000,
    guess: false,
  });
  const records = emptyRecords();
  records.bests['1-100|keeper|untilHearts'] = { goals: 12, timeMs: 300_000, at: '2026-11-06T12:00:00.000Z' };
  return {
    settings: { ...defaultSettings(), range: { preset: 'custom', min: 200, max: 500 } },
    progress,
    records,
    lockerRoom: { ...emptyLockerRoom(), stars: 31 },
    cup: emptyCup(),
  };
}

/** What a receiver gets: no attempt history, no `levelRecent` and no `levelWins`. */
function expected(data: SaveData): SaveData {
  const progress = { ...emptyProgress(), directions: data.progress.directions, level: data.progress.level, levels: data.progress.levels };
  return { ...data, progress };
}

const base64url = (json: string) => btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A code as the game before the baseline wrote it (version 1 with ladder steps), uncompressed. */
function preBaselineV1Code(): string {
  const settings = { ...defaultSettings(), version: 2, directions: { right: true, down: true, downRight: true, downLeft: true, left: false, up: false, upLeft: false, upRight: false }, patterns: { neighbors: true, middle: true, row: true, shape: true } } as Record<string, unknown>;
  delete settings.levels;
  const json = JSON.stringify({ v: 1, settings, lockerRoom: emptyLockerRoom(), records: {}, directions: { 'keeper|down': [5, 4, 3, 1, 0, 'iia'], 'keeper|right': [1, 2, 2, 0, 0, ''] } });
  return `v1.${base64url(json)}`;
}

describe('transfer links (FR-041)', () => {
  it('puts the code after #save= and replaces an old fragment', () => {
    expect(transferLink(`${PAGE}#old`, 'v1.abc')).toBe(`${PAGE}#save=v1.abc`);
    expect(saveCodeFromHash('#save=v1.abc')).toBe('v1.abc');
    expect(saveCodeFromHash('#other')).toBeNull();
  });

  it('round-trips a save, compressed and uncompressed, without the attempt history', async () => {
    for (const codec of [browserCodec(), null]) {
      const r = await encodeTransfer(saveData(), PAGE, { codec });
      expect(r.fits).toBe(true);
      expect(r.link.startsWith(`${PAGE}#save=v1.`)).toBe(true);
      const decoded = await decodeTransfer(r.code, { codec });
      expect(decoded).toEqual({ ok: true, data: expected(saveData()), summary: { stars: 31, record: 12, min: 200, max: 500 } });
    }
  });

  it('carries the cup (amendment 13); a code without one or with a damaged one is refused', async () => {
    const cup = { ...emptyCup(), cup: 3, stage: 2, tries: 1, scores: [{ goals: 5, against: 0 }, { goals: 5, against: 2 }], trophies: [{ cup: 1, at: 'a' }, { cup: 2, at: 'b' }] };
    const r = await encodeTransfer({ ...saveData(), cup }, PAGE, { codec: null });
    const decoded = await decodeTransfer(r.code, { codec: null });
    expect(decoded.ok && decoded.data.cup).toEqual(cup);
    const { cup: _cup, ...old } = toTransfer(saveData());
    void _cup;
    expect(await decodeTransfer(`v1.${base64url(JSON.stringify(old))}`, { codec: null })).toEqual({ ok: false });
    const badCode = `v1.${base64url(JSON.stringify({ ...old, cup: { ...cup, stage: 7 } }))}`;
    expect(await decodeTransfer(badCode, { codec: null })).toEqual({ ok: false });
  });

  it('refuses codes written before the stored data baseline (T106): the old version 1 and version 2', async () => {
    expect(await decodeTransfer(preBaselineV1Code(), { codec: null })).toEqual({ ok: false });
    const current = toTransfer(saveData());
    const v2 = { ...current, v: 2, settings: { ...current.settings, version: 4 } };
    expect(await decodeTransfer(`v2.${base64url(JSON.stringify(v2))}`, { codec: null })).toEqual({ ok: false });
  });

  it('cuts the mastery windows when the link would be too long, and says when it never fits', async () => {
    const r = await encodeTransfer(saveData(), PAGE, { codec: null, maxBytes: 1 });
    expect(r.fits).toBe(false);
    expect(r.windowLength).toBe(0);
  });

  it('refuses damaged, foreign, invalid and oversized codes', async () => {
    expect(await decodeTransfer('v3.abc', { codec: null })).toEqual({ ok: false });
    expect(await decodeTransfer('v2.abc', { codec: null })).toEqual({ ok: false });
    expect(await decodeTransfer('v1.***', { codec: null })).toEqual({ ok: false });
    expect(await decodeTransfer(`v1.${'A'.repeat(TRANSFER_MAX_CODE_LENGTH)}`, { codec: null })).toEqual({ ok: false });
    const bad = await encodeTransfer({ ...saveData(), settings: { ...defaultSettings(), goalsPerRound: 0 } }, PAGE, { codec: null });
    expect(await decodeTransfer(bad.code, { codec: null })).toEqual({ ok: false });
  });

  it('summarizes stars, the best goal count and the range', () => {
    expect(transferSummary(saveData())).toEqual({ stars: 31, record: 12, min: 200, max: 500 });
  });
});

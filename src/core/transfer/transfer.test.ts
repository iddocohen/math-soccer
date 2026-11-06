// Adapted from math-tank src/core/transfer/transfer.test.ts, trimmed to one code version.
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import { emptyLockerRoom, emptyProgress, emptyRecords, type Outcome } from '../storage/schemas';
import type { SaveData } from './transfer';
import {
  browserCodec,
  decodeTransfer,
  encodeTransfer,
  saveCodeFromHash,
  TRANSFER_MAX_CODE_LENGTH,
  transferLink,
  transferSummary,
} from './transfer';

const PAGE = 'https://iddocohen.github.io/math-soccer/';

function saveData(): SaveData {
  const progress = emptyProgress();
  progress.directions['holes|down'] = {
    step: 2,
    recent: ['independent'],
    masteryWindow: ['independent', 'assisted', 'unsolved'],
    attempts: 5,
    independent: 3,
    assisted: 2,
    guesses: 1,
  };
  progress.attempts.push({
    at: '2026-11-06T12:00:00.000Z',
    mode: 'holes',
    min: 1,
    max: 100,
    target: 46,
    directions: ['down'],
    hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
    hintDisplay: 'always',
    difficultyStep: 2,
    solved: true,
    helpStep: 0,
    misses: 0,
    responseMs: 4000,
    guess: false,
  });
  const records = emptyRecords();
  records.bests['1-100|holes|untilHearts'] = { goals: 12, timeMs: 300_000, at: '2026-11-06T12:00:00.000Z' };
  return {
    settings: { ...defaultSettings(), range: { preset: 'custom', min: 200, max: 500 } },
    progress,
    records,
    lockerRoom: { ...emptyLockerRoom(), stars: 31 },
  };
}

/** What a receiver gets: no attempt history and no `recent` list. */
function expected(data: SaveData): SaveData {
  const progress = { ...emptyProgress(), directions: { 'holes|down': { ...data.progress.directions['holes|down']!, recent: [] as Outcome[] } } };
  return { ...data, progress };
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

  it('cuts the mastery windows when the link would be too long, and says when it never fits', async () => {
    const r = await encodeTransfer(saveData(), PAGE, { codec: null, maxBytes: 1 });
    expect(r.fits).toBe(false);
    expect(r.windowLength).toBe(0);
  });

  it('refuses damaged, foreign, invalid and oversized codes', async () => {
    expect(await decodeTransfer('v2.abc', { codec: null })).toEqual({ ok: false });
    expect(await decodeTransfer('v1.***', { codec: null })).toEqual({ ok: false });
    expect(await decodeTransfer(`v1.${'A'.repeat(TRANSFER_MAX_CODE_LENGTH)}`, { codec: null })).toEqual({ ok: false });
    const bad = await encodeTransfer({ ...saveData(), settings: { ...defaultSettings(), lineLength: 1 } }, PAGE, { codec: null });
    expect(await decodeTransfer(bad.code, { codec: null })).toEqual({ ok: false });
  });

  it('summarizes stars, the best goal count and the range', () => {
    expect(transferSummary(saveData())).toEqual({ stars: 31, record: 12, min: 200, max: 500 });
  });
});

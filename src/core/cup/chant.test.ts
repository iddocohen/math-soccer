import { describe, expect, it } from 'vitest';
import { CHANT_BEAT_SECONDS, CHANT_REPEATS, chantParts, chantPattern, chantSeconds } from './chant';

describe('cup final chant (FR-110)', () => {
  it('gives one sung tone per three letters of the shirt name, from 1 to 4', () => {
    expect(chantParts('')).toBe(2);
    expect(chantParts('Al')).toBe(1);
    expect(chantParts('Leo')).toBe(1);
    expect(chantParts('Lena')).toBe(2);
    expect(chantParts('Maximilian')).toBe(4);
    expect(chantParts('  Ben  ')).toBe(1);
  });

  it('sings the tones, then claps three times, and repeats the line', () => {
    const beats = chantPattern('Lena');
    const voices = beats.filter((b) => b.kind === 'voice');
    const claps = beats.filter((b) => b.kind === 'clap');
    expect(voices).toHaveLength(2 * CHANT_REPEATS);
    expect(claps).toHaveLength(3 * CHANT_REPEATS);
    expect(beats.slice(0, 5).map((b) => b.kind)).toEqual(['voice', 'voice', 'clap', 'clap', 'clap']);
  });

  it('keeps every beat on the beat grid and in time order', () => {
    const beats = chantPattern('Maximilian');
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at).toBeGreaterThan(beats[i - 1]!.at);
    for (const b of beats) expect(Math.abs(b.at / CHANT_BEAT_SECONDS - Math.round(b.at / CHANT_BEAT_SECONDS))).toBeLessThan(1e-9);
    expect(chantSeconds('Maximilian')).toBeCloseTo(beats[beats.length - 1]!.at + CHANT_BEAT_SECONDS);
  });

  it('a longer name gives a longer chant', () => {
    expect(chantSeconds('Maximilian')).toBeGreaterThan(chantSeconds('Leo'));
  });
});

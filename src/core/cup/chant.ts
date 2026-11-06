/**
 * The crowd's chant in the cup final (amendment 13, FR-110): a synthesized rhythm with clapping, built from the length
 * of the child's shirt name. No name is spoken or recorded: each part of the name is one sung crowd tone, followed by
 * three claps, and the line plays twice. The sound module (src/audio/sfx.ts) plays the beats; the stands clap along.
 */
import { clamp } from '../util';

/** One beat of the chant: a sung crowd tone at `pitch` Hz, or a clap. `at` is in seconds from the start. */
export type ChantBeat = { at: number; kind: 'voice'; pitch: number; length: number } | { at: number; kind: 'clap' };

/** The time between two beats, in seconds. */
export const CHANT_BEAT_SECONDS = 0.32;
/** How often the line repeats. */
export const CHANT_REPEATS = 2;
const CLAPS_PER_LINE = 3;
/** The sung tones of a line, high to low, like a crowd calling a name. */
const PITCHES = [392, 330, 330, 262];

/** How many sung tones the name gets: one per three letters, from 1 to 4. An empty name gets 2. */
export function chantParts(shirtName: string): number {
  const letters = shirtName.trim().length;
  if (letters === 0) return 2;
  return clamp(Math.ceil(letters / 3), 1, 4);
}

/** The beats of the whole chant, in time order. */
export function chantPattern(shirtName: string): ChantBeat[] {
  const parts = chantParts(shirtName);
  const beats: ChantBeat[] = [];
  let beat = 0;
  for (let line = 0; line < CHANT_REPEATS; line++) {
    for (let i = 0; i < parts; i++) {
      // The last tone of the name is held a little longer, as a crowd does.
      const last = i === parts - 1;
      const pitch = PITCHES[parts === 1 ? 0 : Math.round((i * (PITCHES.length - 1)) / (parts - 1))]!;
      beats.push({ at: beat * CHANT_BEAT_SECONDS, kind: 'voice', pitch, length: CHANT_BEAT_SECONDS * (last ? 1.6 : 0.85) });
      beat += last ? 2 : 1;
    }
    for (let i = 0; i < CLAPS_PER_LINE; i++) {
      beats.push({ at: beat * CHANT_BEAT_SECONDS, kind: 'clap' });
      beat += 1;
    }
    // A short rest before the line repeats.
    beat += 1;
  }
  return beats;
}

/** How long the chant lasts, in seconds. */
export function chantSeconds(shirtName: string): number {
  const beats = chantPattern(shirtName);
  const last = beats[beats.length - 1]!;
  return last.at + CHANT_BEAT_SECONDS;
}

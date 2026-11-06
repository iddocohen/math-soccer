// Adapted from math-tank src/audio/sfx.ts; the sounds follow specs/001-math-soccer/prototype/index.html.
/**
 * The game's sounds (research R10, FR-021, FR-022, FR-059): a kick, a cheer, clapping and a soft "ohhh" followed by
 * clapping.
 *
 * - Recorded clips (amendment 03): with `clips`, each sound is fetched and decoded once, right after the first key or
 *   tap unlocks audio, and then played from memory. A clip that is missing or cannot be decoded is replaced by the
 *   synthesized sound below, and so is every clip until decoding has finished.
 * - Synthesized sounds, made with the Web Audio API at runtime: a kick (a low triangle glide), a cheer (two band-passed
 *   noise swells), clapping (short noise bursts) and the "ohhh" (three low triangle tones gliding down).
 *
 * - `kick` plays while `sound.effects` is on.
 * - The cup final (amendment 13, FR-110): `chant` sings the crowd's chant (core/cup/chant.ts) with clapping, and
 *   `fireworks` pops and crackles for a won cup. Both are synthesized and are crowd sounds.
 * - `cheer`, `clap` and `ohh` are crowd sounds and play while `sound.crowd` is on.
 * - With `sound.ohh` off, `ohh` plays the clapping alone (data-model "Settings").
 * - Browsers start audio suspended; the context is created and resumed on the first key or tap (installUnlock). Until
 *   then every sound is skipped silently.
 * - Every voice peaks at MAX_GAIN or lower. Clapping is scheduled on the audio clock, not with timers.
 */
import { chantPattern } from '../core/cup/chant';

/** The part of AudioContext this module uses; tests pass a stand-in. */
export type AudioContextLike = Pick<
  AudioContext,
  | 'state'
  | 'currentTime'
  | 'sampleRate'
  | 'destination'
  | 'resume'
  | 'createGain'
  | 'createOscillator'
  | 'createBuffer'
  | 'createBufferSource'
  | 'createBiquadFilter'
  | 'decodeAudioData'
>;

/** The recorded clips, by the sound they play (src/assets.ts). */
export type ClipName = 'kick' | 'cheer' | 'clap' | 'ohh';

export const MAX_GAIN = 0.35;
const CLIP_NAMES: readonly ClipName[] = ['kick', 'cheer', 'clap', 'ohh'];
/** Length of the "ohhh" tones; the clapping starts after them. */
export const OHH_SECONDS = 0.9;
/** With the recorded "ohhh" (about 1.2 s), the recorded clapping starts this long after it, while the "ohhh" fades. */
export const OHH_CLIP_SECONDS = 0.9;
const SILENT = 0.0001;

/** The sound settings this module reads (settings.sound). */
export interface SoundSwitches {
  effects: boolean;
  crowd: boolean;
  ohh: boolean;
}

export interface SfxOptions {
  /** Read on every sound, so a changed setting applies at once. */
  sound: () => SoundSwitches;
  /** Defaults to `new AudioContext()`. */
  createContext?: () => AudioContextLike;
  /** The URL of each recorded clip; without it every sound is synthesized. */
  clips?: (name: ClipName) => string;
  /** Defaults to `fetch`; tests pass a stand-in. */
  fetchClip?: (url: string) => Promise<ArrayBuffer>;
}

export interface Sfx {
  kick(): void;
  /** The crowd's chant in the cup final, built from the shirt name's length (FR-110); a crowd sound. */
  chant(shirtName: string): void;
  /** A few firework pops with crackle over the stands, for a won cup (FR-110); a crowd sound. */
  fireworks(): void;
  cheer(): void;
  clap(): void;
  /** The soft "ohhh", then clapping; clapping alone when `sound.ohh` is off. */
  ohh(): void;
  /** Creates and resumes the audio context, then decodes the clips once; call from a user gesture. */
  unlock(): Promise<void>;
  /** Unlocks on the first pointer or key press on `target`; returns a function that removes the listeners. */
  installUnlock(target?: EventTarget): () => void;
}

export function createSfx(options: SfxOptions): Sfx {
  const make = options.createContext ?? (() => new AudioContext());
  let ctx: AudioContextLike | null = null;
  let noise: AudioBuffer | null = null;
  const decoded = new Map<ClipName, AudioBuffer>();
  let loading: Promise<void> | null = null;
  const fetchClip =
    options.fetchClip ??
    (async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`sfx: ${url} answered ${response.status}`);
      return response.arrayBuffer();
    });

  /** Fetches and decodes every clip once; a clip that fails stays out of `decoded`, so its synthesized sound plays. */
  const loadClips = (c: AudioContextLike): Promise<void> => {
    const url = options.clips;
    if (!url) return Promise.resolve();
    loading ??= Promise.all(
      CLIP_NAMES.map(async (name) => {
        try {
          decoded.set(name, await c.decodeAudioData(await fetchClip(url(name))));
        } catch {
          // Missing or broken file: the synthesized sound stays.
        }
      }),
    ).then(() => undefined);
    return loading;
  };

  /** Plays a decoded clip at MAX_GAIN after `delay` seconds; false when the clip is not decoded. */
  const playClip = (c: AudioContextLike, name: ClipName, delay = 0): boolean => {
    const buffer = decoded.get(name);
    if (!buffer) return false;
    const t = c.currentTime + delay;
    const g = c.createGain();
    g.gain.setValueAtTime(MAX_GAIN, t);
    g.connect(c.destination);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(g);
    src.start(t);
    return true;
  };

  const running = (): AudioContextLike | null => (ctx && ctx.state === 'running' ? ctx : null);

  const noiseBuffer = (c: AudioContextLike): AudioBuffer => {
    if (noise) return noise;
    const length = Math.floor(c.sampleRate * 2.4);
    const buf = c.createBuffer(1, length, c.sampleRate);
    const data = buf.getChannelData(0);
    // Fixed pseudo-random noise, so the sound is the same every time.
    let s = 12345;
    for (let i = 0; i < length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (s / 0x7fffffff) * 2 - 1;
    }
    noise = buf;
    return buf;
  };

  /** Band-passed noise that swells for the first 30 % of `duration` and fades out. */
  const noiseBurst = (c: AudioContextLike, duration: number, frequency: number, peak: number, delay = 0) => {
    const t = c.currentTime + delay;
    const g = c.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(Math.min(peak, MAX_GAIN), t + duration * 0.3);
    g.gain.linearRampToValueAtTime(SILENT, t + duration);
    g.connect(c.destination);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(frequency, t);
    f.Q.setValueAtTime(0.7, t);
    f.connect(g);
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.connect(f);
    src.start(t);
    src.stop(t + duration + 0.05);
  };

  /** A triangle tone gliding from `from` to `to` and fading out over `duration`. */
  const glide = (c: AudioContextLike, from: number, to: number, duration: number, peak: number) => {
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.min(peak, MAX_GAIN), t);
    g.gain.linearRampToValueAtTime(SILENT, t + duration);
    g.connect(c.destination);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(from, t);
    o.frequency.linearRampToValueAtTime(to, t + duration);
    o.connect(g);
    o.start(t);
    o.stop(t + duration + 0.05);
  };

  const clapping = (c: AudioContextLike, claps: number, gap: number, peak: number, delay = 0) => {
    for (let i = 0; i < claps; i++) noiseBurst(c, 0.08, 2200, peak, delay + i * gap);
  };

  const crowd = (): AudioContextLike | null => (options.sound().crowd ? running() : null);

  const unlock = async (): Promise<void> => {
    try {
      ctx ??= make();
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      // No Web Audio here: the game stays silent.
      ctx = null;
      return;
    }
    await loadClips(ctx);
  };

  /** A crowd singing one tone: three slightly detuned voices that swell in and fade out. */
  const voice = (c: AudioContextLike, pitch: number, length: number, delay: number) => {
    const t = c.currentTime + delay;
    for (const detune of [0.985, 1, 1.02]) {
      const g = c.createGain();
      g.gain.setValueAtTime(SILENT, t);
      g.gain.linearRampToValueAtTime(0.05, t + length * 0.2);
      g.gain.linearRampToValueAtTime(SILENT, t + length);
      g.connect(c.destination);
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(pitch * detune, t);
      o.connect(g);
      o.start(t);
      o.stop(t + length + 0.05);
    }
  };

  const clapSound = (c: AudioContextLike, delay = 0) => {
    if (!playClip(c, 'clap', delay)) clapping(c, 5, 0.12, 0.2, delay);
  };

  return {
    kick() {
      const c = options.sound().effects ? running() : null;
      if (c && !playClip(c, 'kick')) glide(c, 160, 60, 0.12, 0.3);
    },
    chant(shirtName: string) {
      const c = crowd();
      if (!c) return;
      for (const beat of chantPattern(shirtName)) {
        if (beat.kind === 'voice') voice(c, beat.pitch, beat.length, beat.at);
        else noiseBurst(c, 0.08, 2200, 0.25, beat.at);
      }
    },
    fireworks() {
      const c = crowd();
      if (!c) return;
      for (const [i, at] of [0, 0.45, 0.8, 1.3].entries()) {
        // A low pop, then a short crackle.
        noiseBurst(c, 0.18, 300 + i * 60, 0.3, at);
        noiseBurst(c, 0.5, 4200, 0.08, at + 0.12);
      }
    },
    cheer() {
      const c = crowd();
      if (!c || playClip(c, 'cheer')) return;
      noiseBurst(c, 2.2, 1200, 0.3);
      noiseBurst(c, 2.0, 2600, 0.15);
    },
    clap() {
      const c = crowd();
      if (c && !playClip(c, 'clap')) clapping(c, 6, 0.11, 0.25);
    },
    ohh() {
      const c = crowd();
      if (!c) return;
      if (!options.sound().ohh) {
        clapSound(c);
        return;
      }
      if (playClip(c, 'ohh')) {
        clapSound(c, OHH_CLIP_SECONDS);
        return;
      }
      for (const f of [220, 262, 330]) glide(c, f, f * 0.8, OHH_SECONDS, 0.06);
      clapSound(c, OHH_SECONDS);
    },
    unlock,
    installUnlock(target: EventTarget = globalThis) {
      const events = ['pointerdown', 'touchend', 'keydown'];
      const handler = () => {
        remove();
        void unlock();
      };
      const remove = () => events.forEach((e) => target.removeEventListener(e, handler));
      events.forEach((e) => target.addEventListener(e, handler));
      return remove;
    },
  };
}

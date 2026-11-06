// Adapted from math-tank src/audio/sfx.ts; the sounds follow specs/001-math-soccer/prototype/index.html.
/**
 * Synthesized sounds (research R10, FR-021, FR-022): a kick, a cheer (two band-passed noise swells), clapping (short
 * noise bursts) and a soft "ohhh" (three low triangle tones gliding down, then clapping). Made with the Web Audio API
 * at runtime, so there are no audio files.
 *
 * - `kick` plays while `sound.effects` is on.
 * - `cheer`, `clap` and `ohh` are crowd sounds and play while `sound.crowd` is on.
 * - With `sound.ohh` off, `ohh` plays the clapping alone (data-model "Settings").
 * - Browsers start audio suspended; the context is created and resumed on the first key or tap (installUnlock). Until
 *   then every sound is skipped silently.
 * - Every voice peaks at MAX_GAIN or lower. Clapping is scheduled on the audio clock, not with timers.
 */

/** The part of AudioContext this module uses; tests pass a stand-in. */
export type AudioContextLike = Pick<
  AudioContext,
  'state' | 'currentTime' | 'sampleRate' | 'destination' | 'resume' | 'createGain' | 'createOscillator' | 'createBuffer' | 'createBufferSource' | 'createBiquadFilter'
>;

export const MAX_GAIN = 0.35;
/** Length of the "ohhh" tones; the clapping starts after them. */
export const OHH_SECONDS = 0.9;
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
}

export interface Sfx {
  kick(): void;
  cheer(): void;
  clap(): void;
  /** The soft "ohhh", then clapping; clapping alone when `sound.ohh` is off. */
  ohh(): void;
  /** Creates and resumes the audio context; call from a user gesture. */
  unlock(): Promise<void>;
  /** Unlocks on the first pointer or key press on `target`; returns a function that removes the listeners. */
  installUnlock(target?: EventTarget): () => void;
}

export function createSfx(options: SfxOptions): Sfx {
  const make = options.createContext ?? (() => new AudioContext());
  let ctx: AudioContextLike | null = null;
  let noise: AudioBuffer | null = null;

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
    }
  };

  return {
    kick() {
      const c = options.sound().effects ? running() : null;
      if (c) glide(c, 160, 60, 0.12, 0.3);
    },
    cheer() {
      const c = crowd();
      if (!c) return;
      noiseBurst(c, 2.2, 1200, 0.3);
      noiseBurst(c, 2.0, 2600, 0.15);
    },
    clap() {
      const c = crowd();
      if (c) clapping(c, 6, 0.11, 0.25);
    },
    ohh() {
      const c = crowd();
      if (!c) return;
      if (!options.sound().ohh) {
        clapping(c, 5, 0.12, 0.2);
        return;
      }
      for (const f of [220, 262, 330]) glide(c, f, f * 0.8, OHH_SECONDS, 0.06);
      clapping(c, 5, 0.12, 0.2, OHH_SECONDS);
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

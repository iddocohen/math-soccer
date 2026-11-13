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
 * - Amendment 22 (FR-150 to FR-152): recorded clips for the whistle, the keeper's catch, the ball on the wall, the coin
 *   and the fanfare (effects), and for the firework, the confetti pop, the rain and the crowd murmur (crowd), each with
 *   a synthesized stand-in. `CLIP_SWITCH` names the switch of every clip. The rain and the murmur loop quietly while
 *   `ambience` wants them and the crowd switch is on.
 * - Browsers start audio suspended (amendment 17). iPad Safari and Silk on Fire tablets resume it only inside a user
 *   gesture that counts as one: a key press, a click, or the end of a touch, not the start of a touch (pointerdown).
 *   installUnlock listens to keydown, pointerup, touchend and click for the whole session. While the context is not
 *   running, each of these calls `resume()` synchronously in the handler and plays a one-sample silent buffer, so the
 *   gesture is not lost to an `await`. The clips are decoded beside it and never delay the resume. When the tab comes
 *   back into view, or the browser suspends or interrupts the context (a phone call, another app), the next gesture
 *   resumes it again. Until the context runs, every sound is skipped silently.
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
export type ClipName = 'kick' | 'cheer' | 'clap' | 'ohh' | 'whistle' | 'catch' | 'wall' | 'firework' | 'pop' | 'coin' | 'fanfare' | 'rain' | 'murmur';

/** The parent's switch that each clip follows (FR-059, FR-152): "Geräusche" (effects) or "Publikum" (crowd). */
export const CLIP_SWITCH: Record<ClipName, 'effects' | 'crowd'> = {
  kick: 'effects',
  whistle: 'effects',
  catch: 'effects',
  wall: 'effects',
  coin: 'effects',
  fanfare: 'effects',
  cheer: 'crowd',
  clap: 'crowd',
  ohh: 'crowd',
  firework: 'crowd',
  pop: 'crowd',
  rain: 'crowd',
  murmur: 'crowd',
};

export const MAX_GAIN = 0.35;
const CLIP_NAMES = Object.keys(CLIP_SWITCH) as ClipName[];
/** The loops play far below the other sounds: the murmur well below the cheer, the rain a little louder (FR-151). */
export const LOOP_GAIN = { murmur: 0.06, rain: 0.09 } as const;
export type LoopName = keyof typeof LOOP_GAIN;

/**
 * The loops a match wants (FR-151): the murmur while the match runs (not paused, not over), and the rain too while the
 * weather is rain. `sfx.ambience` still checks the crowd switch.
 */
export function matchAmbience(running: boolean, weather: string | undefined): Record<LoopName, boolean> {
  return { murmur: running, rain: running && weather === 'rain' };
}
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
  /** The referee's whistle at the start of a round and the end of a cup match or shootout (FR-150); an effect. */
  whistle(): void;
  /** The keeper catches the ball (FR-150); an effect. */
  keeperCatch(): void;
  /** The ball hits the wall in "Freistoß mit Mauer" (FR-150); an effect. */
  wallHit(): void;
  /** A confetti pop with the confetti goal effect and the cup's confetti (FR-150); a crowd sound. */
  pop(): void;
  /** A coin for an item bought in the locker room (FR-150); an effect. */
  coin(): void;
  /** A short fanfare for an unlocked game mode and the cup lift (FR-150); an effect. */
  fanfare(): void;
  /**
   * The quiet loops under a match (FR-151): the crowd murmur and the rain. Each plays while it is wanted here and the
   * crowd switch is on, and stops otherwise. Call it whenever the match, the pause, the weather or the switches change.
   */
  ambience(want: Record<LoopName, boolean>): void;
  /**
   * Creates the audio context and, while it is not running, calls `resume()` and plays a silent buffer at once; then
   * decodes the clips once. Call it synchronously from a user gesture. Resolves when the resume and the decoding end.
   */
  unlock(): Promise<void>;
  /**
   * Unlocks on every key press, click or end of a touch on `target` while the context is not running, and when the page
   * comes back into view; returns a function that removes the listeners.
   */
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

  /** The one gain node every clip plays through, at MAX_GAIN; made with the first clip of its context. */
  let clipGain: { context: AudioContextLike; node: ReturnType<AudioContextLike['createGain']> } | null = null;
  const clipOutput = (c: AudioContextLike) => {
    if (clipGain === null || clipGain.context !== c) {
      const node = c.createGain();
      node.gain.setValueAtTime(MAX_GAIN, c.currentTime);
      node.connect(c.destination);
      clipGain = { context: c, node };
    }
    return clipGain.node;
  };

  /** Plays a decoded clip at MAX_GAIN after `delay` seconds; false when the clip is not decoded. */
  const playClip =(c: AudioContextLike, name: ClipName, delay = 0): boolean => {
    const buffer = decoded.get(name);
    if (!buffer) return false;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(clipOutput(c));
    src.start(c.currentTime + delay);
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

  /** A one-sample silent sound: iOS Safari starts the context's output only once a sound starts inside a gesture. */
  const playSilence = (c: AudioContextLike) => {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start(0);
  };

  const unlock = (): Promise<void> => {
    let resumed: Promise<void> = Promise.resolve();
    try {
      ctx ??= make();
      if (ctx.state !== 'running') {
        // Both calls run synchronously in the gesture's handler; awaiting anything first would lose the gesture.
        resumed = ctx.resume();
        playSilence(ctx);
      }
    } catch {
      // No Web Audio here: the game stays silent.
      ctx = null;
      return Promise.resolve();
    }
    const c = ctx;
    return Promise.all([
      resumed.catch(() => {
        // Refused outside a gesture: the next key press or tap tries again.
      }),
      loadClips(c),
    ]).then(() => {
      // The loops wanted before audio ran start now, and a synthesized loop gives way to its decoded clip.
      for (const [name, loop] of loops) if (loop.synthesized && decoded.has(name)) stopLoop(name);
      applyAmbience();
    });
  };

  /** A crowd singing one tone: three slightly detuned voices that swell in and fade out. */
  const voice = (c: AudioContextLike, pitch: number, length: number, delay: number) => {
    const t = c.currentTime + delay;
    // One envelope for the three voices: a gain node scales the sum as it would scale each voice.
    const g = c.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(0.05, t + length * 0.2);
    g.gain.linearRampToValueAtTime(SILENT, t + length);
    g.connect(c.destination);
    for (const detune of [0.985, 1, 1.02]) {
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

  /** A plain tone of `type` at `frequency` for `duration`, starting after `delay`, with a quick fade in and out. */
  const tone = (c: AudioContextLike, frequency: number, duration: number, peak: number, delay = 0, type: OscillatorType = 'triangle') => {
    const t = c.currentTime + delay;
    const g = c.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(Math.min(peak, MAX_GAIN), t + 0.01);
    g.gain.linearRampToValueAtTime(SILENT, t + duration);
    g.connect(c.destination);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(frequency, t);
    o.connect(g);
    o.start(t);
    o.stop(t + duration + 0.05);
  };

  /** The context when the switch of `name` is on and audio runs; null otherwise. */
  const gate = (name: ClipName): AudioContextLike | null => (options.sound()[CLIP_SWITCH[name]] ? running() : null);

  /** The synthesized pops and crackle of fireworks, also the fallback of the firework clip. */
  const synthFireworks = (c: AudioContextLike) => {
    for (const [i, at] of [0, 0.45, 0.8, 1.3].entries()) {
      // A low pop, then a short crackle.
      noiseBurst(c, 0.18, 300 + i * 60, 0.3, at);
      noiseBurst(c, 0.5, 4200, 0.08, at + 0.12);
    }
  };

  /** The synthesized stand-in of each loop: band-passed noise, low for the murmur and high for the rain. */
  const LOOP_NOISE: Record<LoopName, number> = { murmur: 450, rain: 5200 };
  /** The playing loops: their source and gain, so a loop can stop. */
  const loops = new Map<LoopName, { src: AudioBufferSourceNode; gain: GainNode; synthesized: boolean }>();
  let wanted: Record<LoopName, boolean> = { murmur: false, rain: false };

  const startLoop = (c: AudioContextLike, name: LoopName) => {
    const t = c.currentTime;
    const g = c.createGain();
    // A short fade in, so the loop never starts with a click.
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(LOOP_GAIN[name], t + 0.4);
    g.connect(c.destination);
    const src = c.createBufferSource();
    src.loop = true;
    const clip = decoded.get(name);
    if (clip) {
      src.buffer = clip;
      src.connect(g);
    } else {
      src.buffer = noiseBuffer(c);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(LOOP_NOISE[name], t);
      f.Q.setValueAtTime(0.7, t);
      f.connect(g);
      src.connect(f);
    }
    src.start(t);
    loops.set(name, { src: src as AudioBufferSourceNode, gain: g as GainNode, synthesized: !clip });
  };

  const stopLoop = (name: LoopName) => {
    const loop = loops.get(name);
    if (!loop) return;
    loops.delete(name);
    try {
      loop.src.stop();
      loop.gain.disconnect();
    } catch {
      // Already stopped: nothing more to do.
    }
  };

  /** Starts the loops that are wanted and allowed, and stops the others. */
  const applyAmbience = () => {
    const c = options.sound().crowd ? running() : null;
    for (const name of Object.keys(LOOP_GAIN) as LoopName[]) {
      const on = c !== null && wanted[name];
      if (on && !loops.has(name)) startLoop(c, name);
      else if (!on) stopLoop(name);
    }
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
      const c = gate('firework');
      if (c && !playClip(c, 'firework')) synthFireworks(c);
    },
    whistle() {
      const c = gate('whistle');
      if (!c || playClip(c, 'whistle')) return;
      // Two short high blows, square for the whistle's edge.
      tone(c, 2750, 0.18, 0.12, 0, 'square');
      tone(c, 2750, 0.45, 0.12, 0.25, 'square');
    },
    keeperCatch() {
      const c = gate('catch');
      if (c && !playClip(c, 'catch')) noiseBurst(c, 0.12, 700, 0.3);
    },
    wallHit() {
      const c = gate('wall');
      if (!c || playClip(c, 'wall')) return;
      glide(c, 140, 55, 0.16, 0.3);
      noiseBurst(c, 0.08, 500, 0.2);
    },
    pop() {
      const c = gate('pop');
      if (!c || playClip(c, 'pop')) return;
      noiseBurst(c, 0.06, 1500, 0.3);
      noiseBurst(c, 0.3, 4500, 0.08, 0.05);
    },
    coin() {
      const c = gate('coin');
      if (!c || playClip(c, 'coin')) return;
      tone(c, 988, 0.08, 0.15, 0, 'square');
      tone(c, 1319, 0.3, 0.15, 0.08, 'square');
    },
    fanfare() {
      const c = gate('fanfare');
      if (!c || playClip(c, 'fanfare')) return;
      // C, E, G and the high C, the last one held.
      [523, 659, 784].forEach((f, i) => tone(c, f, 0.16, 0.2, i * 0.14));
      tone(c, 1047, 0.6, 0.2, 0.42);
    },
    ambience(want) {
      wanted = { ...want };
      applyAmbience();
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
      // pointerdown is left out: on a touch screen it does not count as a gesture, so a resume there stays suspended.
      const gestures = ['keydown', 'pointerup', 'touchend', 'click'];
      const onGesture = () => {
        if (!ctx || ctx.state !== 'running') void unlock();
      };
      const onVisible = () => {
        const visibility = (target as Partial<Document>).visibilityState;
        if (ctx && ctx.state !== 'running' && (visibility === undefined || visibility === 'visible')) void unlock();
      };
      gestures.forEach((e) => target.addEventListener(e, onGesture));
      target.addEventListener('visibilitychange', onVisible);
      return () => {
        gestures.forEach((e) => target.removeEventListener(e, onGesture));
        target.removeEventListener('visibilitychange', onVisible);
      };
    },
  };
}

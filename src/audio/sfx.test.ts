// Adapted from math-tank src/audio/sfx.test.ts.
import { describe, expect, it } from 'vitest';
import { chantPattern } from '../core/cup/chant';
import { createSfx, MAX_GAIN, OHH_CLIP_SECONDS, OHH_SECONDS, type AudioContextLike, type ClipName, type SoundSwitches } from './sfx';

/** Minimal Web Audio stand-in that records started sources and gain values. */
function fakeContext(decode: (data: ArrayBuffer) => Promise<AudioBuffer> = () => Promise.reject(new Error('no decoder'))) {
  const started: Array<{ kind: 'osc' | 'noise'; at: number; type?: string; buffer?: unknown }> = [];
  const gains: number[] = [];
  const silent: number[] = [];
  let state: AudioContextState = 'suspended';
  const param = (log: number[]) => ({
    value: 0,
    setValueAtTime(v: number) {
      log.push(v);
      return this;
    },
    linearRampToValueAtTime(v: number) {
      log.push(v);
      return this;
    },
    exponentialRampToValueAtTime(v: number) {
      log.push(v);
      return this;
    },
  });
  const node = () => ({ connect: (n: unknown) => n, disconnect() {} });
  const ctx = {
    get state() {
      return state;
    },
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    resume: async () => {
      state = 'running';
    },
    createGain: () => ({ ...node(), gain: param(gains) }),
    createOscillator: () => {
      const o = { ...node(), type: 'sine', frequency: param([]), start: (at: number) => started.push({ kind: 'osc', at, type: o.type }), stop() {} };
      return o;
    },
    createBuffer: (_c: number, length: number) => ({ length, getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => {
      const src = {
        ...node(),
        buffer: null as unknown,
        // The one-sample silent buffer of the unlock is counted apart from the sounds.
        start: (at: number) => ((src.buffer as { length?: number } | null)?.length === 1 ? silent.push(at) : started.push({ kind: 'noise', at, buffer: src.buffer })),
        stop() {},
      };
      return src;
    },
    decodeAudioData: decode,
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param([]), Q: param([]) }),
  };
  return { ctx: ctx as unknown as AudioContextLike, started, gains, silent };
}

/**
 * A context that behaves like iPad Safari and Silk: `resume()` runs it only when called during a gesture (`gesture`
 * dispatches an event with the flag set, as a browser does); outside one the promise stays pending and the context stays
 * suspended. `interrupt` puts it back into "interrupted", as a phone call or a hidden tab does.
 */
function tabletContext() {
  const f = fakeContext();
  let state: string = 'suspended';
  let inGesture = false;
  const resumes: boolean[] = [];
  Object.defineProperty(f.ctx, 'state', { get: () => state });
  Object.defineProperty(f.ctx, 'resume', {
    value: () => {
      resumes.push(inGesture);
      if (!inGesture) return new Promise<void>(() => {});
      state = 'running';
      return Promise.resolve();
    },
  });
  const gesture = (target: EventTarget, type: string) => {
    inGesture = true;
    target.dispatchEvent(new Event(type));
    inGesture = false;
  };
  return { ...f, resumes, gesture, interrupt: () => (state = 'interrupted') };
}

function setupTablet(options: { fetchClip?: (url: string) => Promise<ArrayBuffer> } = {}) {
  const f = tabletContext();
  const sfx = createSfx({
    sound: () => ({ effects: true, crowd: true, ohh: true }),
    createContext: () => f.ctx,
    clips: options.fetchClip ? (name) => `/assets/${name}.mp3` : undefined,
    fetchClip: options.fetchClip,
  });
  const target = new EventTarget();
  const remove = sfx.installUnlock(target);
  return { f, sfx, target, remove, gesture: f.gesture, interrupt: f.interrupt };
}

function setup(sound: Partial<SoundSwitches> = {}) {
  const f = fakeContext();
  const switches: SoundSwitches = { effects: true, crowd: true, ohh: true, ...sound };
  const sfx = createSfx({ sound: () => switches, createContext: () => f.ctx });
  return { f, sfx, switches };
}

describe('sfx', () => {
  it('plays nothing before the first key or tap unlocks audio', () => {
    const { f, sfx } = setup();
    sfx.kick();
    sfx.cheer();
    sfx.clap();
    sfx.ohh();
    expect(f.started).toEqual([]);
  });

  it('plays kick, cheer, clap and ohh after unlock', async () => {
    const { f, sfx } = setup();
    await sfx.unlock();
    sfx.kick();
    expect(f.started).toEqual([{ kind: 'osc', at: 0, type: 'triangle' }]);
    sfx.cheer();
    sfx.clap();
    expect(f.started.filter((s) => s.kind === 'noise')).toHaveLength(2 + 6);
  });

  it('ohh plays three triangle tones, then clapping after the tones', async () => {
    const { f, sfx } = setup();
    await sfx.unlock();
    sfx.ohh();
    const tones = f.started.filter((s) => s.kind === 'osc');
    const claps = f.started.filter((s) => s.kind === 'noise');
    expect(tones).toHaveLength(3);
    expect(tones.every((t) => t.type === 'triangle' && t.at === 0)).toBe(true);
    expect(claps.length).toBeGreaterThan(0);
    expect(Math.min(...claps.map((c) => c.at))).toBeGreaterThanOrEqual(OHH_SECONDS);
  });

  it('with sound.ohh off, ohh plays the clapping alone', async () => {
    const { f, sfx } = setup({ ohh: false });
    await sfx.unlock();
    sfx.ohh();
    expect(f.started.filter((s) => s.kind === 'osc')).toEqual([]);
    expect(f.started.filter((s) => s.kind === 'noise').length).toBeGreaterThan(0);
  });

  it('sound.effects off silences the kick only', async () => {
    const { f, sfx } = setup({ effects: false });
    await sfx.unlock();
    sfx.kick();
    expect(f.started).toEqual([]);
    sfx.clap();
    expect(f.started.length).toBeGreaterThan(0);
  });

  it('sound.crowd off silences cheer, clap and ohh, and a change applies at once', async () => {
    const { f, sfx, switches } = setup({ crowd: false });
    await sfx.unlock();
    sfx.cheer();
    sfx.clap();
    sfx.ohh();
    expect(f.started).toEqual([]);
    sfx.kick();
    expect(f.started).toHaveLength(1);
    switches.crowd = true;
    sfx.clap();
    expect(f.started.length).toBeGreaterThan(1);
  });

  it('never goes above MAX_GAIN', async () => {
    const { f, sfx } = setup();
    await sfx.unlock();
    sfx.kick();
    sfx.cheer();
    sfx.clap();
    sfx.ohh();
    expect(Math.max(...f.gains)).toBeLessThanOrEqual(MAX_GAIN);
  });

  it('chant sings three voices per name tone and claps on its beats; fireworks pop; both stay below MAX_GAIN (FR-110)', async () => {
    const { f, sfx } = setup();
    await sfx.unlock();
    sfx.chant('LEO');
    const voices = chantPattern('LEO').filter((b) => b.kind === 'voice');
    const claps = chantPattern('LEO').filter((b) => b.kind === 'clap');
    expect(f.started.filter((s) => s.kind === 'osc')).toHaveLength(voices.length * 3);
    expect(f.started.filter((s) => s.kind === 'noise').map((s) => s.at)).toEqual(claps.map((c) => c.at));
    sfx.fireworks();
    expect(f.started.filter((s) => s.kind === 'noise').length).toBeGreaterThan(claps.length);
    expect(Math.max(...f.gains)).toBeLessThanOrEqual(MAX_GAIN);
  });

  it('sound.crowd off silences the chant and the fireworks', async () => {
    const { f, sfx } = setup({ crowd: false });
    await sfx.unlock();
    sfx.chant('LEO');
    sfx.fireworks();
    expect(f.started).toEqual([]);
  });

  it('installUnlock resumes audio on a key press', async () => {
    const { f, sfx } = setup();
    const target = new EventTarget();
    sfx.installUnlock(target);
    target.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    await Promise.resolve();
    sfx.kick();
    expect(f.started).toHaveLength(1);
  });

  describe('unlock on iPad and Fire tablets (amendment 17)', () => {
    it('stays suspended until a gesture; the start of a touch is not one, its end resumes at once', () => {
      const t = setupTablet();
      t.gesture(t.target, 'pointerdown');
      t.sfx.kick();
      expect(t.f.resumes).toEqual([]);
      expect(t.f.started).toEqual([]);
      t.gesture(t.target, 'touchend');
      expect(t.f.resumes).toEqual([true]);
      expect(t.f.silent).toEqual([0]);
      t.sfx.kick();
      expect(t.f.started).toHaveLength(1);
    });

    it.each(['pointerup', 'click', 'keydown'])('resumes synchronously on %s', (type) => {
      const t = setupTablet();
      t.gesture(t.target, type);
      expect(t.f.resumes).toEqual([true]);
      t.sfx.cheer();
      expect(t.f.started.length).toBeGreaterThan(0);
    });

    it('a resume refused outside a gesture keeps the listeners, and the next tap unlocks', () => {
      const t = setupTablet();
      void t.sfx.unlock();
      expect(t.f.resumes).toEqual([false]);
      t.sfx.kick();
      expect(t.f.started).toEqual([]);
      t.gesture(t.target, 'touchend');
      expect(t.f.resumes).toEqual([false, true]);
      t.sfx.kick();
      expect(t.f.started).toHaveLength(1);
    });

    it('resumes before the clips are decoded, and plays the synthesized sounds meanwhile', () => {
      const t = setupTablet({ fetchClip: () => new Promise<ArrayBuffer>(() => {}) });
      t.gesture(t.target, 'touchend');
      expect(t.f.resumes).toEqual([true]);
      t.sfx.kick();
      expect(t.f.started).toEqual([{ kind: 'osc', at: 0, type: 'triangle' }]);
    });

    it('resumes again on the next tap after an interruption, and calls resume only while not running', () => {
      const t = setupTablet();
      t.gesture(t.target, 'touchend');
      t.gesture(t.target, 'touchend');
      expect(t.f.resumes).toEqual([true]);
      t.interrupt();
      t.sfx.kick();
      expect(t.f.started).toEqual([]);
      t.gesture(t.target, 'touchend');
      expect(t.f.resumes).toEqual([true, true]);
      t.sfx.kick();
      expect(t.f.started).toHaveLength(1);
    });

    it('tries to resume when the page comes back into view, and the removed listeners do nothing', () => {
      const t = setupTablet();
      t.target.dispatchEvent(new Event('visibilitychange'));
      // Not created yet: nothing to resume before the first gesture.
      expect(t.f.resumes).toEqual([]);
      t.gesture(t.target, 'touchend');
      t.interrupt();
      t.gesture(t.target, 'visibilitychange');
      expect(t.f.resumes).toEqual([true, true]);
      t.interrupt();
      t.remove();
      t.gesture(t.target, 'touchend');
      expect(t.f.resumes).toEqual([true, true]);
    });
  });

  it('stays silent when Web Audio is missing', async () => {
    const sfx = createSfx({
      sound: () => ({ effects: true, crowd: true, ohh: true }),
      createContext: () => {
        throw new Error('no audio');
      },
    });
    await sfx.unlock();
    expect(() => sfx.kick()).not.toThrow();
  });

  describe('recorded clips', () => {
    /** A decoded clip stands in as an object that names it; the fetch returns the clip's name as bytes. */
    const clipOf = (name: ClipName) => ({ clip: name }) as unknown as AudioBuffer;
    const nameOf = (data: ArrayBuffer) => new TextDecoder().decode(data) as ClipName;

    function setupClips(sound: Partial<SoundSwitches> = {}, broken: ClipName[] = []) {
      const f = fakeContext(async (data) => {
        const name = nameOf(data);
        if (broken.includes(name)) throw new Error(`cannot decode ${name}`);
        return clipOf(name);
      });
      const switches: SoundSwitches = { effects: true, crowd: true, ohh: true, ...sound };
      const fetched: string[] = [];
      const sfx = createSfx({
        sound: () => switches,
        createContext: () => f.ctx,
        clips: (name) => `/assets/${name}.mp3`,
        fetchClip: async (url) => {
          fetched.push(url);
          const name = url.slice('/assets/'.length, -'.mp3'.length);
          return new TextEncoder().encode(name).buffer as ArrayBuffer;
        },
      });
      const clips = () => f.started.flatMap((s) => (s.buffer && typeof s.buffer === 'object' && 'clip' in s.buffer ? [{ clip: (s.buffer as { clip: ClipName }).clip, at: s.at }] : []));
      return { f, sfx, switches, fetched, clips };
    }

    it('fetches and decodes every clip once, after the first unlock', async () => {
      const { sfx, fetched } = setupClips();
      expect(fetched).toEqual([]);
      await sfx.unlock();
      await sfx.unlock();
      expect([...fetched].sort()).toEqual(['/assets/cheer.mp3', '/assets/clap.mp3', '/assets/kick.mp3', '/assets/ohh.mp3']);
    });

    it('plays the recorded kick, cheer and clapping instead of the synthesized sounds', async () => {
      const { f, sfx, clips } = setupClips();
      await sfx.unlock();
      sfx.kick();
      sfx.cheer();
      sfx.clap();
      expect(clips().map((c) => c.clip)).toEqual(['kick', 'cheer', 'clap']);
      expect(f.started.filter((s) => s.kind === 'osc')).toEqual([]);
      expect(f.started).toHaveLength(3);
      expect(Math.max(...f.gains)).toBeLessThanOrEqual(MAX_GAIN);
    });

    it('plays the recorded "ohhh", then the recorded clapping; with sound.ohh off the clapping alone', async () => {
      const on = setupClips();
      await on.sfx.unlock();
      on.sfx.ohh();
      expect(on.clips()).toEqual([
        { clip: 'ohh', at: 0 },
        { clip: 'clap', at: OHH_CLIP_SECONDS },
      ]);
      const off = setupClips({ ohh: false });
      await off.sfx.unlock();
      off.sfx.ohh();
      expect(off.clips()).toEqual([{ clip: 'clap', at: 0 }]);
    });

    it('the switches still gate every clip', async () => {
      const { sfx, switches, clips } = setupClips({ effects: false, crowd: false });
      await sfx.unlock();
      sfx.kick();
      sfx.cheer();
      sfx.clap();
      sfx.ohh();
      expect(clips()).toEqual([]);
      switches.effects = true;
      sfx.kick();
      expect(clips().map((c) => c.clip)).toEqual(['kick']);
    });

    it('falls back to the synthesized sound for a clip that fails to decode', async () => {
      const { f, sfx, clips } = setupClips({}, ['kick', 'ohh']);
      await sfx.unlock();
      sfx.kick();
      expect(f.started).toEqual([{ kind: 'osc', at: 0, type: 'triangle' }]);
      sfx.ohh();
      // The synthesized "ohhh" tones, then the recorded clapping after them.
      expect(f.started.filter((s) => s.kind === 'osc')).toHaveLength(1 + 3);
      expect(clips()).toEqual([{ clip: 'clap', at: OHH_SECONDS }]);
    });

    it('falls back to the synthesized sounds when the clips cannot be fetched', async () => {
      const f = fakeContext();
      const sfx = createSfx({
        sound: () => ({ effects: true, crowd: true, ohh: true }),
        createContext: () => f.ctx,
        clips: (name) => `/assets/${name}.mp3`,
        fetchClip: () => Promise.reject(new Error('offline')),
      });
      await sfx.unlock();
      sfx.cheer();
      sfx.clap();
      expect(f.started.filter((s) => s.kind === 'noise')).toHaveLength(2 + 6);
    });
  });
});

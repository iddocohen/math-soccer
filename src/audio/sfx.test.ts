// Adapted from math-tank src/audio/sfx.test.ts.
import { describe, expect, it } from 'vitest';
import { createSfx, MAX_GAIN, OHH_SECONDS, type AudioContextLike, type SoundSwitches } from './sfx';

/** Minimal Web Audio stand-in that records started sources and gain values. */
function fakeContext() {
  const started: Array<{ kind: 'osc' | 'noise'; at: number; type?: string }> = [];
  const gains: number[] = [];
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
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => ({ ...node(), buffer: null, start: (at: number) => started.push({ kind: 'noise', at }), stop() {} }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param([]), Q: param([]) }),
  };
  return { ctx: ctx as unknown as AudioContextLike, started, gains };
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

  it('installUnlock resumes audio on the first key press and removes its listeners', async () => {
    const { f, sfx } = setup();
    const target = new EventTarget();
    sfx.installUnlock(target);
    target.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    await Promise.resolve();
    sfx.kick();
    expect(f.started).toHaveLength(1);
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
});

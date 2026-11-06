// Copied from math-tank src/audio/speaker.test.ts.
import { describe, expect, it } from 'vitest';
import { createSpeaker, type SpeechLike } from './speaker';

interface Spoken {
  text: string;
  lang: string;
  voice: string | null;
}

/** A stand-in for window.speechSynthesis that records what is spoken and cancelled. */
function fakeSpeech(voices: Array<{ lang: string; name: string; localService?: boolean }>) {
  const log: Array<Spoken | 'cancel'> = [];
  const synth = {
    getVoices: () => voices as unknown as SpeechSynthesisVoice[],
    speak: (u: SpeechSynthesisUtterance) => log.push({ text: u.text, lang: u.lang, voice: u.voice?.name ?? null }),
    cancel: () => log.push('cancel'),
  };
  class Utterance {
    text: string;
    lang = '';
    voice: SpeechSynthesisVoice | null = null;
    rate = 1;
    constructor(text: string) {
      this.text = text;
    }
  }
  const speech: SpeechLike = { synth, Utterance: Utterance as unknown as typeof SpeechSynthesisUtterance };
  return { speech, log };
}

describe('Speaker (FR-032, as math-tank)', () => {
  it('is not available when the browser has no speech API', () => {
    const speaker = createSpeaker(null);
    expect(speaker.available).toBe(false);
    // Speaking then does nothing and throws nothing.
    speaker.speak('Welche Zahl fehlt?');
    speaker.prime();
  });

  it('is not available without a German voice', () => {
    const { speech, log } = fakeSpeech([{ lang: 'en-US', name: 'Samantha' }]);
    const speaker = createSpeaker(speech);
    expect(speaker.available).toBe(false);
    speaker.speak('Welche Zahl fehlt?');
    expect(log).toEqual([]);
  });

  it('is available with a German voice and speaks with lang de-DE and that voice, cancelling earlier speech', () => {
    const { speech, log } = fakeSpeech([
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'de_DE', name: 'Anna' },
    ]);
    const speaker = createSpeaker(speech);
    expect(speaker.available).toBe(true);
    speaker.speak('Welche Zahl fehlt?');
    speaker.speak('Welche Zahl kommt hier?');
    expect(log).toEqual(['cancel', { text: 'Welche Zahl fehlt?', lang: 'de-DE', voice: 'Anna' }, 'cancel', { text: 'Welche Zahl kommt hier?', lang: 'de-DE', voice: 'Anna' }]);
  });

  it('notices a German voice that loads later (voices arrive asynchronously in Chrome)', () => {
    const voices: Array<{ lang: string; name: string }> = [];
    const { speech } = fakeSpeech(voices);
    const speaker = createSpeaker(speech);
    expect(speaker.available).toBe(false);
    voices.push({ lang: 'de-AT', name: 'Lisa' });
    expect(speaker.available).toBe(true);
  });

  it('prime() speaks a short greeting, so tablet browsers allow speech after the start tap', () => {
    const { speech, log } = fakeSpeech([{ lang: 'de-DE', name: 'Anna' }]);
    createSpeaker(speech).prime();
    const spoken = log.filter((e): e is Spoken => e !== 'cancel');
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.text.length).toBeGreaterThan(0);
    expect(spoken[0]!.text.split(' ').length).toBeLessThanOrEqual(3);
    expect(spoken[0]!.lang).toBe('de-DE');
  });

  it('prefers a German voice on the device to a network voice, so no task text leaves the device (review R7)', () => {
    const { speech, log } = fakeSpeech([
      { lang: 'de-DE', name: 'Google Deutsch', localService: false },
      { lang: 'de-DE', name: 'Anna', localService: true },
    ]);
    createSpeaker(speech).speak('Welche Zahl fehlt?');
    expect(log).toContainEqual({ text: 'Welche Zahl fehlt?', lang: 'de-DE', voice: 'Anna' });
  });
});

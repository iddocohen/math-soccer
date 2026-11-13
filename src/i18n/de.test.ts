import { describe, expect, it } from 'vitest';
import { de } from './de';
import { CHILD_SECTIONS, forbiddenWords, hasForbiddenWord, resetMessage } from './index';

/** Sample arguments for texts that take numbers or words. */
const SAMPLES: Array<Array<number | string>> = [[1], [56], [0, 1], [8, 340000], [1, 100], [3, 10]];

/** Every string in a section, with its path; functions are called with sample arguments. */
function collect(value: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof value === 'string') out.push({ path, text: value });
  else if (typeof value === 'function') {
    for (const args of SAMPLES) out.push({ path: `${path}(${args.join(', ')})`, text: String((value as (...a: unknown[]) => unknown)(...args)) });
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, v] of Object.entries(value)) collect(v, `${path}.${key}`, out);
  }
}

function childTexts(): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  for (const section of CHILD_SECTIONS) collect(de[section], section, out);
  return out;
}

describe('child texts (FR-023)', () => {
  it('the forbidden list is "falsch", "verloren", "Fehler" and "schlecht"', () => {
    expect([...forbiddenWords]).toEqual(['falsch', 'verloren', 'Fehler', 'schlecht']);
  });

  it('contain none of the forbidden words, case-insensitive and inside compounds', () => {
    const texts = childTexts();
    expect(texts.length).toBeGreaterThan(50);
    expect(texts.filter(({ text }) => hasForbiddenWord(text)).map(({ path, text }) => `${path}: ${text}`)).toEqual([]);
  });

  it('the check catches a forbidden word inside a compound', () => {
    expect(hasForbiddenWord('Schussfehler')).toBe(true);
    expect(hasForbiddenWord('FALSCH')).toBe(true);
    expect(hasForbiddenWord('Nochmal!')).toBe(false);
  });
});

describe('texts from contracts/screens.md', () => {
  it('start screen and match', () => {
    expect(de.start.play).toBe('Spielen');
    expect(de.start.timeChallenge).toBe('Zeit-Challenge');
    expect(de.start.lockerRoom).toBe('Kabine');
  });

  it('feedback lines', () => {
    expect(de.feedback.goal).toBe('TOR!');
    expect(de.feedback.miss(56)).toBe('Hier ist 56. Nochmal!');
    expect(de.feedback.outOfRange(1, 100)).toBe('Zahlen von 1 bis 100');
    expect(de.feedback.heartLost).toBe("Weiter geht's!");
  });

  it('round end', () => {
    expect(de.roundEnd.summary(8, 340000)).toBe('8 Tore in 5:40');
    expect(de.roundEnd.summary(1, 5000)).toBe('1 Tor in 0:05');
    expect(de.roundEnd.newRecord).toBe('Neuer Rekord!');
    expect(de.roundEnd.record(9)).toBe('Dein Rekord: 9');
    expect(de.roundEnd.again).toBe('Nochmal');
    expect(de.roundEnd.back).toBe('Zurück');
    expect(de.roundEnd.updateWaiting).toBe('Neue Version, startet gleich');
  });

  it('parent gate, settings groups, progress and locker room', () => {
    expect([de.parent.settings, de.parent.progress]).toEqual(['Einstellungen', 'Fortschritt']);
    expect(Object.values(de.settings.groups)).toEqual([
      'Zahlenraum',
      'Hinweise',
      'Formen',
      'Runde',
      'Zeit-Challenge',
      'Pokal',
      'Schwierigkeit',
      'Ton',
      'Bedienung',
      'Kabine',
      'Daten',
    ]);
    expect([de.settings.data.export, de.settings.data.import]).toEqual(['Daten sichern', 'Daten laden']);
    expect(de.progressPage.columns.mastered).toBe('gemeistert');
    expect(Object.values(de.levels.names)).toEqual(['Gerade Linien', 'Schräge Linien', 'Formen', 'Formen mit 2 Lücken', 'X-Form', 'Ausschnitte']);
    expect(de.feedback.levelUp(de.levels.names[2])).toBe('Neue Stufe: Schräge Linien!');
    expect(Object.values(de.settings.options.shapes)).toEqual(['Stab', 'Quadrat', 'T', 'L', 'J', 'S', 'Z']);
    expect(Object.values(de.lockerRoom.groups)).toEqual(['Ball', 'Trikot', 'Nummer und Name', 'Fans', 'Jubel', 'Pokale']);
    expect(de.lockerRoom.stillNeeded(5)).toBe('noch 5 Sterne');
  });
});

describe('resetMessage (FR-036)', () => {
  it('gives a note for each reset reason and none without a reset', () => {
    expect(resetMessage('none')).toBeNull();
    expect(resetMessage('invalid')).toBe(de.storage.reset.invalid);
    expect(resetMessage('newer')).toBe(de.storage.reset.newer);
    expect(resetMessage('unavailable')).toBe(de.storage.reset.unavailable);
  });
});

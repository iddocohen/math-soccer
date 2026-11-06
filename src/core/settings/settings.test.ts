import { describe, expect, it } from 'vitest';
import { parseSettings } from '../storage/migrate';
import { CHALLENGE_MINUTES, defaultSettings, MISSES_PER_HEART } from './defaults';
import { settingsSchema, type Settings } from './schema';
import { validateSettings, type SettingsErrorKey } from './validate';

function withChanges(change: (s: Settings) => void): Settings {
  const s = defaultSettings();
  change(s);
  return s;
}

function keys(s: Settings): SettingsErrorKey[] {
  return validateSettings(s).map((e) => e.key);
}

describe('defaultSettings (data-model "Settings", defaults as listed)', () => {
  it('passes the schema and every rule', () => {
    expect(settingsSchema.safeParse(defaultSettings()).success).toBe(true);
    expect(validateSettings(defaultSettings())).toEqual([]);
  });

  it('has the listed values', () => {
    const s = defaultSettings();
    expect(s.version).toBe(1);
    expect(s.range).toEqual({ preset: '1-100', min: 1, max: 100 });
    expect(s).not.toHaveProperty('modes');
    expect(s).not.toHaveProperty('lineLength');
    expect(s.hintDisplay).toBe('always');
    expect(s.hintDistance).toEqual({ direct: true, vertical: true, diagonal: true, far: true });
    expect(s).not.toHaveProperty('directions');
    expect(s).not.toHaveProperty('patterns');
    expect(s.levels).toEqual({ start: 1, hardest: 5 });
    expect(s.shapes).toEqual({ I: true, O: true, T: true, L: true, J: true, S: true, Z: true });
    expect(s.timeChallenge).toEqual({ allowed: true, minutes: 2 });
    expect(s.roundType).toBe('untilHearts');
    expect(s.goalsPerRound).toBe(10);
    expect(s.difficulty).toBe('easy');
    expect(s.adaptive).toBe(true);
    expect(s.sound).toEqual({ effects: true, crowd: true, ohh: true, speech: false });
    expect(s.numberPad).toBe('auto');
    expect(s.showClock).toBe(false);
    expect(s.showRecords).toBe(true);
    expect(s.lockerRoom).toBe(true);
    expect(s.pointAfterFullHelp).toBe(true);
    expect(s.rowColumnHelper).toBe(true);
  });

  it('returns a new object on every call', () => {
    const a = defaultSettings();
    a.shapes.L = false;
    expect(defaultSettings().shapes.L).toBe(true);
  });
});

describe('difficulty: "misses per heart: 5, 4, 3"', () => {
  it('maps easy, normal, challenging to 5, 4, 3', () => {
    expect(MISSES_PER_HEART).toEqual({ easy: 5, normal: 4, challenging: 3 });
  });
});

describe('range: "integers, `0 <= min < max <= 1000`, `max - min >= 9`"', () => {
  const custom = (min: number, max: number) => withChanges((s) => (s.range = { preset: 'custom', min, max }));

  it('accepts the edges', () => {
    expect(keys(custom(0, 9))).toEqual([]);
    expect(keys(custom(991, 1000))).toEqual([]);
    expect(keys(custom(0, 1000))).toEqual([]);
  });

  it('refuses numbers that are not integers', () => {
    expect(keys(custom(1.5, 100))).toEqual(['rangeNotInteger']);
  });

  it('refuses min below 0 and max above 1000', () => {
    expect(keys(custom(-1, 100))).toContain('rangeOutside');
    expect(keys(custom(1, 1001))).toContain('rangeOutside');
  });

  it('refuses min >= max', () => {
    expect(keys(custom(50, 50))).toContain('rangeOrder');
    expect(keys(custom(60, 50))).toContain('rangeOrder');
  });

  it('refuses max - min below 9', () => {
    expect(keys(custom(1, 9))).toEqual(['rangeSpan']);
  });

  it('refuses a preset whose min and max do not match it', () => {
    expect(keys(withChanges((s) => (s.range = { preset: '1-100', min: 0, max: 100 })))).toEqual(['rangePresetMismatch']);
    expect(keys(withChanges((s) => (s.range = { preset: '0-1000', min: 0, max: 1000 })))).toEqual([]);
  });
});

describe('levels (FR-085)', () => {
  it('refuses a start level above the hardest level', () => {
    expect(keys(withChanges((s) => (s.levels = { start: 3, hardest: 2 })))).toEqual(['levelOrder']);
    expect(keys(withChanges((s) => (s.levels = { start: 2, hardest: 2 })))).toEqual([]);
  });

  it('allows every shape off, which skips levels 3 and 4, unless the range holds only those levels', () => {
    const none = { I: false, O: false, T: false, L: false, J: false, S: false, Z: false };
    expect(keys(withChanges((s) => (s.shapes = none)))).toEqual([]);
    expect(keys(withChanges((s) => ((s.shapes = none), (s.levels = { start: 3, hardest: 4 }))))).toEqual(['noLevel']);
    expect(keys(withChanges((s) => ((s.shapes = { ...none, L: true }), (s.levels = { start: 3, hardest: 4 }))))).toEqual([]);
  });

  it('refuses a level outside 1 to 5 in stored settings', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), levels: { start: 0, hardest: 5 } }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultSettings(), levels: { start: 1, hardest: 6 } }).success).toBe(false);
  });
});

describe('"at least one true" rules', () => {
  it('hintDistance', () => {
    const none = { direct: false, vertical: false, diagonal: false, far: false };
    expect(keys(withChanges((s) => (s.hintDistance = none)))).toEqual(['noHintDistance']);
    expect(keys(withChanges((s) => (s.hintDistance = { ...none, far: true })))).toEqual([]);
  });
});

describe('number fields', () => {
  it('goalsPerRound: "1 to 20"', () => {
    expect(keys(withChanges((s) => (s.goalsPerRound = 1)))).toEqual([]);
    expect(keys(withChanges((s) => (s.goalsPerRound = 20)))).toEqual([]);
    expect(keys(withChanges((s) => (s.goalsPerRound = 0)))).toEqual(['goalsPerRound']);
    expect(keys(withChanges((s) => (s.goalsPerRound = 21)))).toEqual(['goalsPerRound']);
  });
});

describe('settingsSchema', () => {
  it('refuses unknown enum values and missing fields', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), difficulty: 'hard' }).success).toBe(false);
    const { pointAfterFullHelp: _dropped, ...rest } = defaultSettings();
    void _dropped;
    expect(settingsSchema.safeParse(rest).success).toBe(false);
    for (const version of [0, 2, 3, 4]) expect(settingsSchema.safeParse({ ...defaultSettings(), version }).success).toBe(false);
  });
});

describe('settingsSchema limits (review M5)', () => {
  it('accepts challenge minutes 1, 2, 3, 5 and goals per round 1 to 20, and nothing outside (FR-076)', () => {
    const parse = (change: (s: Settings) => void) => settingsSchema.safeParse(withChanges(change)).success;
    for (const m of CHALLENGE_MINUTES) expect(parse((s) => (s.timeChallenge.minutes = m))).toBe(true);
    for (const m of [0, 4, 10, 2.5]) expect(parse((s) => ((s.timeChallenge as { minutes: number }).minutes = m))).toBe(false);
    expect(parse((s) => (s.goalsPerRound = 1))).toBe(true);
    expect(parse((s) => (s.goalsPerRound = 20))).toBe(true);
    expect(parse((s) => (s.goalsPerRound = 0))).toBe(false);
    expect(parse((s) => (s.goalsPerRound = 21))).toBe(false);
  });
});

describe('parseSettings (stored settings, version 1)', () => {
  it('reads stored settings as they are', () => {
    const stored = withChanges((s) => ((s.timeChallenge = { allowed: false, minutes: 5 }), (s.levels = { start: 2, hardest: 4 }), (s.rowColumnHelper = false)));
    expect(parseSettings(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it('refuses settings that break a rule, miss a field or come from before the baseline (T106)', () => {
    expect(parseSettings({ ...defaultSettings(), difficulty: 'hard' })).toBeNull();
    const { cupGoals: _c, ...noCupGoals } = defaultSettings();
    void _c;
    expect(parseSettings(noCupGoals)).toBeNull();
    expect(parseSettings({ ...defaultSettings(), version: 4 })).toBeNull();
  });

  it('defaults to the row and column helper on (FR-093)', () => {
    expect(defaultSettings().rowColumnHelper).toBe(true);
  });
});

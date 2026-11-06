import { describe, expect, it } from 'vitest';
import { defaultSettings, MISSES_PER_HEART } from './defaults';
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
    expect(s.modes).toEqual({ holes: true, lines: true, keeper: true });
    expect(s.hintDisplay).toBe('always');
    expect(s.hintDistance).toEqual({ direct: true, vertical: true, diagonal: true, far: true });
    expect(s.lineDirections).toEqual({
      right: true,
      down: true,
      downRight: true,
      downLeft: true,
      left: false,
      up: false,
      upLeft: false,
      upRight: false,
    });
    expect(s.lineLength).toBe(5);
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
  });

  it('returns a new object on every call', () => {
    const a = defaultSettings();
    a.modes.holes = false;
    expect(defaultSettings().modes.holes).toBe(true);
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

describe('"at least one true" rules', () => {
  it('modes', () => {
    expect(keys(withChanges((s) => (s.modes = { holes: false, lines: false, keeper: false })))).toEqual(['noMode']);
    expect(keys(withChanges((s) => (s.modes = { holes: false, lines: false, keeper: true })))).toEqual([]);
  });

  it('hintDistance', () => {
    const none = { direct: false, vertical: false, diagonal: false, far: false };
    expect(keys(withChanges((s) => (s.hintDistance = none)))).toEqual(['noHintDistance']);
    expect(keys(withChanges((s) => (s.hintDistance = { ...none, far: true })))).toEqual([]);
  });

  it('lineDirections', () => {
    const none = withChanges((s) => {
      for (const d of Object.keys(s.lineDirections) as Array<keyof Settings['lineDirections']>) s.lineDirections[d] = false;
    });
    expect(keys(none)).toEqual(['noLineDirection']);
    none.lineDirections.upLeft = true;
    expect(keys(none)).toEqual([]);
  });
});

describe('number fields', () => {
  it('lineLength: "3 to 10"', () => {
    expect(keys(withChanges((s) => (s.lineLength = 3)))).toEqual([]);
    expect(keys(withChanges((s) => (s.lineLength = 10)))).toEqual([]);
    expect(keys(withChanges((s) => (s.lineLength = 2)))).toEqual(['lineLength']);
    expect(keys(withChanges((s) => (s.lineLength = 11)))).toEqual(['lineLength']);
  });

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
    expect(settingsSchema.safeParse({ ...defaultSettings(), version: 2 }).success).toBe(false);
  });
});

describe('settingsSchema limits (review M5)', () => {
  it('accepts line length 3 to 10 and goals per round 1 to 20, and nothing outside', () => {
    const parse = (change: (s: Settings) => void) => settingsSchema.safeParse(withChanges(change)).success;
    expect(parse((s) => (s.lineLength = 3))).toBe(true);
    expect(parse((s) => (s.lineLength = 10))).toBe(true);
    expect(parse((s) => (s.lineLength = 2))).toBe(false);
    expect(parse((s) => (s.lineLength = 11))).toBe(false);
    expect(parse((s) => (s.goalsPerRound = 1))).toBe(true);
    expect(parse((s) => (s.goalsPerRound = 20))).toBe(true);
    expect(parse((s) => (s.goalsPerRound = 0))).toBe(false);
    expect(parse((s) => (s.goalsPerRound = 21))).toBe(false);
  });
});

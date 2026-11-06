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
    expect(s.version).toBe(2);
    expect(s.range).toEqual({ preset: '1-100', min: 1, max: 100 });
    expect(s).not.toHaveProperty('modes');
    expect(s).not.toHaveProperty('lineLength');
    expect(s.hintDisplay).toBe('always');
    expect(s.hintDistance).toEqual({ direct: true, vertical: true, diagonal: true, far: true });
    expect(s.directions).toEqual({
      right: true,
      down: true,
      downRight: true,
      downLeft: true,
      left: false,
      up: false,
      upLeft: false,
      upRight: false,
    });
    expect(s.patterns).toEqual({ neighbors: true, middle: true, row: true, shape: true });
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
  });

  it('returns a new object on every call', () => {
    const a = defaultSettings();
    a.patterns.middle = false;
    expect(defaultSettings().patterns.middle).toBe(true);
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
  it('patterns (FR-066)', () => {
    const none = { neighbors: false, middle: false, row: false, shape: false };
    expect(keys(withChanges((s) => (s.patterns = none)))).toEqual(['noPattern']);
    expect(keys(withChanges((s) => (s.patterns = { ...none, row: true })))).toEqual([]);
  });

  it('shapes, only while "Formen" is on (FR-074)', () => {
    const none = { I: false, O: false, T: false, L: false, J: false, S: false, Z: false };
    expect(keys(withChanges((s) => (s.shapes = none)))).toEqual(['noShape']);
    expect(keys(withChanges((s) => (s.shapes = { ...none, L: true })))).toEqual([]);
    expect(keys(withChanges((s) => ((s.shapes = none), (s.patterns.shape = false))))).toEqual([]);
  });

  it('hintDistance', () => {
    const none = { direct: false, vertical: false, diagonal: false, far: false };
    expect(keys(withChanges((s) => (s.hintDistance = none)))).toEqual(['noHintDistance']);
    expect(keys(withChanges((s) => (s.hintDistance = { ...none, far: true })))).toEqual([]);
  });

  it('directions (FR-066)', () => {
    const none = withChanges((s) => {
      for (const d of Object.keys(s.directions) as Array<keyof Settings['directions']>) s.directions[d] = false;
    });
    expect(keys(none)).toEqual(['noDirection']);
    none.directions.upLeft = true;
    expect(keys(none)).toEqual([]);
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
    expect(settingsSchema.safeParse({ ...defaultSettings(), version: 1 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultSettings(), version: 3 }).success).toBe(false);
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

/** Settings as the published game (version 1) stored them, with every field set away from its default. */
function storedV1(): Record<string, unknown> {
  return {
    version: 1,
    range: { preset: 'custom', min: 200, max: 500 },
    modes: { holes: false, lines: true, keeper: true },
    hintDisplay: 'onRequest',
    hintDistance: { direct: true, vertical: false, diagonal: true, far: false },
    lineDirections: { right: false, down: true, downRight: false, downLeft: true, left: true, up: false, upLeft: false, upRight: false },
    lineLength: 7,
    roundType: 'goalCount',
    goalsPerRound: 12,
    difficulty: 'normal',
    adaptive: false,
    sound: { effects: false, crowd: true, ohh: false, speech: true },
    numberPad: 'always',
    showClock: true,
    showRecords: false,
    lockerRoom: false,
    pointAfterFullHelp: false,
  };
}

describe('settings version 1 to version 2 (FR-070)', () => {
  it('drops modes and line length, keeps the line directions as directions, turns every pattern and shape on', () => {
    const s = parseSettings(storedV1());
    expect(s).not.toBeNull();
    expect(s).not.toHaveProperty('modes');
    expect(s).not.toHaveProperty('lineLength');
    expect(s).not.toHaveProperty('lineDirections');
    expect(s!.version).toBe(2);
    expect(s!.directions).toEqual(storedV1().lineDirections);
    expect(s!.patterns).toEqual({ neighbors: true, middle: true, row: true, shape: true });
    expect(s!.shapes).toEqual({ I: true, O: true, T: true, L: true, J: true, S: true, Z: true });
    expect(s!.timeChallenge).toEqual({ allowed: true, minutes: 2 });
  });

  it('keeps every other field as the parent set it', () => {
    const s = parseSettings(storedV1())!;
    const { version: _v, modes: _m, lineDirections: _d, lineLength: _l, ...kept } = storedV1();
    void [_v, _m, _d, _l];
    expect(s).toMatchObject(kept);
  });

  it('reads version 1 settings with the defaults, and version 1 settings whose line length was out of bounds', () => {
    const v1: Record<string, unknown> = { ...defaultSettings(), version: 1, modes: { holes: true, lines: true, keeper: true }, lineLength: 5 };
    delete v1.directions;
    delete v1.patterns;
    delete v1.shapes;
    delete v1.timeChallenge;
    v1.lineDirections = defaultSettings().directions;
    expect(parseSettings(v1)).toEqual(defaultSettings());
    expect(parseSettings({ ...v1, lineLength: 99 })).toEqual(defaultSettings());
  });

  it('reads version 2 settings as they are', () => {
    const v2 = withChanges((s) => ((s.timeChallenge = { allowed: false, minutes: 5 }), (s.patterns.row = false)));
    expect(parseSettings(JSON.parse(JSON.stringify(v2)))).toEqual(v2);
  });

  it('refuses version 1 settings that break a rule that still exists', () => {
    expect(parseSettings({ ...storedV1(), lineDirections: { right: false, down: false, downRight: false, downLeft: false, left: false, up: false, upLeft: false, upRight: false } })).toBeNull();
    expect(parseSettings({ ...storedV1(), difficulty: 'hard' })).toBeNull();
  });
});

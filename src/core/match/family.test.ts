/**
 * "Papa gegen Kind" (amendment 23, T117, FR-158 to FR-161): the turn order with turn cards, sudden death, a level per
 * player, stars only for the child (1 per goal, 3 for a win), and only the child's kicks recorded.
 */
import { describe, expect, it } from 'vitest';
import { defaultSettings, type Level } from '../settings/defaults';
import { roundSchema, type AttemptRecord, type StoredRound } from '../storage/schemas';
import { MatchController, SHOWN_MS, type RoundStore } from './MatchController';
import type { Digit } from './entry';
import { cleanGrownupLevel, cleanGrownupName, DEFAULT_GROWNUP_LEVEL, DEFAULT_GROWNUP_NAME, type FamilySetup } from './family';
import { nextSide } from './shootout';
import { STARS } from '../rewards/lockerRoom';

function type(c: MatchController, n: number) {
  for (const ch of String(n)) c.typeKey({ digit: Number(ch) as Digit });
}

function memoryStore(): RoundStore & { round: StoredRound | null } {
  const store = {
    round: null as StoredRound | null,
    load: () => store.round,
    save: (r: StoredRound) => {
      store.round = structuredClone(r);
    },
    clear: () => {
      store.round = null;
    },
  };
  return store;
}

function family(options: { setup?: FamilySetup | null; childLevel?: Level; attempts?: AttemptRecord[]; store?: RoundStore } = {}) {
  const c = new MatchController({
    settings: defaultSettings,
    newSeed: () => 7,
    progress: () => ({ mastered: [], level: options.childLevel ?? 1, xTwoEmpties: false }),
    onAttempt: options.attempts ? (r) => void options.attempts!.push(r) : undefined,
    store: options.store,
  });
  c.start('family', options.setup === undefined ? { name: 'Papa', level: 6 } : options.setup);
  return c;
}

/** One kick of whoever's turn it is: Enter hides the turn card, then the target scores or another number misses. */
function kick(c: MatchController, goal: boolean) {
  expect(c.getState().family!.card).toBe(true);
  c.typeKey('enter');
  expect(c.getState().family!.card).toBe(false);
  const n = c.getState().target!.number;
  type(c, goal ? n : n === 1 ? 2 : n - 1);
  c.typeKey('enter');
  expect(c.getState().phase).toBe('ballInFlight');
  c.ballLanded();
  if (goal) c.celebrationDone();
  else c.tick(SHOWN_MS);
}

describe('the grown-up of the start card (FR-158, FR-159)', () => {
  it('"Papa" at level 6 by default; names are cleaned, levels checked', () => {
    expect([DEFAULT_GROWNUP_NAME, DEFAULT_GROWNUP_LEVEL]).toEqual(['Papa', 6]);
    expect(cleanGrownupName('  Mama  ')).toBe('Mama');
    expect(cleanGrownupName('Opa123!')).toBe('Opa');
    expect(cleanGrownupName('   ')).toBe('Papa');
    expect(cleanGrownupName('Großvater Hans')).toBe('Großvater');
    expect(cleanGrownupLevel(3)).toBe(3);
    expect(cleanGrownupLevel(9)).toBe(6);
    const c = family({ setup: null });
    expect(c.getState().family).toEqual({ name: 'Papa', level: 6, card: true });
  });
});

describe('the "Papa gegen Kind" shootout (FR-158 to FR-161)', () => {
  it('the child shoots first; a turn card shows before every kick, and nothing is typed or shot under it', () => {
    const c = family();
    const s = c.getState();
    expect(s.mode).toBe('family');
    expect(s.keeperShot).toBeNull();
    expect(nextSide(s.shootout!.kicks)).toBe(0);
    expect(s.family!.card).toBe(true);
    type(c, 5);
    expect(c.getState().entry).toBe('');
    c.askHelp();
    expect(c.getState().helpStep).toBe(0);
    // A tap on the card starts the turn as Enter does.
    c.startTurn();
    expect(c.getState().family!.card).toBe(false);
    type(c, 5);
    expect(c.getState().entry).toBe('5');
  });

  it('turns alternate with a card each; the grown-up shoots at his level, the child at his own', () => {
    const c = family({ childLevel: 1, setup: { name: 'Mama', level: 5 } });
    expect(c.getState().target!.level).toBe(1);
    kick(c, true);
    expect(nextSide(c.getState().shootout!.kicks)).toBe(1);
    expect(c.getState().target!.level).toBe(5);
    expect(c.getState().keeperShot).toBeNull();
    kick(c, false);
    expect(nextSide(c.getState().shootout!.kicks)).toBe(0);
    expect(c.getState().target!.level).toBe(1);
    expect(c.getState().shootout!.kicks).toEqual([['goal'], ['miss']]);
  });

  it('only the child earns stars: 1 per goal and 3 for a win; the grown-up\'s goals count for nothing', () => {
    const c = family();
    for (let round = 0; round < 5; round++) {
      kick(c, true);
      kick(c, round < 2);
    }
    const s = c.getState();
    expect(s.phase).toBe('roundOver');
    expect(s.shootout!.kicks.map((k) => k.filter((x) => x === 'goal').length)).toEqual([5, 2]);
    expect(s.goals).toBe(5);
    expect(s.starsThisRound).toBe(5 + STARS.familyWin);
    expect(s.family!.card).toBe(false);
  });

  it('a loss gives the child his goal stars and takes nothing away', () => {
    const c = family();
    for (let round = 0; round < 5; round++) {
      kick(c, round === 0);
      kick(c, true);
    }
    expect(c.getState()).toMatchObject({ phase: 'roundOver', goals: 1, starsThisRound: 1 });
  });

  it('level after 5 rounds: single rounds in turn until one side leads after a full round', () => {
    const c = family();
    for (let round = 0; round < 5; round++) {
      kick(c, true);
      kick(c, true);
    }
    expect(c.getState().phase).toBe('aiming');
    kick(c, true);
    kick(c, true);
    expect(c.getState().phase).toBe('aiming');
    kick(c, true);
    kick(c, false);
    expect(c.getState().phase).toBe('roundOver');
    expect(c.getState().starsThisRound).toBe(7 + STARS.familyWin);
  });

  it("only the child's kicks are recorded; the grown-up's are not", () => {
    const attempts: AttemptRecord[] = [];
    const c = family({ attempts, childLevel: 2 });
    kick(c, true);
    kick(c, true);
    kick(c, false);
    kick(c, false);
    expect(attempts.map((a) => [a.solved, a.level])).toEqual([
      [true, 2],
      [false, 2],
    ]);
  });

  it('a refresh continues with the grown-up and the kicks; a grown-up outside the mode is invalid', () => {
    const store = memoryStore();
    const c = family({ store, setup: { name: 'Mama', level: 4 } });
    kick(c, true);
    expect(store.round?.family).toEqual({ name: 'Mama', level: 4, card: true });
    const again = new MatchController({ settings: defaultSettings, store, progress: () => ({ mastered: [], level: 1, xTwoEmpties: false }) });
    expect(again.restore()).toBe(true);
    expect(again.getState()).toMatchObject({ mode: 'family', family: { name: 'Mama', level: 4 } });
    expect(again.getState().shootout!.kicks).toEqual([['goal'], []]);
    const stored = store.round!;
    expect(roundSchema.safeParse({ ...stored, mode: 'shootout' }).success).toBe(false);
    expect(roundSchema.safeParse({ ...stored, family: null }).success).toBe(false);
    expect(roundSchema.safeParse(stored).success).toBe(true);
  });
});

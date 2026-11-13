/**
 * "Elfmeterschießen" (amendment 21 part 3, T115, FR-147, FR-148): the order of the kicks, the 5 rounds, sudden death
 * when level, the score circles, and the controller's shootout: the child's kicks as in "Spielen", the opponent's as in
 * "Selbst ins Tor", 5 stars for a win and nothing taken for a loss.
 */
import { describe, expect, it } from 'vitest';
import { defaultSettings, type Level } from '../settings/defaults';
import { roundSchema, type AttemptRecord, type StoredRound } from '../storage/schemas';
import { MatchController, SHOWN_MS, type RoundStore } from './MatchController';
import type { Digit } from './entry';
import { flightMsOf, KEEPER_RESULT_MS, keeperOpponent } from './keeper';
import {
  addKick,
  emptyKicks,
  nextSide,
  scoreCircles,
  scoreText,
  SHOOTOUT_ROUNDS,
  SHOOTOUT_WIN_STARS,
  shootoutOver,
  shootoutRound,
  shootoutScore,
  shootoutWinner,
  type Kick,
} from './shootout';

/** The kicks after `seq` in turn order, side 0 first. */
function play(seq: Kick[]): [Kick[], Kick[]] {
  return seq.reduce((k, kick) => addKick(k, kick), emptyKicks());
}

const g: Kick = 'goal';
const m: Kick = 'miss';

describe('the order of the kicks and the end (FR-147)', () => {
  it('the sides take turns, side 0 first in every round', () => {
    let kicks = emptyKicks();
    const sides: Array<0 | 1 | null> = [];
    for (let i = 0; i < 6; i++) {
      sides.push(nextSide(kicks));
      kicks = addKick(kicks, g);
    }
    expect(sides).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('5 rounds are always played, also when one side cannot catch up any more', () => {
    // After 3 rounds 3:0, a real shootout would be over; here the child takes all five kicks.
    const kicks = play([g, m, g, m, g, m]);
    expect(shootoutOver(kicks)).toBe(false);
    expect(shootoutRound(kicks)).toBe(4);
    const done = play([g, m, g, m, g, m, g, m, g, m]);
    expect(shootoutWinner(done)).toBe(0);
    expect(shootoutScore(done)).toEqual([5, 0]);
    expect(nextSide(done)).toBeNull();
  });

  it('the side ahead after 5 rounds wins; the second side can still win in round 5', () => {
    expect(shootoutWinner(play([g, g, g, g, g, g, g, g, m, g]))).toBe(1);
    // Side 0 leads after its fifth kick, but the round is not over yet.
    expect(shootoutWinner(play([g, g, g, g, g, g, g, g, g]))).toBeNull();
  });

  it('level after 5 rounds: single rounds follow until one side leads after a full round', () => {
    const level = play([g, g, m, m, g, g, m, m, g, g]);
    expect(shootoutScore(level)).toEqual([3, 3]);
    expect(shootoutOver(level)).toBe(false);
    expect(nextSide(level)).toBe(0);
    expect(shootoutRound(level)).toBe(6);
    // Round 6: both score, still level. Round 7: side 0 misses, side 1 scores.
    const six = addKick(addKick(level, g), g);
    expect(shootoutOver(six)).toBe(false);
    const sevenHalf = addKick(six, m);
    expect(shootoutOver(sevenHalf)).toBe(false);
    const seven = addKick(sevenHalf, g);
    expect(shootoutWinner(seven)).toBe(1);
    expect(shootoutRound(seven)).toBe(7);
  });

  it('a kick after the end changes nothing', () => {
    const done = play([g, m, g, m, g, m, g, m, g, m]);
    expect(addKick(done, g)).toEqual(done);
  });
});

describe('the score circles (FR-147)', () => {
  it('two rows of five: goal, miss, open', () => {
    expect(scoreCircles(emptyKicks())).toEqual([Array(5).fill('open'), Array(5).fill('open')]);
    expect(scoreCircles(play([g, m, m]))).toEqual([
      ['goal', 'miss', 'open', 'open', 'open'],
      ['miss', 'open', 'open', 'open', 'open'],
    ]);
    expect(scoreText(play([g, m, m]))).toBe('1:0');
  });

  it('sudden death adds one circle per round to both rows', () => {
    const level = play([g, g, m, m, g, g, m, m, g, g]);
    expect(scoreCircles(level).map((r) => r.length)).toEqual([6, 6]);
    expect(scoreCircles(level)[0][5]).toBe('open');
    const sevenHalf = addKick(addKick(addKick(level, g), g), m);
    expect(scoreCircles(sevenHalf)).toEqual([
      ['goal', 'miss', 'goal', 'miss', 'goal', 'goal', 'miss'],
      ['goal', 'miss', 'goal', 'miss', 'goal', 'goal', 'open'],
    ]);
    expect(SHOOTOUT_ROUNDS).toBe(5);
  });
});

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

function shootout(options: { store?: RoundStore; attempts?: AttemptRecord[]; settings?: typeof defaultSettings; level?: Level } = {}) {
  const c = new MatchController({
    settings: options.settings ?? defaultSettings,
    newSeed: () => 21,
    progress: () => ({ mastered: [], level: options.level ?? 1, xTwoEmpties: false }),
    store: options.store,
    onAttempt: options.attempts ? (r) => void options.attempts!.push(r) : undefined,
  });
  c.start('shootout');
  return c;
}

/** The child's kick: the target number scores, another number misses. Ends with the opponent's turn or the end. */
function childKick(c: MatchController, goal: boolean) {
  const s = c.getState();
  expect(s.keeperShot).toBeNull();
  const n = s.target!.number;
  type(c, goal ? n : n === 1 ? 2 : n - 1);
  c.typeKey('enter');
  expect(c.getState().phase).toBe('ballInFlight');
  c.ballLanded();
  if (goal) c.celebrationDone();
  else c.tick(SHOWN_MS);
}

/** The opponent's kick: the child saves with the square's number, or concedes with a wrong one. */
function opponentKick(c: MatchController, save: boolean) {
  const s = c.getState();
  expect(s.keeperShot).not.toBeNull();
  const n = s.target!.number;
  type(c, save ? n : n === 1 ? 2 : n - 1);
  c.typeKey('enter');
  c.tick(KEEPER_RESULT_MS);
}

describe('the shootout round (FR-147, FR-148)', () => {
  it('"Elfmeter" starts the mode shootout; the child shoots first, against a cup team', () => {
    const c = shootout();
    const s = c.getState();
    expect(s.mode).toBe('shootout');
    expect(s.shootout).toEqual({ kicks: [[], []], waitMs: 0 });
    expect(s.keeperShot).toBeNull();
    expect(s.target).not.toBeNull();
    expect(s.target!.level).toBe(1);
    expect(keeperOpponent(s.seed).name).toBeTruthy();
  });

  it('a goal is celebrated, then the opponent shoots at an unnumbered square, the first one slowly', () => {
    const c = shootout({ settings: () => ({ ...defaultSettings(), keeperSpeed: 'fast' }) });
    childKick(c, true);
    const s = c.getState();
    expect(s.shootout!.kicks).toEqual([['goal'], []]);
    expect(s.goals).toBe(1);
    expect(s.keeperShot).not.toBeNull();
    expect(s.keeperShot!.totalMs).toBe(flightMsOf('fast', 0));
    expect(s.ball).toBeNull();
    // The second shot of the opponent flies at the parent's speed.
    opponentKick(c, true);
    childKick(c, true);
    expect(c.getState().keeperShot!.totalMs).toBe(flightMsOf('fast', 1));
  });

  it('a missed kick shows its square and ends the turn: no second try, no typing until the opponent shoots', () => {
    const c = shootout();
    const n = c.getState().target!.number;
    const wrong = n === 1 ? 2 : n - 1;
    type(c, wrong);
    c.typeKey('enter');
    c.ballLanded();
    let s = c.getState();
    expect(s.message).toEqual({ kind: 'kickMissed', number: wrong });
    expect(s.shown).toEqual({ number: wrong, remainingMs: SHOWN_MS });
    expect(s.shootout).toEqual({ kicks: [['miss'], []], waitMs: SHOWN_MS });
    expect(s.hearts).toBe(3);
    // Typing, shooting and help do nothing while the square shows.
    type(c, n);
    c.typeKey('enter');
    c.askHelp();
    s = c.getState();
    expect(s.entry).toBe('');
    expect(s.phase).toBe('aiming');
    expect(s.helpStep).toBe(0);
    c.tick(SHOWN_MS - 1);
    expect(c.getState().keeperShot).toBeNull();
    c.tick(1);
    expect(c.getState().keeperShot).not.toBeNull();
    expect(c.getState().shootout!.waitMs).toBe(0);
  });

  it('the opponent scores when the child does not save, also when the ball arrives first; a save is his miss', () => {
    const c = shootout();
    childKick(c, false);
    opponentKick(c, false);
    expect(c.getState().shootout!.kicks).toEqual([['miss'], ['goal']]);
    childKick(c, false);
    opponentKick(c, true);
    expect(c.getState().shootout!.kicks).toEqual([['miss', 'miss'], ['goal', 'miss']]);
    childKick(c, false);
    // No number before the ball arrives.
    c.tick(c.getState().keeperShot!.leftMs);
    expect(c.getState().keeperShot!.result).toBe('late');
    c.tick(KEEPER_RESULT_MS);
    expect(c.getState().shootout!.kicks[1]).toEqual(['goal', 'miss', 'goal']);
  });

  it('a won shootout ends after 5 rounds with 5 stars; goals and saves earn none', () => {
    const c = shootout();
    for (let round = 0; round < SHOOTOUT_ROUNDS; round++) {
      childKick(c, true);
      expect(c.getState().starsThisRound).toBe(0);
      opponentKick(c, round !== 2);
    }
    const s = c.getState();
    expect(s.phase).toBe('roundOver');
    expect(shootoutWinner(s.shootout!.kicks)).toBe(0);
    expect(shootoutScore(s.shootout!.kicks)).toEqual([5, 1]);
    expect(s.starsThisRound).toBe(SHOOTOUT_WIN_STARS);
    expect(s.keeperShot).toBeNull();
  });

  it('a lost shootout ends without stars and takes nothing away', () => {
    const c = shootout();
    for (let round = 0; round < SHOOTOUT_ROUNDS; round++) {
      childKick(c, false);
      opponentKick(c, false);
    }
    const s = c.getState();
    expect(s.phase).toBe('roundOver');
    expect(shootoutWinner(s.shootout!.kicks)).toBe(1);
    expect(s.starsThisRound).toBe(0);
  });

  it('level after 5 rounds: sudden death until one side leads after a full round', () => {
    const c = shootout();
    for (let round = 0; round < SHOOTOUT_ROUNDS; round++) {
      childKick(c, true);
      opponentKick(c, false);
    }
    expect(c.getState().phase).toBe('aiming');
    expect(shootoutRound(c.getState().shootout!.kicks)).toBe(6);
    // Round 6 level again, round 7 the child scores and saves.
    childKick(c, false);
    opponentKick(c, true);
    expect(c.getState().phase).toBe('aiming');
    childKick(c, true);
    expect(c.getState().phase).toBe('aiming');
    opponentKick(c, true);
    const s = c.getState();
    expect(s.phase).toBe('roundOver');
    expect(shootoutScore(s.shootout!.kicks)).toEqual([6, 5]);
    expect(s.starsThisRound).toBe(SHOOTOUT_WIN_STARS);
  });

  it('help works on the child\'s kick as in "Spielen" and holds the opponent\'s shot as in "Selbst ins Tor"', () => {
    const c = shootout();
    c.askHelp();
    expect(c.getState().helpStep).toBe(1);
    childKick(c, true);
    expect(c.getState().helpStep).toBe(0);
    c.askHelp();
    expect(c.getState().keeperShot!.held).toBe(true);
    const left = c.getState().keeperShot!.leftMs;
    c.tick(5_000);
    expect(c.getState().keeperShot!.leftMs).toBe(left);
  });

  it("only the child's kicks record attempts: his goals and misses, not the opponent's shots", () => {
    const attempts: AttemptRecord[] = [];
    const c = shootout({ attempts });
    childKick(c, true);
    opponentKick(c, true);
    childKick(c, false);
    opponentKick(c, false);
    expect(attempts.map((a) => a.solved)).toEqual([true, false]);
  });

  it('each kick of the child has a new target: a shape does not go on into the next kick', () => {
    const c = shootout({ level: 4 });
    const first = c.getState().target!;
    expect(first.queue?.length ?? 0).toBeGreaterThan(0);
    childKick(c, true);
    // The opponent shoots at a square of his own, not the shape's next one.
    const opponent = c.getState().target!;
    expect(opponent.pattern).toBe('neighbors');
    expect(opponent.queue).toBeUndefined();
    opponentKick(c, true);
    const next = c.getState().target!;
    expect(next.number).not.toBe(first.queue![0]!.number);
    expect(c.getState().targetCount).toBe(3);
  });

  it('a refresh continues the shootout with its kicks; kicks outside the shootout are invalid', () => {
    const store = memoryStore();
    const c = shootout({ store });
    childKick(c, true);
    opponentKick(c, false);
    expect(store.round?.mode).toBe('shootout');
    expect(store.round?.shootout?.kicks).toEqual([['goal'], ['goal']]);
    const again = new MatchController({ settings: defaultSettings, store, progress: () => ({ mastered: [], level: 1, xTwoEmpties: false }) });
    expect(again.restore()).toBe(true);
    expect(again.getState().shootout!.kicks).toEqual([['goal'], ['goal']]);
    expect(again.getState().mode).toBe('shootout');
    const stored = store.round!;
    expect(roundSchema.safeParse({ ...stored, mode: 'normal' }).success).toBe(false);
    expect(roundSchema.safeParse({ ...stored, shootout: null }).success).toBe(false);
    expect(roundSchema.safeParse(stored).success).toBe(true);
  });
});

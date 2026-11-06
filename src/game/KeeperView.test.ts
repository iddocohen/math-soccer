/**
 * The waiting keeper in KeeperView (amendment 15, FR-120, FR-121), with a small stand-in for the Phaser scene whose
 * tweens run on a clock the test moves. Regression for keeper-blocks-bug.png: after a goal the next target came while
 * he walked back, and he ended on the last target's spot, fully drawn over the new hints.
 */
import { describe, expect, it, vi } from 'vitest';
import { cellRect, layoutChart } from '../core/chart/layout';
import { CHART_RECT } from '../core/match/world';
import type { Rect } from '../core/types';
import { FLIGHT_MS } from './BallView';
import { BOARD_DEPTH } from './GoalView';
import { FADED_ALPHA, HOME_POSE, idleBounds, waitingSpot } from './keeperDive';
import { QUIRKS, type Quirk } from '../core/cup/teams';
import { HOLD_MS, KEEPER_DEPTH, KeeperView, QUICK_SHUFFLE_MS, WAITING_DEPTH } from './KeeperView';

vi.mock('phaser', () => ({ default: {} }));

interface FakeTween {
  start: number;
  delay: number;
  duration: number;
  onUpdate: (tw: { getValue: () => number }) => void;
  onComplete: () => void;
  stopped: boolean;
}

/** A stand-in for the parts of Phaser.Scene that KeeperView uses; `advance` moves the tween clock. */
function fakeScene() {
  let now = 0;
  const tweens: FakeTween[] = [];
  const shape = () => {
    const o: Record<string, unknown> = { depth: 0, alpha: 1 };
    const chain = () => o;
    for (const m of ['clear', 'fillTriangle', 'fillStyle', 'fillRect', 'fillRoundedRect', 'fillCircle', 'fillEllipse', 'lineStyle', 'strokeRoundedRect', 'setPosition', 'setRotation', 'setScale', 'destroy']) o[m] = chain;
    o.setDepth = (d: number) => ((o.depth = d), o);
    o.setAlpha = (a: number) => ((o.alpha = a), o);
    return o;
  };
  const scene = {
    add: { graphics: shape, ellipse: shape, container: shape },
    tweens: {
      addCounter: (c: { delay?: number; duration: number; onUpdate: FakeTween['onUpdate']; onComplete: () => void }) => {
        const tw: FakeTween = { start: now, delay: c.delay ?? 0, duration: c.duration, onUpdate: c.onUpdate, onComplete: c.onComplete, stopped: false };
        tweens.push(tw);
        return { stop: () => (tw.stopped = true) };
      },
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      // Finish the tweens that end before `end`, in order, so callbacks start their followers at the right time.
      const live = tweens.filter((t) => !t.stopped);
      const next = live.map((t) => ({ t, at: t.start + t.delay + t.duration })).filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      now = next.at;
      next.t.stopped = true;
      next.t.onUpdate({ getValue: () => 1 });
      next.t.onComplete();
    }
    now = end;
    for (const t of tweens.filter((x) => !x.stopped)) {
      const k = Math.min(1, Math.max(0, (now - t.start - t.delay) / t.duration));
      t.onUpdate({ getValue: () => k });
    }
  };
  return { scene: scene as unknown as ConstructorParameters<typeof KeeperView>[0], advance };
}

const chart = layoutChart(1, 100);
const squares = (...ns: number[]): Rect[] => ns.map((n) => cellRect(chart, CHART_RECT, n));
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const covers = (x: number, rects: readonly Rect[]) => idleBounds(x).some((k) => rects.some((s) => overlap(k, s)));

/** The screenshot's target: 87 with the hints 67, 85 and 89, which lie on his spot in the middle. */
const SCREENSHOT = squares(87, 67, 85, 89);
/** A target far from the middle, where he waits in the middle. */
const TOP = squares(14, 13, 15, 4, 24);

function keeper() {
  const { scene, advance } = fakeScene();
  const phases: string[] = [];
  const k = new KeeperView(scene, (p) => phases.push(p));
  return { k, advance, phases };
}

describe('the waiting keeper keeps the numbers clear for every new target (FR-121)', () => {
  it('the screenshot case has a free spot, away from the middle', () => {
    const spot = waitingSpot(SCREENSHOT);
    expect(spot.clear).toBe(true);
    expect(spot.pose.x).not.toBe(HOME_POSE.x);
    expect(covers(HOME_POSE.x, SCREENSHOT)).toBe(true);
    expect(covers(spot.pose.x, SCREENSHOT)).toBe(false);
  });

  it('at the start of a round and after a restore he stands clear at once', () => {
    const { k } = keeper();
    k.reset();
    k.keepClear(SCREENSHOT);
    expect(k.currentPose.x).toBe(waitingSpot(SCREENSHOT).pose.x);
    expect(k.alpha).toBe(1);
  });

  it('after a goal: the next target comes while he walks back, and he ends on its free spot', () => {
    const { k, advance } = keeper();
    k.reset();
    k.keepClear(TOP);
    expect(k.currentPose.x).toBe(HOME_POSE.x);
    k.dive(squares(14)[0]!, 'beaten');
    advance(FLIGHT_MS);
    k.beaten();
    // The celebration (1400 ms) ends after his fall and hold (1000 ms), while he walks back to his last spot.
    advance(1400);
    expect(k.phase).toBe('beaten');
    k.keepClear(SCREENSHOT);
    advance(2000);
    expect(k.phase).toBe('idle');
    expect(k.currentPose.x).toBe(waitingSpot(SCREENSHOT).pose.x);
    expect(covers(k.currentPose.x, SCREENSHOT)).toBe(false);
    expect(k.alpha).toBe(1);
  });

  it('after a goal: a target that comes while he still lies on the grass works too', () => {
    const { k, advance } = keeper();
    k.reset();
    k.keepClear(TOP);
    k.dive(squares(14)[0]!, 'beaten');
    advance(FLIGHT_MS);
    k.beaten();
    advance(100);
    k.keepClear(SCREENSHOT);
    advance(3000);
    expect(k.currentPose.x).toBe(waitingSpot(SCREENSHOT).pose.x);
  });

  for (const at of [HOLD_MS / 2, HOLD_MS + 200]) {
    it(`after a lost heart: a new target ${at} ms after the catch moves him to its free spot`, () => {
      const { k, advance } = keeper();
      k.reset();
      k.keepClear(TOP);
      k.dive(squares(30)[0]!, 'catch');
      advance(FLIGHT_MS);
      k.catchBall();
      advance(at);
      k.keepClear(SCREENSHOT);
      advance(3000);
      expect(k.phase).toBe('idle');
      expect(k.currentPose.x).toBe(waitingSpot(SCREENSHOT).pose.x);
    });
  }

  it('after new settings: the squares of another chart size move the waiting keeper', () => {
    const { k, advance } = keeper();
    k.reset();
    k.keepClear(TOP);
    const other = layoutChart(1, 50);
    const moved = [44, 34, 43, 45].map((n) => cellRect(other, CHART_RECT, n));
    k.keepClear(moved);
    advance(1000);
    expect(covers(k.currentPose.x, moved)).toBe(waitingSpot(moved).clear ? false : true);
    expect(k.currentPose.x).toBe(waitingSpot(moved).pose.x);
  });

  it('waits in the middle at 50% opacity when no spot is free, also after a shot', () => {
    const row = squares(91, 92, 93, 94, 95, 96, 97, 98, 99, 100);
    expect(waitingSpot(row).clear).toBe(false);
    const { k, advance } = keeper();
    k.reset();
    k.keepClear(row);
    expect(k.alpha).toBe(FADED_ALPHA);
    expect(k.currentPose.x).toBe(HOME_POSE.x);
    k.dive(squares(95)[0]!, 'catch');
    expect(k.alpha).toBe(1);
    advance(FLIGHT_MS);
    k.catchBall();
    advance(3000);
    expect(k.alpha).toBe(FADED_ALPHA);
  });
});

describe('the waiting keeper is drawn behind the numbers (FR-120)', () => {
  it('behind the grid while he waits, in front of it from the leap until he is back on his spot', () => {
    const { k, advance } = keeper();
    k.reset();
    k.keepClear(SCREENSHOT);
    expect(WAITING_DEPTH).toBeLessThan(BOARD_DEPTH);
    expect(KEEPER_DEPTH).toBeGreaterThan(BOARD_DEPTH);
    expect(k.depth).toBe(WAITING_DEPTH);
    k.dive(squares(87)[0]!, 'beaten');
    expect(k.depth).toBe(KEEPER_DEPTH);
    advance(FLIGHT_MS);
    k.beaten();
    advance(1000);
    expect(k.depth).toBe(KEEPER_DEPTH);
    advance(2000);
    expect(k.phase).toBe('idle');
    expect(k.depth).toBe(WAITING_DEPTH);
  });
});

describe('cup keeper quirks are looks only (amendment 13, FR-107)', () => {
  /** Where the keeper is after each step of a shot sequence, with the given quirk (or the blue keeper). */
  function trace(quirk: Quirk | null): Array<{ x: number; y: number; phase: string; depth: number; alpha: number }> {
    const { k, advance } = keeper();
    k.setTeam(quirk ? { color: '#d8382f', trim: '#ffffff', quirk } : null);
    k.reset();
    const out: Array<{ x: number; y: number; phase: string; depth: number; alpha: number }> = [];
    const note = () => out.push({ x: k.currentPose.x, y: k.currentPose.y, phase: k.phase, depth: k.depth, alpha: k.alpha });
    k.keepClear(TOP);
    note();
    k.keepClear(SCREENSHOT);
    advance(1000);
    note();
    k.dive(squares(30)[0]!, 'catch');
    advance(FLIGHT_MS);
    note();
    k.catchBall();
    advance(HOLD_MS);
    note();
    advance(2000);
    note();
    k.dive(squares(87)[0]!, 'beaten');
    advance(FLIGHT_MS);
    note();
    k.beaten();
    advance(3000);
    note();
    return out;
  }

  const blue = trace(null);

  for (const quirk of QUIRKS) {
    it(`"${quirk}": the same spots, leaps, layers and opacity as the blue keeper`, () => {
      const { k } = keeper();
      k.setTeam({ color: '#2b6fd6', trim: '#cfe6ff', quirk });
      expect(k.quirk).toBe(quirk);
      expect(trace(quirk)).toEqual(blue);
    });
  }

  it('the small, quick keeper reaches a new waiting spot sooner, at the same spot', () => {
    const run = (quirk: Quirk | null) => {
      const { k, advance } = keeper();
      k.setTeam(quirk ? { color: '#f2c230', trim: '#1d2a5c', quirk } : null);
      k.reset();
      k.keepClear(TOP);
      k.keepClear(SCREENSHOT);
      advance(QUICK_SHUFFLE_MS);
      return k.currentPose.x;
    };
    const target = waitingSpot(SCREENSHOT).pose.x;
    expect(run('small')).toBe(target);
    expect(run(null)).not.toBe(target);
  });

  it('setTeam(null) gives the blue keeper back', () => {
    const { k } = keeper();
    k.setTeam({ color: '#2b6fd6', trim: '#cfe6ff', quirk: 'cap' });
    k.setTeam(null);
    expect(k.quirk).toBeNull();
  });
});

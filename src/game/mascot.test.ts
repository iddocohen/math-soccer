import { describe, expect, it } from 'vitest';
import { CHART_RECT, GOAL_FRAME, OVERLAY_LEFT, WORLD_HEIGHT, WORLD_WIDTH } from '../core/match/world';
import type { Rect } from '../core/types';
import { COLUMN_STRIP, ROW_STRIP } from './scales';
import { KICKING, playerBounds, STANDING } from './playerPose';
import {
  ARM_LENGTH,
  ART_BOUNDS,
  EYE,
  MASCOT_ART,
  MASCOT_CHEER_MS,
  MASCOT_EYES_MS,
  MASCOT_JUMP,
  MASCOT_RECT,
  mascotPose,
  moodMs,
  PAW_RADIUS,
  pawAt,
  SHOULDER,
  type MascotMood,
  type MascotShape,
} from './mascot';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The top bar's counters and buttons reach at most this far down the world (about 60 screen pixels at 1280 by 800). */
const TOP_BAR: Rect = { x: 0, y: 0, width: WORLD_WIDTH, height: 110 };

function shapeBox(s: MascotShape): Rect {
  switch (s.type) {
    case 'circle':
    case 'smile':
      return { x: s.x - s.r, y: s.y - s.r, width: 2 * s.r, height: 2 * s.r };
    case 'ellipse':
      return { x: s.x - s.rx, y: s.y - s.ry, width: 2 * s.rx, height: 2 * s.ry };
    case 'triangle': {
      const xs = [s.points[0], s.points[2], s.points[4]];
      const ys = [s.points[1], s.points[3], s.points[5]];
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
  }
}

describe('where the mascot stands (FR-136)', () => {
  it('stays inside the world, left of the goal', () => {
    expect(MASCOT_RECT.x).toBeGreaterThanOrEqual(0);
    expect(MASCOT_RECT.y + MASCOT_RECT.height).toBeLessThanOrEqual(WORLD_HEIGHT);
    expect(MASCOT_RECT.x + MASCOT_RECT.width).toBeLessThan(GOAL_FRAME.x);
  });

  it('never overlaps the chart, the row and column scales, the top bar, the player or the overlay', () => {
    for (const [name, rect] of [
      ['chart', CHART_RECT],
      ['goal frame', GOAL_FRAME],
      ['row scale', ROW_STRIP],
      ['column scale', COLUMN_STRIP],
      ['top bar', TOP_BAR],
      ['player standing', playerBounds(STANDING)],
      ['player kicking', playerBounds(KICKING)],
    ] as const) {
      expect(overlaps(MASCOT_RECT, rect), name).toBe(false);
    }
    // The help line, the typed number and the message start at OVERLAY_LEFT.
    expect(MASCOT_RECT.x + MASCOT_RECT.width).toBeLessThan(OVERLAY_LEFT);
  });

  it('draws every animal inside its art bounds', () => {
    for (const art of Object.values(MASCOT_ART)) {
      for (const s of art.shapes) {
        const b = shapeBox(s);
        expect(b.x).toBeGreaterThanOrEqual(ART_BOUNDS.left);
        expect(b.x + b.width).toBeLessThanOrEqual(ART_BOUNDS.right);
        expect(b.y).toBeGreaterThanOrEqual(ART_BOUNDS.top);
        expect(b.y + b.height).toBeLessThanOrEqual(ART_BOUNDS.bottom);
      }
    }
  });

  it('keeps its paws and its jumps inside the bounds in every pose', () => {
    for (const mood of ['idle', 'cheer', 'eyes'] as MascotMood[]) {
      for (let ms = 0; ms <= 1000; ms += 10) {
        const pose = mascotPose(mood, ms);
        expect(pose.lift).toBeGreaterThanOrEqual(0);
        expect(pose.lift).toBeLessThanOrEqual(MASCOT_JUMP);
        for (const [side, turn] of [
          [-1, pose.left],
          [1, pose.right],
        ] as const) {
          const paw = pawAt(side, turn);
          expect(paw.x - PAW_RADIUS).toBeGreaterThanOrEqual(ART_BOUNDS.left);
          expect(paw.x + PAW_RADIUS).toBeLessThanOrEqual(ART_BOUNDS.right);
          expect(paw.y - PAW_RADIUS).toBeGreaterThanOrEqual(ART_BOUNDS.top);
        }
      }
    }
  });
});

describe('how the mascot moves (FR-136)', () => {
  it('jumps on a goal and lands again', () => {
    expect(mascotPose('cheer', MASCOT_CHEER_MS / 4).lift).toBeCloseTo(MASCOT_JUMP);
    expect(mascotPose('cheer', MASCOT_CHEER_MS / 2).lift).toBeCloseTo(0);
    expect(mascotPose('cheer', MASCOT_CHEER_MS).lift).toBeCloseTo(0);
  });

  it('raises a paw high to wave on a goal', () => {
    const paw = pawAt(1, mascotPose('cheer', MASCOT_CHEER_MS / 2).right);
    expect(paw.y).toBeLessThan(SHOULDER.y - ARM_LENGTH * 0.8);
  });

  it('covers both eyes with its paws on a miss, and lowers them again', () => {
    const mid = mascotPose('eyes', MASCOT_EYES_MS / 2);
    for (const [side, turn] of [
      [-1, mid.left],
      [1, mid.right],
    ] as const) {
      const paw = pawAt(side, turn);
      expect(Math.hypot(paw.x - side * EYE.x, paw.y - EYE.y)).toBeLessThan(PAW_RADIUS);
    }
    const end = mascotPose('eyes', MASCOT_EYES_MS);
    expect(end).toEqual({ lift: 0, left: mascotPose('idle', 0).left, right: mascotPose('idle', 0).right });
  });

  it('idles until the next goal or miss', () => {
    expect(moodMs('idle')).toBe(Infinity);
    expect(moodMs('cheer')).toBe(MASCOT_CHEER_MS);
    expect(moodMs('eyes')).toBe(MASCOT_EYES_MS);
  });
});

/**
 * The cup lift in PlayerView (amendment 19, FR-131), with a small stand-in for the Phaser scene that records what each
 * graphics object draws and whether it shows. Regression for the parent's report: after the won final the hanging arms
 * still showed under the raised ones, so the arms looked down.
 */
import { describe, expect, it, vi } from 'vitest';
import { emptyLockerRoom } from '../core/storage/schemas';
import { lookOf } from '../core/rewards/lockerRoom';
import { COLOR } from './palette';
import { BODY } from './playerPose';
import { PlayerView } from './PlayerView';

vi.mock('phaser', () => ({ default: { Display: { Color: { IntegerToColor: () => ({ v: 1, s: 0 }) } } } }));

interface FakeShape {
  visible: boolean;
  /** The circles drawn since the last `clear`, with the fill color at the time. */
  circles: Array<{ x: number; y: number; r: number; color: number }>;
  strokes: number;
}

/** A stand-in for the parts of Phaser.Scene that PlayerView uses; `graphics` lists the graphics in creation order. */
function fakeScene() {
  const graphics: FakeShape[] = [];
  const make = () => {
    const state: FakeShape = { visible: true, circles: [], strokes: 0 };
    let color = 0;
    const o: Record<string, unknown> = { state, width: 40 };
    const chain = () => o;
    for (const m of ['fillRect', 'fillRoundedRect', 'fillTriangle', 'lineStyle', 'lineBetween', 'setPosition', 'setRotation', 'setScale', 'setDepth', 'setOrigin', 'setText', 'setColor', 'destroy']) o[m] = chain;
    o.fillStyle = (c: number) => ((color = c), o);
    o.fillCircle = (x: number, y: number, r: number) => (state.circles.push({ x, y, r, color }), o);
    o.strokeCircle = () => ((state.strokes += 1), o);
    o.clear = () => ((state.circles = []), (state.strokes = 0), o);
    o.setVisible = (v: boolean) => ((state.visible = v), o);
    return o;
  };
  const scene = {
    add: {
      graphics: () => {
        const g = make();
        graphics.push(g.state as FakeShape);
        return g;
      },
      text: make,
      container: make,
    },
    tweens: { killTweensOf: () => undefined, add: () => undefined, addCounter: () => ({ remove: () => undefined }) },
  };
  return { scene: scene as unknown as ConstructorParameters<typeof PlayerView>[0], graphics };
}

/** PlayerView makes its graphics in this order: legs, hanging arms, shirt, celebration arms, heart, head, cup lift. */
function player() {
  const { scene, graphics } = fakeScene();
  const view = new PlayerView(scene, lookOf(emptyLockerRoom()));
  const [, restArms, , poseArms, , , trophy] = graphics as [FakeShape, FakeShape, FakeShape, FakeShape, FakeShape, FakeShape, FakeShape];
  return { view, restArms: restArms!, poseArms: poseArms!, trophy: trophy! };
}

describe('the cup lift (amendment 19, FR-131)', () => {
  it('stands with the hanging arms before the lift', () => {
    const { restArms, trophy } = player();
    expect(restArms.visible).toBe(true);
    expect(trophy.visible).toBe(false);
  });

  it('hides the hanging arms for the whole lift and shows only the raised arms with the hands above the head', () => {
    const { view, restArms, poseArms, trophy } = player();
    view.liftCup();
    expect(view.isLifting).toBe(true);
    expect(restArms.visible).toBe(false);
    expect(poseArms.visible).toBe(false);
    expect(trophy.visible).toBe(true);
    expect(trophy.strokes).toBeGreaterThan(0);
    const hands = trophy.circles.filter((c) => c.color === COLOR.skin && c.r >= 12);
    expect(hands).toHaveLength(2);
    for (const hand of hands) expect(hand.y).toBeLessThan(-BODY.height);
    expect(hands.map((h) => Math.sign(h.x)).sort()).toEqual([-1, 1]);
  });

  it('keeps the arms up when a celebration is asked for or ends during the lift', () => {
    const { view, restArms, trophy } = player();
    view.liftCup();
    view.celebrate('armsUp', 1200);
    view.stopCelebration();
    expect(restArms.visible).toBe(false);
    expect(trophy.visible).toBe(true);
  });

  it('keeps the arms up when the shirt changes during the lift', () => {
    const { view, restArms, trophy } = player();
    view.liftCup();
    view.setLook({ ...lookOf(emptyLockerRoom()), shirtColor: 0x3e6fb0 });
    expect(restArms.visible).toBe(false);
    expect(trophy.circles.filter((c) => c.color === COLOR.skin && c.r >= 12)).toHaveLength(2);
  });

  it('brings the arms down after the lift', () => {
    const { view, restArms, trophy } = player();
    view.liftCup();
    view.lowerCup();
    expect(view.isLifting).toBe(false);
    expect(restArms.visible).toBe(true);
    expect(trophy.visible).toBe(false);
  });
});

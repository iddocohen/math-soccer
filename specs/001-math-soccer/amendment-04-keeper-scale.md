# Amendment 04: goalkeeper size and position

**Date**: 2026-11-06
**Requested by**: the parent: "The scale of the goaly seems wrong."
**Observed**: the keeper is drawn at 0.7 scale while waiting and grows to 1.25 during the dive, so he looks small next to the goal at rest and changes size in the air.
**Changes**: FR-020, `src/game/KeeperView.ts`, `src/game/keeperDive.ts`.

## Behavior

- **FR-062**: The keeper MUST keep one size for the whole shot. He MUST stand about half as tall as the goal mouth (from the goal line to the crossbar), so he reads as a person in a goal. Design call: a real keeper is about three quarters of the goal's height, but at that size he would cover too many chart squares.
- **FR-063**: The keeper MUST stand on the goal line, feet on the grass inside the goal. Only his arms, the stretch of the dive and the jump arc change during a shot. There is no scaling.
- **FR-064**: While waiting, the keeper MUST NOT cover the target square, any hint square, and the waiting empty squares of a shape (amendment 06). He shuffles sideways along the goal line to a spot that leaves them visible. If no such spot exists, he is drawn at 50% opacity until the child shoots. Design call.
- The dive keeps FR-020: toward the ball on every shot, catching a wrong number at its square, and falling short of a correct one.

## Tests

- Unit (`keeperDive.test.ts`): the keeper's drawn height is between 45% and 55% of the goal mouth height in every pose; the waiting spot never overlaps the target or hint rectangles when a free spot exists.
- e2e (Chromium): `keeper.spec.ts` still passes.

# Amendment 08: player size compared to the goalkeeper

**Date**: 2026-11-06
**Requested by**: the parent, after the keeper fix: "Now the player is not in scale to the goalie."
**Observed**: since amendment 04 the keeper stands about half the goal's height. The player at the penalty spot is drawn at 0.8 scale and looks smaller than the keeper, although he stands much closer to the viewer.
**Changes**: FR-056, `src/game/PlayerView.ts`, the kick spot in `src/core/match/world.ts`.

## Behavior

- **FR-082**: The player MUST look closer than the keeper. He is drawn at least 1.3 times the keeper's height, seen from behind, and the bottom edge of the screen may cut off his lower legs. Design call.
- **FR-083**: The player MUST still never cover a chart square (FR-056 stays). He stands to the lower left of the ball, as a penalty taker before the run-up, so his head and shoulders stay outside `CHART_RECT` or below it. The ball stays at the kick spot, and its flight is unchanged.
- **FR-084**: The kick animation MUST move the player one step toward the ball as it is kicked, then back. It is short (about 0.3 s) and does not delay the ball.

## Tests

- Unit: the player's drawn height is at least 1.3 times the keeper's; the player's drawn rectangle never overlaps `CHART_RECT`; the ball start point is unchanged.
- e2e (Chromium): `keeper.spec.ts` and `patterns.spec.ts` still pass.

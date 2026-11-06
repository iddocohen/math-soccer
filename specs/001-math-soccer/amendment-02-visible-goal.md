# Amendment 02: a visible goal with the board inside it

**Date**: 2026-11-06
**Requested by**: the parent, after playing hole mode on the local site: "I would like to see the goal itself hence the cutout should be within the goal if that makes sense".
**Observed**: the chart board filled the whole goal mouth, so no net was visible, the posts were thin lines, and the player covered the bottom row.
**Changes**: FR-001, FR-011, FR-019; `src/core/match/world.ts`, `GoalView`, `PlayerView`.

## Behavior

- **FR-053**: The scene MUST show a recognisable soccer goal in every mode: thick white posts and crossbar, side nets drawn in depth (perspective toward the back of the goal), and the net mesh visible.
- **FR-054**: In hole and line mode, the chart board MUST be a panel inside the goal mouth, inset from the posts and crossbar so the net shows on every side of it (at least 6% of the goal width at the sides and top). The target hole is cut into the panel, and a goal shot is seen passing through the hole into the net behind it.
- **FR-055**: In goalkeeper mode the faint grid MUST lie inside the same inset area, so the posts and net frame it in the same way.
- **FR-056**: The player and the ball at the kick spot MUST NOT cover any square of the chart: the player stands below the goal line, drawn smaller if needed.

## Layout (world 1600 by 1000)

- Goal frame (outer edge of posts and crossbar): x 260 to 1340, y 200 to 800; posts and crossbar 22 px thick.
- Chart area (`CHART_RECT` in `src/core/match/world.ts`, used by `cellRect` for the board, hints, help and ball): x 340 to 1260, y 250 to 750.
- Player at about (800, 905), scaled so his head stays below y 820; ball at the kick spot about (860, 940).

## Tests

- Unit: `CHART_RECT` lies inside the goal frame with the required margin; every `cellRect` lies inside `CHART_RECT`.
- e2e (Chromium): `holes.spec.ts` keeps passing; a screenshot check is not required.

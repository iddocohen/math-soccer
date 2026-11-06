# Amendment 06: shape patterns (Formen)

**Date**: 2026-11-06
**Requested by**: the parent: "It would also be great to have other tetris forms with detecting different numbers in between like L form or others."
**Changes**: adds the hint pattern "Formen" to amendment 05.

## Shapes

The seven four-square shapes known from falling-block games, each placed on the chart in any of its four turns:

| Shape | Name | Example on the chart |
|-------|------|----------------------|
| I | "Stab" | 34, 35, 36, 37 (across) or 14, 24, 34, 44 (down) |
| O | "Quadrat" | 34, 35, 44, 45 |
| T | "T" | 34, 35, 36, 45 |
| L | "L" | 34, 44, 54, 55 |
| J | "J" | 35, 45, 55, 54 |
| S | "S" | 35, 36, 44, 45 |
| Z | "Z" | 34, 35, 45, 46 |

The names are design calls. The game shows shapes, not their names, so the names appear only in the parent's settings, as a reference.

## Behavior

- **FR-071**: With "Formen", a target MUST be one square of a shape placed fully on the chart. The other squares of the shape light up as hints.
- **FR-072**: At higher adaptive steps, a shape MAY have two empty squares. The child then shoots them one after the other. Each correct shot is a goal, and the shape stays until both are filled. The second empty square lights up as the next target after the first goal. Design call: one empty square at ladder step 6, two at step 7 and above. The waiting empty square shows a faint dashed outline, so the whole shape stays visible; requested after viewing the shape screenshot.
- **FR-073**: The directions a shape target trains come from its neighbors inside the shape. For example, in the L 34, 44, 54, 55, the square 44 trains down and up, and 55 trains across. The progress page counts them like any other target.
- **FR-074**: The parent MAY turn single shapes off ("Formen" group in settings; all on by default).

## Tests

- Unit: every shape in every turn fits fully on the chart or is not chosen; the hints and target together form the shape; the trained directions of each square match its shape neighbors; two empty squares give two targets in a row.
- e2e (Chromium): a round with only "Formen" allowed scores two goals in a two-empty shape.

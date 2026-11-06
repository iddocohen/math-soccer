# Amendment 11: a better goal net and small visual fixes

**Date**: 2026-11-06
**Requested by**: the parent: "could the goal net be somehow improved, as today it looks a bit odd." The small fixes were found on the live site when checking "See again what is wrong".
**Observed**:
- The back net, side nets and roof net use a dense square mesh.
- In the goalkeeper game the faint chart grid is drawn over that mesh, so the goal looks like graph paper and the two grids blur together.
- Small glitches:
  - white bars from the floodlights peek out behind "0 Tore" (top left) and behind the shirt button (top right);
  - the number box next to the ball is an empty white rectangle before the child types;
  - "Spielen" shows no key hint while "Zeit-Challenge" shows "Z".

**Changes**: FR-053 (goal look), FR-055 (keeper grid), the start screen and the overlay.

## Net

- **FR-096**: The net MUST use a diamond (rhombus) mesh, like a real goal net, in thin chalk lines with lower opacity than today:
  - The back net is darker than the side nets and the roof, so the goal has depth.
  - The side nets and the roof follow the perspective of the frame.
  - The mesh hangs slightly: a gentle sag at the bottom of the back net and along the roof.
- **FR-097**: The chart grid in the goalkeeper game MUST read separately from the net. It is drawn as a soft panel of square cells:
  - thin lines, a faint dark fill and rounded cell corners;
  - lit hint squares and the target outline stay as they are;
  - the net shows behind the panel at reduced opacity.
  - The cell panel shows only from help step 2 until the target is solved (parent feedback).
- **FR-098**: The net MUST react when a goal goes in: it bulges out around the ball's landing point for about 0.4 s, then settles. A caught ball does not move the net.
- The net is drawn once into a texture (with its sag). Only the bulge animates.

## Small fixes

- **FR-099**: Nothing from the scene's floodlights or stands MUST show through or around the top bar buttons and counters. The overlay bars get a solid background matching the night sky, or the floodlights move out from under them.
- **FR-100**: Before the child types, the number box MUST show a faint placeholder (a small ball icon or "?"). It never shows the answer.
- **FR-101**: The "Spielen" button MUST show its key hint "Enter", like "Zeit-Challenge" shows "Z".
- **FR-101a**: The column scale labels above the crossbar sit over the fans and are hard to read (found in the screenshot after amendment 10). The column scale and the row scale MUST each lie on one calm dark strip in the night color, slightly transparent, so their labels read clearly. There is no box per label.

## Tests

- Unit: the net texture key depends only on the layout, so it is not redrawn per frame; the bulge starts only on a goal.
- e2e (Chromium): the start screen shows "Enter" on "Spielen"; the entry placeholder shows before typing and disappears with the first digit.
- One screenshot at 1280x800 of the goal with hints, checked by eye.

# Amendment 18: cutouts from the hundred chart (Ausschnitte)

**Date**: 2026-11-13
**Requested by**: the parent, with a photo of his son's workbook page "Ergänze die fehlenden Zahlen in den Ausschnitten aus der Hundertertafel" ("Der Zahlenraum bis 100", page 11): "we also have boxes and/or tetris items where my son needs to enter several numbers to succeed". The photo is saved as `workbook-cutouts.png` in the session scratchpad. The parent's answers:
- The keeper steps in only on the last square.
- The cutouts are a new level 6 after the X shape.

**Changes**: the levels of amendment 09 (FR-085 to FR-089) get a level 6. Shapes with gaps (amendment 06) and the cup's stage spread (FR-109) stay as they are.

## What the workbook asks

- **Exercise 3:** a 3×3 box with one number given, for example 43 in the middle row or 68 in the centre or 85 in a corner. The child writes the other eight numbers.
- **Exercise 4:** column and shape cutouts with one or two numbers given. The child fills the rest, for example:
  - a column 51, 61, …, with an L foot 81, 82
  - an L with 54, 55 on top, down to 85, 86
  - a T-like shape 68, 69, 70 over a column ending in 100

## Behavior

- **FR-124**: Level 6 ("Ausschnitte") MUST offer cutouts placed fully on the chart, with all squares inside the range:
  - **Boxes:** a 3×3 box, and a 2×3 or 3×2 box.
  - **Columns and rows:** a column of 4 to 5 squares, and a row of 4 to 5 squares.
  - **Shapes:** the seven Tetris shapes of amendment 06, and L and T shapes with arms of 3, as on the workbook page.

  Each cutout shows its whole outline. One or two squares are given with their numbers, and every other square is empty. Design call: one given square in boxes and longer cutouts, two in four-square shapes.
- **FR-125**: The empty squares MUST be filled one after the other:
  - **Next target:** the next empty square is marked as the target, starting next to a given or filled square. The order moves outward from the given numbers, so each next square touches something already known.
  - **Correct number:** the ball lands on the square, the square lights up with its number, the fans clap, and 1 star is earned.
  - **Wrong number:** the ball lands on the square of the typed number, as everywhere (FR-003), with the soft "ohhh" and the help steps of amendment 10.
- **FR-126**: The keeper MUST step in only for the last empty square. During the other squares he waits at the side of the goal, out of the cutout, and does not dive. The last square is a normal keeper shot. A correct number scores the goal with the celebration (FR-114), and the fans cheer. Filling the whole cutout earns a bonus of 3 stars.
- **FR-127**: A cutout MUST count as one target for the round's goal count and for the cup's "Tore pro Spiel": its final goal is the goal. Each square counts as its own attempt for progress, toward the direction that leads from the touching known square (across, down or diagonal).
- **FR-128**: Hearts follow FR-027 per square: misses in a row on the current square count. A lost heart shows the answer on that square, and the cutout continues.
- **FR-129**: Level 6 MUST join the levels of amendment 09:
  - The parent can pick it as start or hardest level.
  - The default hardest level becomes 6.
  - Adaptive difficulty can reach it after level 5.
  - The cup's stage spread includes it, so the final can be a cutout.
  - On the settings page, level 6 shows a small 3×3 box with one number as its example drawing.
- **FR-130**: The row and column helper (amendment 10, amendment 14) MUST work per square. Help for the current square shows its row and column. The grid of amendment 11 FR-097 shows from help step 2 until the current square is filled.
- A refresh during a cutout continues it. The stored round keeps the cutout's squares, the given ones and the filled ones. No migration is needed (the brief's rule).

## Design calls (T109)

- The fill order goes by the number of steps across and down from the nearest given square, then in reading order. Each square trains the directions from the known squares that share an edge with it, so cutouts train across and down. No square needs a diagonal, because every cutout is connected by edges.
- The Tetris cutouts use all seven shapes, whatever the shape switches of the settings say. Those switches belong to levels 3 and 4, so level 6 stays offered with every shape off.
- The seven Tetris shapes count as one cutout kind when level 6 picks a cutout, next to the 3×3 box, the 2×3 box, the row or column of 4, of 5, the L and the T. Otherwise the shapes would make up seven of thirteen picks.
- A filled square shows "Richtig, 68!" in the message line. The fans clap. The ball rests on the square for a quarter of a second and then fades, so the square's number shows soon.
- While hints wait for a request ("auf Wunsch"), the squares the child filled stay lit with their numbers, because they are the child's own answers. The given squares follow the hint display like any hint.

## Tests

- Unit:
  - every cutout lies fully on the chart for 1 to 100, 0 to 1000 and 205 to 480;
  - each next target touches a known square;
  - a correct square earns 1 star and the full cutout 3 more;
  - the keeper dives only on the last square;
  - one goal per cutout counts toward the goal count and the cup's goals per match;
  - progress gets one attempt per square with the right direction;
  - level 6 is reachable by adaptive difficulty and is clamped by the parent's range;
  - a stored round continues a half-filled cutout.
- e2e (Chromium): with start and hardest level 6 and a seed, fill a 3×3 box. The first seven squares light up without a keeper dive (`data-keeper` stays `idle`), the last one is a goal, and `data-goals` goes up by one.

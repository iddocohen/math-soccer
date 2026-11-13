# Amendment 23: Torwandschießen and Papa gegen Kind

**Date**: 2026-11-13
**Requested by**: the parent: "check if there are other modes based on such a game that could be implemented cheaply". From the four proposals he picked "Torwandschießen" and "Papa gegen Kind", both unlocked with stars.
**Changes**: the unlockable modes of amendment 21 (FR-140, FR-141), using the same `rounds.ts` mode table.

## Unlocking

- **FR-154**: The locker room group "Spielarten" MUST also offer:
  - "Torwandschießen": 150 stars.
  - "Papa gegen Kind": 250 stars.

  Each gets a start screen button once unlocked: "Torwand" (key W) and "Papa gegen Kind" (key F). The lock and price display, the parent switch "Spielarten erlauben" and the locker room shortcut work as in amendment 21.

## Torwandschießen

The classic German shooting wall: a board covers the whole goal, with only a few round holes.

- **FR-155**: A board MUST cover the goal mouth, painted in the board style of the old hole mode (light panel, chart squares faintly printed, no numbers). Two or three round holes are cut into chart squares.
  - One hole is the target. The game asks "Triff die 47!" in the message line.
  - The other holes are decoys at other chart squares.
  - There is no keeper.
- **FR-156**: The child MUST type the number of the hole asked for:
  - **Correct number:** the ball flies through that hole and scores a goal, with cheering.
  - **Number of a decoy hole:** the ball flies through that decoy and does not score. The soft "ohhh" plays, and the decoy shows its number for 1.5 s.
  - **Any other number:** the ball hits the board on that square, which shows its number (FR-003).

  Hint numbers follow the child's level, with fewer than usual:
  - levels 1 to 2: one neighbor shown;
  - from level 3: none, so the child finds the hole from the chart's structure alone.

  Help steps work as usual (row, column, chart, answer).
- **FR-157**: A round MUST be 10 shots. The end screen shows "N von 10 Treffern" and a personal best. Each goal earns 1 star. The holes move after every shot.

## Papa gegen Kind (two players on one tablet)

- **FR-158**: Two players, the child and a grown-up, take turns shooting in a penalty shootout against the computer keeper:
  - 5 shots each, then single shots in turn if the score is level;
  - player names shown: the child's shirt name, and "Papa" by default, changeable in the mode's start card;
  - before each shot, a big turn card names the shooter ("Leo ist dran!"), and Enter or a tap starts it.
- **FR-159**: Each player MUST have their own level, so the grown-up gets harder numbers:
  - the child plays at his current level;
  - the grown-up plays at a level chosen on the start card, level 6 by default.

  Targets, hints, help and the keeper work as in "Spielen".
- **FR-160**: The score MUST show as two rows of five circles (goal, miss, open), labelled with the names. At the end the winner gets a short trophy moment with confetti: "Leo gewinnt!" or "Papa gewinnt!".
  - The child earns 1 star per goal and 3 stars for a win.
  - The grown-up earns no stars.
  - A loss shows "Knapp! Revanche?" and nothing is taken away.
- **FR-161**: Only the child's shots count for progress, adaptive difficulty and records. The grown-up's shots are not recorded.

## Tests

- Unit:
  - Torwand holes lie on the chart and never overlap;
  - a decoy is a miss and the target a goal;
  - hint counts per level;
  - 10 shots per round;
  - the shootout order, sudden death and per-player levels;
  - only the child's attempts are recorded, and only the child gets stars.
- e2e (Chromium):
  - unlock "Torwand" with seeded stars, score through the asked hole, and miss through a decoy;
  - unlock "Papa gegen Kind", play to the end with the turn cards and the speed hook, and see the winner card.
- Screenshots at 1280x800 of both modes.

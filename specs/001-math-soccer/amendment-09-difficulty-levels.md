# Amendment 09: difficulty levels from straight lines to the X shape

**Date**: 2026-11-06
**Requested by**: the parent: "lines (vertical and/or horizontal) are the easiest, diagonal lines are next level, then the tetris shapes and last X shape. So over time I would like the difficulty level to increase as he gets things right and I would like to define the range." Answers: the parent sets the start level and the hardest level; the X shape is the diagonal cross.
**Changes**: replaces the ladder of FR-067 (amendment 05) and the step rule of FR-072 (amendment 06). Replaces the settings "Hinweis-Muster" and "Richtungen" (FR-066) with levels. Keeps the "Formen" switches (FR-074) and the hint display "immer" or "auf Wunsch".

## Levels

| Level | German label | Targets |
|-------|--------------|---------|
| 1 | "Gerade Linien" | Nachbarn, Mitte and Reihe across and down (forward and backward) |
| 2 | "Schräge Linien" | Mitte and Reihe on the two diagonals (forward and backward) |
| 3 | "Formen" | Tetris shapes with one empty square (amendment 06) |
| 4 | "Formen mit 2 Lücken" | Tetris shapes with two empty squares |
| 5 | "X-Form" | the diagonal cross |

The X shape is five squares: a centre and its four diagonal corners. For example, the centre 45 has the corners 34, 36, 54 and 56. One empty square is the target; with adaptive difficulty above two successes at level 5, two empty squares appear, shot one after the other, as in FR-072.

## Behavior

- **FR-085**: The parent MUST set "Stufe am Anfang" (start level, default 1) and "Schwerste Stufe" (hardest level, default 5) in settings, under a new group "Schwierigkeit". The start level must not be above the hardest level. Each level shows a small example drawing on the settings page.
- **FR-086**: A round MUST start at the child's current level. On the very first round, or after a reset, that is the start level. The current level is kept between rounds.
- **FR-087**: With adaptive difficulty on, the level MUST go up one after 3 targets in a row solved alone (no help, not a guess, as FR-038 defines). It MUST go down one when 2 of the last 3 targets needed help. It MUST never go below the start level or above the hardest level. With adaptive off, the level stays at the start level.
- **FR-088**: When the level changes, the game MUST show a short, positive line, such as "Neue Stufe: Schräge Linien!" with a small cheer. A level going down shows nothing, so it never feels like a loss.
- **FR-089**: Within a level, targets are drawn at random. Directions the child has not mastered yet are weighted twice, as before (FR-040).
- **FR-090**: The progress page MUST show the current level and, per level, targets solved alone and with help, next to the existing per-direction table.
- If a parent turns off every Tetris shape, levels 3 and 4 are skipped and the level moves on to the next allowed one.
- The "Richtungen" and "Hinweis-Muster" settings are removed, because the levels decide them.

## Stored data

- Settings move to the next version. A migration maps the old choices: start level 1, hardest level 5, and the hint display and shape switches kept.
- The stored adaptive steps of amendment 05 are replaced by one stored current level. Old steps 0 to 2 map to level 1, 3 to 4 to level 2, 5 to level 3, and 6 to 7 to level 4, clamped to the parent's range.

## Tests

- Unit:
  - each level offers only its targets;
  - the X shape stays fully on the chart;
  - the level rises after 3 independent solves and falls after 2 helped ones in 3;
  - the level is clamped to the parent's range;
  - the level is kept across rounds;
  - the settings migration and the old step mapping work;
  - turning off all shapes skips levels 3 and 4.
- e2e (Chromium): with start level 1 and hardest level 2, three goals in a row show "Neue Stufe: Schräge Linien!" and then diagonal hints.

# Amendment 05: the goalkeeper game is the main and only game

**Date**: 2026-11-06
**Requested by**: the parent: "I think the goaly should be the main game play and we do not need all the others, as with the difficulty and randomness, rows, diagonal roles and or the middle numbers as done today, can be just introduced with goaly accordingly." Then: "Remove them".
**Changes**: removes hole mode and line mode (US1 hole parts, US4, FR-011 to FR-018, FR-054 hole/line parts) and replaces the three-mode start screen (FR-030). The goalkeeper game (US5, FR-019, FR-020) becomes the game. Adds hint patterns, which carry over what hole and line mode taught.

## What stays

The goal, the chart in rows of 10, typing a number to shoot, the ball landing on the square of the typed number, help in three steps, hearts, rounds, personal bests, the locker room, the parent gate, settings, progress and backup.

## Hint patterns

Every target is an empty square in the faint grid over the open goal. A **hint pattern** decides which numbers light up around it.

| Pattern | German label | What lights up | Example (target 46) |
|---------|--------------|----------------|---------------------|
| Neighbors | "Nachbarn" | the squares around the target, as the old hint distance chose them | 45, 47, 36, 56 |
| Middle | "Mitte" | the two squares on both sides of the target in one direction, so the target is the middle | across: 45 and 47; down: 36 and 56; diagonal: 35 and 57 |
| Row | "Reihe" | two or three squares before the target in one direction, so the target continues the row | down: 16, 26, 36; diagonal: 13, 24, 35 |
| Shape | "Formen" | see amendment 06 | |

- **FR-065**: Each target MUST use one hint pattern and one direction (across, down, diagonal down-right, diagonal down-left, and their backward versions where the pattern allows). The trained directions come from the pattern and direction, as FR-038 describes.
- **FR-066**: The parent MUST choose which patterns are allowed ("Hinweis-Muster": Nachbarn, Mitte, Reihe, Formen; all on by default) and which directions are allowed ("Richtungen": the existing line direction switches move here; default across, down and both diagonals; backward off).
- **FR-067**: Adaptive difficulty MUST choose the pattern and the direction within the parent's choices, using a ladder from easiest to hardest. Unmastered directions are weighted twice, as before:
  1. Nachbarn
  2. Mitte across
  3. Mitte down
  4. Reihe down
  5. Mitte or Reihe diagonal
  6. Formen
  7. Nachbarn two squares away
  8. "auf Wunsch" (hints hidden until help)

  With adaptive off, the parent's choices are drawn at random with equal weight.

## Start screen and settings

- **FR-068**: The start screen MUST show one big "Spielen" button (Enter or Space) and, when allowed, a "Zeit-Challenge" button (amendment 07). Keys 1 to 3 for modes are removed. "Kabine" and the gear stay.
- **FR-069**: The settings MUST drop "Spielarten", the line length and the hole settings. "Hinweis-Muster" and "Richtungen" replace them. The hint display ("immer" or "auf Wunsch") stays.

## Stars

- A goal earns 2 stars, as in keeper mode before.

## Stored data

- **FR-070**: Settings move to the next version. A migration drops the mode and line-length fields, keeps the old line directions as "Richtungen", and turns all patterns on.
- Stored rounds in hole or line mode are discarded on load.
- Progress keeps all old attempts: progress per direction counts every mode, and the progress page shows mode columns only for the keeper game, plus a "früher" (earlier) total for the removed modes.
- Personal bests from the removed modes are kept under "früher" and are no longer compared with new rounds.
- Old adaptive steps 0 to 3 map to new steps 0, 2, 6 and 7.

## Code to remove

Hole and line logic and drawing: patched holes, the hole board panel, line state, `lines.ts` except what Reihe reuses, line e2e specs, and hole e2e specs. Their unit tests go with them, except tests of shared code that the keeper game still uses. The help arrow and help chart stay.

## Tests

- Unit: each pattern produces hint squares on the chart only, with the target where the pattern says (middle, end of a row); the ladder order; settings migration from the previous version; old stored rounds are discarded.
- e2e (Chromium): a round from "Spielen" with each pattern forced through settings; `keeper.spec.ts`, help, settings, locker room, persistence, offline and base path still pass; `holes.spec.ts` and `lines.spec.ts` are removed.

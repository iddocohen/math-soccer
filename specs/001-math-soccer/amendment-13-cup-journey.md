# Amendment 13: the cup journey (Pokal-Reise) and goal celebrations

**Date**: 2026-11-06
**Requested by**: the parent asked for "the one killer feature that would hook my son to play this game". The recommendation was a cup journey with a cheap add-on of chosen goal celebrations. The parent answered: "Yes do it and also the cheap-addons".
**Why**: a clear, short goal (win this match) and visible progress (a bracket and a trophy shelf) give a reason to come back. The cup stages carry the difficulty levels of amendment 09, so the child feels he is getting further in the cup, not that the math got harder. Losing costs nothing.
**Changes**: the start screen (FR-068), the locker room (FR-043), stars (FR-042), stored data (FR-036), backup and reset (FR-041, FR-051).

## The cup

- **FR-105**: The start screen MUST show a third big button, "Pokal" (key P). The other buttons are "Spielen" (Enter) and "Zeit-Challenge" (Z). "Pokal" opens the bracket screen. Design call on the key.
- **FR-106**: A cup MUST have five matches, shown as a bracket from left to right:
  1. Gruppenspiel 1
  2. Gruppenspiel 2
  3. Viertelfinale
  4. Halbfinale
  5. Finale

  The next match is highlighted. Enter, Space or a tap on it starts it. Won matches show a check mark and the score.
- **FR-107**: Each match MUST be against a made-up team. Each team has a name, team colors on the keeper's shirt and stand scarves, and a keeper with a look-only quirk:
  - very tall
  - small and quick
  - a big beard
  - a cap
  - one who celebrates saves
  - one who always looks left first

  There are 8 teams with friendly German names, such as "FC Blitz", "Rote Löwen", "Adler 09", "Blaue Haie", "Turbo Kicker", "Grüne Frösche", "Sternenelf" and "Wilde Wölfe". Quirks never change where the keeper can reach and never change the math. No real clubs, players or league names are used.
- **FR-108**: A match MUST be won by scoring the parent's "Tore pro Spiel" (3 to 10, default 5) before the 3 hearts are gone. Hearts follow FR-027 (misses per heart by difficulty). Help works as usual.
  - **Win**: the bracket advances, and the child sees "Gewonnen! Weiter ins Halbfinale".
  - **Loss**: the child sees "Knapp! Noch mal gegen Adler 09?" and replays the same match. Nothing is lost, and there is never a step back in the bracket.
- **FR-109**: Each stage MUST set the level of its targets:
  - The cup's stages are spread across the parent's level range (start level to hardest level, amendment 09), from group games (lowest) to the final (highest).
  - Adaptive difficulty does not change the level inside a cup match.
  - Safeguard for low frustration tolerance: after 2 lost tries of the same match, that match plays one level easier, never below the start level. Design call.
- **FR-110**: The final MUST feel bigger than the other matches:
  - a full stand
  - the crowd chanting the child's shirt name, as a synthesized rhythm with clapping (no recorded name)
  - on the win: confetti, fireworks over the stands, and the player lifting the cup
- **FR-111**: Winning a cup MUST put a cup on a trophy shelf in the locker room, labelled "Pokal 1", "Pokal 2" and so on. The next cup starts automatically and sits one level higher, within the parent's range: its group games start one level above the last cup's group games, until they reach the hardest level.
- **FR-112**: Stars:
  - a goal in a cup match earns 2 stars, as in "Spielen";
  - a won match adds 5;
  - a won cup adds 20.
- The cup clock is the round clock (FR-029). The cup has no time limit.

## Goal celebrations (Jubel)

- **FR-113**: The locker room MUST have a new group "Jubel" with celebrations:
  - "Arme hoch" (arms up), free and chosen by default
  - "Rutschen" (knee slide)
  - "Flugzeug" (airplane arms, running in a curve)
  - "Salto" (backflip)
  - "Tanz" (dance)
  - "Herz" (hands form a heart)

  Each costs 10 to 30 stars. A preview plays the celebration in the locker room.
- **FR-114**: After every goal, in all game types, the player MUST play the chosen celebration (about 1.2 s) while the fans cheer. The next target appears when it ends. Enter or a tap skips it. In the time challenge it plays faster (0.6 s), so it costs little time.

## Stored data

- A new stored kind `mathsoccer.cup.v1`, versioned like the others, holds:
  - the cup number
  - the stage
  - the tries of the current match
  - won match scores
  - the trophy list
- It is part of "Daten sichern" and "Daten laden", the QR transfer, "Kopie wiederherstellen" and "Alles zurücksetzen".
- The locker room data gets the owned and chosen celebration, with a version bump and a migration (default "Arme hoch").
- A running cup match is saved like a round, so a refresh continues it.
- A cup match whose cup was replaced during it (reset, loaded data or transfer) records no result.

## Tests

- Unit:
  - the bracket order;
  - win and loss outcomes;
  - the match level spread over the parent's range;
  - one level easier after 2 lost tries, never below the start level;
  - the next cup one level higher, clamped to the parent's range;
  - star bonuses;
  - cup storage and migration, including transfer and reset-all;
  - celebration purchase and choice;
  - the skip key.
- e2e (Chromium): start "Pokal" with "Tore pro Spiel" 3, using the `?speed=` hook and seeded targets. Win group game 1 and see the bracket advance. Lose a match and see "Knapp!" with the same opponent. Buy and choose "Rutschen" and see it play after a goal (`data-celebration`).

# Amendment 14: help scales only on misses, and a way back to the start

**Date**: 2026-11-06
**Requested by**: the parent, after trying the local site:
- "Why do I see on the right hand side the column all the time, it should be right? only when missing over time."
- "after I missed it twice, I can see a grid popping up … which should only appear when both row and column are displayed for a given number and disappear after." This is handled in amendment 11, FR-097.
- "Also I do not have any option to go back to the start menu."
- Later the same day: remove the help sentence at the bottom completely (FR-119).

**Changes**: FR-093 (amendment 10: helper shown at all times) and FR-095; the help line of FR-024 and amendment 10's help steps; the match overlay and the pause screen (FR-033, FR-030).

## Help scales

- **FR-115**: The row scale and the column scale MUST be hidden while the child aims without help. Each one appears as a help step, and they go away with the target:
  - **Help step 1**: the row scale appears with the arrow and the row band.
  - **Help step 2**: the column scale appears too, with the arrow and the column band. The cell grid shows (FR-097).
  - **Steps 3 and 4**: both stay.
  - **When the target is solved or replaced**: both scales, the bands and the grid disappear.
- This replaces FR-093's "shown at all times by default". The parent switch "Zeilen- und Spaltenhilfe" now decides whether help steps 1 and 2 show the scales' labels. With the switch off, the bands and arrows still show (FR-095).

## Help sentence removed

- **FR-119**: The help sentence under the goal is removed; help is shown only by arrows, bands, scales, the hint arrow, the full chart and the answer (parent feedback).
  - The sentence was the line such as "Von 84 eine Reihe runter: +10. Die Zahl ist in der Reihe 90 und in der Spalte 4."
  - "Vorlesen" reads only the task; there is no help sentence to read.
  - The short miss message ("Hier ist 95. Nochmal!") stays.

## Back to the start

- **FR-116**: The match MUST have a home button (a house icon, accessible name "Zum Start") in the top bar next to pause. One tap pauses the round and asks "Runde beenden?" with two buttons: "Weiter" (Enter) and "Zum Start".
- **FR-117**: The pause screen (Escape or the pause button) MUST offer "Weiter" (Enter or Escape) and "Zum Start".
- **FR-118**: "Zum Start" MUST end the round without an end screen:
  - Stars earned so far stay (they were awarded at once).
  - Attempts already finished stay in progress.
  - The unfinished target records no attempt.
  - The round is not a personal best.
  - The stored round is cleared.
  - In the time challenge the countdown stops and no best is recorded.
  - A cup match (amendment 13) counts as neither won nor lost, and the bracket stays where it was.
- Keys: Escape pauses; on the pause screen, Enter continues. "Zum Start" has no key of its own, so a stray key press never ends a round. Design call.

## Tests

- Unit: the scales are hidden at help step 0, the row scale shows from step 1, the column scale from step 2, and none after a solve; "Zum Start" keeps stars and finished attempts and records no best and no attempt for the open target.
- Unit and e2e: no help sentence shows at any help step (FR-119).
- e2e (Chromium): no scale shows before the first miss; the row label shows after one miss and the column label after two; both are gone after the goal; the home button leads to "Runde beenden?" and "Zum Start" shows the start screen; Escape followed by "Zum Start" does the same.

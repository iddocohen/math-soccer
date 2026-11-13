# Amendment 20: new things to buy

**Date**: 2026-11-13
**Requested by**: the parent asked for ideas on what more his son could buy, then picked all four groups: ball trails, his own stadium, a mascot, and goal effects plus weather.
**Rules**: all items are looks and effects only. They never change the math, the difficulty or the keeper's reach. There are no random packs: every item has a fixed price and is chosen directly. Prices follow the economy of amendment 19.

**Changes**: the locker room (FR-043), with new groups, and the scene.

## New locker room groups

| Group (German) | Items | Price range |
|----------------|-------|-------------|
| "Ballspur" (ball trail) | none (free, default), sparkles, fire, rainbow, stars | 40 to 120 |
| "Stadion" | stadium name on a scoreboard (free text, up to 14 letters, default "Mathe-Arena"), bigger stands (2 more rows), floodlight color (white free; gold, blue, green, purple) | name free; stands 150; floodlight colors 40 each |
| "Maskottchen" | none (free), dog, lion, penguin, bear | 80 to 150 |
| "Tor-Effekt" | none (free), fireworks, confetti, light show | 60 to 120 |
| "Wetter" | evening (free, today's look), day, sunset, snow, rain | 50 to 100 |

## Behavior

- **FR-134**: The ball trail MUST follow the ball in flight on every shot, drawn behind the ball, and fade within 0.4 s after it lands. It is not shown on the help chart.
- **FR-135**: The stadium name MUST show on a scoreboard above the stands, next to the goal count. "Bigger stands" adds two rows of fans. The floodlight color tints the floodlights and the light cone.
- **FR-136**: The mascot MUST stand at the side of the pitch, left of the goal, outside the chart and the scales. It idles, jumps and waves on a goal, and covers its eyes briefly on a miss in a friendly way. It never covers numbers, helpers or buttons.
- **FR-137**: The goal effect MUST play on every goal, in all game types, for about 1 s, together with the celebration (FR-114). In the cup final the final's own show plays instead (FR-110).
- **FR-138**: The weather MUST change the sky, the light and an overlay:
  - **day:** a blue sky with lighter grass and no floodlight cones;
  - **sunset:** an orange sky;
  - **snow:** falling snowflakes and a light white cover on the grass edges;
  - **rain:** falling rain streaks and a darker, wet look.

  Snow and rain overlays MUST stay behind the chart and never reduce the readability of numbers. The chosen weather applies to all rounds.
- **FR-139**: All new items MUST have a preview in the locker room, as celebrations do (FR-113).
- The locker room schema gains the new owned and chosen fields with defaults. No migration is needed (the brief's rule).

## Tests

- Unit: prices within ranges; buy and equip per group; the stadium name is limited to 14 letters; the mascot's rectangle never overlaps `CHART_RECT`, the scales or the top bar; the weather overlay is drawn behind the chart layer.
- e2e (Chromium): buy and equip a ball trail, mascot, goal effect and weather, start a round, and check `data-trail`, `data-mascot`, `data-goal-effect` and `data-weather` on the match. Score once and see the goal effect run.
- One screenshot per weather at 1280x800, checked by eye for number readability.

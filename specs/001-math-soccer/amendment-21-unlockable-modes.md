# Amendment 21: game modes to unlock with stars

**Date**: 2026-11-13
**Requested by**: the parent: "And or a new game mode he could unlock to use those stars". He picked all three proposals:
- "Selbst ins Tor" (about 300 stars)
- "Elfmeterschießen" (about 600 stars, after "Selbst ins Tor")
- "Freistoß mit Mauer" (about 200 stars)

**Changes**: the start screen (FR-068, FR-105) and the locker room (a new group "Spielarten" for unlocking). Stars follow amendment 19.

## Unlocking

- **FR-140**: The locker room MUST have a group "Spielarten" with three modes:
  - "Freistoß mit Mauer": 200 stars.
  - "Selbst ins Tor": 300 stars.
  - "Elfmeterschießen": 600 stars. It can be bought only after "Selbst ins Tor" is owned; until then it shows "Erst Selbst ins Tor freischalten".

  A locked mode shows its price and a short preview animation. Once bought, a mode stays unlocked.
- **FR-141**: Each unlocked mode MUST get its own button on the start screen, below "Spielen", "Zeit-Challenge" and "Pokal":
  - "Mauer" (key M)
  - "Torwart" (key T)
  - "Elfmeter" (key E)

  Locked modes show as greyed buttons with a lock and the price; tapping one opens the locker room at "Spielarten". Design call on the keys.
- The parent can turn each unlockable mode off in settings ("Spielarten erlauben"), which hides its button.

## Freistoß mit Mauer

- **FR-142**: A wall of 3 to 5 defenders stands in front of the goal and covers a band of chart columns.
  - The target and its hints are always in the free part.
  - A shot at a number behind the wall hits the wall, with the soft "ohhh". The square of the typed number still flashes, so the child sees where the number is (FR-003).
  - The wall moves to new columns after each goal.
  - The defenders are drawn taller than the keeper and smaller than the child's player, standing on the grass in front of the goal line under the covered columns, beside the child's player whenever the free columns allow it; they are drawn behind the grid, so they never cover a number, a hint or the target.

  Targets come from the child's current level. Rounds follow the parent's round type.

## Selbst ins Tor (he is the goalkeeper)

- **FR-143**: The view stays the same goal, but the child is the keeper:
  1. An opponent player (a cup team) stands at the penalty spot and shoots.
  2. The ball heads for one square of the faint grid, which flashes in a ring, with no number on it.
  3. The child types that square's number before the ball arrives, then presses Enter.

  - **Correct number:** the keeper (the child's player, in the child's kit and number) dives and saves, and the fans cheer.
  - **Wrong number or too late:** the keeper dives to the typed square, the ball goes in, and the soft "ohhh" plays. The real square shows its number, and the next shot follows.
- **FR-144**: The ball's flight time MUST give enough time to read the chart and type:
  - 8 s by default, set by the parent as "Schussgeschwindigkeit": langsam 10 s, mittel 8 s, schnell 5 s;
  - a visible countdown arc around the target square, in kit yellow;
  - the first shot of each round always at the slow speed.
- **FR-145**: Help in this mode works on the target square, following the help steps of amendment 10:
  1. row band and row scale
  2. column band and column scale
  3. the whole chart
  4. the answer

  Help pauses the ball's flight until the next key, so asking never costs a goal.
- **FR-146**: The squares chosen MUST follow the child's level, in reverse:
  - levels 1 to 2: any square, with its row and column neighbors shown as hints;
  - levels 3 to 4: fewer hints;
  - levels 5 to 6: no hints.

  A round ends after 10 shots. The end screen shows "N von 10 gehalten" and a personal best. Each save earns 1 star.

## Elfmeterschießen (penalty shootout)

- **FR-147**: A shootout against a cup team, 5 rounds. Each round has one shot by the child (as in "Spielen", against the opponent's keeper) and one shot by the opponent (as in "Selbst ins Tor").
  - The score shows as two rows of five circles (goal, miss, open).
  - If it is level after 5 rounds, single rounds follow until one side leads.
  - The opponent scores when the child does not save. The opponent's own shots never miss on purpose.
- **FR-148**: Winning the shootout MUST show a short trophy moment ("Elfmeter-Sieger!") with confetti and earns 5 stars. A loss shows "Knapp verloren! Noch mal?". Nothing is taken away.
- Targets come from the child's current level. Help works as in each half: as in "Spielen" for his shots, and as in FR-145 for saves.

## Stored data

- The locker room gains the unlocked modes. Records gain a best per mode ("Torwart": most saves out of 10; "Elfmeter": shootouts won; "Mauer": as the normal round type). No migration is needed (the brief's rule).

## Tests

- Unit:
  - prices and the unlock order ("Elfmeterschießen" needs "Selbst ins Tor");
  - locked modes are not startable;
  - the wall never covers the target or its hints, and a shot behind the wall counts as a miss;
  - in keeper mode, a save on a correct number, a goal on a wrong or late number, the flight time per speed, help pausing the flight, hints per level, and a round of 10 shots;
  - the shootout's 5 rounds, sudden death when level, and the score display data;
  - the stars per save and per shootout win.
- e2e (Chromium):
  - unlock "Mauer" with seeded stars, play a goal past the wall;
  - unlock "Torwart", save one shot by typing the flashing square's number, concede one by typing a wrong number;
  - unlock "Elfmeter", play a shootout to the end with the speed-up hook.
- Screenshots at 1280x800 of each mode for a visual check.

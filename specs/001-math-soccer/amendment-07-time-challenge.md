# Amendment 07: time challenge (Zeit-Challenge)

**Date**: 2026-11-06
**Requested by**: the parent: "It would also be great to have a time based game where how many goals you can hit in X time." Then: the child picks it on the start screen.
**Changes**: FR-026 (round types), FR-028 (end screen and bests), FR-034 settings list, the start screen from amendment 05.

## Behavior

- **FR-075**: The start screen MUST show a "Zeit-Challenge" button next to "Spielen" when the parent allows it (default: allowed). Key Z starts it. Design call.
- **FR-076**: The parent MUST set the challenge time: 1, 2, 3 or 5 minutes (default 2), and MAY turn the challenge off ("Zeit-Challenge erlauben").
- **FR-077**: A time challenge round MUST show a countdown clock at the top. It has no hearts: misses cost only time. It ends when the time is up. A ball already in flight still lands and counts.
- **FR-078**: The countdown MUST stop while the game is paused, the parent menu or locker room is open, or the tab is hidden, as the round clock does (FR-029).
- **FR-079**: Help works as usual (FR-024, FR-025) and costs nothing but time. A goal after help step 3 counts as FR-025b says.
- **FR-080**: The end screen MUST show "N Tore in M Minuten" and compare with the personal best for the same range and time ("Neuer Rekord!" or "Dein Rekord: N"). Bests are stored per range and challenge time.
- **FR-081**: In the last 10 seconds the clock MUST turn kit yellow and pulse gently. There is no ticking sound and no red, so the end does not feel like a threat. Design call, in line with the low-frustration rule.
- Normal rounds ("Spielen") keep the parent's round type (hearts or a number of goals).
- Saved settings change the challenge time only from the next round, as FR-052 says for round-shaping settings.
- A stored time challenge is discarded on load when the parent no longer allows the challenge.

## Tests

- Unit: the countdown runs only while playing; the round ends at zero after a ball in flight lands; no hearts are lost on misses; bests are keyed per range and time.
- e2e (Chromium): start with Z and a 1-minute setting, using the test speed-up hook. Score twice, let the time run out, and the end screen shows "2 Tore in 1 Minute".

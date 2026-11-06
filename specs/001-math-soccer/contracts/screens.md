# Contract: screens, keys and test hooks

World size 1600 by 1000, scaled to fit (src/core/match/world.ts, amendment 02). Goal frame (outer edge of posts and crossbar): x 260 to 1340, y 200 to 800, posts and crossbar 22 thick; the bottom edge is the goal line. Number chart panel inside the goal mouth: x 340 to 1260, y 265 to 750, so the margin at the sides (80) and the top (65) is at least 6% of the goal width (FR-054). Stands: y 0 to 260. Ball spot before a shot (kick spot): (860, 940), below the goal line.

| Screen | Built with | Opens from | Content and keys |
|--------|-----------|-----------|---------|
| Start | React | App load | One big button per offered mode: "Löcher" (`data-mode="holes"`, key 1), "Reihen" (`data-mode="lines"`, key 2), "Torwart" (`data-mode="keeper"`, key 3); Enter or Space starts the first offered mode; "Kabine" button (K) and star total when the locker room is on; gear (hold 2 s); fullscreen button; a short note with "OK" when stored data was reset on load (naming the kind and "Kopie wiederherstellen") or a save failed during play (`data-testid="start-notice-reset"`, `data-testid="start-notice-save"`). `?mode=holes\|lines\|keeper` makes Enter or Space start that mode (tests) |
| Match | Phaser + React overlay | A mode button | Scene; overlay with the typed number (`data-testid="entry"`), message line (`data-testid="message"`), goal counter, hearts (with `untilHearts`), help button (`?`), speaker icon when speech is on, pause, fullscreen, gear, and the "Kabine" icon next to the gear when the locker room is on (opens the locker room over the match and pauses the round); number pad by setting. Keys: digits, Backspace, Enter or Space shoot, H help, Escape pause. `data-testid="match"` carries `data-target`, `data-phase`, `data-help`, `data-help-chart`, `data-goals`, `data-hearts`, `data-rows`, `data-line`, `data-line-index`, `data-ball` (the chosen ball design), `data-ball-kind`, `data-shirt` (the chosen shirt color), `data-keeper` (the keeper's phase, goalkeeper mode only) and `data-number-pad` (true when the number pad shows) for tests |
| Help chart | React overlay | Help step 2 | The full chart of the range in a modal panel, target square and last typed number marked; closes with Enter, Space, Escape or a tap, and that key does not shoot; `data-testid="help-chart"` |
| Round end | React overlay | Round over | Encouraging line, "8 Tore in 5:40", "Neuer Rekord!" or "Dein Rekord: 9", stars earned; "Nochmal" (Enter or Space), "Zurück" |
| Parent gate | React | Gear held 2 s | Menu: "Einstellungen", "Fortschritt". No key opens it |
| Settings | React | Parent menu | All Settings fields, grouped: Zahlenraum, Spielarten, Hinweise, Reihen, Runde, Schwierigkeit, Ton, Bedienung, Kabine, Daten (sichern, laden, QR); "Kopie wiederherstellen" when a kept copy of data this version can read exists |
| Progress | React | Parent menu | Table per direction and mode: attempts, alone, with help, step, "gemeistert"; personal bests; "Fortschritt zurücksetzen" with confirmation (keeps stars and bests); "Alles zurücksetzen" with confirmation (progress, bests, stars and locker room; the settings stay) |
| Locker room | React | "Kabine" or K | Preview player and ball; groups Ball, Trikot, Nummer und Name, Fans; locked items show "noch N Sterne"; Escape back |
| Transfer dialog | React | Link with `#save=` | As math-tank |

## Test query parameters

These parameters exist for the end-to-end tests, as in math-tank. A child never needs them.

- `?mode=holes|lines|keeper`: Enter or Space on the start screen starts that mode when the parent offers it, instead of the first offered mode.
- `?seed=N`: the round seed, a whole number from 0 to 9999999999, so targets follow the same order on every run.
- Short rounds: specs store settings before the page loads (`seedStorage` in `tests/e2e/fixtures.ts`), for example `roundType: 'goalCount'` with `goalsPerRound: 2`, instead of a query parameter.
- A running round is saved under `mathsoccer.round.v1` between shots, so a reload continues it.

## Feedback contract

| Event | Scene | Sound | Message (German) |
|-------|-------|-------|------------------|
| Goal | ball into net; in goalkeeper mode the keeper dives toward the ball and falls short; fans jump, wave scarves | cheer | "TOR!" |
| Correct square (line) | square lights up, fans clap | clapping | "Richtig!" |
| Miss | ball hits the board, or the keeper jumps to the ball's square and catches it; the square of the typed number shows its number in a warm orange for 1.5 s or more | soft "ohhh" then clapping (clapping only if "ohhh" is off) | "Hier ist 56. Nochmal!" |
| Out of range | no shot | none | "Zahlen von 1 bis 100" |
| Heart lost | one ball icon fades | soft clapping | "Weiter geht's!" |

Forbidden in all child text: "falsch", "verloren", "Fehler", "schlecht".

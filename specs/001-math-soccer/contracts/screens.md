# Contract: screens, keys and test hooks

World size 1600 by 1000, scaled to fit. Goal rectangle: x 300 to 1300, y 230 to 790. Stands: y 0 to 260. Player and ball spot: (800, 930).

| Screen | Built with | Opens from | Content and keys |
|--------|-----------|-----------|---------|
| Start | React | App load | One big button per offered mode: "Löcher" (`data-mode="holes"`, key 1), "Reihen" (`data-mode="lines"`, key 2), "Torwart" (`data-mode="keeper"`, key 3); Enter or Space starts the first offered mode; "Kabine" button (K) and star total when the locker room is on; gear (hold 2 s); fullscreen button. `?mode=holes\|lines\|keeper` starts that mode (tests) |
| Match | Phaser + React overlay | A mode button | Scene; overlay with the typed number (`data-testid="entry"`), message line (`data-testid="message"`), goal counter, hearts (with `untilHearts`), help button (`?`), speaker icon when speech is on, pause, fullscreen, gear; number pad by setting. Keys: digits, Backspace, Enter or Space shoot, H help, Escape pause. `data-testid="match"` carries `data-target`, `data-phase`, `data-help`, `data-goals`, `data-hearts` for tests |
| Help chart | React overlay | Help step 2 | The full chart of the range in a modal panel, target square and last typed number marked; closes with Enter, Escape or a tap; `data-testid="help-chart"` |
| Round end | React overlay | Round over | Encouraging line, "8 Tore in 5:40", "Neuer Rekord!" or "Dein Rekord: 9", stars earned; "Nochmal" (Enter or Space), "Zurück" |
| Parent gate | React | Gear held 2 s | Menu: "Einstellungen", "Fortschritt". No key opens it |
| Settings | React | Parent menu | All Settings fields, grouped: Zahlenraum, Spielarten, Hinweise, Reihen, Runde, Schwierigkeit, Ton, Bedienung, Kabine, Daten (sichern, laden, QR) |
| Progress | React | Parent menu | Table per direction and mode: attempts, alone, with help, step, "gemeistert"; personal bests; reset with confirmation (keeps stars) |
| Locker room | React | "Kabine" or K | Preview player and ball; groups Ball, Trikot, Nummer und Name, Fans; locked items show "noch N Sterne"; Escape back |
| Transfer dialog | React | Link with `#save=` | As math-tank |

## Feedback contract

| Event | Scene | Sound | Message (German) |
|-------|-------|-------|------------------|
| Goal | ball into net (or past keeper), fans jump, wave scarves | cheer | "TOR!" |
| Correct square (line) | square lights up, fans clap | clapping | "Richtig!" |
| Miss | ball hits the board or the keeper catches it; the square of the typed number shows its number in a warm orange for 1.5 s or more | soft "ohhh" then clapping (clapping only if "ohhh" is off) | "Hier ist 56. Nochmal!" |
| Out of range | no shot | none | "Zahlen von 1 bis 100" |
| Heart lost | one ball icon fades | soft clapping | "Weiter geht's!" |

Forbidden in all child text: "falsch", "verloren", "Fehler", "schlecht".

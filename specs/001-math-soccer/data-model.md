# Data Model: Math Soccer

All stored entities are validated with Zod on load and carry a `version`. Damaged data, and data from a newer version of the game, is reset with a short message (FR-036), as math-tank; older data is migrated (see "Stored data baseline").

## Stored data baseline (T106)

Every stored kind is at version 1 with the shape described below: settings, progress, records, locker room, round and cup. The storage keys keep their names (`mathsoccer.<kind>.v1`).

During development the kinds went through versions 2 to 4 under the same keys (settings and progress up to 4, round up to 4, locker room up to 2), with migration steps between them. The baseline removed those steps, the old-version mapping (ladder steps to levels, three-step help to four-step help, hole and line rounds and the "früher" totals on the progress page) and the readers of older transfer codes and export files.

Because older data sits under the same keys, a one-time marker keeps it from being read as the new version 1:

- `mathsoccer.baseline` holds the build constant `BASELINE` (`'1'`, src/core/storage/storage.ts).
- On start, before anything loads, `applyBaseline` checks the marker. When it is missing or holds another value, it removes every data key (`DATA_KEYS`: settings, progress, locker room, records, round, cup) and its kept copy under `<key>.unreadable`, then writes the marker. Other keys stay.
- The cleared data loads as the defaults with no reset message. A new browser has no data, so it only gets the marker.
- When storage is blocked, nothing changes and the next start tries again.

Future shape changes use the migration mechanism instead of a new baseline: raise the kind's `version` in its schema and in its `StoredKind` (storage.ts), and add a step from the old version to the new one in `STEPS` (src/core/storage/migrate.ts). `load` runs the steps before the schema check, so older data keeps working. The test "example: how a future step from version 1 to version 2 runs" (src/core/storage/storage.test.ts) shows a step. Changing `BASELINE` clears every player's data again and is only for a change that cannot be migrated.

## Settings (`mathsoccer.settings.v1`, version 1)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `version` | `1` | 1 | |
| `range` | `{ preset: '1-100' \| '0-1000' \| 'custom', min, max }` | `1-100`, 1, 100 | integers, `0 <= min < max <= 1000`, `max - min >= 9` |
| `hintDisplay` | `'always' \| 'onRequest'` | `'always'` | `onRequest` hides the hint numbers until help step 1 |
| `hintDistance` | `{ direct, vertical, diagonal, far: boolean }` | all true | at least one true; the distances of the Nachbarn pattern |
| `levels` | `{ start, hardest: 1 \| 2 \| 3 \| 4 \| 5 \| 6 }` | 1, 6 | "Stufe am Anfang" and "Schwerste Stufe" (FR-085); `start` is not above `hardest` |
| `shapes` | `{ I, O, T, L, J, S, Z: boolean }` | all true | the shapes of "Formen" (FR-074); with every shape off, levels 3 and 4 are skipped |
| `timeChallenge` | `{ allowed: boolean, minutes: 1 \| 2 \| 3 \| 5 }` | true, 2 | FR-075, FR-076 |
| `roundType` | `'untilHearts' \| 'goalCount'` | `'untilHearts'` | the round type of "Spielen" |
| `goalsPerRound` | integer | 10 | 1 to 20 |
| `cupGoals` | integer | 5 | "Tore pro Spiel" of a cup match (FR-108), 3 to 10 |
| `difficulty` | `'easy' \| 'normal' \| 'challenging'` | `'easy'` | misses per heart: 5, 4, 3 |
| `adaptive` | boolean | true | |
| `sound` | `{ effects, crowd, ohh, speech: boolean }` | true, true, true, false | `ohh` off plays clapping alone |
| `numberPad` | `'auto' \| 'always' \| 'never'` | `'auto'` | |
| `showClock` | boolean | false | |
| `showRecords` | boolean | true | |
| `lockerRoom` | boolean | true | |
| `pointAfterFullHelp` | boolean | true | a shot after help step 4 (the answer) counts for goals and bests (FR-094) |
| `rowColumnHelper` | boolean | true | "Zeilen- und Spaltenhilfe" (FR-093): on, a help scale shows all its labels; off, only the lit label (FR-095) |

Direction names (used by targets, attempts and progress) map to steps: right +1, left −1, down +10, up −10, downRight +11, upLeft −11, downLeft +9, upRight −9.

## ChartLayout (derived, not stored)

| Field | Meaning |
|-------|---------|
| `min`, `max` | range |
| `zeroBased` | `min <= 0`: rows start at multiples of 10; otherwise at multiples of 10 plus 1 |
| `firstRowStart` | start number of the first row |
| `rows` | number of rows |
| `cellOf(n)` | `{ row, col }` for an in-range number |
| `numberAt(row, col)` | number or `null` outside the range |
| `ballKind` | `soccer` (≤ 10 rows), `tennis` (≤ 30), `pingpong` |

## Target (in memory, and in the stored round)

| Field | Meaning |
|-------|---------|
| `number` | the answer |
| `hints` | lit hint numbers |
| `directions` | directions trained (FR-038; for Formen, from the lit shape squares that share an edge with the target, FR-073) |
| `level` | 1 to 6, the difficulty level of the target (amendments 09 and 18) |
| `pattern` | `neighbors`, `middle`, `row`, `shape`, `xshape` (the X shape of level 5; FR-065, amendment 09) or `cutout` (level 6, amendment 18) |
| `queue` | Formen or the X shape with two empty squares only: the empty squares still to shoot after this one, each `{ number, directions }` (FR-072). After the goal, the first one becomes the target and the scored square joins the hints. A cutout keeps its empty squares here too: after a filled square (no goal) the first one becomes the target |
| `cutout` | level 6 only (amendment 18): `{ squares, given }`, all squares of the cutout and the squares given from the start; the filled squares are the hints that are not given. Only the last square (empty `queue`) is a keeper shot and a goal. A stored round keeps it, so a refresh continues a half-filled cutout |

Levels (src/core/progress/levels.ts, amendment 09; they replace the ladder of amendment 05): 1 "Gerade Linien" (Nachbarn, Mitte and Reihe across and down), 2 "Schräge Linien" (Mitte and Reihe on the diagonals, and diagonal Nachbarn), 3 "Formen" (one empty square), 4 "Formen mit 2 Lücken", 5 "X-Form" (the diagonal cross, with two empty squares once the child solved 2 targets alone at level 5), 6 "Ausschnitte" (cutouts from the hundred chart with one or two given squares, filled square by square; amendment 18). A level whose patterns do not fit the chart falls back to the nearest lower level that fits, else the nearest higher one. Within a level the direction is drawn at random, directions not mastered yet weighted twice (FR-089).

## Round (`mathsoccer.round.v1`, kept on refresh)

| Field | Meaning |
|-------|---------|
| `seed` | round seed for `Rng` |
| `version` | 2 (refactor R2); a stored round of version 1 is discarded on load, without a migration step |
| `roundType` | `untilHearts` or `goalCount` from the settings for "Spielen", `time` for "Zeit-Challenge", `cup` for a cup match |
| `play` | what only this kind of round has, tagged by `kind` (refactor R2); the match mode is derived from it (`modeOf`). See the list below the table |
| `wait` | what the round waits for before play goes on, or null: `{ reason: 'afterMiss', ms }` after a missed kick or a shot at the board, or `{ reason: 'turnCard' }` for the turn card of "Papa gegen Kind" |
| `goalsPerRound` | goals per round at the round start; a refresh keeps it and the round-start `roundType` (FR-052) |
| `min`, `max` | the round's range; `min` is below `max` |
| `goals` | goals scored |
| `hearts` | 3 down to 0 (`untilHearts` only) |
| `missesInRow` | misses on the current target |
| `helpStep` | 0 to 4: none, row, column, help chart, answer (amendment 10, FR-094) |
| `target` | the current target, with its `queue` of empty shape squares |
| `targetCount`, `targetStartMs`, `targetMisses`, `missTimes` | target count for the seed, and the current target's start, misses and miss times for the attempt record |
| `starsThisRound` | stars earned |
| `elapsedMs` | time played, paused when hidden or paused; in a time challenge the countdown is the play's `minutes` minus this, so a refresh continues it |
| `shots` | the shots decided so far in "Selbst ins Tor" and "Torwandschießen"; 0 in the other modes |
| `phase` | `aiming`, `ballInFlight`, `celebrating`, `roundOver` |

The kinds of `play`:

- `{ kind: 'normal' }`: "Spielen".
- `{ kind: 'time', minutes }`: "Zeit-Challenge", with its challenge time (1, 2, 3 or 5 minutes); the settings change it only from the next round.
- `{ kind: 'cup', match }`: a cup match, with its fixed level, the goals that win it, and its cup and stage.
- `{ kind: 'wall', wall }`: "Freistoß mit Mauer", with the wall in front of the current target (its first and last column and its defenders), or null.
- `{ kind: 'keeper', shot }`: "Selbst ins Tor", with the opponent's shot, or null.
- `{ kind: 'shootout', kicks, shot }`: the shootout, with the kicks of both sides and the opponent's shot, or null.
- `{ kind: 'torwand', holes }`: "Torwandschießen", with the board's one to three holes.
- `{ kind: 'family', kicks, name, level }`: "Papa gegen Kind", with the kicks and the grown-up's name and level.

In memory the match state and its read-only view (`MatchView`) are a union per phase: a ball exists only in `ballInFlight`, and only there it has no outcome yet (refactor R2).

A stored round is saved between shots, so its phase is `aiming` or `celebrating`. It is discarded on load when a rule between fields fails:

- `min` is not below `max`;
- an aiming round has no target;
- the target, a queued shape square or a square of its cutout lies outside `min..max`;
- a time challenge has no `time` play, or another round has one;
- a cup match has no `cup` play, or another round has one;
- a wall goes from right to left;
- a hole of the board lies outside `min..max`;
- the turn card waits in a round that is not "Papa gegen Kind";
- the wait after a miss is in a round that is not a shootout, "Papa gegen Kind" or "Torwandschießen".

State transitions: `aiming --shoot(n in range)--> ballInFlight`; when the ball lands, a goal goes to `celebrating --> aiming (the next empty square of the same shape, else a new target) or roundOver`, and a miss goes to `aiming` (help step +1, misses +1; with `untilHearts`, at the difficulty limit hearts −1 and help jumps to the answer); `roundOver` when hearts reach 0, goals reach `goalsPerRound`, or the countdown of a time challenge reaches 0. At 0 a round that aims ends at once; a ball in flight still lands, a goal is still celebrated, and then the round ends (FR-077). There is no separate landed phase: the landing result is the ball's `outcome`.

A round ended with "Zum Start" (amendment 14, FR-118) has no round end: the stored round is cleared, stars and finished attempts stay, and the open target records no attempt and no best.

## AttemptRecord (`mathsoccer.progress.v1`)

`{ at, mode, min, max, target, directions[], hintDistance, hintDisplay, level, solved, helpStep, misses, responseMs, guess }`. `mode` is always `'keeper'`. `level` is 1 to 6. `helpStep` is 0 to 4. Kept as a capped list (last 2000 attempts), as math-tank.

## Progress (`mathsoccer.progress.v1`, version 1)

Every field is required.

| Field | Meaning |
|-------|---------|
| `attempts` | the AttemptRecords above |
| `directions` | DirectionProgress per `mode\|direction` |
| `level` | the current level (FR-086); null before the first target and after a reset, so the start level applies |
| `levelRecent` | outcomes since the level last changed, newest last, at most 6; guesses never enter it (FR-087) |
| `levelWins` | targets solved alone since the level last changed (for the X shape with two empty squares) |
| `levels` | per level "1" to "6": targets solved alone and with help, and guesses (FR-090) |

Level rule with adaptive on (FR-087): up one after 3 targets in a row solved alone, down one when 2 of the last 3 needed help, never below `levels.start` or above `levels.hardest`. With adaptive off the level stays at `levels.start`.

## DirectionProgress (derived from attempts)

Per `mode|direction`: `masteryWindow`, `attempts`, `independent`, `assisted`, `guesses`; mastered is derived from `masteryWindow`.

## PersonalBest (`mathsoccer.records.v1`)

Key: `min-max|keeper|roundType` for "Spielen" rounds and `min-max|keeper|time|minutes` for time challenges, so a time challenge compares only with the same range and challenge time (FR-080). The modes of amendment 21 keep their own bests: `min-max|keeper|roundType|wall` for "Mauer", `min-max|keeper|keeper` for "Torwart" (the most saves out of 10) and `min-max|keeper|shootout` for "Elfmeter" (`goals` is the number of shootouts won, `timeMs` 0). Amendment 23 adds `min-max|keeper|torwand` for "Torwand" (the most hits out of 10) and `min-max|keeper|family` for "Papa gegen Kind" (the child's wins, `timeMs` 0). Value: `{ goals, timeMs, at }`. Stored as `{ version: 1, bests }`. The progress page skips keys it cannot read.

## LockerRoom (`mathsoccer.lockerroom.v1`, version 1)

| Field | Meaning |
|-------|---------|
| `stars` | balance, never decreases except by buying |
| `totalEarned` | all stars ever earned |
| `owned` | item ids |
| `ball` | chosen ball design id |
| `shirtColor` | chosen shirt color id |
| `shirtNumber` | 1 to 99 |
| `shirtName` | up to 10 letters |
| `scarfColor` | chosen scarf color id |
| `celebration` | chosen goal celebration id (amendment 13, FR-113); `celebration.armsUp` ("Arme hoch") by default |

Stars: 2 per goal, also each goal of a two-empty shape and each goal in a time challenge. Items cost 5 to 40 stars; the starter ball, white shirt and yellow scarves are free. Decision (T057): the yellow shirt in the game's kit color is free too and is the shirt a new player wears; `owned` lists bought items only. Item ids are `ball.<design>`, `shirt.<color>`, `scarf.<color>` and `celebration.<name>` (src/core/rewards/items.ts).

The celebrations are `armsUp` ("Arme hoch", free), `slide` ("Rutschen", 10), `dance` ("Tanz", 15), `airplane` ("Flugzeug", 15), `heart` ("Herz", 20) and `backflip` ("Salto", 30). Loading drops unknown and free items from `owned` and puts the starter item back where a chosen item is not owned.

## Cup (`mathsoccer.cup.v1`, version 1)

The cup journey (amendment 13, FR-106 to FR-112). No stored cup is the first cup at its first match.

| Field | Meaning |
|-------|---------|
| `cup` | the number of the cup being played, 1 for the first |
| `stage` | the next match, 0 (Gruppenspiel 1) to 4 (Finale) |
| `tries` | lost tries of that match |
| `scores` | `{ goals, against }` of each match already won in this cup, one per stage before `stage` |
| `trophies` | `{ cup, at }` of each won cup, oldest first |

## Export file and transfer code (format version 1)

- Export file ("Daten sichern", FR-041): JSON `{ app: 'math-soccer', exportedAt, settings, progress, records, lockerRoom, cup }`. Each part carries its own `version` and is read with the same migrations and schemas as storage. A file with a missing or invalid part is refused as a whole.
- Transfer code (link or QR code, FR-041): `#save=v1.<data>`, where `<data>` is the base64url of `{ v: 1, settings, lockerRoom, records, directions, level, levels, cup }`, compressed with `deflate-raw` when the browser can. Codes of any other version are refused. A later change to the format raises the code version and reads the older format next to the new one.

## Not stored: update state (amendment 12)

sessionStorage, per browser tab, by `src/app/swUpdate.ts`:

- `mathSoccer.autoReloadFrom`: the version the page last reloaded from automatically; the loop guard allows one automatic reload per version.
- `mathSoccer.startAfterUpdate`: the round kind (`play` or `time`) that "Nochmal" asked for before the page reloaded with a new version; the new page reads it once and starts that round (FR-103).

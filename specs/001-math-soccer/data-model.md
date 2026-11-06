# Data Model: Math Soccer

All stored entities are validated with Zod on load and carry a `version`. Damaged or older data is migrated or reset with a short message (FR-036), as math-tank.

## Settings (`mathsoccer.settings.v1`, version 4)

Version 4 follows amendments 05 to 07, 09 and 10. Migrations (src/core/storage/migrate.ts):

- Version 1 to 2 (FR-070): `modes` and `lineLength` are dropped, `lineDirections` becomes `directions`, all `patterns` and `shapes` are turned on, and `timeChallenge` gets its defaults.
- Version 2 to 3 (amendment 09): `levels` replaces `directions` ("Richtungen") and `patterns` ("Hinweis-Muster"), with levels 1 to 5. A parent who had turned the pattern "Formen" off gets every shape off, so levels 3 and 4 are skipped (T095).
- Version 3 to 4 (amendment 10): `rowColumnHelper` is new and starts on.

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `version` | `4` | 4 | |
| `range` | `{ preset: '1-100' \| '0-1000' \| 'custom', min, max }` | `1-100`, 1, 100 | integers, `0 <= min < max <= 1000`, `max - min >= 9` |
| `hintDisplay` | `'always' \| 'onRequest'` | `'always'` | `onRequest` hides the hint numbers until help step 1 |
| `hintDistance` | `{ direct, vertical, diagonal, far: boolean }` | all true | at least one true; the distances of the Nachbarn pattern |
| `levels` | `{ start, hardest: 1 \| 2 \| 3 \| 4 \| 5 }` | 1, 5 | "Stufe am Anfang" and "Schwerste Stufe" (FR-085); `start` is not above `hardest` |
| `shapes` | `{ I, O, T, L, J, S, Z: boolean }` | all true | the shapes of "Formen" (FR-074); with every shape off, levels 3 and 4 are skipped |
| `timeChallenge` | `{ allowed: boolean, minutes: 1 \| 2 \| 3 \| 5 }` | true, 2 | FR-075, FR-076 |
| `roundType` | `'untilHearts' \| 'goalCount'` | `'untilHearts'` | the round type of "Spielen" |
| `goalsPerRound` | integer | 10 | 1 to 20 |
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
| `level` | 1 to 5, the difficulty level of the target (amendment 09) |
| `pattern` | `neighbors`, `middle`, `row`, `shape` or `xshape` (the X shape of level 5; FR-065, amendment 09) |
| `queue` | Formen or the X shape with two empty squares only: the empty squares still to shoot after this one, each `{ number, directions }` (FR-072). After the goal, the first one becomes the target and the scored square joins the hints |

Levels (src/core/progress/levels.ts, amendment 09; they replace the ladder of amendment 05): 1 "Gerade Linien" (Nachbarn, Mitte and Reihe across and down), 2 "Schräge Linien" (Mitte and Reihe on the diagonals, and diagonal Nachbarn), 3 "Formen" (one empty square), 4 "Formen mit 2 Lücken", 5 "X-Form" (the diagonal cross, with two empty squares once the child solved 2 targets alone at level 5). A level whose patterns do not fit the chart falls back to the nearest lower level that fits, else the nearest higher one. Within a level the direction is drawn at random, directions not mastered yet weighted twice (FR-089).

## Round (`mathsoccer.round.v1`, kept on refresh)

| Field | Meaning |
|-------|---------|
| `seed` | round seed for `Rng` |
| `version` | 4 (version 1 had a mode and a line, and hole and line rounds are discarded on load, FR-070; version 3 stores the target's level instead of its ladder step; version 4 stores the help step of the four-step help) |
| `roundType` | `untilHearts` or `goalCount` from the settings for "Spielen", `time` for "Zeit-Challenge" |
| `challengeMinutes` | the challenge time of a `time` round (1, 2, 3 or 5), null otherwise; the settings change it only from the next round |
| `goalsPerRound` | goals per round at the round start; a refresh keeps it and the round-start `roundType` (FR-052). Missing in rounds stored before it was kept, then the current setting applies |
| `min`, `max` | the round's range; `min` is below `max` |
| `goals` | goals scored |
| `hearts` | 3 down to 0 (`untilHearts` only) |
| `missesInRow` | misses on the current target |
| `helpStep` | 0 to 4: none, row, column, help chart, answer (amendment 10, FR-094) |
| `target` | the current target, with its `queue` of empty shape squares |
| `targetCount`, `targetStartMs`, `targetMisses`, `missTimes` | target count for the seed, and the current target's start, misses and miss times for the attempt record |
| `starsThisRound` | stars earned |
| `elapsedMs` | time played, paused when hidden or paused; in a time challenge the countdown is `challengeMinutes` minus this, so a refresh continues it |
| `phase` | `aiming`, `ballInFlight`, `celebrating`, `roundOver` |

A stored round is saved between shots, so its phase is `aiming` or `celebrating`. It is discarded on load when a rule between fields fails: `min` is not below `max`, an aiming round has no target, the target or a queued shape square lies outside `min..max`, or `challengeMinutes` is set for a round that is not a time challenge (or missing for one).

State transitions: `aiming --shoot(n in range)--> ballInFlight`; when the ball lands, a goal goes to `celebrating --> aiming (the next empty square of the same shape, else a new target) or roundOver`, and a miss goes to `aiming` (help step +1, misses +1; with `untilHearts`, at the difficulty limit hearts −1 and help jumps to the answer); `roundOver` when hearts reach 0, goals reach `goalsPerRound`, or the countdown of a time challenge reaches 0. At 0 a round that aims ends at once; a ball in flight still lands, a goal is still celebrated, and then the round ends (FR-077). There is no separate landed phase: the landing result is the ball's `outcome`.

A round ended with "Zum Start" (amendment 14, FR-118) has no round end: the stored round is cleared, stars and finished attempts stay, and the open target records no attempt and no best.

## AttemptRecord (`mathsoccer.progress.v1`)

`{ at, mode, min, max, target, directions[], hintDistance, hintDisplay, level, solved, helpStep, misses, responseMs, guess }`. `level` is 1 to 5; older attempts get theirs from the ladder step (steps 0 to 2 level 1, 3 and 4 level 2, 5 level 3, 6 and 7 level 4). `helpStep` is 0 to 4; older attempts of the three-step help move 2 to 3 and 3 to 4. Kept as a capped list (last 2000 attempts), as math-tank. New attempts have `mode: 'keeper'`; `holes` and `lines` attempts from earlier versions are kept and count as "früher" (FR-070).

## Progress (`mathsoccer.progress.v1`, version 4)

Version 3 (amendment 09) keeps one current level for the child instead of a ladder step per direction; version 4 (amendment 10) has help steps 0 to 4.

| Field | Meaning |
|-------|---------|
| `attempts` | the AttemptRecords above |
| `directions` | DirectionProgress per `mode\|direction` |
| `level` | the current level (FR-086); null before the first target and after a reset, so the start level applies |
| `levelRecent` | outcomes since the level last changed, newest last, at most 6; guesses never enter it (FR-087) |
| `levelWins` | targets solved alone since the level last changed (for the X shape with two empty squares) |
| `levels` | per level "1" to "5": targets solved alone and with help, and guesses (FR-090) |

Level rule with adaptive on (FR-087): up one after 3 targets in a row solved alone, down one when 2 of the last 3 needed help, never below `levels.start` or above `levels.hardest`. With adaptive off the level stays at `levels.start`.

## DirectionProgress (derived from attempts)

Per `mode|direction`: `masteryWindow`, `attempts`, `independent`, `assisted`, `guesses`; mastered is derived from `masteryWindow`.

## PersonalBest (`mathsoccer.records.v1`)

Key: `min-max|keeper|roundType` for "Spielen" rounds and `min-max|keeper|time|minutes` for time challenges, so a time challenge compares only with the same range and challenge time (FR-080). Value: `{ goals, timeMs, at }`. Keys with `holes` or `lines` are bests of the removed modes, kept under "früher" and no longer compared (FR-070).

## LockerRoom (`mathsoccer.lockerroom.v1`)

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

Stars: 2 per goal, also each goal of a two-empty shape and each goal in a time challenge. Items cost 5 to 40 stars; the starter ball, white shirt and yellow scarves are free. Decision (T057): the yellow shirt in the game's kit color is free too and is the shirt a new player wears; `owned` lists bought items only. Item ids are `ball.<design>`, `shirt.<color>` and `scarf.<color>` (src/core/rewards/items.ts).

## Not stored: update state (amendment 12)

sessionStorage, per browser tab, by `src/app/swUpdate.ts`:

- `mathSoccer.autoReloadFrom`: the version the page last reloaded from automatically; the loop guard allows one automatic reload per version.
- `mathSoccer.startAfterUpdate`: the round kind (`play` or `time`) that "Nochmal" asked for before the page reloaded with a new version; the new page reads it once and starts that round (FR-103).

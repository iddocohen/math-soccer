# Data Model: Math Soccer

All stored entities are validated with Zod on load and carry a `version`. Damaged or older data is migrated or reset with a short message (FR-036), as math-tank.

## Settings (`mathsoccer.settings.v1`, version 2)

Version 2 follows amendments 05 to 07. Migration from version 1 (FR-070): `modes` and `lineLength` are dropped, `lineDirections` becomes `directions`, all `patterns` and `shapes` are turned on, and `timeChallenge` gets its defaults.

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `version` | `2` | 2 | |
| `range` | `{ preset: '1-100' \| '0-1000' \| 'custom', min, max }` | `1-100`, 1, 100 | integers, `0 <= min < max <= 1000`, `max - min >= 9` |
| `hintDisplay` | `'always' \| 'onRequest'` | `'always'` | `onRequest` hides hints until help only at the top ladder step (index 7) |
| `hintDistance` | `{ direct, vertical, diagonal, far: boolean }` | all true | at least one true; the distances of the Nachbarn pattern |
| `directions` | `{ right, down, downRight, downLeft, left, up, upLeft, upRight: boolean }` | `right`, `down`, `downRight`, `downLeft` true; others false | at least one true ("Richtungen", FR-066) |
| `patterns` | `{ neighbors, middle, row, shape: boolean }` | all true | at least one true ("Hinweis-Muster": Nachbarn, Mitte, Reihe, Formen; FR-066) |
| `shapes` | `{ I, O, T, L, J, S, Z: boolean }` | all true | the shapes of "Formen" (FR-074) |
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
| `pointAfterFullHelp` | boolean | true | a shot after help step 3 counts for goals and bests |

Direction names map to steps: right +1, left −1, down +10, up −10, downRight +11, upLeft −11, downLeft +9, upRight −9.

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
| `difficultyStep` | 0 to 7, the ladder step of FR-067 counted from 0 |
| `pattern` | `neighbors`, `middle`, `row` or `shape` (FR-065) |
| `queue` | Formen with two empty squares only: the empty squares still to shoot after this one, each `{ number, directions }` (FR-072). After the goal, the first one becomes the target and the scored square joins the hints |

Ladder (src/core/progress/ladder.ts), counted from 0: 0 Nachbarn, 1 Mitte across, 2 Mitte down, 3 Reihe down and across, 4 Mitte or Reihe diagonal, 5 Formen with one empty square, 6 Nachbarn two squares away and Formen with two empty squares, 7 as 6 with hints on request when `hintDisplay` is `onRequest`. A step that offers nothing for a direction under the settings falls back to the nearest lower step that does. Shapes train across and down only.

## Round (`mathsoccer.round.v1`, kept on refresh)

| Field | Meaning |
|-------|---------|
| `seed` | round seed for `Rng` |
| `version` | 2 (version 1 had a mode and a line; hole and line rounds are discarded on load, FR-070) |
| `roundType` | `untilHearts` or `goalCount` from the settings for "Spielen", `time` for "Zeit-Challenge" |
| `challengeMinutes` | the challenge time of a `time` round (1, 2, 3 or 5), null otherwise; the settings change it only from the next round |
| `goalsPerRound` | goals per round at the round start; a refresh keeps it and the round-start `roundType` (FR-052). Missing in rounds stored before it was kept, then the current setting applies |
| `min`, `max` | the round's range; `min` is below `max` |
| `goals` | goals scored |
| `hearts` | 3 down to 0 (`untilHearts` only) |
| `missesInRow` | misses on the current target |
| `helpStep` | 0 to 3 |
| `target` | the current target, with its `queue` of empty shape squares |
| `targetCount`, `targetStartMs`, `targetMisses`, `missTimes` | target count for the seed, and the current target's start, misses and miss times for the attempt record |
| `starsThisRound` | stars earned |
| `elapsedMs` | time played, paused when hidden or paused; in a time challenge the countdown is `challengeMinutes` minus this, so a refresh continues it |
| `phase` | `aiming`, `ballInFlight`, `celebrating`, `roundOver` |

A stored round is saved between shots, so its phase is `aiming` or `celebrating`. It is discarded on load when a rule between fields fails: `min` is not below `max`, an aiming round has no target, the target or a queued shape square lies outside `min..max`, or `challengeMinutes` is set for a round that is not a time challenge (or missing for one).

State transitions: `aiming --shoot(n in range)--> ballInFlight`; when the ball lands, a goal goes to `celebrating --> aiming (the next empty square of the same shape, else a new target) or roundOver`, and a miss goes to `aiming` (help step +1, misses +1; with `untilHearts`, at the difficulty limit hearts −1 and help jumps to the answer); `roundOver` when hearts reach 0, goals reach `goalsPerRound`, or the countdown of a time challenge reaches 0. At 0 a round that aims ends at once; a ball in flight still lands, a goal is still celebrated, and then the round ends (FR-077). There is no separate landed phase: the landing result is the ball's `outcome`.

## AttemptRecord (`mathsoccer.progress.v1`)

`{ at, mode, min, max, target, directions[], hintDistance, hintDisplay, difficultyStep, solved, helpStep, misses, responseMs, guess }`. Kept as a capped list (last 2000 attempts), as math-tank. New attempts have `mode: 'keeper'`; `holes` and `lines` attempts from earlier versions are kept and count as "früher" (FR-070).

## DirectionProgress (derived from attempts, plus stored step)

Per `mode|direction`: `step` (0 to 7), `recent`, `masteryWindow`, `attempts`, `independent`, `assisted`, `guesses`; mastered is derived from `masteryWindow`.

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

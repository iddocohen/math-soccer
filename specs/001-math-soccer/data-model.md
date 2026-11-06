# Data Model: Math Soccer

All stored entities are validated with Zod on load and carry a `version`. Damaged or older data is migrated or reset with a short message (FR-036), as math-tank.

## Settings (`mathsoccer.settings.v1`, version 1)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `range` | `{ preset: '1-100' \| '0-1000' \| 'custom', min, max }` | `1-100`, 1, 100 | integers, `0 <= min < max <= 1000`, `max - min >= 9` |
| `modes` | `{ holes, lines, keeper: boolean }` | all true | at least one true |
| `hintDisplay` | `'always' \| 'onRequest'` | `'always'` | |
| `hintDistance` | `{ direct, vertical, diagonal, far: boolean }` | `direct` true, others true | at least one true; adaptive picks within the allowed set |
| `lineDirections` | `{ right, down, downRight, downLeft, left, up, upLeft, upRight: boolean }` | `down`, `downRight`, `downLeft`, `right` true; others false | at least one true |
| `lineLength` | integer | 5 | 3 to 10 |
| `roundType` | `'untilHearts' \| 'goalCount'` | `'untilHearts'` | |
| `goalsPerRound` | integer | 10 | 1 to 20 |
| `difficulty` | `'easy' \| 'normal' \| 'challenging'` | `'easy'` | misses per heart: 5, 4, 3 |
| `adaptive` | boolean | true | |
| `sound` | `{ effects, crowd, ohh, speech: boolean }` | true, true, true, false | `ohh` off plays clapping alone |
| `numberPad` | `'auto' \| 'always' \| 'never'` | `'auto'` | |
| `showClock` | boolean | false | |
| `showRecords` | boolean | true | |
| `lockerRoom` | boolean | true | |

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

## Target (in memory)

| Field | Meaning |
|-------|---------|
| `mode` | `holes`, `lines`, `keeper` |
| `number` | the answer |
| `hints` | visible hint numbers |
| `decoyHoles` | other holes on the board (hole mode only) |
| `directions` | directions trained (from hint offsets or the line's direction) |
| `difficultyStep` | 0 to 3, from the adaptive ladder |

## Line (in memory, line mode)

`{ squares: number[], direction, given: 2, index }`: `squares[0..given-1]` are printed; `squares[index]` is the current target. Squares are computed in row and column space and all lie on the chart.

## Round (`mathsoccer.round.v1`, kept on refresh)

| Field | Meaning |
|-------|---------|
| `seed` | round seed for `Rng` |
| `mode`, `roundType` | from start screen and settings |
| `goals` | goals scored |
| `hearts` | 3 down to 0 (`untilHearts` only) |
| `missesInRow` | misses on the current target |
| `helpStep` | 0 to 3 |
| `target`, `line` | current target and line |
| `starsThisRound` | stars earned |
| `elapsedMs` | time played, paused when hidden or paused |
| `phase` | `aiming`, `ballInFlight`, `landed`, `celebrating`, `roundOver` |

State transitions: `aiming --shoot(n in range)--> ballInFlight --land--> landed`; `landed(goal or correct square) --> celebrating --> aiming (new target) or roundOver`; `landed(miss) --> aiming` (help step +1, misses +1; at the difficulty limit hearts −1 and the target resolves); `roundOver` when hearts reach 0 or goals reach `goalsPerRound`.

## AttemptRecord (`mathsoccer.progress.v1`)

`{ at, mode, min, max, target, directions[], hintDistance, hintDisplay, difficultyStep, solved, helpStep, misses, responseMs, guess }`. Kept as a capped list (last 2000 attempts), as math-tank.

## DirectionProgress (derived from attempts, plus stored step)

Per direction and mode: `attempts`, `independent`, `assisted`, `currentStep`, `correctInRow`, `mastered`.

## PersonalBest (`mathsoccer.records.v1`)

Key: `min-max|mode|roundType`. Value: `{ goals, timeMs, at }`.

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

Stars: line mode 1 per correct square and 3 per finished line; hole and keeper mode 2 per goal. Items cost 5 to 40 stars; the starter ball, white shirt and yellow scarves are free.

# Contract: engine-free core modules (`src/core/`)

No module here imports Phaser, React or the DOM, and none calls `Math.random`. All randomness takes an `Rng` (copied from math-tank).

## `core/chart`

- `layoutChart(min: number, max: number): ChartLayout`: see data-model. Throws on invalid input; callers validate settings first.
- `cellOf(layout, n): { row: number; col: number }`: for `min <= n <= max`.
- `numberAt(layout, row, col): number | null`.
- `cellRect(layout, goal: Rect, n): Rect`: world rectangle of the square of `n` inside the goal rectangle. Property: for every `n` in range, the rectangles tile the goal without overlap, and `cellRect` of `n + 10` is directly below `n` when both exist.
- `ballKind(layout): 'soccer' | 'tennis' | 'pingpong'`.
- `showNumbers(layout, goal): boolean`: false when squares are under 14 world pixels high.

## `core/targets`

- `STEP: Record<Direction, number>`: the 8 directions and their number steps.
- `hintOffsets(distance: HintDistance): Array<[dRow, dCol]>`.
- `hintsFor(layout, n, distance): number[]`: hints on the chart only.
- `directionsOf(n, hints): Direction[]`.
- `nextTarget(input: { layout, settings, progress, rng, avoid? }): Target`: answer-first; the ladder (core/progress/ladder.ts) picks the direction and the hint pattern within the parent's choices, weighting unmastered directions twice; the target number comes from the pattern's placements on the chart (amendment 05).

## `core/match`

- `entryReducer(entry: string, key: EntryKey, maxDigits): string`: as math-tank.
- `class MatchController`: `getState()` (a deep read-only `MatchView`), `subscribe(fn)`, and actions `start()`, `typeKey(key)`, `shoot()`, `ballLanded()`, `celebrationDone()`, `askHelp()`, `pause()`, `resume()`, `tick(ms)`. `shoot()` refuses out-of-range numbers and sets a range message. `ballLanded()` decides goal, correct square or miss from `state.ball.number === state.target.number`.
- `missesPerHeart(difficulty): 3 | 4 | 5`.
- `GOAL_STARS`: 2 stars per goal (amendment 05).

## `core/progress`

Adapted from math-tank with `skill` renamed to `direction`: `classifyAttempt`, `isGuess`, `adaptStep`, `isMastered`, `summarize(attempts) → DirectionProgress[]`. Thresholds unchanged from math-tank (FR-039, FR-040).

## `core/settings`, `core/storage`, `core/transfer`, `core/records`, `core/rewards`

- `settingsSchema`, `defaultSettings`, `validateSettings(s) → errors[]`.
- `load*`/`save*` per stored key, with migration and reset on damage.
- `exportAll() / importAll(blob)`, `encodeTransfer() / decodeTransfer(fragment)`: as math-tank.
- `updateBest(records, key, goals, timeMs) → { records, isNew }`.
- `ITEMS`, `buy(locker, itemId)`, `equip(locker, slot, itemId)`, `award(locker, stars)`.

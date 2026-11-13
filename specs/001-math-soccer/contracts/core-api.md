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
- `class MatchController`: `getState()` (a deep read-only `MatchView`), `subscribe(fn)`, and actions `start()`, `typeKey(key)`, `shoot()`, `ballLanded()`, `celebrationDone()`, `skipCelebration()` (Enter through `shoot()`, or a tap, during the goal celebration: it ends at once and nothing is shot, FR-114), `askHelp()`, `pause()`, `resume()`, `tick(ms)`. `shoot()` refuses out-of-range numbers and sets a range message. `ballLanded()` decides goal, correct square or miss from `state.ball.number === state.target.number`.
- `missesPerHeart(difficulty): 3 | 4 | 5`.
- `GOAL_STARS` (core/rewards/lockerRoom.ts): 1 star per goal since amendment 19 (FR-132; 2 in amendment 05). Cutouts (amendment 18): `FILL_STARS` 0 for a filled square that is not the last, `CUTOUT_BONUS_STARS` 2 on the last one; a filled square lands with the outcome `filled` and gives the next square at once, without a goal or a celebration.
- `rounds.ts` (amendment 21): `START_KINDS` (`play`, `time`, `cup`, `wall`, `keeper`, `shootout`), `START_KIND_INFO` (each kind's match mode, the mode to unlock, where its round type comes from), `MATCH_MODES` (`normal`, `wall`, `keeper`, `shootout`), `canStart(kind, locker, settings)` (a locked mode or one the parent turned off never starts), `startKindOf(state)` for "Nochmal". `MatchController.start(kind)` starts any kind but the cup (`startCup`).
- `wall.ts` (amendment 21, FR-142): `placeWall(layout, target, rng, previous)` covers 3 to 5 free columns, never the target or its hints, and moves after a goal; `wallBlocks(layout, wall, n)`: a shot at `n` hits the wall (the ball lands with the outcome `blocked`, a miss in every way); `wallColumns(wall)`.
- `keeper.ts` (amendment 21, FR-143 to FR-146): `KEEPER_SHOTS` 10, `KEEPER_SAVE_STARS` 1, `KEEPER_FLIGHT_MS` (slow 10 s, medium 8 s, fast 5 s), `flightMsOf(speed, index)` (the first shot is slow), `keeperTarget(layout, level, rng, avoid)` (hints by level in reverse), `shotResult(target, typed)` (`saved`, `wrong`, `late`), `keeperOpponent(seed)` (a cup team). The state's `keeperShot` holds the flight time left, `held` while help holds it, and the result.
- `shootout.ts` (amendment 21, FR-147, FR-148): pure functions over the kicks of two sides, side 0 shooting first in each round, so another pair of players can use them (amendment 23): `SHOOTOUT_ROUNDS` 5, `SHOOTOUT_WIN_STARS` 5, `nextSide(kicks)`, `addKick(kicks, kick)`, `shootoutWinner(kicks)` (all 5 rounds are played; level after them, single rounds until one side leads after a full round), `shootoutRound(kicks)`, `scoreCircles(kicks)` (at least 5 per side, one more per round of sudden death), `shootoutScore`, `scoreText`. In the controller's mode `shootout`, side 0 is the child (one shot as in "Spielen", a miss ends the turn after `SHOWN_MS`) and side 1 the opponent (a `keeperShot` as in "Selbst ins Tor"; a save is his miss). A win adds 5 stars; goals and saves add none. Only the child's kicks record attempts.

## `core/progress`

Adapted from math-tank with `skill` renamed to `direction`: `classifyAttempt`, `isGuess`, `adaptStep`, `isMastered`, `summarize(attempts) → DirectionProgress[]`. Thresholds unchanged from math-tank (FR-039, FR-040).

## `core/settings`, `core/storage`, `core/transfer`, `core/records`, `core/rewards`

- `settingsSchema`, `defaultSettings`, `validateSettings(s) → errors[]`.
- `load*`/`save*` per stored key, with migration and reset on damage.
- `exportAll() / importAll(blob)`, `encodeTransfer() / decodeTransfer(fragment)`: as math-tank.
- `recordKey(min, max, roundType, challengeMinutes, mode)`: `1-100|keeper|untilHearts`, `…|time|2` for a time challenge, `…|untilHearts|wall` for "Mauer", and `1-100|keeper|keeper` and `1-100|keeper|shootout` for "Torwart" and "Elfmeter", which do not follow the round type. `submitResult(records, key, { goals, timeMs, at })` keeps the most goals (or saves), the faster time on a tie; `submitShootout(records, key, won, at)` counts the shootouts won. `parseRecordKey(key)` (core/progress/summarize.ts) reads all of them back with the match mode for the progress page.
- `UNLOCK_MODES`, `MODE_OFFERS`, `modeLock`, `unlockMode(locker, mode)` and `modeButtons(locker, allowed, lockerRoomOn)` (core/rewards/modes.ts, amendment 21): prices 200, 300 and 600, "Elfmeterschießen" only after "Selbst ins Tor"; a bought mode stays unlocked.
- `ITEMS`, `buy(locker, itemId)`, `equip(locker, slot, itemId)`, `award(locker, stars)`.

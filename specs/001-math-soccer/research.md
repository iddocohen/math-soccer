# Research: Math Soccer

All decisions below resolve the open points of the Technical Context in [plan.md](./plan.md). Where math-tank already solved a problem, the decision is to copy its approach; the reference is its `specs/001-math-tanks/research.md` and source under `~/dev/private/math-tank/src`.

## R1. Stack and project setup

- **Decision**: Copy math-tank's setup: TypeScript 6.0 (strict), Vite 8.3, React 19.3 for menus and overlay, Phaser 4.2 for the game scene, Zod 4.6 for stored data, Vitest 5.1, Playwright 1.64, ESLint 10 with typescript-eslint, `vite-plugin-pwa` 2.0, pnpm 10, Node 22. Same `tsconfig.json`, `eslint.config.js` (engine-free `src/core`, no `Math.random` in core) and Vitest projects split (node for core, jsdom for app).
- **Rationale**: The source PRD decides it. One parent maintains both games, and math-tank's patterns are proven with 22 amendments.
- **Alternatives**: A single canvas file like the prototype (no tests, hard to grow); Three.js (3D was ruled out by the parent).

## R2. Scene rendering

- **Decision**: One Phaser scene (`MatchScene`) drawn in a logical world of 1600 by 1000 pixels, scaled to fit (`Phaser.Scale.FIT`). The stands, fans, goal, net, chart board, keeper, player and ball are drawn with Phaser Graphics and generated textures, as math-tank's `textures.ts` does. No bitmap asset is required for the first version.
- **Rationale**: The search for free assets found no crowd sprite with jumping and clapping, and the CC0 soccer packs are top-down. Drawing in code keeps every asset license-free (FR-048), lets the locker room recolor ball, shirt and scarves at no cost, and keeps the offline bundle small. The prototype (see R12) showed that drawn shapes read well at this size.
- **Alternatives**: Kenney Sports Pack (CC0, top-down view, only useful for icons); a paid crowd pack (needs the parent's approval).

## R3. Chart layout

- **Decision**: A pure function `layoutChart(min, max)` in `src/core/chart/layout.ts` returns the row start (`zeroBased = min <= 0` → rows start at multiples of 10, otherwise at multiples of 10 plus 1), the first row number, the number of rows, and `cellOf(n) → {row, col}` and `numberAt(row, col) → n | null`. Squares in a partial first or last row outside the range return `null`. One function `cellRect(layout, goalRect)` maps a cell to world coordinates; the ball, the board, the hints and the help chart all use it, the way math-tank uses one `numberToX`.
- **Rationale**: One mapping makes "the ball lands on the square of the typed number" (FR-003, SC-004) true by construction and testable with property tests.

## R4. Ball and square size by chart size

- **Decision**: The goal rectangle is fixed in world space (1000 by 560). Square height = 560 / rows. Ball kind by rows: up to 10 rows a soccer ball (radius 30 at the spot, scaled to 55% of the square height at impact); 11 to 30 rows a tennis ball; above 30 rows a ping-pong ball. Above 20 rows (more than 200 numbers) the layout still draws; numbers are drawn only when the square is at least 14 world pixels high, otherwise only on the target, hints and the "shown" square (FR-009).
- **Rationale**: Keeps 1 to 200 comfortable and 0 to 1000 functional without building zoom now.

## R5. Targets and hints

- **Decision**: Answer-first generation, as math-tank: the generator picks the target number first, then the hint numbers from the hint distance setting (`direct`, `vertical`, `diagonal`, `far`), dropping hints off the chart. A target is valid only when at least one hint remains (two for `direct`). Directions trained are derived from hint offsets (hint above or below → ±10, beside → ±1, diagonal → ±11 or ±9; "far" counts as the matching direction). Line targets train their line's direction. All randomness goes through math-tank's seeded `Rng`.
- **Rationale**: FR-014, FR-019, FR-038; reproducible tests.

## R6. Lines

- **Decision**: `makeLine(layout, direction, length, rng)` picks a start so that every square of the line lies on the chart, stepping in row and column space (not by adding the step to the number) so diagonals never wrap across a row edge. The first two squares are given; the rest are targets. If no start fits (very small charts), the length is shortened down to 3, then the direction falls back to across.
- **Rationale**: FR-015 to FR-018, edge case "line past the edge".

## R7. Round state machine

- **Decision**: A `MatchController` in `src/core/match/` owns all state, as math-tank's `BattleController`: phases `aiming` → `ballInFlight` → `landed` (goal, correctSquare, miss) → `celebrating` or back to `aiming` → `roundOver`. React and Phaser subscribe with `useSyncExternalStore` and send actions; neither mutates state. Keyboard entry uses math-tank's pure entry reducer (digits, Backspace, Enter, H, Escape).
- **Rationale**: Proven pattern; the controller is testable without a browser.

## R8. Hearts

- **Decision**: Misses in a row on the current target are counted. When they reach the difficulty's limit (easy 5, normal 4, challenging 3), one heart is lost and the counter resets. In hole and goalkeeper mode the target then changes to a new one after the answer is shown; in line mode the square fills in and the line continues. The first round on a new device starts on "easy".
- **Rationale**: FR-027; same spirit as math-tank amendment 13 (the enemy zeroes in on misses in a row).

## R9. Help, adaptive difficulty, mastery, guesses

- **Decision**: Reuse math-tank's logic and thresholds, renaming "skill" to "direction": help steps 1 to 3 advance on each miss or H; attempts are classified (independent, assisted, unsolved, guess) with math-tank's guess rule (confirmed under 1.5 s, or after 3 wrong answers within 5 s); adaptive moves one difficulty step per direction (up after 3 independent in a row, down when 2 of the last 3 needed help); mastery at 10 independent attempts with 8 of the last 10 correct. Difficulty ladder (FR-040): 0 hints always shown + direct; 1 vertical or diagonal; 2 far; 3 hints on request only, clamped by the parent's hint settings. Target selection weights unmastered directions twice as high.
- **Rationale**: FR-024, FR-025, FR-039, FR-040.

## R10. Crowd and sound

- **Decision**: Crowd sounds are synthesized with Web Audio as math-tank's `sfx.ts` does: a cheer (two band-passed noise swells), clapping (short noise bursts), a soft "ohhh" (three low triangle tones gliding down, then clapping), a kick. No recorded clip is required. If the parent later wants recorded cheering, a CC0 clip can replace one function.
- **Rationale**: The Freesound and itch.io candidates need a per-clip license check; synthesized sound is license-free, small and works offline. The prototype showed the synthesized "ohhh" is soft and not punishing.
- **Alternatives**: Freesound clip 397434 (license unchecked).

## R11. Storage, backup, transfer

- **Decision**: Copy math-tank's `storage/`, `transfer/` and export/import modules with new keys `mathsoccer.settings.v1`, `mathsoccer.progress.v1`, `mathsoccer.lockerroom.v1`, `mathsoccer.records.v1`, `mathsoccer.round.v1` (refresh keeps the round). Versioned Zod schemas with migrations; a persistent storage request on start.
- **Rationale**: FR-036, FR-041.

## R12. Prototype findings

A throwaway HTML prototype (`prototype/index.html`, published privately for the parent at https://claude.ai/artifact/M3kaeXD8qX8Rg7vesEGuz6) checked the look and the three modes.

- The view from behind the player with stands above the goal fits a landscape screen; the goal must take most of the height so a 10-row chart stays readable on an iPad.
- Printed board squares (light) with dark holes read clearly in hole and line mode; in goalkeeper mode a faint grid over the dark net with hint squares in the team color works better than printed numbers.
- The square of a wrong number needs a strong, warm color (not red) so it reads as "here is your number", not as "wrong".
- Mode keys 1 to 3 clash with typing numbers during play; they work only on the start screen (as math-tank), not during a round.

## R13. Devices and tests

- **Decision**: Playwright projects: `chromium` and `firefox` at desktop size, `webkit` at desktop size, and `ipad-landscape` and `ipad-portrait` (WebKit, touch) for the device specs, plus `base-path` for the `/math-soccer/` build. No phone projects (FR-045).
- **Rationale**: Target devices from the spec.

## R14. Publishing

- **Decision**: Copy math-tank's `.github/workflows/pages.yml` with `--base=/math-soccer/`. The repository `iddocohen/math-soccer` does not exist yet; creating it is the parent's decision (spec Assumptions). The workflow is committed so it runs once the repository exists.

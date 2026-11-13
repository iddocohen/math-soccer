---
description: "Task list for Math Soccer"
---

# Tasks: Math Soccer

**Input**: Design documents from `specs/001-math-soccer/` ([plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md))

**Tests**: Included. The plan (Technical Context, Testing) and quickstart require Vitest unit tests for `src/core` and Playwright end-to-end tests, as math-tank.

**Reference project**: `~/dev/private/math-tank`. "Copy from math-tank" means copy the named file, rename tank concepts to soccer concepts, remove what this spec does not need, keep the tests that still apply, and add a header comment naming the origin file.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story from spec.md (US1 to US6)

---

## Phase 1: Setup

**Purpose**: project tooling, copied from math-tank.

- [X] T001 Create `package.json` with the same scripts and dependency versions as `~/dev/private/math-tank/package.json` (name `math-soccer`), `pnpm-lock.yaml` via `pnpm install`, and `.gitignore` additions for `node_modules/`, `dist/`, `dist-base/`, `dev-dist/`, `coverage/`, `test-results/`, `playwright-report/`, `blob-report/`, `.vitest/` (keep the existing `.specify/` and `.claude/` lines)
- [X] T002 [P] Copy `tsconfig.json` and `eslint.config.js` from math-tank (engine-free `src/core`: no `phaser`, `react` or DOM imports; no `Math.random` in `src/core`)
- [X] T003 [P] Copy `vite.config.ts` from math-tank: PWA manifest name and short name "Mathe-Kicker", `lang: 'de'`, theme and background `#0f1d2b`; Vitest projects `node` (src/core) and `jsdom` (src/app)
- [X] T004 [P] Create `index.html` (German, title "Mathe-Kicker", root div, no external resources) and `src/main.tsx` (React root, service worker registration as math-tank)
- [X] T005 [P] Create PWA icons `public/icons/icon.svg`, `icon-192.png`, `icon-512.png` (a ball in front of a goal, drawn as simple shapes)
- [X] T006 [P] Create `playwright.config.ts` from math-tank with projects `chromium`, `firefox`, `webkit` (desktop), `ipad-landscape` and `ipad-portrait` (WebKit, touch, device specs only), and `base-path` (build with `--base=/math-soccer/` on port 4174); no phone or Fire projects
- [X] T007 [P] Create `.github/workflows/pages.yml` from math-tank's workflow with `pnpm exec vite build --base=/math-soccer/`
- [X] T008 [P] Create `README.md`: what the game is for, how to play (child tutorial), parent tutorial (gear hold, settings, progress, backup), run commands, and an "Assets and licenses" section stating that all art and sound are drawn or synthesized in code
- [X] T009 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` on the empty project and make them pass

---

## Phase 2: Foundational

**Purpose**: modules every story needs. Blocks all stories.

- [X] T010 [P] Copy `src/core/rng.ts` and its test from math-tank
- [X] T011 [P] Create `src/core/types.ts`: `Direction` (`right`, `left`, `down`, `up`, `downRight`, `upLeft`, `downLeft`, `upRight`), `Mode` (`holes`, `lines`, `keeper`), `HintDistance` (`direct`, `vertical`, `diagonal`, `far`), `Rect`
- [X] T012 [P] Create `src/i18n/de.ts` and `src/i18n/index.ts` with all child and parent texts from contracts/screens.md, plus `src/i18n/de.test.ts` that fails if any child text contains "falsch", "verloren", "Fehler" or "schlecht" (FR-023)
- [X] T013 Create `src/core/settings/schema.ts`, `defaults.ts`, `validate.ts` and tests per data-model Settings, quoting its rules: range "integers, `0 <= min < max <= 1000`, `max - min >= 9`"; modes "at least one true"; hintDistance "at least one true"; lineDirections "at least one true"; lineLength "3 to 10"; goalsPerRound "1 to 20"; difficulty misses per heart "5, 4, 3"; defaults as listed, including `pointAfterFullHelp: true`
- [X] T014 Copy `src/core/storage/` (`keyValue.ts`, `storage.ts`, `migrate.ts`, `exportImport.ts`) and tests from math-tank with keys `mathsoccer.settings.v1`, `mathsoccer.progress.v1`, `mathsoccer.lockerroom.v1`, `mathsoccer.records.v1`, `mathsoccer.round.v1`; persistent storage request on start; reset with a message on damaged data (FR-036)
- [X] T015 [P] Create `src/core/chart/layout.ts` with `layoutChart`, `cellOf`, `numberAt`, `cellRect`, `ballKind`, `showNumbers` per contracts/core-api.md and research R3, R4: rows start at multiples of 10 when `min <= 0`, else at multiples of 10 plus 1; squares outside the range in a partial row return `null`; ball kind soccer up to 10 rows, tennis up to 30, ping-pong above; numbers drawn only when squares are at least 14 world pixels high
- [X] T016 [P] Create `src/core/chart/layout.test.ts`: 1 to 100 gives 10 rows with 1 top left, 10 top right, 100 bottom right; 0 to 1000 gives 101 rows starting at 0; 205 to 480 keeps every number's column from the full chart; property test that `cellRect(n + 10)` lies directly below `cellRect(n)` and that rectangles tile the goal without overlap
- [X] T017 Copy `src/core/match/entry.ts` (math-tank's `src/core/battle/entry.ts`) and its test: digits, Backspace, Enter, H, Escape; extra digits beyond the largest number's length ignored
- [X] T018 Create `src/core/match/MatchController.ts` skeleton with `getState`, `subscribe`, `start(mode)`, `typeKey`, `shoot`, `ballLanded`, `celebrationDone`, `askHelp`, `pause`, `resume`, `tick` and the Round state and phases from data-model (`aiming`, `ballInFlight`, `landed`, `celebrating`, `roundOver`); `shoot()` refuses out-of-range numbers and sets the range message (FR-005)
- [X] T019 Create `src/app/useController.ts` (useSyncExternalStore bridge), `src/app/keyboard.ts` (key map per screen: start screen 1, 2, 3, Enter, Space, K; match digits, Backspace, Enter, Space, H, Escape) and `src/app/useKeyboard.ts`, from math-tank
- [X] T020 Create `src/game/createGame.ts` (Phaser 4, world 1600 by 1000, `Scale.FIT`) and `src/game/textures.ts` (generated textures for ball kinds, player, keeper, fan)
- [X] T021 Create `src/audio/sfx.ts` with Web Audio `kick`, `cheer`, `clap`, `ohh` (three low triangle tones gliding down, then clapping) as in the prototype `specs/001-math-soccer/prototype/index.html`; sound starts after the first key or tap; respects `sound.effects`, `sound.crowd`, `sound.ohh`
- [X] T022 Create `src/app/App.tsx` and `src/app/styles.css`: screens start, match, round end, with the Phaser canvas under a React overlay

**Checkpoint**: the app builds, shows an empty start screen, and core tests pass.

---

## Phase 3: User Story 1 - Score goals in hole mode (Priority: P1) 🎯 MVP

**Goal**: a playable hole-mode round on the hundred chart.

**Independent Test**: quickstart scenarios 1, 2, 11 and 14 with default settings, keyboard only.

### Tests for User Story 1

- [X] T023 [P] [US1] `src/core/targets/hints.test.ts`: `hintsFor(46, direct)` is 45, 47, 36, 56; hints off the chart are dropped; `directionsOf` maps above and below to down and up, beside to right and left, diagonals to the diagonal directions
- [X] T024 [P] [US1] `src/core/targets/nextTarget.test.ts`: hole targets always have at least one hint (two for `direct`); same seed gives same target; unmastered directions are chosen about twice as often
- [X] T025 [P] [US1] `src/core/match/MatchController.test.ts`: correct number gives a goal and a new target after celebration; wrong number gives a miss, help step +1, target unchanged; out-of-range number does not shoot; misses per heart 5, 4, 3 by difficulty and a single miss never costs a heart; a lost heart keeps the target, jumps help to step 3, and the next correct shot moves on (FR-027); round ends at 0 hearts or at `goalsPerRound`
- [X] T026 [P] [US1] `tests/e2e/holes.spec.ts`: start with `?mode=holes`, read `data-target` from `data-testid="match"`, type it and press Enter, expect `data-goals` 1; type a wrong in-range number, expect the message "Hier ist N. Nochmal!"; play a round to the end screen and press Enter for "Nochmal"

### Implementation for User Story 1

- [X] T027 [P] [US1] Create `src/core/targets/hints.ts` with `STEP`, `hintOffsets`, `hintsFor`, `directionsOf` (research R5)
- [X] T028 [US1] Create `src/core/targets/nextTarget.ts`: answer-first hole and keeper targets with seeded `Rng`, hint distance from settings and adaptive step, decorative `patchedHoles` (hole mode only, a shot there hits the patch)
- [X] T029 [US1] Complete hole-mode logic in `src/core/match/MatchController.ts`: goal, miss with `shown` square for at least 1.5 s (FR-004), hearts, round end, time played paused when hidden or paused (FR-029), `pointAfterFullHelp` (FR-025b), and saving the round to `mathsoccer.round.v1` so a refresh continues it; discard a stored round whose range or mode no longer matches settings (FR-036a)
- [X] T030 [P] [US1] Create `src/game/StandsView.ts`: rows of drawn fans in the distance with idle sway, cheer (stand, jump, raise arms, wave scarves in the scarf color) and soft "ohh" (slump), then clap (FR-021, FR-022)
- [X] T031 [P] [US1] Create `src/game/GoalView.ts`: net, posts, printed chart board drawn into a cached texture redrawn only when target, hints, help step or shown square change (plan decision 9); one open hole at the target; patched holes; hint numbers; the shown square in warm orange; numbers only when `showNumbers` is true
- [X] T032 [P] [US1] Create `src/game/PlayerView.ts` (player from behind, shirt color and number) and `src/game/BallView.ts` (ball kind by `ballKind`, 0.8 s flight along an arc to `cellRect` of the typed number, shrinking with distance, into the net on a goal, bouncing off the board on a miss)
- [X] T033 [US1] Create `src/game/MatchScene.ts`: composes the views, subscribes to the controller, calls `ballLanded` and `celebrationDone` when animations end, plays sounds
- [X] T034 [US1] Create `src/app/StartScreen.tsx` (mode buttons with keys 1 to 3 for offered modes, Enter or Space starts the first, `?mode=` for tests, gear and fullscreen buttons) and `src/app/MatchOverlay.tsx` (typed number `data-testid="entry"`, message line `data-testid="message"`, goal counter, hearts, help button, pause; `data-testid="match"` with `data-target`, `data-phase`, `data-help`, `data-goals`, `data-hearts`)
- [X] T035 [US1] Create `src/app/RoundEnd.tsx`: encouraging line, "N Tore in m:ss", "Nochmal" with Enter or Space, "Zurück"
- [X] T036 [US1] Copy `src/core/records/records.ts` and test from math-tank with key `min-max|mode|roundType` and value `{ goals, timeMs, at }`; show "Neuer Rekord!" or "Dein Rekord: N" in `RoundEnd.tsx` when `showRecords` is on (FR-028)

**Checkpoint**: hole mode is fully playable with the keyboard.

---

## Phase 4: User Story 2 - Help in steps (Priority: P1)

**Goal**: help steps 1 to 3 with the full chart.

**Independent Test**: quickstart scenario 3.

- [X] T037 [P] [US2] `src/core/match/help.test.ts`: H and each miss advance the help step up to 3; help never changes hearts or stars; step 1 reveals hints when `hintDisplay` is `onRequest`; a shot after step 3 scores and is recorded as unsolved (FR-025b)
- [X] T038 [US2] Implement help in `src/core/match/MatchController.ts`: `askHelp`, automatic step after each miss, step 1 hint text (direction arrow text such as "eine Reihe runter: +10" from the closest hint), step 3 answer
- [X] T039 [US2] Create `src/app/HelpChart.tsx`: full chart of the range in a modal (`data-testid="help-chart"`), target with a thick outline, last typed number as a filled warm square with a ball icon (FR-025a); closes with Enter, Escape or a tap
- [X] T040 [US2] Show help step 1 hint text and step 3 answer in `src/app/MatchOverlay.tsx` and `src/game/GoalView.ts`; add `tests/e2e/help.spec.ts` covering three H presses

---

## Phase 5: User Story 3 - Parent settings and progress (Priority: P1)

**Goal**: parent gate, settings, progress, backup.

**Independent Test**: quickstart scenarios 4, 5, 6 and 7.

- [X] T041 [P] [US3] Copy `src/app/ParentGate.tsx` and test from math-tank: gear held 2 s opens the parent menu and pauses; short tap and keys do nothing (FR-034)
- [X] T042 [P] [US3] Create `src/core/progress/` (`classify.ts`, `adaptive.ts`, `mastery.ts`, `summarize.ts`) adapted from math-tank with `skill` renamed to `direction` and the same thresholds: guess under 1.5 s or after 3 wrong answers within 5 s; step up after 3 independent in a row, down when 2 of the last 3 needed help; mastered at 10 independent attempts with 8 of the last 10 correct; ladder 0 always+direct, 1 vertical or diagonal, 2 far, 3 on request, clamped to the parent's settings (FR-039, FR-040); with tests
- [X] T043 [US3] Record an AttemptRecord per target in `src/core/progress/` and `MatchController.ts` with fields `{ at, mode, min, max, target, directions[], hintDistance, hintDisplay, difficultyStep, solved, helpStep, misses, responseMs, guess }`, capped at the last 2000 (FR-037, FR-038)
- [X] T044 [US3] Create `src/app/SettingsPage.tsx` with all Settings fields grouped Zahlenraum, Spielarten, Hinweise, Reihen, Runde, Schwierigkeit, Ton, Bedienung, Kabine, Daten; Save disabled while invalid; errors next to fields (FR-035); how saved changes reach a running round is T047b (amendment 01)
- [X] T045 [US3] Create `src/app/ProgressPage.tsx`: table per direction and mode (attempts, alone, with help, step, "gemeistert"), personal bests, reset with confirmation that keeps stars
- [X] T046 [P] [US3] Copy `src/core/transfer/` and `src/app/TransferDialog.tsx` with tests from math-tank (QR code or link, `#save=`) and wire "Daten sichern", "Daten laden" in `SettingsPage.tsx` (FR-041)
- [X] T047 [US3] `tests/e2e/settings.spec.ts`: gear hold opens settings, range 200 to 500 gives 30 rows (check `data-rows` on `match`), range 0 to 1000 plays a shot without errors, settings survive a reload

---

## Phase 6: User Story 4 - Line mode (Priority: P2)

**Goal**: complete lines in a chosen direction.

**Independent Test**: quickstart scenarios 8 and 9.

- [X] T048 [P] [US4] `src/core/targets/lines.test.ts`: every square of a line lies on the chart; +11 and +9 lines never wrap across a row edge; length shortens to 3 and falls back to `right` on tiny charts; same seed gives same line
- [X] T049 [US4] Create `src/core/targets/lines.ts` with `makeLine(layout, direction, length, rng)` stepping in row and column space (research R6)
- [X] T050 [US4] Implement line mode in `MatchController.ts`: first two squares printed, correct square lights up and earns a star, finishing the line scores a goal; a goal is one finished line for `goalsPerRound` (FR-015 to FR-018, FR-026)
- [X] T051 [US4] Draw line mode in `src/game/GoalView.ts` (mostly blank board, printed start squares, lit squares, marked target) and add clapping on a correct square in `StandsView.ts`
- [X] T052 [US4] `tests/e2e/lines.spec.ts`: with only `down` on, shoot the five targets and expect one goal

---

## Phase 7: User Story 5 - Goalkeeper mode (Priority: P2)

**Goal**: beat the keeper.

**Independent Test**: quickstart scenario 10.

- [X] T053 [US5] Implement keeper mode in `MatchController.ts` using `nextTarget` with hints lit in the grid and an empty target square (FR-019)
- [X] T054 [US5] Create `src/game/KeeperView.ts`: on every shot the keeper jumps or dives toward the ball; on a wrong number he reaches the ball's square and catches it; on a correct number he dives toward it and falls short; then returns to the middle (FR-020)
- [X] T055 [US5] Draw keeper mode in `GoalView.ts`: open goal, faint grid over the net, hint squares filled in the team color with dark numbers, marked empty target
- [X] T056 [US5] `tests/e2e/keeper.spec.ts`: a correct number scores; a wrong number shows the miss message and `data-keeper="caught"`

---

## Phase 8: User Story 6 - Stars and locker room (Priority: P3)

**Goal**: rewards as looks only.

**Independent Test**: quickstart scenario 12.

- [X] T057 [P] [US6] Create `src/core/rewards/items.ts`, `lockerRoom.ts` and tests: items for ball designs, shirt colors, scarf colors costing 5 to 40 stars, free starter ball, white shirt and yellow scarves; `award`, `buy`, `equip`; stars: line mode 1 per correct square and 3 per finished line, hole and keeper mode 2 per goal; stars never decrease except by buying; shirt number "1 to 99", shirt name "up to 10 letters" (FR-042, FR-043)
- [X] T058 [US6] Create `src/app/LockerRoom.tsx`: preview player and ball, groups Ball, Trikot, Nummer und Name, Fans, locked items with "noch N Sterne", Escape back; K opens it from the start screen; hidden when `lockerRoom` is off (FR-044)
- [X] T059 [US6] Apply the chosen looks in `PlayerView.ts`, `BallView.ts` and `StandsView.ts`; show stars earned on `RoundEnd.tsx` and the star total on `StartScreen.tsx`
- [X] T060 [US6] `tests/e2e/lockerroom.spec.ts`: earn stars, buy and choose a ball, start a round, expect `data-ball` with the new id

---

## Phase 3b: Amendment 02 (visible goal)

**Goal**: a recognisable goal with the board as a panel inside it. See [amendment-02-visible-goal.md](./amendment-02-visible-goal.md).

- [X] T076 [US1] Add `GOAL_FRAME` and `CHART_RECT` to `src/core/match/world.ts` per amendment 02 layout (frame x 260 to 1340, y 200 to 800, posts 22 px; chart x 340 to 1260, y 250 to 750) and use `CHART_RECT` everywhere the chart is placed (`cellRect` callers, board texture, hints, help arrow, ball target); unit test that the chart lies inside the frame with at least 6% side and top margin and every `cellRect` lies inside `CHART_RECT`
- [X] T077 [US1] Redraw the goal in `src/game/GoalView.ts`: thick posts and crossbar, side nets in depth, net mesh visible around the board panel and through the hole; goalkeeper grid inside `CHART_RECT` (FR-053 to FR-055)
- [X] T078 [US1] Move and scale the player in `src/game/PlayerView.ts` (and the kick spot in `world.ts`, ball start in `BallView.ts`) so the player and ball never cover a chart square (FR-056); keep `tests/e2e/holes.spec.ts` and `help.spec.ts` passing in Chromium

## Phase 8b: Amendment 01 (math-tank amendments 23, 24, 25)

**Goal**: locker room from the match, keeping progress, settings apply at once. See [amendment-01-from-math-tank-23-25.md](./amendment-01-from-math-tank-23-25.md).

**Independent Test**: the amendment's "Tests first" list.

- [X] T069 Change `playwright.config.ts` web server ports to 4273 (`pnpm build && pnpm preview --port 4273 --strictPort`) and 4274 (`/math-soccer/` base path), `baseURL` to `http://localhost:4273`, and every spec or helper that names 4173 or 4174 (amendment 01 section 4)
- [X] T070 [US3] Add `applySettings(settings)` to `src/core/match/MatchController.ts` with tests in `MatchController.test.ts`: target-shaping settings give a new target on the new layout, keeping goals, hearts, stars and time; round type and goals per round keep their round-start values; display-only changes keep the target; the dropped target records no attempt (FR-052)
- [X] T071 [US3] Call `applySettings` from `src/app/App.tsx` when the settings page closes after one or more saves (once), not when nothing was saved; keep the paused state; tests in `src/app/App.test.tsx`
- [X] T072 [US3] Copy math-tank's kept-copy restore and `resetAll` (`src/app/persistence.ts` and its test) for the `mathsoccer.*` keys; "Kopie wiederherstellen" with notice on `SettingsPage.tsx`; "Alles zurücksetzen" with a confirmation that reminds to save first on `ProgressPage.tsx`; all or none; settings stay (FR-050, FR-051); i18n texts in `src/i18n/de.ts`
- [X] T073 [US6] Locker room icon next to the gear in `src/app/MatchOverlay.tsx` (only with the locker room on, accessible name "Kabine"); one tap opens `LockerRoom.tsx` over the match, pauses a running round, keys do nothing while open, "Zurück" or Escape closes and resumes, a child-paused round stays paused; equipped looks show at once (FR-049); tests in `App.test.tsx` and `MatchOverlay` tests
- [X] T074 [US6] e2e in Chromium: `tests/e2e/settingsLive.spec.ts` (range 1 to 100 → 1 to 20 mid-round, 2 rows, goals kept), `tests/e2e/persistence.spec.ts` (restore a kept locker room copy, stars on the start screen), `tests/e2e/lockerMatch.spec.ts` (open from a running round, equip a ball, close, round continues with `data-ball` changed)
- [X] T075 Update `README.md`: section "Keeping the child's progress", Home Screen advice for iPad, "save first" before every step that clears browser data (amendment 01 section 2)

---

## Phase 8c: Amendment 03 (free assets)

**Goal**: real grass, a spinning ball, recorded crowd sounds and a rounded number font. See [amendment-03-free-assets.md](./amendment-03-free-assets.md).

- [X] T079 Add the asset files under `public/assets/` (grass `grass004_512.jpg`, ball `ball_rolling_grid.png`, sounds trimmed to `cheer.mp3`, `ohh.mp3`, `clap.mp3`, `kick.mp3`, font `Fredoka.ttf` plus `OFL.txt`), copied from the vetted downloads in the session scratchpad, and extend the PWA `globPatterns` in `vite.config.ts` with jpg, mp3 and ttf (FR-057 to FR-060)
- [X] T080 [US1] Pitch grass in `src/game/MatchScene.ts` (or a new `PitchView.ts`): tiled, darkened texture under the drawn chalk lines (FR-057)
- [X] T081 [US1] Classic ball sprite in `src/game/BallView.ts` / `ballArt.ts`: spin frames advanced with flight progress, frame 0 at rest; other designs and ball kinds stay drawn; unit test for the frame mapping (FR-058)
- [X] T082 [US1] Recorded sounds in `src/audio/sfx.ts`: decode the clips once after the first interaction, play them with the existing switches, fall back to the synthesized sounds when a clip is missing or fails; unit tests (FR-059)
- [X] T083 [US1] Fredoka via `@font-face` in `src/app/styles.css` and in the Phaser text and canvas board drawing (wait for the font to load before drawing the board texture); README asset table with author, license and link (FR-060, FR-061); keep `noExternalRequests`, `offline`, `holes` e2e green in Chromium

---

## Phase 8d: Amendments 04 to 07 (keeper size, keeper as the only game, shapes, time challenge)

See [amendment 04](./amendment-04-keeper-scale.md), [05](./amendment-05-keeper-main-game.md), [06](./amendment-06-tetris-shapes.md), [07](./amendment-07-time-challenge.md).

- [X] T084 [US5] Keeper one size, about half the goal mouth height, feet on the goal line, no scaling during the dive; waiting spot shuffles so target and hint squares stay visible, 50% opacity when no free spot (FR-062 to FR-064); tests in `src/game/keeperDive.test.ts`
- [X] T085 [US1] Hint patterns in `src/core/targets/patterns.ts`: Nachbarn, Mitte, Reihe with a direction, all on the chart, target placement per pattern, trained directions (FR-065); tests in `patterns.test.ts`
- [X] T086 [US3] Settings version bump with migration: drop modes and lineLength, keep line directions as `directions`, add `patterns` (Nachbarn, Mitte, Reihe, Formen; all on) and `shapes` (all on), add `timeChallenge { allowed: true, minutes: 2 }` with minutes in {1, 2, 3, 5} (FR-066, FR-070, FR-076); tests
- [X] T087 [US3] Adaptive ladder per FR-067 in `src/core/progress/ladder.ts` choosing pattern and direction within the parent's choices; random with equal weight when adaptive is off; tests
- [X] T088 [US1] MatchController and nextTarget: keeper game only; remove hole and line logic, `lines.ts` parts not reused by Reihe, patched holes; stored hole or line rounds discarded on load (FR-070); progress keeps old attempts and shows a "früher" total; old bests kept under "früher"; update unit tests
- [X] T089 [US1] Start screen: "Spielen" (Enter, Space) and "Zeit-Challenge" (Z, when allowed); remove mode buttons and keys 1 to 3; settings page groups "Hinweis-Muster", "Richtungen", "Formen", "Zeit-Challenge"; remove "Spielarten", line length and hole settings (FR-068, FR-069); remove the hole board drawing from `GoalView` and `board.ts`
- [X] T090 [US1] e2e in Chromium: remove `holes.spec.ts` and `lines.spec.ts`; add `patterns.spec.ts` (one round per pattern forced via settings); update every spec that used `?mode=` or key 1 to start (keeper, help, settings, settingsLive, lockerroom, lockerMatch, persistence, devices, offline, basePath, performance)
- [X] T091 [US5] Shapes in `src/core/targets/shapes.ts`: I, O, T, L, J, S, Z in four turns placed fully on the chart; one empty square at ladder step 6, two at step 7 and above, shot one after the other, each a goal; trained directions from shape neighbors; parent can turn single shapes off (FR-071 to FR-074); unit tests and an e2e two-empty shape round
  - Design calls (T091): amendment 06 counts ladder steps from 1, so one empty square is at ladder index 5 ("Formen") and two empty squares at indexes 6 and 7. Index 7 offers two-empty shapes together with the far Nachbarn, and its hints wait for a request when the parent chose "auf Wunsch". With one empty square, the empty square is any square that at least two lit squares point to in a straight line of one to three steps and at least one lit square touches. With two, the first must touch a lit square and the second must touch a lit square once the first is filled. A target carries the empty squares still to shoot (`Target.queue`), so a refresh mid-shape continues it. Shapes train across and down only, so for a diagonal the "Formen" step falls back like any empty step.
- [X] T092 [US1] Time challenge: round type `time` with countdown from the challenge minutes, no hearts, ends at zero after a ball in flight lands, pauses with the round clock; kit-yellow gentle pulse in the last 10 s, no red, no ticking; end screen "N Tore in M Minuten" with bests per range and minutes (FR-075 to FR-081); unit tests and e2e with a test speed-up hook
  - Design calls (T092): the countdown is the challenge time minus the time played, so it stops whenever the round clock stops and a refresh continues it from the stored time played. The stored round carries `roundType: 'time'` and `challengeMinutes`. Bests use the key `min-max|keeper|time|minutes`. The test speed-up hook is `?speed=N` (play time runs N times as fast); with it, `window.mathSoccerSpeed` changes the speed while the page runs, so a test can score at normal speed and then let the time run out.
- [X] T093 Update README (how to play: one game, patterns, shapes, time challenge; settings), `contracts/screens.md`, `data-model.md` and `quickstart.md` for amendments 04 to 07; run lint, typecheck, test, build, Chromium and base-path e2e, and performance

---

## Phase 8e: Amendments 08 to 11 (player size, difficulty levels, row and column helper, net and polish)

See [amendment 08](./amendment-08-player-scale.md), [09](./amendment-09-difficulty-levels.md), [10](./amendment-10-row-column-helper.md), [11](./amendment-11-net-and-polish.md).

- [X] T094 [US3] Difficulty levels 1 to 5 in `src/core/progress/ladder.ts` (or a new `levels.ts`): Gerade Linien, Schräge Linien, Formen, Formen mit 2 Lücken, X-Form (diagonal cross in `src/core/targets/xshape.ts`); level up after 3 independent solves in a row, down when 2 of the last 3 needed help, clamped to the parent's start and hardest level; current level stored and kept across rounds; shapes all off skips levels 3 and 4 (FR-085 to FR-089); unit tests
- [X] T095 [US3] Settings version bump: "Schwierigkeit" group with "Stufe am Anfang" and "Schwerste Stufe" (example drawing per level), remove "Hinweis-Muster" and "Richtungen"; migration and old step mapping per amendment 09; progress page shows the current level and per-level counts (FR-090); "Neue Stufe: …" line with a small cheer on level up only (FR-088); unit tests and `tests/e2e/levels.spec.ts`
  - Design calls (T094, T095):
    - The levels live in `src/core/progress/levels.ts`; `ladder.ts` is removed. The pattern generators stay in `patterns.ts` and `shapes.ts`.
    - Level 1 uses the Nachbarn hint distances "direkt daneben", "darüber und darunter" and "weiter weg"; diagonal Nachbarn ("schräg") belong to level 2, so every hint distance switch still has an effect.
    - Level 5 X shape: two empty squares once the child has solved 2 targets alone since reaching level 5 (`Progress.levelWins`, cleared on every level change), with adaptive difficulty on. With adaptive off it always has one empty square. An X target trains only the diagonals through its lit squares.
    - Level changes follow the old step rule on one list of outcomes for the child (`Progress.levelRecent`); guesses do not count. With adaptive off the level is the start level. A level that does not fit the chart (for example the diagonals on one row) falls back to the nearest lower level that fits.
    - "auf Wunsch" with adaptive on: hints wait for a request only at the hardest level the parent allows (it was the top ladder step).
    - The "Schwierigkeit" group keeps the hearts select, now labelled "Schüsse pro Ball", the adaptive switch, and the two level selects with one example drawing per level (levels outside the range are faded).
    - Settings validation: start level above hardest level is refused; a range of only levels 3 and 4 with every shape off is refused, because it offers nothing.
    - Stored data: settings, progress and round go to version 3. Settings 2 to 3 drop "Richtungen" and "Hinweis-Muster", set levels 1 to 5, and turn every shape off when the pattern "Formen" was off. Progress 2 to 3 takes the highest goalkeeper step as the level (steps 0 to 2 level 1, 3 to 4 level 2, 5 level 3, 6 to 7 level 4), maps each attempt's step to its level, and starts the per-level counts from the kept goalkeeper attempts; the level is clamped to the parent's range when used. Round 2 to 3 maps the target's step the same way.
    - Transfer codes are version 2 (no step per direction, plus the level and per-level counts); codes of version 1 from the published game are still read, through the same progress migration.
    - Level up: the goal message becomes "Neue Stufe: <Name>!" and the app plays the clap clip on top of the goal cheer. A level going down shows nothing.
- [X] T096 [US2] Row and column helper: row scale right of the goal with tens labels, column scale above the crossbar 1 to 10, calm style, parent switch "Zeilen- und Spaltenhilfe" (on), every fifth row label above 20 rows (FR-091 to FR-093); help steps row, column, whole chart, answer with bands, arrows and hint lines (FR-094, FR-095); `data-help-row`, `data-help-col`; unit tests; update `help.spec.ts`
- [X] T097 [US1] Player drawn at least 1.3 times the keeper's height, lower left of the ball, never over `CHART_RECT`, short step on the kick (FR-082 to FR-084); unit tests
- [X] T098 [US1] Net: diamond mesh with depth and sag drawn once into a texture, chart grid as a separate soft panel, bulge on a goal (FR-096 to FR-098); overlay bars clear of floodlights, entry placeholder, "Enter" hint on "Spielen" (FR-099 to FR-101); tests; screenshot check
  - Design calls (T097, T098): the player is 1.32 times the keeper's height with a larger head and shirt, his head 6 world pixels below `CHART_RECT` and his feet below the bottom edge, so only head, shirt and shorts show (`src/game/playerPose.ts`). The kick is a 22 px step with a 0.04 rad lean, 150 ms out and back. To keep him clear of the help line, the typed number and the message, these now start at world x `OVERLAY_LEFT` (894, right of the ball), placed with the canvas scale from container units; on iPad landscape they stop before the number pad. The floodlight lamps moved above the top edge and the top bar's counters and buttons are solid night color (FR-099). The entry placeholder is a CSS "?" (FR-100). The bulge is a soft round patch of the net texture that stretches for 400 ms on a goal. Parent feedback: the cell panel shows only while both row and column bands are lit (help step 2 on) and goes when the target is scored (`cellPanelVisible`). FR-101a: one dark strip per scale (`rowBacking`, `columnBacking`).
- [X] T099 Update README, `contracts/screens.md`, `data-model.md` and `quickstart.md` for amendments 08 to 11; run lint, typecheck, test, build, Chromium and base-path e2e, iPad projects and performance

---

## Phase 8f: Amendments 12 and 13 (reliable updates, cup journey and celebrations)

See [amendment 12](./amendment-12-reliable-updates.md) and [13](./amendment-13-cup-journey.md).

- [X] T104 [US2] Amendment 14: row scale hidden until help step 1, column scale until step 2, both with bands and grid gone when the target is solved or replaced (FR-115); home button "Zum Start" with "Runde beenden?" (Weiter / Zum Start), pause screen with "Weiter" and "Zum Start"; "Zum Start" keeps stars and finished attempts, records no best and no attempt for the open target, clears the stored round, stops the time challenge, leaves a cup match unplayed (FR-116 to FR-118); unit tests and e2e
- [X] T100 Updates: check for a new version on every start screen, on tab focus and every 5 minutes; round end line "Neue Version, startet gleich" when a version is waiting; "Zurück" and "Nochmal" apply it; reload applies a waiting version (FR-102 to FR-104); copy and adapt math-tank's two-version update e2e (`tests/e2e/updateServer.mjs` and its spec) with own ports; unit tests
- [X] T105 [US5] Amendment 15: hints, numbers, target outline and waiting shape squares drawn above the waiting keeper; root cause of the keeper not moving aside found and fixed for every new target (after goal, lost heart, restore, new settings), 50% opacity when no free spot; small plus (level 1) and big plus (level 2) with all four arms on the chart, partial Nachbarn removed (FR-120 to FR-123); regression test from the screenshot case; e2e pixel check
- [X] T101 [US6] Cup core: `src/core/cup/` with bracket of five matches, eight fictional teams with keeper quirks (look only), match win at "Tore pro Spiel" (3 to 10, default 5) before hearts are gone, replay on loss, stage levels spread over the parent's level range, one level easier after 2 lost tries (never below start), next cup one level higher, star bonuses 5 per match and 20 per cup; stored kind `mathsoccer.cup.v1` included in backup, transfer, restore and reset-all (FR-105 to FR-112); unit tests
  - Design calls (T101): the cup lives in `src/core/cup/` (`cup.ts`, `teams.ts`) with the stored kind `mathsoccer.cup.v1` (`cupSchema` in `storage/schemas.ts`: cup number, stage 0 to 4, lost tries, won scores as goals and hearts lost, trophies). Stage levels spread over the offered levels of the parent's range (`levelRange`, so levels 3 and 4 drop out with every shape off) with rounding; cup N starts its group games N - 1 positions higher, up to the hardest level, so the levels follow the parent's range when it changes. After 2 lost tries a match plays one position lower, never below the start level. Team of match s in cup N is team ((N - 1) * 5 + s) mod 8. The round type `cup` keeps `cupMatch` (level and goals) in the match state and the stored round; hearts work as in "Bis die Bälle weg sind", and adaptive difficulty does not move the child's level during a cup match (attempts still count). "Tore pro Spiel" (`cupGoals`) is a settings field with a schema default of 5, so stored settings keep version 4. Bonus stars go to the locker room when the match ends; a cup match records no personal best. Minimal start path until T102: a "Pokal" button (P) with `data-cup-number`, `data-cup-stage`, `data-cup-tries`, `?start=cup`, the round end line `data-testid="cup-result"` and `data-misses` on the overlay. e2e: `tests/e2e/cupMatch.spec.ts`.
- [X] T102 [US6] Cup screens and scene: "Pokal" button (P) on the start screen, bracket screen, match intro with the opponent, win and loss lines, keeper and scarf team colors and quirks, bigger final (full stand, name chant rhythm, confetti, fireworks, cup lift), trophy shelf in the locker room; e2e `tests/e2e/cup.spec.ts`
  - Design calls (T102): "Pokal" (P) opens the bracket screen (`src/app/CupBracket.tsx`); Enter, Space or a tap on the highlighted match starts it, Escape or "Zurück" goes back. `?start=cup` still starts the next match at once (test hook). The intro card ("Gruppenspiel 1 gegen FC Blitz", `data-testid="cup-intro"`) shows 1.5 s; Enter, Space or a tap skip it without shooting, the first typed digit ends it and types, and the round clock waits for it. After a win the round end has one button "Weiter" (Enter) back to the bracket; after a loss "Nochmal" replays the match and "Zurück" goes to the bracket. Quirks keep the keeper's size, spots, leaps, layer and opacity (unit test per quirk): tall is a tall flat top, small and quick is a headband and a shuffle in 200 ms instead of 350 ms, beard, cap in team colors, celebrates saves is a jump with the caught ball inside the same hold time, looks left first turns his eyes left during the leap. Half of the scarves take the opponent's color, the other half keep the child's scarf color. The final shows a second layer of fans between the others (full stand) with scarves up, and the crowd chant (`src/core/cup/chant.ts`): one sung tone per three letters of the shirt name (1 to 4), three claps, twice, with the fans clapping on the beat. A won final adds confetti, fireworks over the stands, the player raising the cup (PlayerView.liftCup), a cheer and the chant; its round end is a card at the lower right so the scene stays in view. The trophy shelf ("Pokale") is the last group of the locker room. Test hooks: `data-keeper-quirk`, `data-cup-team` and `data-cup-show` (`match`, `final`, `won`) on the match overlay; `data-testid="cup-bracket"` and `bracket-match` with `data-state`; `trophy-shelf` with `data-trophies`.
- [X] T103 [US6] Celebrations: locker room group "Jubel" (Arme hoch free and default; Rutschen, Flugzeug, Salto, Tanz, Herz for 10 to 30 stars) with preview; played after every goal (about 1.2 s, 0.6 s in the time challenge), skip with Enter or a tap; locker room data version bump and migration; `data-celebration`; unit tests and e2e (FR-113, FR-114)

- [X] T106 Migration baseline (after all features): every stored kind (settings, progress, locker room, records, round, cup) reset to a clean version 1 with its final shape; dev-time migration chains removed; old data resets to defaults once; the migration mechanism stays ready for future changes with one example test

- [X] T107 [US1] Amendment 16: number pad on iPad and Fire tablets with "Automatisch": shown without a fine pointer or on a screen narrower than 1100 px, as math-tank (`src/core/view/screen.ts`, `src/app/useScreen.ts`); Fire projects in `playwright.config.ts`; `tests/e2e/numberPadTablets.spec.ts`
- [X] T108 [US1] Amendment 17: sound on iPad and Fire tablets: audio resumes synchronously on keydown, pointerup, touchend and click (not pointerdown) with a silent buffer, again after an interruption or when the page returns, and on the start tap as in math-tank; clips decode beside the resume (`src/audio/sfx.ts`, `src/app/App.tsx`); unit tests with a tablet-like AudioContext in `src/audio/sfx.test.ts`

- [X] T109 [US5] Amendment 18: level 6 "Ausschnitte" with workbook cutouts (3×3, 2×3 and 3×2 boxes, columns and rows of 4 to 5, Tetris shapes, L and T with arms of 3) fully on the chart, one or two given squares; squares filled one after the other outward from known squares, 1 star each, keeper waits aside and steps in only for the last square, goal plus 3 bonus stars; one cutout is one goal for the round and cup goal counts; per-square attempts, hearts and help; level 6 in settings (example drawing), adaptive and cup spread, default hardest level 6; stored round continues a half-filled cutout (FR-124 to FR-130); unit tests and `tests/e2e/cutouts.spec.ts`

## Phase 8g: Amendments 19 to 21 (cup arms and economy, new shop items, unlockable modes)

See [amendment 19](./amendment-19-cup-arms-and-star-economy.md), [20](./amendment-20-new-shop-items.md), [21](./amendment-21-unlockable-modes.md).

- [X] T110 [US6] Amendment 19: arms raised holding the cup during the final lift (FR-131); stars per event (goal 1, cup match 3, cup 10, cutout square 0, cutout bonus 2) everywhere (FR-132); prices ball designs 30 to 120, shirt and scarf 20 to 60, celebrations 50 to 150, owned items and balance kept (FR-133); unit tests
- [X] T111 [US6] Amendment 20 part 1: locker room groups "Ballspur" (trail behind the ball, fades 0.4 s after landing), "Tor-Effekt" (fireworks, confetti, light show on every goal, final keeps its own show), "Maskottchen" (dog, lion, penguin, bear beside the pitch, never over numbers or buttons; jumps on goals, covers eyes on misses) with previews (FR-134, FR-136, FR-137, FR-139); unit tests and e2e
- [X] T112 [US6] Amendment 20 part 2: "Stadion" (scoreboard with stadium name up to 14 letters, bigger stands, floodlight colors) and "Wetter" (evening, day, sunset, snow, rain; overlays behind the chart) with previews (FR-135, FR-138, FR-139); unit tests, e2e, one screenshot per weather
- [X] T113 [US6] Amendment 21 part 1: "Spielarten" group in the locker room (Mauer 200, Torwart 300, Elfmeter 600 after Torwart), start screen buttons with lock and price, parent switch "Spielarten erlauben" (FR-140, FR-141); "Freistoß mit Mauer" mode (FR-142); unit tests and e2e
- [X] T114 [US6] Amendment 21 part 2: "Selbst ins Tor" mode: opponent shoots, flashing unnumbered square, type its number to save, flight time per "Schussgeschwindigkeit" with countdown arc, help pauses the flight, hints by level, 10 shots, "N von 10 gehalten", 1 star per save (FR-143 to FR-146); unit tests and e2e
- [X] T115 [US6] Amendment 21 part 3: "Elfmeterschießen" (5 rounds of one shot each way, score circles, sudden death, "Elfmeter-Sieger!" with 5 stars, loss without loss) (FR-147, FR-148); bests per mode; README and contracts for amendments 18 to 21; unit tests and e2e

- [X] T116 [US6] Amendment 22: Kenney particle images for sparkles, stars, fire trails, fireworks and light show (tinted, pooled); new CC0 sounds (whistle, keeper catch, wall and post impact, firework, confetti pop, coin, unlock fanfare, rain loop, quiet crowd murmur) at the moments in FR-150, behind the right switches with synthesized fallbacks, trimmed mono, about 1.5 MB total, precached; README asset table (FR-149 to FR-153); unit tests and e2e

- [ ] T117 [US6] Amendment 23: "Torwandschießen" (150 stars, key W): board over the goal with 2 to 3 round holes, "Triff die N!", decoy holes miss, fewer hints, 10 shots, "N von 10 Treffern", 1 star per goal (FR-154 to FR-157); "Papa gegen Kind" (250 stars, key F): two-player shootout on one tablet with turn cards, names, per-player levels (grown-up level 6 by default), score circles, winner card, child-only stars and progress (FR-158 to FR-161); unit tests and e2e

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T061 [P] Copy `src/app/NumberPad.tsx` and test from math-tank with the setting automatic, always, never; layout for iPad landscape and portrait (FR-031)
- [X] T062 [P] Copy `src/audio/speaker.ts` from math-tank and read tasks aloud when "Vorlesen" is on, with a speaker icon in the overlay (FR-032)
- [X] T063 [P] Pause and resume (Escape and button), fullscreen button, optional clock (FR-029, FR-033)
- [X] T064 [P] `tests/e2e/offline.spec.ts`, `tests/e2e/noExternalRequests.spec.ts` and `tests/e2e/basePath.spec.ts` from math-tank (FR-046, FR-047)
- [X] T065 [P] `tests/e2e/devices.spec.ts` for the iPad projects: start, number pad shot, help chart fit on screen
- [X] T066 Performance check: a 1 to 200 round and a 0 to 1000 round keep a smooth frame rate in Chromium (`tests/e2e/performance.spec.ts`, runs alone, skipped without a graphics card, as math-tank)
- [X] T067 Update `README.md` with final play instructions and the asset list, and run all quickstart scenarios; record results in `specs/001-math-soccer/quickstart.md`
- [X] T068 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm e2e`, and fix every failure

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **US1** first (MVP). **US2** and **US3** depend on the controller from US1. **US4** and **US5** depend on US1's scene and controller and can run in parallel with each other. **US6** depends on US1 (stars come from goals and squares).
- **Amendment 01 (Phase 8b)** after US3 and US6; T069 can run any time and is done first.
- **Polish** after the stories it touches.

## Parallel Examples

- Phase 1: T002 to T008 in parallel after T001.
- Phase 2: T010, T011, T012, T015, T016 in parallel; T013 and T014 after T011.
- US1: tests T023 to T026 together; views T030, T031, T032 together after T028 and T029.
- US4 and US5 in parallel once US1 is done.

## Implementation Strategy

1. Setup and Foundational.
2. US1: playable hole mode; stop and check against quickstart 1, 2, 11, 14. Start the local server here and tell the parent it is ready to view.
3. US2 and US3: help and parent tools, so the parent can tune the game.
4. US4, US5: more modes.
5. US6: rewards.
6. Polish, then `/simplify` and `/code-review high --fix` as the parent asked.

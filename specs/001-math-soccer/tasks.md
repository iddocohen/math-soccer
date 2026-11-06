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

- [ ] T053 [US5] Implement keeper mode in `MatchController.ts` using `nextTarget` with hints lit in the grid and an empty target square (FR-019)
- [ ] T054 [US5] Create `src/game/KeeperView.ts`: on every shot the keeper jumps or dives toward the ball; on a wrong number he reaches the ball's square and catches it; on a correct number he dives toward it and falls short; then returns to the middle (FR-020)
- [ ] T055 [US5] Draw keeper mode in `GoalView.ts`: open goal, faint grid over the net, hint squares filled in the team color with dark numbers, marked empty target
- [ ] T056 [US5] `tests/e2e/keeper.spec.ts`: a correct number scores; a wrong number shows the miss message and `data-keeper="caught"`

---

## Phase 8: User Story 6 - Stars and locker room (Priority: P3)

**Goal**: rewards as looks only.

**Independent Test**: quickstart scenario 12.

- [ ] T057 [P] [US6] Create `src/core/rewards/items.ts`, `lockerRoom.ts` and tests: items for ball designs, shirt colors, scarf colors costing 5 to 40 stars, free starter ball, white shirt and yellow scarves; `award`, `buy`, `equip`; stars: line mode 1 per correct square and 3 per finished line, hole and keeper mode 2 per goal; stars never decrease except by buying; shirt number "1 to 99", shirt name "up to 10 letters" (FR-042, FR-043)
- [ ] T058 [US6] Create `src/app/LockerRoom.tsx`: preview player and ball, groups Ball, Trikot, Nummer und Name, Fans, locked items with "noch N Sterne", Escape back; K opens it from the start screen; hidden when `lockerRoom` is off (FR-044)
- [ ] T059 [US6] Apply the chosen looks in `PlayerView.ts`, `BallView.ts` and `StandsView.ts`; show stars earned on `RoundEnd.tsx` and the star total on `StartScreen.tsx`
- [ ] T060 [US6] `tests/e2e/lockerroom.spec.ts`: earn stars, buy and choose a ball, start a round, expect `data-ball` with the new id

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
- [ ] T070 [US3] Add `applySettings(settings)` to `src/core/match/MatchController.ts` with tests in `MatchController.test.ts`: target-shaping settings give a new target on the new layout, keeping goals, hearts, stars and time; round type and goals per round keep their round-start values; display-only changes keep the target; the dropped target records no attempt (FR-052)
- [ ] T071 [US3] Call `applySettings` from `src/app/App.tsx` when the settings page closes after one or more saves (once), not when nothing was saved; keep the paused state; tests in `src/app/App.test.tsx`
- [ ] T072 [US3] Copy math-tank's kept-copy restore and `resetAll` (`src/app/persistence.ts` and its test) for the `mathsoccer.*` keys; "Kopie wiederherstellen" with notice on `SettingsPage.tsx`; "Alles zurücksetzen" with a confirmation that reminds to save first on `ProgressPage.tsx`; all or none; settings stay (FR-050, FR-051); i18n texts in `src/i18n/de.ts`
- [ ] T073 [US6] Locker room icon next to the gear in `src/app/MatchOverlay.tsx` (only with the locker room on, accessible name "Kabine"); one tap opens `LockerRoom.tsx` over the match, pauses a running round, keys do nothing while open, "Zurück" or Escape closes and resumes, a child-paused round stays paused; equipped looks show at once (FR-049); tests in `App.test.tsx` and `MatchOverlay` tests
- [ ] T074 [US6] e2e in Chromium: `tests/e2e/settingsLive.spec.ts` (range 1 to 100 → 1 to 20 mid-round, 2 rows, goals kept), `tests/e2e/persistence.spec.ts` (restore a kept locker room copy, stars on the start screen), `tests/e2e/lockerMatch.spec.ts` (open from a running round, equip a ball, close, round continues with `data-ball` changed)
- [ ] T075 Update `README.md`: section "Keeping the child's progress", Home Screen advice for iPad, "save first" before every step that clears browser data (amendment 01 section 2)

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T061 [P] Copy `src/app/NumberPad.tsx` and test from math-tank with the setting automatic, always, never; layout for iPad landscape and portrait (FR-031)
- [ ] T062 [P] Copy `src/audio/speaker.ts` from math-tank and read tasks aloud when "Vorlesen" is on, with a speaker icon in the overlay (FR-032)
- [ ] T063 [P] Pause and resume (Escape and button), fullscreen button, optional clock (FR-029, FR-033)
- [ ] T064 [P] `tests/e2e/offline.spec.ts`, `tests/e2e/noExternalRequests.spec.ts` and `tests/e2e/basePath.spec.ts` from math-tank (FR-046, FR-047)
- [ ] T065 [P] `tests/e2e/devices.spec.ts` for the iPad projects: start, number pad shot, help chart fit on screen
- [ ] T066 Performance check: a 1 to 200 round and a 0 to 1000 round keep a smooth frame rate in Chromium (`tests/e2e/performance.spec.ts`, runs alone, skipped without a graphics card, as math-tank)
- [ ] T067 Update `README.md` with final play instructions and the asset list, and run all quickstart scenarios; record results in `specs/001-math-soccer/quickstart.md`
- [ ] T068 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm e2e`, and fix every failure

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

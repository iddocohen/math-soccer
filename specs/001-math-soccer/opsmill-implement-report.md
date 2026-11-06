# Implementation report: Math Soccer (Mathe-Kicker)

**Status**: DONE
**Spec directory**: `specs/001-math-soccer`
**Base commit**: `25c2dd9` | **Head commit before this report**: `3104bc0`
**Wall-clock time**: about 1 hour 55 minutes (13:57 to 15:52 UTC on 2026-11-06)

## 1. Summary

All 78 tasks are done: 68 from the original task list, 7 from amendment 01 (math-tank amendments 23 to 25), and 3 from amendment 02 (a visible goal). The final checks pass:

- 436 unit tests
- 20 browser tests in Chromium and the `/math-soccer/` base-path build
- 6 iPad-size device tests
- a frame-rate check at 60 frames per second

## 2. Chunk ledger

| # | Chunk | Tasks | Outcome | Commits | Flagged decisions |
|---|-------|-------|---------|---------|-------------------|
| 1 | Phase 1 Setup | 9 | 9 ✅ | f79e7c0 | Service worker update module copied from math-tank. |
| 2 | Phase 2 Foundational A | 7 | 7 ✅ | 19fdcb4 | One shared load and save for every stored kind. Damaged data is copied to `<key>.unreadable`. |
| 3 | Phase 2 Foundational B | 6 | 6 ✅ | 164b57a | The controller takes a `nextTarget` input. Messages are stored as data. |
| 4 | US1 core | 7 | 7 ✅ | c3cb210 | `far` hints are exactly 2 squares away. Found that math-tank's servers hold ports 4173 and 4174. |
| 5 | US1 scene, plus T069 | 8 | 8 ✅ | a1eb17b | Own test ports 4273 and 4274. A record counts more goals, or the same goals in less time. |
| 6 | US2 help | 4 | 4 ✅ | e0f95f9 | The help chart has its own key screen, and Enter there never shoots. |
| 7 | Amendment 02 visible goal | 3 | 3 ✅ | 40f1ae7 | The board is a panel inside a drawn goal. The player stands below the goal line. |
| 8 | US3 parent tools | 7 | 7 ✅ | 02429fc | 200 to 500 has 31 rows; the spec text was fixed in 60afc9c. Adaptive "auf Wunsch" is a ceiling. |
| 9 | US4 lines | 5 | 5 ✅ | 7972bc2 | A 5-square line has 3 targets, because 2 squares are given. |
| 10 | US5 goalkeeper | 4 | 4 ✅ | 8880280 | The keeper dives the other way when the target is next to him. |
| 11 | US6 locker room | 4 | 4 ✅ | e233884 | Yellow kit shirt as the default, white free too. `data-ball` holds the design and `data-ball-kind` the size. |
| 12 | Amendment 01 | 6 | 6 ✅ | 2166a70 | Settings saved during a shot apply once aiming resumes. |
| 13 | Phase 9 Polish | 8 | 8 ✅ | 5bddd24 | The spoken task never says the answer. |

Spec and amendment commits made by the orchestrator: 345bb44 (amendment 01), cf77428 (amendment 02), 60afc9c (31 rows).

## 3. Tasks not completed

None. All 78 tasks are `[X]`.

## 4. Local-pass evidence

All runs on 2026-11-06. Vitest runs in node or jsdom. Playwright ran in Chromium (the parent's decision), plus the iPad projects in WebKit for the device spec.

| Test id | Type | Run command | Passed at | Environment | Verbatim pass line |
|---------|------|-------------|-----------|-------------|--------------------|
| src/app/swUpdate.test.ts (13) | unit | `pnpm test` | 2026-11-06T13:59:23Z | jsdom | `Tests  13 passed (13)` |
| rng, util, chart/layout, settings, storage, i18n/de (67) | unit | `pnpm -s exec vitest run src/core src/i18n` | 2026-11-06T14:05:11Z | node | `Tests  67 passed (67)` |
| match/entry, MatchController, keyboard, App, audio/sfx (43) | unit | `pnpm exec vitest run src/core/match src/app/keyboard.test.ts src/app/App.test.tsx src/audio` | 2026-11-06T14:10:52Z | node, jsdom | `Tests  43 passed (43)` |
| targets/hints (12), targets/nextTarget (10), MatchController (36) | unit | `pnpm exec vitest run src/core/targets ...` | 2026-11-06T14:18:45Z | node | `✓ \|node\| src/core/match/MatchController.test.ts (36 tests)` |
| tests/e2e/holes.spec.ts (2) | e2e | `pnpm exec playwright test tests/e2e/holes.spec.ts --project=chromium` | 2026-11-06T14:29:50Z | Chromium, port 4273 | `2 passed (15.4s)` |
| records (8), game/board (9), App (10) | unit | `pnpm exec vitest run src/core/records src/game/board.test.ts src/app/App.test.tsx` | 2026-11-06T14:28:22Z | n/a | `Tests  27 passed (27)` |
| match/help (20), keyboard (16), board (12) | unit | `pnpm exec vitest run src/core/match/help.test.ts ...` | 2026-11-06T14:35:41Z | n/a | `Tests  48 passed (48)` |
| tests/e2e/help.spec.ts (3) | e2e | `pnpm exec playwright test tests/e2e/help.spec.ts tests/e2e/holes.spec.ts --project=chromium` | 2026-11-06T14:35:01Z | Chromium | `5 passed (27.7s)` |
| match/world (4), board | unit | `pnpm exec vitest run src/core/match/world.test.ts src/game/board.test.ts` | 2026-11-06T14:39:30Z | n/a | `Tests  16 passed (16)` |
| progress (adaptive, attempt, classify), transfer, qr, ParentGate, SettingsPage, ProgressPage, TransferDialog, App (159) | unit | `pnpm exec vitest run <13 files>` | 2026-11-06T14:55:29Z | node, jsdom | `Tests 159 passed (159)` |
| tests/e2e/settings.spec.ts (2) | e2e | `pnpm exec playwright test tests/e2e/settings.spec.ts ... --project=chromium` | 2026-11-06T14:54:59Z | Chromium | `7 passed (18.7s)` |
| targets/lines (7), MatchController, board, storage (89) | unit | `pnpm exec vitest run src/core/targets/lines.test.ts ...` | 2026-11-06T15:00:50Z | n/a | `Tests  89 passed (89)` |
| tests/e2e/lines.spec.ts (1) | e2e | `pnpm exec playwright test tests/e2e/lines.spec.ts --project=chromium` | 2026-11-06T14:59:59Z | Chromium | `1 passed (12.6s)` |
| game/keeperDive (8), MatchController (+3) | unit | `pnpm test` | 2026-11-06T15:08Z | n/a | `Tests  331 passed (331)` |
| tests/e2e/keeper.spec.ts (2) | e2e | `pnpm exec playwright test tests/e2e/keeper.spec.ts ... --project=chromium` | 2026-11-06T15:08:32Z | Chromium | `5 passed (16.1s)` |
| rewards/lockerRoom (17), App (19) | unit | `pnpm exec vitest run src/core/rewards/lockerRoom.test.ts` and `src/app/App.test.tsx` | 2026-11-06T15:16:42Z | n/a | `Tests  17 passed (17)` / `Tests  19 passed (19)` |
| tests/e2e/lockerroom.spec.ts (1) | e2e | `pnpm exec playwright test tests/e2e/lockerroom.spec.ts ... --project=chromium` | 2026-11-06T15:16:34Z | Chromium | `6 passed (25.3s)` |
| MatchController, App, persistence (11), SettingsPage, ProgressPage, MatchOverlay (3) (120) | unit | `pnpm exec vitest run <6 files>` | 2026-11-06T15:25:11Z | jsdom | `Tests  120 passed (120)` |
| tests/e2e/settingsLive, persistence, lockerMatch (3) | e2e | `pnpm exec playwright test <3 specs> --project=chromium` | 2026-11-06T15:24:11Z | Chromium | `3 passed (14.7s)` |
| NumberPad, MatchOverlay, speaker, i18n (28) | unit | `pnpm exec vitest run <files>` | 2026-11-06T15:28:46Z | n/a | `Tests 28 passed (28)` |
| offline, noExternalRequests, speech (2), pauseResume, basePath | e2e | `pnpm exec playwright test --project=chromium --project=base-path` | 2026-11-06T15:33:59Z | Chromium | `20 passed (38.5s)` |
| tests/e2e/devices.spec.ts (6) | e2e | `pnpm exec playwright test --project=ipad-landscape --project=ipad-portrait` | 2026-11-06T15:34:21Z | WebKit, iPad Mini sizes | `6 passed (15.6s)` |
| tests/e2e/performance.spec.ts (2) | e2e | `pnpm exec playwright test --project=performance --no-deps` | 2026-11-06T15:31:28Z | Chromium with GPU (Apple M4 Pro) | `2 passed (12.9s)` |
| Review fixes: MatchController (70), storage, settings, persistence, world, App (36), TransferDialog, ProgressPage, SettingsPage | unit | `pnpm test` | 2026-11-06T15:48:22Z | node, jsdom | `Tests  436 passed (436)` |
| Full Chromium and base-path suite after review fixes | e2e | `pnpm exec playwright test --project=chromium --project=base-path` | 2026-11-06T15:48:33Z | Chromium | `20 passed (39.6s)` |

Not run, by the parent's decision: the `firefox` and `webkit` desktop projects. They stay in the config for `pnpm e2e`.

## 5. Review findings

Review mode: plugin (pr-review-toolkit)

Five reviewers ran in parallel: code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer and comment-analyzer. Then code-simplifier ran alone; its 10 edits were recorded as low findings and discarded. All high findings, and the medium findings that were real bugs, were fixed in 10418ae and 3104bc0.

| ID | Severity | File | Summary | Status |
|----|----------|------|---------|--------|
| H1 | high | MatchController.ts | `getState()` returned the live, changeable object | fixed (read-only `MatchView`) |
| H2 | high | MatchController.ts, data-model.md | the `landed` phase was declared but never set | fixed (removed) |
| H3 | high | storage/schemas.ts | the stored round had no checks across fields | fixed (`superRefine`) |
| H4 | high | MatchController.ts | the match state is one flat record | partial: rules between phases are checked at runtime in development builds; a union per phase is deferred |
| H5 | high | storage.ts, App.tsx | data reset on load was never shown to the parent | fixed (note on the start screen) |
| H6 | high | persistence.ts | a failed undo still reported "nothing changed" | fixed (`partial` result and its own notice) |
| H7 | high | MatchController.restore | after a refresh the round used the newly saved goals per round | fixed |
| H8 | high | world.ts, world.test.ts | the chart's top margin was under 6% of the goal width | fixed (chart y 265 to 750) |
| H9 | high | README.md | the README named a "Spielen" button that does not exist | fixed |
| H10 | high | contracts/screens.md | coordinates and screen details were out of date | fixed |
| M1 | medium | MatchController.ts, MatchScene.ts | settings saved during a shot wiped the landing feedback | fixed |
| M2 | medium | App.tsx | a refresh during the final goal lost the personal best | fixed |
| M3 | medium | App.tsx | taking over a transfer did not apply its settings to the running round | fixed |
| M4 | medium | App.tsx | attempts were recorded with the saved settings, not the round's | fixed (no screen path to test it) |
| M5 | medium | settings/schema.ts | the limits were not in the schema | fixed |
| M6 | medium | App.tsx | failed saves during play were silent | fixed (note on the start screen) |
| M7 | medium | i18n/de.ts | the app name was "Mathe-Fußball" | fixed: "Mathe-Kicker" |
| M8 | medium | buildInfo.ts, ladder.ts, playwright.config.ts, README | stale comments | fixed |
| T3 to T9 | medium/low | tests | gaps: ball path set in the scene, damaged compressed transfer, all-or-none import tests, failed transfer in the app, misses across targets, reset failure notice, kick-spot clearance | deferred |
| Ty5 to Ty12 | medium/low | types | unions for item ids, template-literal progress keys, read-only `ChartLayout`, 0 to 3 step type, line index bounds in the type | deferred (line bounds are now checked in the schema) |
| S5 to S7 | medium/low | persistence.ts, storage.ts | removing a restored copy can fail silently; an old kept copy is overwritten; `saveRound` results are dropped | deferred |
| C4 to C15 | low | docs | small wording issues in the contracts and quickstart | partly fixed in 3104bc0 |
| Simplifier 1 to 10 | low | MatchController, lockerRoom, persistence, App, MatchOverlay, LockerRoom, SettingsPage, MatchScene | repeated logic and nested ternaries | deferred to the `/simplify` run the parent asked for |

## 6. Autonomous decisions

- **Chunks:** 13, running one at a time. The two amendments got chunks of their own.
- **Browsers:** Chromium only for e2e, as the parent decided during the run. Firefox and WebKit desktop were not run.
- **Test ports:** 4273 and 4274, because math-tank's preview servers hold 4173 and 4174 on this machine.
- **H4 partly fixed:** a full union per phase would touch every reader of the match state. Runtime checks in development builds cover the same rules for now.
- **Commit attribution:** the parent's global rules forbid attribution lines, and a hook blocks them, so none of the commits carry one.
- **Assets:** CC0 assets for grass, ball, crowd sounds and font were researched. They are not built in yet, because the parent has not yet answered whether to add them as amendment 03.
- **App name:** "Mathe-Kicker" everywhere, including the export file name.

## 7. Suggested next steps

1. Run `/simplify` and `/code-review high --fix`, as the parent asked.
2. Decide on amendment 03, the CC0 assets.
3. Create the public repository `iddocohen/math-soccer`, merge to `main`, push, set Pages to GitHub Actions, and check https://iddocohen.github.io/math-soccer/.
4. Walk through the quickstart on a real iPad, including offline play.
5. Optionally address the deferred low findings, especially the remaining test gaps.

# Quickstart: validating Math Soccer

## Prerequisites

Node.js 22 or later, pnpm 10.

```bash
pnpm install
pnpm dev                 # development server
pnpm test                # unit tests
pnpm lint && pnpm typecheck
pnpm build && pnpm preview
pnpm exec playwright install chromium firefox webkit
pnpm e2e                 # chromium, firefox, webkit, iPad sizes, /math-soccer/ base path
```

## Scenarios

Each scenario maps to the spec. Run them in Firefox and Chrome on a computer, and on an iPad.

1. **Goal and miss (US1, US5)**: start with Enter ("Spielen"). With target 46 and the Nachbarn pattern, 45, 47, 36, 56 light up. Type 46, Enter: goal past the keeper, cheer. Type 56 on the next target: the ball flies to 56's square, the keeper catches it, it shows "56" in orange, soft "ohhh", clapping. See [contracts/screens.md](./contracts/screens.md) feedback table.
2. **Out of range (US1)**: type 150 in range 1 to 100, Enter: no shot, "Zahlen von 1 bis 100".
3. **Help steps (US2, amendments 10 and 14)**: before help no row or column scale shows. Press H four times: the target's row lights up with a hint arrow and the row scale appears right of the goal; the column lights up and the column scale appears above the crossbar; the full chart with target and last number marked; the answer. No help sentence shows under the goal. After the goal both scales go. Hearts and stars unchanged.
4. **Parent gate (US3)**: tap the gear: nothing. Hold 2 s: parent menu, game paused. Keys never open it.
5. **Custom range (US3)**: set 200 to 500: 31 rows (200 sits in the row 191 to 200), smaller squares, ping-pong ball. Set 205 to 480: the first row shows empty grey squares for 201 to 204.
6. **Range with 0 (US3)**: set 0 to 1000: rows start at 0, ping-pong ball, the game plays without errors.
7. **Progress (US3)**: play 5 targets; the progress page shows them under the right directions.
8. **Hint patterns and levels (amendments 05 and 09)**: set "Stufe am Anfang" and "Schwerste Stufe" to the same level; each target belongs to it: level 1 lights Nachbarn, Mitte or Reihe across and down, level 2 the diagonals, level 3 a shape with one empty square, level 4 a shape with two, level 5 the X shape.
9. **Diagonal at the edge (amendment 05)**: direction +11 with Mitte or Reihe: no pattern wraps from column 10 to column 1.
10. **Goalkeeper (US5)**: correct number goes past the keeper; wrong number flies to its own square and the keeper catches it.
11. **Hearts (US1, FR-027)**: difficulty "challenging", round type hearts: 3 misses on one target cost one heart; one miss costs none.
12. **Locker room (US6)**: earn stars, buy a ball design, choose it; the next round shows it. Stars never drop after a miss.
13. **Offline (FR-046)**: load once, turn the network off, reload, play a round.
14. **Refresh keeps the round**: refresh during a round; the round continues with the same goals and target.
15. **Base path (FR-047)**: `pnpm exec vite build --base=/math-soccer/` and the `base-path` Playwright project pass.
16. **Forbidden words (FR-023)**: the unit test over `src/i18n/de.ts` passes.
17. **Keeper size (amendment 04)**: the keeper is about half as tall as the goal mouth, keeps that size during the dive, and while waiting does not cover the target or a hint square.
18. **Shapes (amendment 06)**: allow only "Formen". A target is one square of a four-square shape, the other squares lit. At level 4, a shape has two empty squares: after the first goal the second empty square is the target and the first lights up. Turn single shapes off in "Formen": they no longer appear.
19. **Time challenge (amendment 07)**: set "Zeit-Challenge" to 1 minute and press Z. The countdown runs from 1:00, stops during pause, the parent menu and the locker room, and continues after a refresh. No hearts show. In the last 10 seconds it turns yellow and pulses, with no red and no ticking. A ball in flight at 0:00 still counts. The end screen says "N Tore in 1 Minute" and compares with the best of the same range and length.

20. **Level up (amendment 09)**: adaptive on, levels 1 to 5. Solve 3 targets in a row alone: the goal message reads "Neue Stufe: Schräge Linien!" and the next targets are diagonal. Ask for help on 2 of 3 targets: the level goes down with no message. The progress page shows the current level and the counts per level.
21. **Player and kick (amendment 08)**: the player is clearly taller than the keeper, stands lower left of the ball and never covers a chart square; on a shot he steps toward the ball.
22. **Net and polish (amendment 11)**: a diamond net that bulges around the ball on a goal, a chart panel that reads apart from the net, no floodlight behind the top bar, a faint "?" in the empty number box, "Enter" on "Spielen".
23. **Row and column helper switch (amendment 10)**: "Zeilen- und Spaltenhilfe" off: during help a shown scale has only the target's row or column label.
24. **Zum Start (amendment 14)**: during a round tap the house button: the round pauses and asks "Runde beenden?". "Weiter" (Enter) plays on; "Zum Start" goes to the start screen with no end screen, the stars stay, and a reload starts on the start screen. Escape shows the pause screen with "Weiter" and "Zum Start".
25. **New versions (amendment 12)**: with a page open, publish a new build. Back on the start screen it reloads into the new build. During a round the round end says "Neue Version, startet gleich", and "Zurück" or "Nochmal" reloads with it. Reloading during a round applies it too, and the round continues.

## Look-and-feel prototype

`prototype/index.html` is a throwaway prototype from research (R12). Open it directly in a browser. It is not part of the build.

## Results (T067, 2026-11-06)

Run on a Mac (Apple M4 Pro) with Playwright: Chromium for the desktop specs, WebKit with iPad Mini sizes for the device spec. Firefox, desktop WebKit and real iPads were not run here. "Unit" means the scenario is checked by Vitest tests, not by playing it in a browser.

| # | Scenario | Result | Checked by |
|---|----------|--------|------------|
| 1 | Hole mode goal and miss | Passed | `tests/e2e/holes.spec.ts` (goal, miss message, target stays); the orange miss square in `src/game/board.test.ts` (unit). The cheer, "ohhh" and clapping sounds were not listened to. |
| 2 | Out of range | Passed | `tests/e2e/holes.spec.ts` (101 in 1 to 100: no shot, range message) |
| 3 | Help steps | Passed | `tests/e2e/help.spec.ts`; iPad sizes: the help chart fits the screen in `tests/e2e/devices.spec.ts` |
| 4 | Parent gate | Passed | Hold 2 s: `tests/e2e/settings.spec.ts`; short tap and keys do not open it: `src/app/ParentGate.test.tsx` (unit) |
| 5 | Custom range 200 to 500, and 205 to 480 | Passed | 200 to 500 gives 31 rows: `tests/e2e/settings.spec.ts`; 205 to 480 empty squares: `src/core/chart/layout.test.ts` (unit) |
| 6 | Range with 0 (0 to 1000) | Passed | `tests/e2e/settings.spec.ts` (a shot without page errors); frame rate 60 per second in `tests/e2e/performance.spec.ts` |
| 7 | Progress | Passed (unit only) | `src/app/ProgressPage.test.tsx` and `src/core/progress/*.test.ts`. Playing 5 targets and then opening the progress page was not run in a browser. |
| 8 | Line mode | Passed | `tests/e2e/lines.spec.ts` |
| 9 | Diagonal at the edge | Passed (unit) | `src/core/targets/lines.test.ts` ("+11 and +9 lines never wrap across a row edge") |
| 10 | Goalkeeper | Passed | `tests/e2e/keeper.spec.ts` |
| 11 | Hearts | Passed (unit) | `src/core/match/MatchController.test.ts` ("hearts (FR-027)") |
| 12 | Locker room | Passed | `tests/e2e/lockerroom.spec.ts`, `tests/e2e/lockerMatch.spec.ts` |
| 13 | Offline | Passed in Chromium | `tests/e2e/offline.spec.ts` (service worker, network off, reload, a whole round). On a real iPad: not run here (needs a real iPad). |
| 14 | Refresh keeps the round | Passed | `tests/e2e/holes.spec.ts` ("a refresh continues the round") |
| 15 | Base path | Passed | `tests/e2e/basePath.spec.ts` in the `base-path` project. Publishing to GitHub Pages is not verified: the repository `iddocohen/math-soccer` does not exist yet. |
| 16 | Forbidden words | Passed | `src/i18n/de.test.ts` (unit) |

Phase 9 checks:

- Number pad (FR-031): `tests/e2e/devices.spec.ts` in `ipad-landscape` and `ipad-portrait` (pad shows with "automatisch", keys at least 48 by 48, a round played with taps only, the pad clear of the typed number and the top buttons). Use on a real iPad: not run here (needs a real iPad).
- Vorlesen (FR-032): `tests/e2e/speech.spec.ts` with a stand-in German voice. Real speech output was not listened to.
- Pause, fullscreen and clock (FR-029, FR-033): `tests/e2e/pauseResume.spec.ts` and `src/app/MatchOverlay.test.tsx`. Entering fullscreen was not tried by hand.
- No requests to other origins: `tests/e2e/noExternalRequests.spec.ts`.
- Frame rate: `tests/e2e/performance.spec.ts`, 60 frames per second during the ball flight for 1 to 200 and for 0 to 1000 (Chromium, ANGLE Metal on an Apple M4 Pro). The iPad goal of 30 frames per second was not measured.

## Results after amendments 04 to 07 (T093, 2026-11-06)

Run on the same Mac with Playwright: `--project=chromium --project=base-path` (24 passed), `ipad-landscape` and `ipad-portrait` (6 passed), and `performance` (2 passed, 55 frames per second or more for 1 to 200 and 0 to 1000); `pnpm test` 488 unit tests passed. Firefox, desktop WebKit and real iPads were not run. The T067 table above names `holes.spec.ts`, `lines.spec.ts` and `lines.test.ts`, which amendment 05 removed; the rows below replace those rows.

| # | Scenario | Result | Checked by |
|---|----------|--------|------------|
| 1 | Goal and miss | Passed | `tests/e2e/keeper.spec.ts` |
| 2 | Out of range | Passed (unit) | `src/core/match/MatchController.test.ts` |
| 8 | Hint patterns | Passed | `tests/e2e/patterns.spec.ts` (one round per pattern) |
| 9 | Diagonal at the edge | Passed (unit) | `src/core/targets/patterns.test.ts` ("placements stay on the chart") |
| 14 | Refresh keeps the round | Passed | `tests/e2e/persistence.spec.ts`; a time challenge: `tests/e2e/timeChallenge.spec.ts` |
| 17 | Keeper size | Passed (unit) | `src/game/keeperDive.test.ts`; `tests/e2e/keeper.spec.ts` |
| 18 | Shapes | Passed | `tests/e2e/patterns.spec.ts` (two goals in a two-empty shape); every shape and turn, the trained directions and the shapes switches in `src/core/targets/shapes.test.ts` and `src/core/progress/ladder.test.ts` (unit) |
| 19 | Time challenge | Passed | `tests/e2e/timeChallenge.spec.ts` (Z, two goals, "2 Tore in 1 Minute", the last-seconds look, a refresh); countdown pause, no hearts, the ball in flight at 0:00 and bests per range and length in `src/core/match/MatchController.test.ts` and `src/core/records/records.test.ts` (unit). The pulse was looked at in a screenshot only. |

## Results after amendments 08 to 14 (T099, 2026-11-06)

Run on the same Mac with Playwright: `--project=chromium --project=base-path` (35 passed, including the 4 tests of `tests/e2e/update.spec.ts`), `ipad-landscape` and `ipad-portrait` (6 passed), `performance --no-deps` (2 passed, 55 frames per second or more for 1 to 200 and 0 to 1000); `pnpm test` 571 unit tests passed; `pnpm lint`, `pnpm typecheck` and `pnpm build` clean. Firefox, desktop WebKit and real iPads were not run.

| # | Scenario | Result | Checked by |
|---|----------|--------|------------|
| 3 | Help steps | Passed | `tests/e2e/help.spec.ts`, `tests/e2e/helpScalesHome.spec.ts`; `src/core/match/help.test.ts` (unit) |
| 8 | Hint patterns and levels | Passed | `tests/e2e/levels.spec.ts`, `tests/e2e/patterns.spec.ts`; `src/core/progress/levels.test.ts` (unit) |
| 20 | Level up | Passed (unit, and e2e for the message) | `src/core/progress/adaptive.test.ts`; `tests/e2e/levels.spec.ts` |
| 21 | Player and kick | Passed (unit) | `src/game/playerPose.test.ts` (size, position clear of the chart, kick step); the look was not checked in a browser here |
| 22 | Net and polish | Partly | The "?" placeholder: `tests/e2e/keeper.spec.ts`. The net bulge, the chart panel, the top bar background and the "Enter" hint were not checked by a test in this run |
| 23 | Helper switch | Passed (unit) | `src/core/match/help.test.ts` |
| 24 | Zum Start | Passed | `tests/e2e/helpScalesHome.spec.ts` |
| 25 | New versions | Passed in Chromium | `tests/e2e/update.spec.ts` (reload on the start screen, reload during a round, "Zurück", "Nochmal" with the round end line); `src/app/swUpdate.test.ts` (unit). Publishing to GitHub Pages and real devices were not tried. |

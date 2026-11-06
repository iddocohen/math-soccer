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

1. **Hole mode goal and miss (US1)**: start, press 1. With target 46 and direct hints, 45, 47, 36, 56 are printed. Type 46, Enter: goal, cheer. Type 56 on the next target's place: the ball hits 56's square, it shows "56" in orange, soft "ohhh", clapping. See [contracts/screens.md](./contracts/screens.md) feedback table.
2. **Out of range (US1)**: type 150 in range 1 to 100, Enter: no shot, "Zahlen von 1 bis 100".
3. **Help steps (US2)**: press H three times: hint, full chart with target and last number marked, answer. Hearts and stars unchanged.
4. **Parent gate (US3)**: tap the gear: nothing. Hold 2 s: parent menu, game paused. Keys never open it.
5. **Custom range (US3)**: set 200 to 500: 31 rows (200 sits in the row 191 to 200), smaller squares, ping-pong ball. Set 205 to 480: the first row shows empty grey squares for 201 to 204.
6. **Range with 0 (US3)**: set 0 to 1000: rows start at 0, ping-pong ball, the game plays without errors.
7. **Progress (US3)**: play 5 targets; the progress page shows them under the right directions.
8. **Line mode (US4)**: only direction "runter": 1 and 11 printed (or another start), next square marked; each correct square lights up with clapping; the fifth square scores a goal.
9. **Diagonal at the edge (US4)**: direction +11: no line wraps from column 10 to column 1.
10. **Goalkeeper (US5)**: correct number goes past the keeper; wrong number flies to its own square and the keeper catches it.
11. **Hearts (US1, FR-027)**: difficulty "challenging", round type hearts: 3 misses on one target cost one heart; one miss costs none.
12. **Locker room (US6)**: earn stars, buy a ball design, choose it; the next round shows it. Stars never drop after a miss.
13. **Offline (FR-046)**: load once, turn the network off, reload, play a round.
14. **Refresh keeps the round**: refresh during a round; the round continues with the same goals and target.
15. **Base path (FR-047)**: `pnpm exec vite build --base=/math-soccer/` and the `base-path` Playwright project pass.
16. **Forbidden words (FR-023)**: the unit test over `src/i18n/de.ts` passes.

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

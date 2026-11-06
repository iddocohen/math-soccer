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
5. **Custom range (US3)**: set 200 to 500: 30 rows, smaller squares, tennis ball. Set 205 to 480: the first row shows empty grey squares for 201 to 204.
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

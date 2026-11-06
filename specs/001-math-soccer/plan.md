# Implementation Plan: Math Soccer

**Branch**: `001-math-soccer` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-math-soccer/spec.md`, source PRD [source-prd.md](./source-prd.md)

## Summary

A static, offline-capable browser game. A Phaser 4 canvas draws a 2D soccer scene from behind the player: stands with drawn fans, a goal with a number chart in rows of 10, a keeper, a player and a ball. The child types a number and the ball flies to that number's square. Three modes (hole, line, goalkeeper) share one chart layout, one target and hint generator, and one match controller. A React overlay shows the entry, help, start screen, round end, parent gate, settings, progress page and locker room. All learning and game logic lives in engine-free TypeScript under `src/core/`, deterministic for a seed and covered by Vitest. Settings, progress, bests and locker room are stored in `localStorage` with Zod. A service worker precaches the build for offline play. The project copies math-tank's setup and reuses its modules where behavior is "as math-tank" (storage, transfer, parent gate, keyboard entry, help steps, adaptive and mastery rules, speech, number pad).

## Technical Context

**Language/Version**: TypeScript 6.0 (`~6.0.3`), strict, ES2022 target

**Primary Dependencies**: Phaser 4.2, React 19.3, Vite 8.3 with `@vitejs/plugin-react`, `vite-plugin-pwa` 2.0, Zod 4.6, `uqr` 0.1.3 (QR transfer)

**Storage**: Browser `localStorage`, keys `mathsoccer.*.v1` (research R11)

**Testing**: Vitest 5.1 (core unit and property tests, React component tests with Testing Library and jsdom); Playwright 1.64 against the production build

**Target Platform**: Current Firefox and Chrome on a computer, Safari on iPad (landscape and portrait); screens from 768 by 600 CSS pixels. Phones are not a target.

**Project Type**: Single-page web application (static files, no backend)

**Performance Goals**: 60 frames per second on a laptop, at least 30 on an iPad from 2020 or later; match scene shown within 3 seconds of "Spielen"; ball flight 0.8 seconds

**Constraints**: Offline after the first load; no network requests after load; no external fonts or CDNs; no assets from existing games; free licenses only; encouraging feedback only; no timer by default

**Scale/Scope**: One player per browser; 8 screens (start, match, round end, parent menu, settings, progress, locker room, transfer dialog); 3 modes; 8 directions; ranges up to 1000 numbers

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so no ratified principles apply. The plan is checked instead against the source PRD's ground rules (section 3) and anti-goals (section 2):

| Gate | Status |
|------|--------|
| No punishing words, sounds or loss after a mistake (FR-023) | Pass: forbidden-word test over `src/i18n/de.ts`; stars only grow |
| Help is always available and costs nothing (FR-024, FR-025) | Pass: help is a controller action in every phase except ball flight |
| Rewards never make the math easier (FR-043) | Pass: locker room data never reaches target generation |
| Shooting only by number (FR-002) | Pass: the scene has no pointer handlers on squares |
| Free licenses only (FR-048) | Pass: all art and sound drawn or synthesized in code |

Re-checked after Phase 1 design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/001-math-soccer/
├── source-prd.md        # approved design, verbatim
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core-api.md      # engine-free modules
│   └── screens.md       # screens, keys, test hooks
├── prototype/index.html # throwaway look-and-feel prototype (research R12)
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
index.html
package.json
vite.config.ts            # React, PWA, Vitest projects (copied from math-tank, names changed)
tsconfig.json
eslint.config.js          # engine-free src/core, no Math.random in core
playwright.config.ts      # chromium, firefox, webkit, ipad-landscape, ipad-portrait, base-path
.github/workflows/pages.yml
public/icons/
src/
├── main.tsx
├── app/                  # React screens and overlay
│   ├── App.tsx
│   ├── StartScreen.tsx
│   ├── MatchOverlay.tsx  # entry readout, help button, hearts, goal counter, messages
│   ├── RoundEnd.tsx
│   ├── ParentGate.tsx    # from math-tank
│   ├── SettingsPage.tsx
│   ├── ProgressPage.tsx
│   ├── LockerRoom.tsx
│   ├── HelpChart.tsx     # help step 2: the full chart
│   ├── NumberPad.tsx     # from math-tank
│   ├── TransferDialog.tsx# from math-tank
│   ├── useController.ts
│   ├── keyboard.ts
│   └── styles.css
├── game/                 # Phaser views over controller state
│   ├── createGame.ts
│   ├── MatchScene.ts
│   ├── StandsView.ts     # fans: idle, clap, cheer, ohh
│   ├── GoalView.ts       # net, posts, chart board, holes, faint grid
│   ├── KeeperView.ts
│   ├── PlayerView.ts
│   ├── BallView.ts
│   └── textures.ts
├── audio/
│   ├── sfx.ts            # kick, cheer, clap, ohh (Web Audio)
│   └── speaker.ts        # from math-tank
├── core/
│   ├── rng.ts            # from math-tank
│   ├── types.ts
│   ├── chart/            # layout, cellRect, ball kind
│   ├── targets/          # hints, directions, hole and keeper targets, lines
│   ├── match/            # MatchController, entry reducer, hearts, scoring
│   ├── progress/         # classify, adaptive, mastery, summarize (adapted from math-tank)
│   ├── rewards/          # stars, locker room items and looks
│   ├── records/          # personal bests
│   ├── settings/         # schema, defaults, validate
│   ├── storage/          # from math-tank, new keys
│   └── transfer/         # from math-tank
└── i18n/
    ├── de.ts
    └── index.ts
tests/e2e/                # Playwright specs
```

**Structure Decision**: Single web project, the same layout as math-tank. `src/core` is the testable heart with no framework imports; `src/game` and `src/app` are views over `MatchController`.

## Key design decisions

1. **One chart mapping** (R3): `layoutChart` and `cellRect` place the board, hints, help chart and ball, so the ball always lands on the typed number's square.
2. **Answer-first targets** (R5): target first, then hints; hints define the trained directions.
3. **Lines step in row and column space** (R6), so diagonals never wrap.
4. **Controller as the single state owner** (R7), as math-tank.
5. **Drawn art and synthesized sound** (R2, R10): license-free, recolorable for the locker room, small offline bundle.
6. **Copy, then adapt math-tank modules** for storage, transfer, parent gate, entry, number pad, speech, adaptive and mastery; the copied files keep a header comment naming their origin.
7. **Mode keys only on the start screen** (R12): digits always type during a round.

## Phasing (maps to spec priorities)

1. **Setup**: tooling, CI workflow, PWA, i18n, Rng, settings schema, storage.
2. **US1 (P1)**: chart layout, hole targets and hints, MatchController, Phaser scene (stands, goal, player, ball), start screen, overlay, round end. Playable.
3. **US2 (P1)**: help steps, help chart, encouraging messages, forbidden-word test.
4. **US3 (P1)**: parent gate, settings page, progress records, adaptive, mastery, progress page, backup and transfer.
5. **US4 (P2)**: lines and line mode.
6. **US5 (P2)**: goalkeeper mode.
7. **US6 (P3)**: stars, locker room, looks.
8. **Polish**: offline, iPad layout and number pad, speech, pause, fullscreen, end-to-end tests, performance check, README with asset list.

## Risks

- **Readability of 20-row charts on an iPad**: mitigated by the large goal rectangle and numbers drawn only when squares are big enough (R4).
- **Safari clearing storage**: mitigated as math-tank (persistent storage request, Home Screen hint, export).
- **Copying math-tank code drags in tank concepts**: copied modules are trimmed to what this spec needs; tests are copied with them.
- **No GitHub repository yet**: the Pages workflow cannot be verified until the parent creates `iddocohen/math-soccer`.

## Complexity Tracking

No gate violations to justify.

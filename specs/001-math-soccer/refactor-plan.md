# Refactor plan: deeper structure (no behavior change)

**Date**: 2026-11-13
**Requested by**: the parent: "Do the deeper refactors". They are the items the `/simplify` and review passes skipped because they were too large for a cleanup.
**Rule**: no change in behavior, look, sound, stored data shape or test hooks (`data-*`). The existing unit and e2e tests must pass unchanged, except tests that reach into internals being replaced.

## R1: controller events and pause reasons

- **Events:** the `MatchController` emits typed events, and App and MatchScene subscribe to them:
  - `roundStarted`
  - `shot`
  - `landed { outcome }`
  - `targetChanged`
  - `starsEarned { n }`
  - `levelUp { level }`
  - `roundEnded`
  - `keeperShotDecided`

  This replaces comparing state snapshots: `seenStars`, `seenMessage`, the `lastPhase` ref, `isNewRound`, the `flying` and `ballInNet` guesses, and similar.
- **Pause reasons:** pausing becomes `pause(reason)` and `resume(reason)`, with a set of reasons: `parent`, `lockerRoom`, `child`, `cupIntro`, `hidden`. This replaces `useAutoPause` bookkeeping and the `introShown` check in App's tick loop. The clock runs only when the set is empty.

Source findings: altitude A3 and A8 (simplify round 2), altitude finding 3 (round 3).

## R2: one shape for per-mode state, and one shared wait

- **Per-mode state:** the nullable per-mode fields (`wall`, `keeperShot`, `shootout`, `torwand`, `family`, `cupMatch`, `challengeMinutes`) become one tagged field: `play: { kind: 'normal' } | { kind: 'time', minutes } | { kind: 'cup', match } | { kind: 'wall', wall } | { kind: 'keeper', shot } | { kind: 'shootout', state } | { kind: 'torwand', holes } | { kind: 'family', state }`. The `mode` field is derived from it.
- **One shared wait:** the separate countdowns (`shootout.waitMs`, `torwand.waitMs`, `family.card`, and `feedbackMs` where it overlaps) become one `wait: { ms, reason } | null`.
- **Read-only view per phase:** `MatchView` becomes a union per phase, so that a ball exists only in flight and phase-specific fields cannot appear in the wrong phase (review finding H4 of the first release).
- **Stored round:** the stored round schema follows the new shape with a version bump. Old rounds are discarded, per the no-migration rule. The baseline marker is unchanged.

Source findings: simplify round 3 "Skipped", type-design findings H4 and Ty items.

## R3: one game kept alive, keeper phases, update rule

- **One game:** a single Phaser game stays alive for the whole session. Leaving a match puts the scene to sleep or restarts it instead of destroying the game, and generated textures are kept. Entering a match restarts the scene with the new round.
- **Keeper phases:** the keeper gets an explicit `returning` phase. Fade and layer are set inside `setPhase`, not by hand at each transition.
- **Update rule:** `swUpdate` gets one `mayApplyNow(context)` rule over a reported context (screen, first input received, round ended, parent screens or family card open) and a typed resume intent, replacing the separate flags.

Source findings: efficiency E4 (round 2), altitude A5 and A7 (round 2).

## Tests

- **All existing tests pass:** unit tests in all projects, and e2e in Chromium, base-path, iPad, Fire and performance.
- **New unit tests** for:
  - the event order of a goal, a miss, a level up and a round end;
  - pause reasons stacking and resuming;
  - the tagged `play` field for each mode;
  - the shared wait;
  - the game staying alive across three rounds (no new WebGL context);
  - the keeper's `returning` phase;
  - `mayApplyNow` for each context.
- **Performance:** the check still passes. Starting the second round is measurably faster (time from "Spielen" to the first target, before and after).

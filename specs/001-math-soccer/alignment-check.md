# Spec/Ask Alignment Check: Math Soccer

## Source

The approved design document `docs/superpowers/specs/2026-11-06-math-soccer-design.md`, stored verbatim as [source-prd.md](./source-prd.md), plus the parent's later feedback in the session (keeper dives toward the ball).

## Verdict

⚠️ MINOR DRIFT (proceeding)

## Findings

| Severity | Category | PRD reference | Spec reference | Description |
|----------|----------|---------------|----------------|-------------|
| Minor | changed | 6.1 "Some squares are cut out as holes" | FR-011 | The spec allows only one open hole (the target); other holes are patched decoration. A critique fix (P5): a shot into a second open hole would look like a goal while counting as a miss. |
| Minor | added | 6.3 | FR-020 | The keeper jumps or dives toward the ball on every shot. Requested by the parent after viewing the prototype. |
| Minor | added | 7 | FR-025a, FR-025b | Help chart marks differ by shape; a shot after help step 3 scores and earns stars and counts for bests by default, with math-tank's "Punkt nach voller Hilfe" setting. Fills a gap the PRD left open. |
| Minor | changed | 7 "After a miss, the next help step is offered" | FR-025 | The next help step appears by itself after a miss, as math-tank does (the PRD says to follow math-tank for help). |
| Minor | added | 8 | FR-027 | Misses per heart set to 5, 4, 3 by difficulty, and the target stays after a lost heart. The PRD left the number to the difficulty setting. |
| Minor | added | 9 | FR-042, data-model | Star amounts and item prices chosen; the PRD left them to the builder. |
| None | — | 2, 3, 4, 5, 6.2, 10, 11, 12 | FR-001 to FR-048 | Goals, non-goals, anti-goals, ground rules, chart layout, ranges, line mode, progress, assets and stack are carried over without loss. |

No PRD requirement, goal or non-goal is missing, and no acceptance criterion is softened.

## Action

Proceed. No remediation pass needed.

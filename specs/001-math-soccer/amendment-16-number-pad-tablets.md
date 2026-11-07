# Amendment 16: number pad on iPad and Fire tablets

**Date**: 2026-11-07
**Requested by**: the parent: "The numbers do not appear for ipad/ amazon fire like in math-tank".

**Changes**: FR-031 (the rule for "Zahlenfeld: Automatisch").

## Cause

The game showed the number pad with "Automatisch" only when the browser reported no fine pointer (`(any-pointer: fine)` did not match). An iPad with a trackpad, keyboard cover or Pencil, and an Amazon Fire tablet in Silk, can report a fine pointer, so the child had no pad to type on. math-tank also checks the screen width (math-tank amendment 12 item 1, amendment 16 items 2 and 4).

## Rule

- **FR-124**: With "Automatisch", the number pad MUST show when the main pointer is not fine (`(pointer: fine)` does not match) OR the screen is narrower than 1100 CSS px (`(max-width: 1099.98px)`), as in math-tank. The game reads both media queries and measures again on their changes, on resize, on orientation change and when the page comes back to the front. "Immer" and "Nie" stay as they are.
- A screen 1100 CSS px or wider with a fine pointer gets no pad with "Automatisch" (for example a Fire HD 10 held sideways, 1280 px, when Silk reports a fine pointer). The parent can choose "Immer" there.

## Code

- `src/core/view/screen.ts`: the rule, without the DOM (from math-tank `src/core/view/screen.ts`).
- `src/app/useScreen.ts`: the hook that reads the media queries (from math-tank `src/app/useScreen.ts`).

## Tests

- Unit: `src/core/view/screen.test.ts` (rule cases from math-tank) and `src/app/useScreen.test.ts` (media query changes, re-measures after events, no matchMedia, cleanup).
- Playwright: `tests/e2e/numberPadTablets.spec.ts` in the projects `ipad-landscape`, `ipad-portrait` and the Fire projects copied from math-tank (Chromium with Silk's user agent, touch, Fire 7, Fire HD 8 and Fire HD 10 held sideways and upright, `tests/e2e/silk.ts`). With "Automatisch" the pad shows and a shot is played by tapping its keys; a second test makes `(pointer: fine)` match and checks the same on screens narrower than 1100 px.

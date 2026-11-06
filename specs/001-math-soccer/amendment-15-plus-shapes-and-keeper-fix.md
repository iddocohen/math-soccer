# Amendment 15: small and big plus, and the keeper never hides numbers

**Date**: 2026-11-06
**Requested by**: the parent, after playing the local site:
- "This is I think a bug … where the keeper is blocking the numbers". The screenshot is saved as `keeper-blocks-bug.png` in the session scratchpad: the waiting keeper, fully opaque, covers the hint 85 and the target outline.
- "we should have this plus shown in the image but also smaller plus where the numbers only 1 away". The image shows hints two squares away (67 above, 85 left, 89 right) around the target 87.

**Changes**: FR-064 (amendment 04, the waiting keeper keeps numbers clear), the Nachbarn pattern (amendment 05) and the levels (amendment 09).

## Keeper never hides numbers

- **FR-120**: While the keeper waits, the hint squares, their numbers, the target outline and the waiting shape squares MUST be drawn above the keeper. Whatever the keeper's position, they stay readable. During the dive and the catch, the keeper is drawn above them as before.
- **FR-121**: The root cause of the screenshot MUST be found and fixed: the keeper did not move aside and was not drawn at 50% opacity. The shuffle of FR-064 MUST run for every new target, including after a goal, after a lost heart, after a restore and after new settings, and the 50% opacity MUST apply when no free spot exists. A regression test reproduces the screenshot's case: target 87 with hints 67, 85 and 89 on 1 to 100.

## Plus shapes

- **FR-122**: Two plus patterns, each placed only where all four arms fit on the chart:
  - **Small plus** ("kleines Plus"): the four neighbors one square away, above, below, left and right of the target. Level 1 (Gerade Linien).
  - **Big plus** ("großes Plus"): the four squares two away in the same directions. Level 2, with the diagonal lines. Design call: jumping two rows and two columns at once is harder than the straight lines of level 1.
- **FR-123**: The old Nachbarn variants with fewer than four arms (because an arm fell off the chart) MUST no longer be used. A target near the edge gets another pattern instead.
- A plus target trains across (left and right arms) and down and up (top and bottom arms). Like other targets, it counts toward those directions.

## Tests

- Unit:
  - small and big plus always have four arms on the chart;
  - a target in the top row or in column 1 never gets a plus;
  - the small plus appears in level 1 and the big plus in level 2;
  - the waiting keeper spot clears the target and hints, including after a goal, a lost heart, a restore and new settings;
  - when no spot is free, the opacity is 50%;
  - the regression case 87 with hints 67, 85 and 89 (now with 107 off the chart, so no big plus there; the test asserts it picks a target where all arms fit).
- e2e (Chromium): with the keeper in the middle, the hint numbers are readable. A check reads the canvas pixel colour at each hint's centre and expects the hint colour, not the keeper's shirt.

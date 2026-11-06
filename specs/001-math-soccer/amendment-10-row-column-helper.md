# Amendment 10: row and column helper beside the goal

**Date**: 2026-11-06
**Requested by**: the parent: "I would like to have as an assistant on the right hand side the numbers vertically 1, 10, 20, etc representing what significant number is on the row, and columns 1, 2, 3, etc. for the insignificant numbers accordingly. When then he hits wrong again the arrows from the right should show him in which row he basically is and/or highlight the row accordingly, and if misses again then the column too." Answer: rows are labelled by their tens, 0, 10, 20 … 90.
**Changes**: help steps of FR-024 and FR-025, the scene layout.

## The helper

- **FR-091**: A row scale MUST stand on the right side of the goal, outside the right post. It has one label per chart row: the row's tens, written 0, 10, 20 … 90 for the hundred chart and continuing for larger ranges, for example 190 for the row 191 to 200. Each label sits at the height of its row.
- **FR-092**: A column scale MUST stand above the crossbar. It has one label per column, 1 to 10, each above its column.
- **FR-093**: The helper MUST be shown in a calm style (chalk text, no boxes). It never shows the answer by itself. Amendment 14 (FR-115) replaces "shown at all times by default": the row scale shows from help step 1, the column scale from step 2, and both go when the target is solved or replaced. The parent switch ("Zeilen- und Spaltenhilfe") decides whether a shown scale has all its labels or only the lit one.
- On charts with too many rows for readable labels (over 20 rows), only every fifth row label is shown, and the highlighted one always shows.
- Design call on the edge case: the tens label of a row and its last number differ (row "0" ends with 10, row "10" ends with 20). Help text never claims that the label is the row's first number.

## Help steps (replace FR-024)

The next step comes by itself after each miss on the same target, or with H, as before. Help still never costs hearts, stars or progress.

1. **Row**:
   - An arrow comes in from the right row scale.
   - The target's row lights up as a soft band across the goal, and its tens label lights up.
   - The hint line says, for example, "Die Zahl ist in der Reihe 40".
   - The hint arrow and text from before stay.
2. **Column**:
   - An arrow comes down from the column scale.
   - The target's column lights up as a soft band, and its label lights up.
   - Where the row band and the column band cross, the target square stands out.
   - The hint line says, for example, "… und in der Spalte 6".
3. **Whole chart**: the full chart opens, as the old step 2 did (FR-025a).
4. **Answer**: the answer shows on the target square, as the old step 3 did.

- **FR-094**: The help steps MUST follow the order above. A shot after step 4 counts as FR-025b says, which used to be step 3.
- **FR-095**: When the helper is turned off, steps 1 and 2 MUST still show the row and column bands and arrows, and only their labels appear.
- With the hearts limit at "challenging" (3 misses), a lost heart moves help straight to step 4, as FR-027 says.

## Tests

- Unit: row labels are tens of each row for 1 to 100, 0 to 1000 and 205 to 480; step order is row, column, chart, answer; the bands match the target's row and column; the shot after step 4 is recorded as unsolved.
- e2e (Chromium): a miss lights the target's row and its label (`data-help-row`); a second miss lights the column (`data-help-col`); help.spec.ts updated for four steps.

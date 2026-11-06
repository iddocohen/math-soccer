# Feature Specification: Math Soccer, a browser game for learning the hundred chart

**Feature Branch**: `001-math-soccer`

**Created**: 2026-11-06

**Status**: Draft, changed by [amendment 01](./amendment-01-from-math-tank-23-25.md) [amendment 02](./amendment-02-visible-goal.md) [amendment 03](./amendment-03-free-assets.md), [amendment 04](./amendment-04-keeper-scale.md), [amendment 05](./amendment-05-keeper-main-game.md), [amendment 06](./amendment-06-tetris-shapes.md) [amendment 07](./amendment-07-time-challenge.md), [amendment 08](./amendment-08-player-scale.md), [amendment 09](./amendment-09-difficulty-levels.md), [amendment 10](./amendment-10-row-column-helper.md) [amendment 11](./amendment-11-net-and-polish.md), [amendment 12](./amendment-12-reliable-updates.md) [amendment 13](./amendment-13-cup-journey.md) and [amendment 14](./amendment-14-help-scales-and-home.md)

**Input**: User description: "Build the browser game described in docs/superpowers/specs/2026-11-06-math-soccer-design.md. Copy that document verbatim into the feature directory as source-prd.md and treat it as the full requirements. Follow math-tank (~/dev/private/math-tank) wherever the document says "as math-tank"." The design document is stored verbatim in [source-prd.md](./source-prd.md).

## Overview

> **Changed by amendment 05**: the goalkeeper game is now the only game. Hole mode and line mode below are replaced by hint patterns (Nachbarn, Mitte, Reihe, Formen) in the goalkeeper game. Amendment 07 adds a time challenge.


A child (about 6 to 9 years old, with low frustration tolerance) plays a 2D soccer game in the browser. The view is from behind the player, facing the goal. The goal shows a number chart with rows of 10 numbers, by default the hundred chart 1 to 100 (Hundertertafel). The child shoots by typing a number and pressing Enter. The ball always flies to the square of the typed number, so even a wrong number shows the child where that number sits on the chart.

The child already handles moving along a row (+1, −1). The game trains the moves the child struggles with: down and up a column (+10, −10) and the diagonals (+11, +9, −11, −9). Three modes do this: hole mode ("Löcher"), line mode ("Reihen") and goalkeeper mode ("Torwart").

Fans in the stands behind the goal cheer on a goal, clap on a correct square and make a soft "ohhh" on a miss, followed by encouraging clapping. The game never punishes a mistake. A parent sets range, modes, hints and difficulty behind a gate that a child does not open by accident, and views the child's progress. The ground rules, parent gate, storage, backup, help steps, adaptive difficulty, personal bests and the reward shop follow the sibling game math-tank (Mathe-Panzer), whose specification is at `~/dev/private/math-tank/specs/001-math-tanks/spec.md`. Where this spec says "as math-tank", the behavior of that specification applies, adapted from tanks to soccer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Score goals in hole mode on the hundred chart (Priority: P1)

The child presses "Spielen" and picks hole mode. A board printed like the hundred chart covers the goal, with one square cut out as a hole: the current target. Neighbor numbers around the hole help the child work out its number. The child types the number (for example 46) and presses Enter. The player kicks, and the ball flies to the square of that number. If the number is the hole's number, the ball flies through the hole into the net: goal, and the fans cheer. If not, the ball hits the board on the square of the typed number, that square shows its number for a moment, the crowd makes a soft "ohhh" and claps, and the child tries again. The round ends as math-tank (section on rounds below), and the end screen shows goals and time.

**Why this priority**: This is the smallest playable game that teaches the chart's structure: a number, its position, and its neighbors above, below and beside it. It alone is a viable first version.

**Independent Test**: With default settings (range 1 to 100, hole mode on, hints always shown), play a full round with the keyboard only and confirm that every shot lands on the square of the typed number, that the correct number scores a goal, that a wrong number shows its square and gives the "ohhh" and clapping, and that the end screen and "Nochmal" work.

**Acceptance Scenarios**:

1. **Given** the start screen, **When** the child presses Enter or taps "Spielen" and picks hole mode, **Then** the goal appears covered by a 10 by 10 chart board (1 top left, 10 top right, 100 bottom right) with at least one hole marked as the target, within 3 seconds.
2. **Given** the target hole is 46 and hints are set to "always shown, direct neighbors", **When** the board is shown, **Then** 45, 47, 36 and 56 are printed on the board around the hole, and no other numbers near the hole are printed.
3. **Given** the target hole is 46, **When** the child types 46 and presses Enter, **Then** the ball flies along a visible path through the hole into the net, the fans stand up and cheer, and the goal counter goes up by one.
4. **Given** the target hole is 46, **When** the child types 56 and presses Enter, **Then** the ball hits the board on the square of 56, that square shows "56" for a moment, the crowd makes a soft "ohhh" followed by clapping, and the target stays 46.
5. **Given** the child typed a number outside the configured range, **When** the child presses Enter, **Then** the game does not shoot and shows a short hint with the range (as math-tank's range hint).
6. **Given** a goal was scored, **When** the celebration ends, **Then** a new target hole is chosen and the child shoots next.
7. **Given** a round has ended, **When** the child presses Enter or taps "Nochmal", **Then** a new round starts without a page reload.

---

### User Story 2 - Get help in steps, ending in the full chart (Priority: P1)

When the child is stuck, help gets more explicit step by step, as math-tank: first a hint, then the full chart with the target square and the child's last number marked, then the answer. Help never costs a heart, a star or progress. It appears by itself after a miss and is also available at any time with H or the help button.

**Why this priority**: The parent observed that seeing the whole chart is what helps the child most. Without help in steps, a child with low frustration tolerance stops playing.

**Independent Test**: In any mode, miss the same target several times and press H, and confirm that step 1 shows a hint, step 2 opens the full chart with the target and the last number marked, step 3 shows the answer, and that no heart or star is lost.

**Acceptance Scenarios**:

1. **Given** a target, **When** the child presses H once, **Then** help step 1 shows a hint: the neighbor numbers of the target appear (if they were hidden), or an arrow and a short text show the direction from a known number (for example "eine Reihe runter: +10").
2. **Given** help step 1 is showing, **When** the child presses H again or misses again, **Then** help step 2 opens the full chart for the configured range with the target square and the child's last typed number marked in different colors.
3. **Given** help step 2 is showing, **When** the child asks for help again or misses again, **Then** help step 3 shows the answer on the target square, and the child shoots it by typing it.
4. **Given** the child used help, **When** the target is solved, **Then** no heart, star or progress was taken away, and the attempt is recorded as solved with help.

---

### User Story 3 - Set up the game and view progress as a parent (Priority: P1)

The parent opens settings by holding the gear icon for 2 seconds, as math-tank. The parent sets the number range, which modes the start screen offers, hint display and hint distance, line directions and line length, round type, difficulty, adaptive difficulty, sound options and the locker room. The parent views per-direction progress and backs up data by file or QR code, as math-tank.

**Why this priority**: The game must be tuned to one child's level, and the parent needs to see whether the down and diagonal moves are improving.

**Independent Test**: Hold the gear for 2 seconds, change the range to 200 to 300 and hint distance to "only above and below", start hole mode, and confirm the board shows 200 to 300 in rows of 10 and only the numbers above and below the hole. Open the progress page and confirm per-direction counts.

**Acceptance Scenarios**:

1. **Given** any screen, **When** the parent taps the gear briefly or presses any key, **Then** settings do not open. **When** the parent holds the gear for 2 seconds, **Then** settings open and the game pauses.
2. **Given** settings are open, **When** the parent sets a custom range of 200 to 500, **Then** the next round shows a chart of 31 rows of 10 numbers (191 to 200 through 491 to 500) on the goal, with smaller squares and a smaller ball.
3. **Given** the parent changed settings, **When** the browser is closed and opened again, **Then** the settings are kept.
4. **Given** the progress page, **When** the parent opens it, **Then** it shows, per direction (+1, −1, +10, −10, +11, −11, +9, −9) and per mode, how many targets were solved alone and how many with help, and which directions count as mastered.
5. **Given** the settings page, **When** the parent uses "Daten sichern" or the QR transfer, **Then** settings, progress, bests and locker room data move to a file or another browser, as math-tank.

---

### User Story 4 - Complete lines in line mode (Priority: P2)

The child picks line mode. The board is mostly blank. The first one or two numbers of a line are printed, for example 1 and 11 going down. The next empty square in the line is the target. The child types 21 and shoots; the ball hits that square, "21" lights up, and the fans clap. The next square becomes the target. When the child finishes the line, a goal is scored and the fans cheer.

**Why this priority**: Line mode trains one direction at a time, which suits the moves the child struggles with (down and diagonal). It builds on the board, ball and help from stories 1 and 2.

**Independent Test**: Turn on only line mode with only the direction "down", start a round, and confirm that a line starts with one or two printed numbers, that each correct square lights up with clapping, and that finishing the line (5 squares by default) scores a goal.

**Acceptance Scenarios**:

1. **Given** line mode with direction "down" and the line starting at 1, **When** the round starts, **Then** 1 and 11 are printed, and the square below 11 is marked as the target.
2. **Given** the target is 21, **When** the child types 21 and shoots, **Then** the ball lands on 21, the square shows "21", fans clap, a star is earned, and the square below becomes the target.
3. **Given** the last square of the line is the target, **When** the child shoots its number, **Then** a goal is scored, the fans cheer, and a new line starts.
4. **Given** the target is 21, **When** the child types 12, **Then** the ball lands on the square of 12, it shows "12" for a moment, the crowd makes the soft "ohhh" and claps, and the target stays 21.
5. **Given** a line would run past the edge of the chart, **When** the line is created, **Then** it is shortened or placed so that every square of the line lies on the chart.

---

### User Story 5 - Beat the goalkeeper (Priority: P2)

The child picks goalkeeper mode. The goal is open, a goalkeeper stands in it, and the chart grid is drawn faintly over the open goal. Hint numbers light up in the grid, for example 41 and 43, with an empty target square between them. The child types 42 and shoots: the ball flies to that square, out of the keeper's reach, and the fans cheer. With a wrong number, the ball flies to the square of that number and the keeper catches it; the crowd makes the soft "ohhh" and claps.

**Why this priority**: It adds variety and the feel of a penalty shot, using the same hints and board logic as hole mode.

**Independent Test**: Turn on only goalkeeper mode, play a round, and confirm that hints light up around an empty target square, that the correct number scores past the keeper, and that a wrong number flies to its own square where the keeper catches it.

**Acceptance Scenarios**:

1. **Given** goalkeeper mode, **When** a target appears, **Then** the hint numbers chosen by the hint settings light up in the faint grid, and the target square is empty and marked.
2. **Given** the target is 42, **When** the child shoots 42, **Then** the ball reaches the square of 42, the keeper dives toward it and misses, a goal is scored and the fans cheer.
3. **Given** the target is 42, **When** the child shoots 52, **Then** the ball flies to the square of 52, the keeper jumps there and catches it, the square shows "52" for a moment, and the crowd makes the soft "ohhh" followed by clapping.

---

### User Story 6 - Earn stars and dress up in the locker room (Priority: P3)

The child earns stars for correct shots and goals. In the locker room ("Kabine") the child spends stars on looks: ball designs, shirt color, own shirt number and name, and the fans' scarf color. Looks never change the math.

**Why this priority**: Rewards keep the child coming back, but the game is playable and useful without them.

**Independent Test**: Earn stars in a round, open the locker room, buy a ball design and a shirt color, and confirm the new looks appear in the next round and that stars never go down after a mistake.

**Acceptance Scenarios**:

1. **Given** the child scored a goal, **When** the round ends, **Then** the star total shows the stars earned and never goes down for a miss.
2. **Given** the child has enough stars, **When** the child buys a ball design in the locker room and chooses it, **Then** the ball has that design in the next round.
3. **Given** the locker room, **When** the child enters a shirt number and name, **Then** the player's shirt shows them in play.
4. **Given** the parent turned the locker room off, **When** the child plays, **Then** the locker room and star total are hidden, as math-tank's garage setting.

---

### Edge Cases

- **Range that includes 0**: rows run 0 to 9, 10 to 19 and so on. Otherwise rows run 1 to 10, 11 to 20, as on the classroom chart.
- **Range that does not start at the beginning of a row** (for example 205 to 480): every row holds 10 numbers, and each number keeps the column it has on the full chart. Squares outside the range in the first and last row are drawn empty and greyed out, and are never targets.
- **Range above 200 numbers** (up to 0 to 1000): the preset exists and can be chosen. In this version it is not required to be comfortable to play; the game must still draw and play it without errors.
- **Very small range** (fewer than 2 rows): directions that need a second row (±10, ±11, ±9) are not offered as targets; the game falls back to across.
- **Hint numbers outside the range or the chart edge**: they are not shown; the game picks targets so that at least one hint remains visible when hints are set to "always shown".
- **Hints "on request" and the child never asks**: help step 1 still appears by itself after a miss.
- **Leading zeros, empty input, more digits than the largest number**: the game ignores extra digits and does not shoot on empty input.
- **Several misses in a row on one target with round type "until hearts"**: after the number of misses set by the difficulty, one heart (ball) is lost; in line mode the target square then fills in and the line continues.
- **Browser refresh during a round**: the round continues as math-tank (refresh keeps the round).
- **Stored data damaged or from an older version**: settings, progress and locker room data are migrated or reset with a short message, as math-tank.
- **Sound blocked by the browser until the first interaction**: the game starts sound after the first key press or tap.

## Requirements *(mandatory)*

### Functional Requirements

**Scene and shooting**

- **FR-001**: The game MUST show a 2D scene viewed from behind the player who faces the goal: the player and the ball at the bottom, the goal in the middle, and stands with fans behind the goal in the distance.
- **FR-002**: The child MUST shoot only by entering a number and confirming it (Enter, or the fire button of the on-screen number pad). Squares on the goal MUST NOT be tappable or clickable to shoot.
- **FR-003**: Every shot MUST fly on a visible path to the square of the typed number on the goal chart, in every mode, whether the number is correct or not.
- **FR-004**: When a shot lands on a square that is not the target, that square MUST show its number for at least 1.5 seconds.
- **FR-005**: A number outside the configured range MUST NOT be shot; the game MUST show a short hint with the range instead.

**The chart**

- **FR-006**: The goal chart MUST hold the configured range in rows of exactly 10 numbers. The default range is 1 to 100 in 10 rows, with 1 top left, 10 top right and 100 bottom right.
- **FR-007**: A range that includes 0 MUST use rows that start at a multiple of 10 (0 to 9, 10 to 19 …). Any other range MUST use rows that start at a multiple of 10 plus 1 (1 to 10, 11 to 20 …). Each number MUST keep the column it has on the full chart; squares outside the range in a partial first or last row MUST be drawn empty and MUST never be targets.
- **FR-008**: The squares MUST shrink to fit the goal as the number of rows grows, and the ball MUST shrink to match: a soccer ball for up to 10 rows, a smaller ball for larger charts, down to a ping-pong ball for the largest charts.
- **FR-009**: Ranges up to 200 numbers (20 rows) MUST be fully playable on the target devices. The preset 0 to 1000 MUST be selectable and MUST draw and play without errors; comfortable play at that size is not required in this version.
- **FR-010**: The design of the chart and settings MUST NOT rule out a later chart where each square counts in steps of 10 or 100 on the same 10 by 10 layout.

**Hole mode ("Löcher")**

- **FR-011**: In hole mode, a board printed like the chart MUST cover the goal, with exactly one open hole at a time: the target square, marked. Other squares MAY show patched holes (covered with a net patch) as decoration; a shot at a patched hole hits the patch like any printed square (critique P5).
- **FR-012**: A correct number MUST send the ball through the target hole into the net and score a goal. A wrong number MUST send the ball onto the board at the square of that number.
- **FR-013**: The parent MUST choose the hint display: "immer" (neighbor numbers always printed around the hole) or "auf Wunsch" (the board is mostly blank and hint numbers appear with help step 1).
- **FR-014**: The parent MUST choose the hint distance, at least: direct neighbors across and above and below; only above and below; diagonal neighbors; numbers two or three squares away.

**Line mode ("Reihen")**

- **FR-015**: In line mode, the board MUST be mostly blank, with the first one or two numbers of a line printed and the next empty square of the line marked as the target.
- **FR-016**: A correct number MUST light up its square, play clapping, earn a star, and make the next square of the line the target. Finishing the line MUST score a goal and play cheering.
- **FR-017**: The parent MUST turn line directions on or off: across (+1), down (+10), diagonal down-right (+11), diagonal down-left (+9), and each backwards direction (−1, −10, −11, −9). The default MUST be down, both diagonals and across on; backwards directions off.
- **FR-018**: A line MUST be 5 squares long by default, adjustable by the parent from 3 to 10, and MUST lie fully on the chart.

**Goalkeeper mode ("Torwart")**

- **FR-019**: In goalkeeper mode, the goal MUST be open with a goalkeeper in it and the chart grid drawn faintly over the goal. Hint numbers MUST light up around an empty, marked target square, using the same hint distance settings as hole mode.
- **FR-020**: On every shot the goalkeeper MUST jump or dive toward the ball. A correct number MUST send the ball to the target square; the keeper dives toward it but does not reach it, and a goal is scored. A wrong number MUST send the ball to the square of that number; the keeper jumps there and catches it (parent feedback on the prototype).

**Crowd and sound**

- **FR-021**: On a goal, fans MUST stand up, jump, wave scarves and cheer. On a correct square in line mode that is not a goal, fans MUST clap.
- **FR-022**: On a miss, the crowd MUST make a soft "ohhh" followed by short encouraging clapping. The parent MUST be able to turn the "ohhh" off; the clapping then plays alone.
- **FR-023**: The game MUST NOT use the words "falsch" or "verloren", sad sounds, or any loss of stars or progress after a mistake.

**Help**

- **FR-024**: Help MUST come in three steps, as math-tank: (1) a hint (neighbor numbers appear, or a direction arrow with a short text such as "+10"); (2) the full chart of the configured range opens with the target square and the child's last typed number marked; (3) the answer is shown on the target square and the child shoots it.
- **FR-025**: The next help step MUST appear by itself after each miss on the same target, and MUST also appear with H or the help button at any time. Help MUST NOT cost hearts, stars or progress.
- **FR-025a**: In help step 2 the target square MUST be marked with a thick outline and the last typed number with a filled warm square and a ball icon, so they differ by shape as well as color (critique P6).
- **FR-025b**: A shot at the answer shown in help step 3 MUST score as usual (goal or correct square, celebration, stars), and the attempt MUST be recorded as unsolved for progress. By default it counts for the goal counter and personal best; a parent setting "Punkt nach voller Hilfe" turns that off, as math-tank (critique P2).

**Rounds, hearts and bests**

- **FR-026**: The parent MUST choose the round type, as math-tank: "until hearts are gone" or "fixed number of goals" (1 to 20). In line mode one goal is one finished line.
- **FR-027**: With "until hearts are gone", the child MUST have 3 hearts, shown as 3 balls. A single miss MUST NOT cost a heart. A heart MUST be lost only after a number of misses in a row on the same target that depends on the difficulty: easy 5, normal 4, challenging 3. A lost heart MUST NOT remove the target: the answer is shown (help step 3) and the child shoots it before a new target follows (critique P7). In line mode the target is one square, and the line continues after it.
- **FR-028**: The end screen MUST show the goals scored, the time played, an encouraging line, and the personal best for the same range, mode and round type. "Nochmal" or Enter MUST start a new round without a page reload.
- **FR-029**: The round MUST measure time played, paused while the game or parent menu is paused or the tab is hidden, as math-tank. A clock during play MUST be off by default and available as a parent setting.

**Start screen and input**

- **FR-030**: The start screen MUST offer the modes the parent turned on; keys 1, 2 and 3 MUST start hole, line and goalkeeper mode when they are on. Enter and Space MUST start, continue and confirm, H MUST show help, Escape MUST pause and resume, Backspace MUST remove a digit.
- **FR-031**: An on-screen number pad MUST be available, with the parent setting automatic (shown on touch devices), always or never, as math-tank.
- **FR-032**: All child-facing text MUST be German, short (about 8 words or fewer per message), and mainly numbers and icons. Tasks MUST be readable aloud with the browser's speech when the parent turns "Vorlesen" on (off by default), as math-tank.
- **FR-033**: The game MUST support pause and resume, and fullscreen.

**Parent settings, progress and storage**

- **FR-034**: Settings and the progress page MUST open only after holding the gear icon for 2 seconds; a short tap or any key MUST NOT open them, and opening them MUST pause the game, as math-tank.
- **FR-035**: The settings MUST cover at least: range (presets 1 to 100, 0 to 1000, and custom minimum and maximum); which modes are offered; hint display and hint distance; line directions and line length; round type and goals per round; difficulty; adaptive difficulty; the crowd "ohhh"; sound effects, crowd sound and "Vorlesen"; number pad; clock; personal bests; locker room.
- **FR-036a**: *Replaced by amendment 01 (FR-052): saved settings apply to the running round when the settings page closes.* A stored round whose range no longer matches the settings MUST be discarded on load (critique E2).
- **FR-036**: Settings, progress records, personal bests and locker room data MUST be stored in the browser with a version number, kept across sessions, and migrated or reset on load when old or damaged, as math-tank.
- **FR-037**: The game MUST record every target attempt with: mode, range, target number, the directions it trains, hint settings, whether it was solved, whether help was used and up to which step, the number of misses before the solve, and response time.
- **FR-038**: A target MUST count toward each direction its hints point from (for example, the hint 36 above target 46 counts as +10; the hint 45 counts as +1). A line-mode target counts toward the line's direction. A target with no visible hints counts toward every direction offered by its hint distance setting.
- **FR-039**: The progress page MUST show, per direction and per mode, targets solved alone and with help, and which directions are mastered. A direction MUST count as mastered with the same rule as math-tank's mastery (at least 10 independent, non-guess attempts and at least 8 of the last 10 independent and correct). Guesses MUST be detected as math-tank does.
- **FR-040**: Adaptive difficulty MUST be on by default and MUST change difficulty one step at a time as math-tank (up after 3 independent correct targets in a row in a direction, down when 2 of the last 3 needed help), never beyond the parent's settings. The difficulty steps from easiest to hardest MUST be: hints always shown with direct neighbors; only above-and-below or diagonal hints; hints two or three squares away; hints on request only. Adaptive difficulty MUST also favor directions that are not yet mastered.
- **FR-041**: Data backup MUST work as math-tank: download and load a file ("Daten sichern", "Daten laden"), and move to another browser by QR code or link.

**Rewards**

- **FR-042**: The child MUST earn stars for correct shots and goals: in line mode one star per correct square plus a bonus for a finished line; in hole and goalkeeper mode stars per goal. Stars MUST never be taken away.
- **FR-043**: A locker room ("Kabine") MUST let the child spend stars on looks: ball designs (colors, patterns, special balls), shirt color, own shirt number and name, and the fans' scarf color. Looks MUST NOT affect the math or the difficulty.
- **FR-044**: The parent MUST be able to turn the locker room and star total off.

**Amendment 01** (see [amendment-01-from-math-tank-23-25.md](./amendment-01-from-math-tank-23-25.md) for full behavior)

- **FR-049**: The locker room MUST open from the match with one tap on an icon next to the gear; the round pauses and continues on "Zurück"; new looks show at once.
- **FR-050**: The settings page MUST offer "Kopie wiederherstellen" for readable kept copies, all or none.
- **FR-051**: The progress page MUST offer "Alles zurücksetzen" (progress, bests, stars, locker room; settings stay), after a question that reminds the parent to save first.
- **FR-052**: Saved settings MUST apply to a running round when the settings page closes: a new target for target-shaping settings, round length unchanged, display-only settings at once.

**Amendment 02** (see [amendment-02-visible-goal.md](./amendment-02-visible-goal.md))

- **FR-053** to **FR-056**: a visible goal (thick posts, crossbar, side nets, net mesh); the board is a panel inside the goal mouth with net showing around it; the keeper grid uses the same area; the player never covers a square.

**Amendment 03** (see [amendment-03-free-assets.md](./amendment-03-free-assets.md))

- **FR-057** to **FR-061**: CC0 grass texture, a spinning CC0 ball sprite for the classic ball, recorded CC0 crowd and kick sounds with the synthesized ones as fallback, the Fredoka font (OFL) bundled, and every asset listed with author, license and source in the README.

**Devices, offline and publishing**

- **FR-045**: The game MUST run in current Firefox and Chrome on a computer and in Safari on iPad. Phones are not a target.
- **FR-046**: After the first load, the game MUST work offline and MUST be installable to the home screen.
- **FR-047**: The game MUST be published to `https://iddocohen.github.io/math-soccer/` on every push to `main`, as math-tank.
- **FR-048**: Every art and sound asset MUST have a free license (CC0 preferred) and MUST be listed with its license and source in the README. Paid assets MUST NOT be used without the parent's approval.

### Key Entities

- **Settings**: the parent's choices (FR-035), versioned and stored in the browser.
- **Chart layout**: the range, the row start (0 or 1 based), the number of rows, and for each number its row and column.
- **Target**: one square to solve, with its number, mode, visible hint numbers, and the directions it trains.
- **Line**: start number, direction, length, and which squares are solved (line mode).
- **Round**: mode, round type, goals, hearts, time, misses in a row on the current target, current help step.
- **Attempt record**: one entry per target for progress (FR-037).
- **Direction progress**: per direction and mode, counts, current difficulty step and mastery.
- **Personal best**: most goals in one round and time, per range, mode and round type.
- **Locker room**: star balance, owned items, chosen ball, shirt color, shirt number and name, scarf color.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The child chooses to play another round in at least half of the sessions, as the parent observes (the main goal, as math-tank).
- **SC-002**: After two weeks of play, the share of down and diagonal targets the child solves without help rises, as shown on the progress page.
- **SC-003**: A round can be started from the start screen and the first shot taken within 10 seconds, using the keyboard only.
- **SC-004**: Every shot lands on the square of the typed number in 100% of shots, in all three modes.
- **SC-005**: Animations run smoothly (no visible stutter) on an iPad and a typical laptop in Firefox and Chrome at the default range.
- **SC-006**: The game starts and plays a full round with the network turned off after the first load.
- **SC-007**: No child-facing screen uses a punishing word or sound, checked against FR-023 on every screen.

## Assumptions

- The child is the same child who plays math-tank; the parent confirmed that math-tank's ground rules apply.
- The game's German title is "Mathe-Kicker" unless the parent chooses another; it is a design choice left to the builder in the source PRD.
- The builder uses the same technology and project setup as math-tank, as the source PRD decides; this spec does not restate it.
- The numbers of misses before a heart is lost (easy 5, normal 4, challenging 3), the line length range (3 to 10) and the star amounts are reasonable defaults chosen in this spec; the parent did not set them.
- Comfortable play for ranges above 200 numbers, and charts with steps of 10 or 100, are out of scope for this version.
- No account, server or internet connection is needed after the first load.
- The GitHub repository `iddocohen/math-soccer` does not exist yet; creating it is the parent's decision and is needed before FR-047 can be verified.

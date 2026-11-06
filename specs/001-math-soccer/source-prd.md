# Math Soccer: a browser game for learning the hundred chart

Date: 2026-11-06
Status: approved by the parent on 2026-11-06. This document is the source PRD for spec-kit, the same way `source-prd.md` fed the math-tank spec.

## 1. Why this game exists

The child plays [math-tank](https://iddocohen.github.io/math-tank/) (Mathe-Panzer) and has low frustration tolerance. He now struggles with the hundred chart (Hundertertafel): 10 rows of 10 numbers, 1 to 100.

What the parent observed:

- Moving along a row (+1, −1) is easy for him.
- Moving down a column (+10) or diagonally (+11, +9) is where he gets lost. He does not yet see that the number below 46 is 56.
- What helps him most is seeing the whole chart.

The game puts the chart inside a soccer game. Every shot is a number. The ball always lands on the square of the number he typed, so a wrong number still shows him where that number sits on the chart.

The long-term goal is that he learns all scales (larger ranges, other step sizes). The first version must work well for 0 to 100, and other ranges must not get in its way.

## 2. Goals, non-goals and anti-goals

Goals:

- He understands the chart's structure: across is ±1, down and up is ±10, diagonals are ±11 and ±9.
- He wants to play another round. That counts more than the number of correct answers, the same as in math-tank.
- The parent controls range, modes, hints and difficulty, and views his progress.

Non-goals for the first version:

- A 3D game. The view is 2D.
- A 1000 chart that counts in steps of 10. It can come later (section 5.3).
- Multiplayer, accounts or a server.

Anti-goals (the game fails even if it works technically):

- Any punishing word, sound or loss of progress after a mistake. No "falsch", no "verloren".
- Help that is hard to reach or makes him wait.
- Rewards that make the math easier. Rewards are only looks.

## 3. Ground rules carried over from math-tank

The parent confirmed these. The builder should read the [math-tank spec](https://github.com/iddocohen/math-tank/blob/main/specs/001-math-tanks/spec.md) and copy its behavior where this document says "as math-tank".

- German interface. Optional spoken tasks.
- Target devices: Firefox and Chrome on a computer, and Safari on iPad. Phones are not a requirement.
- Input: number keys plus Enter, Backspace to fix a digit. On iPad an on-screen number pad, set to automatic, always or never. Mouse and touch work for buttons, menus and the number pad.
- He always shoots by entering a number. Squares on the goal cannot be tapped or clicked to shoot, because that would let him aim at a hole without working out its number (design call after the builder check; the parent did not object).
- Help in steps, each step without penalty: first a hint, then the full chart, then the answer (section 7).
- Adaptive difficulty, on by default, never beyond the parent's limits.
- A progress page for the parent ("Fortschritt").
- Parent settings behind the gear icon, opened by holding it for 2 seconds. A short click does nothing, and no key opens it.
- Data stays in the browser. Backup by file download and by QR code or link, as math-tank.
- Works offline after the first load (installable web app).
- No timer by default. An optional clock and personal bests, compared only with his own results.

## 4. The scene

- 2D, viewed from behind the player who faces the goal. The player and the ball are at the bottom of the screen, the goal fills the middle.
- Stands with fans behind the goal, in the distance.
- On a goal, fans stand up, jump, wave scarves and cheer.
- On a correct square that is not yet a goal (line mode), fans clap.
- On a miss, the crowd makes a soft "ohhh", then claps quickly to encourage him. The parent can turn the "ohhh" off.
- The ball flies on a visible path to the square of the typed number.

## 5. The chart on the goal

### 5.1 Layout

- The goal shows the configured range as a chart with rows of 10 numbers. Rows always hold 10 numbers, because that pattern is what he needs to learn.
- Default range: 1 to 100, 10 rows. The board matches the chart in the classroom: 1 top left, 10 top right, 100 bottom right.
- Other ranges use more or fewer rows. The squares shrink to fit the goal, and the ball shrinks to match: a soccer ball for the 100 chart, a smaller ball (for example a tennis ball) for a few hundred numbers, a ping-pong ball for very large ranges.

### 5.2 Range settings

As math-tank: presets and a custom range.

- Presets: 1 to 100 (default), 0 to 1000.
- Custom: any minimum and maximum, for example 200 to 500.
- First version: ranges up to 200 numbers (20 rows) must be fully playable. 0 to 1000 is kept as a preset that the code must not block, and its layout is designed later (zoom, scroll or a smaller ball). Agreed with the parent.
- A range that includes 0 uses rows 0 to 9. Otherwise rows run 1 to 10, as on the classroom chart (design call).
- Not known yet: how a range that does not start at the beginning of a row is drawn (for example 205 to 480). Left to the builder, with the rule that every row holds 10 numbers and the column of a number stays the same as on the full chart.

### 5.3 Later: other scales

A chart where each square counts in steps of 10 (10, 20 … 1000) or 100 keeps the 10 by 10 layout, so the same skills carry over. Not part of the first version, but the settings and chart code should not rule it out.

## 6. Game modes

The start screen offers the modes the parent turned on. Number keys 1, 2 and 3 start them, as math-tank.

In every mode a wrong number sends the ball to the square of the number he typed. That square shows its number for a moment, so he sees how far and in which direction his number was from the target.

### 6.1 Hole mode ("Löcher")

- A board printed like the chart covers the goal. Some squares are cut out as holes.
- He types the number that belongs in a hole and shoots.
- Correct: the ball flies through the hole, goal, fans cheer.
- Wrong: the ball hits the board on the square of his number.
- Hints around a hole. The parent chooses:
  - **Always shown:** the neighbor numbers are printed on the board around the hole.
  - **On request:** the board is mostly blank, and numbers appear when he asks for help.
- Hint distance. The parent chooses which numbers are shown:
  - direct neighbors across and above and below (45, 47, 36, 56 for 46)
  - only above and below, to train ±10
  - diagonal neighbors (35, 37, 55, 57 for 46), to train ±11 and ±9
  - numbers two or three squares away, which is harder

### 6.2 Line mode ("Reihen")

- The board is mostly blank. The first one or two numbers of a line are printed, for example 1 and 11 in a column.
- He types the next number in the line (21) and shoots. The ball hits that square, the number lights up, fans clap, and the next empty square becomes the target.
- He keeps going to the end of the line. Finishing the line scores a goal and fans cheer.
- A line is 5 squares long by default, and the parent can change it. A line stops at the edge of the chart (design call).
- Directions the parent can turn on:
  - across (+1)
  - down (+10)
  - diagonal down-right (+11)
  - diagonal down-left (+9)
  - backwards in each direction (−1, −10, −11, −9)
- Because he struggles with down and diagonal, the default turns on down and both diagonals, with across as a warm-up. This default is a design call, not a parent decision.

### 6.3 Goalkeeper mode ("Torwart")

- No board covers the goal. A goalkeeper stands in the goal facing him.
- The chart grid is drawn faintly over the open goal.
- Hint numbers light up in the grid, for example 41 and 43, with an empty target square between them.
- He types 42 and shoots. The ball flies to the square for 42, out of the keeper's reach. Goal, fans cheer.
- Wrong: the ball flies to the square of his number and the keeper catches it. Soft "ohhh", then clapping.
- Hint choices are the same as in hole mode: across, above and below, diagonal, close or further away.

## 7. Help

As math-tank, help gets more explicit step by step and never costs anything:

1. A hint: for example the neighbor numbers appear, or an arrow shows the direction (one row down is +10).
2. The full chart opens, with the target square and his last number marked. The parent said that seeing the whole chart is what helps him most.
3. The answer is shown, and he shoots it.

He can ask for help with H or the help button. After a miss, the next help step is offered.

## 8. Rounds and hearts

As math-tank, the parent chooses how a round ends:

- **Until hearts are gone:** he has 3 balls (hearts). A single miss never costs a ball. A ball is lost only after several misses in a row on the same target. In line mode the target is one square; after a lost ball that square fills in and the line continues (design call). The number of misses is set by the difficulty setting (easy, normal, challenging), the same way the math-tank enemy closes in after misses.
- **Fixed number of goals:** 1 to 20 goals per round. In line mode one goal is one finished line (design call).

The end screen shows goals and time, an encouraging line, and his personal best. Never "verloren". "Nochmal" or Enter starts a new round.

## 9. Rewards

Built like the math-tank garage:

- He earns stars for correct shots and for goals. In line mode each correct square earns a star and a finished line earns a goal (design call).
- In the locker room ("Kabine") he spends stars on looks:
  - ball designs: colors, patterns, special balls such as a ball with flames
  - shirt color, and his own shirt number and name
  - the fans' scarf color, so the crowd cheers in his team colors
- He never loses stars. The parent can turn the locker room off.

## 10. Progress tracking

Per direction (+1, −1, +10, −10, +11, −11, +9, −9) and per mode, the progress page shows how many targets he solved alone and how many with help. A direction counts as mastered after repeated solves without help. Adaptive difficulty uses the same data to choose directions and hint distance.

A hole or keeper target counts toward each direction its hints point from. For example, the hint 36 above the target 46 counts as +10, and the hint 45 counts as +1 (design call).

The order of difficulty steps, from easiest to hardest, is left to the builder. A starting point: hints always shown, then direct neighbors only, then only above and below or diagonal, then hints two or three squares away, then hints on request only.

## 11. Assets

Use only assets with a free license (CC0 preferred). List every asset and its license in the README.

- Draw the crowd in code: simple rows of fans that stand, jump, wave and clap. No free crowd sprite with these animations was found.
- Balls, shirts, the goal and the keeper come from CC0 packs or are drawn in code. Candidates:
  - [Kenney Sports Pack](https://kenney.nl/assets/sports-pack), CC0. Top-down, so mainly useful for ball and icon art.
  - [OpenGameArt basic soccer pack](https://opengameart.org/content/basic-soccer-pack) and [soccer ball sprites](https://opengameart.org/content/soccer-ball-animation-sprites-and-3d-texture), CC0.
  - [OpenGameArt 16-bit stadium](https://opengameart.org/content/stadium-background-16-bit) is CC-BY 3.0 and needs a credit line.
- Crowd sounds: [Free Crowd Cheering Sounds](https://gregor-quendel.itch.io/free-crowd-cheering-sounds) and Freesound clips such as [397434](https://freesound.org/s/397434). The license of each clip must be checked before use. The "ohhh" and clapping need sources too.
- A paid pack (for example [Soccorpia](https://gamergoon4.itch.io/soccorpia-pixel-art-asset-pack)) stays optional and needs the parent's approval.

## 12. How it gets made

Decided:

- Same stack as math-tank: Vite, TypeScript, React for menus and settings, Phaser 4 for the game scene, Zod for versioned settings, Vitest and Playwright for tests, pnpm.
- Settings stored like math-tank: one versioned settings object in the browser, checked with Zod, with migrations between versions.
- Repository `~/dev/private/math-soccer`, published by a GitHub Action on every push to `main` to `https://iddocohen.github.io/math-soccer/`, built with `--base=/math-soccer/`, as math-tank's `pages.yml`.
- spec-kit 1.3.0 with the Claude integration and the `opsmill`, `critique` and `checkpoint` extensions, installed in this project. `.specify/` and `.claude/` are in `.gitignore` and never reach GitHub.
- spec-kit produces `specs/001-math-soccer/spec.md` from this document.

Left to the builder:

- Code structure, and how much code is copied from math-tank versus written new.
- The exact ball sizes per range, ball flight animation and crowd drawing.
- Star prices and the list of locker room items.
- The game's German title. A suggestion is "Mathe-Kicker".

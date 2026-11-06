# Mathe-Kicker (Math Soccer)

A browser soccer game that teaches children how the hundred chart works: every number has a square, and its neighbors sit one step to the side (+1, −1), one row down or up (+10, −10) and on the diagonals (+11, +9, −11, −9). The child shoots by typing a number, and the ball flies to that number's square on a chart that covers the goal.

**Play it:** https://iddocohen.github.io/math-soccer/ (after the first release)

The game runs fully in the browser. It needs no account, no server and no internet connection after the first load. The interface is in German.

## What the game is for

Many children can move along a row of the hundred chart but get stuck on columns and diagonals. This game trains those moves with three modes, from the [product requirements](specs/001-math-soccer/source-prd.md):

- **Löcher (hole mode):** a board printed like the chart covers the goal. One square is cut out as a hole. Neighbor numbers help the child work out the hole's number.
- **Reihen (line mode):** the first one or two numbers of a line are printed, for example 1 and 11 going down. The child shoots the next squares of the line.
- **Torwart (goalkeeper mode):** the goal is open and a keeper stands in it. Hint numbers light up in a faint grid around an empty target square.

The game never punishes a mistake. A wrong number still flies to its own square, so the child can see where that number is. Fans cheer on a goal, clap on a correct square and make a soft "ohhh" on a miss, followed by encouraging clapping.

## How to play (tutorial for the child)

1. Press Enter or tap "Spielen", then pick a mode.
2. Look at the marked square and the numbers around it. Which number belongs there?
3. Type the number with the keyboard or the number pad on the screen, then press Enter. The ball flies to the square of that number.
4. The right number scores a goal. A wrong number lands on its own square; look where it landed and try again.
5. Stuck? Press H or the help button. Help comes in steps: first a hint, then the full chart with the target and your last number marked, then the answer. Help costs nothing.
6. Correct shots and goals earn stars. In the locker room ("Kabine") you spend stars on ball designs, a shirt color, your own shirt number and name, and the fans' scarf color. Stars never go down after a mistake.

## Tutorial for parents

- **Open the parent area:** hold the gear icon for 2 seconds. A short tap or a key press does not open it, so a child does not open it by chance. The game pauses while it is open.
- **Settings:** the number range (for example 1 to 100, 200 to 300, or a custom range up to 0 to 1000), which modes the start screen offers, hint display ("immer" or "auf Wunsch") and hint distance, line directions and line length, round type, difficulty, adaptive difficulty, sound options and the locker room. Changes apply from the next round.
- **Progress:** the progress page shows, per direction (+1, −1, +10, −10, +11, −11, +9, −9) and per mode, how many targets the child solved alone and how many with help, and which directions count as mastered.
- **Backup and moving to another device:** "Daten sichern" downloads settings, progress, bests and locker room data to a file, and "Daten laden" loads that file. The QR transfer moves the same data to another browser by QR code or link.

All data stays in the browser where the game runs.

## Run it locally

Requirements: Node.js 22 or later and pnpm 10.

```bash
pnpm install
pnpm dev          # development server
pnpm test         # unit tests (Vitest)
pnpm build        # production build in dist/
pnpm preview      # serve the production build
pnpm exec playwright install chromium firefox webkit
pnpm e2e          # browser tests in Chromium, Firefox and WebKit, on iPad sizes, and under /math-soccer/
pnpm lint && pnpm typecheck
```

The browser tests build the game and serve it on port 4173, and a second build for GitHub Pages under `/math-soccer/` on port 4174. A server already running on one of these ports is used as it is, so stop it first to test fresh code.

## Deployment

Every push to `main` publishes the game to GitHub Pages with the workflow [.github/workflows/pages.yml](.github/workflows/pages.yml). It installs the packages, runs `pnpm lint`, `pnpm typecheck` and `pnpm test`, builds with `vite build --base=/math-soccer/` and publishes `dist/`. In the repository settings, Pages uses "GitHub Actions" as its source.

## Assets and licenses

All art and sound are drawn or synthesized in code. The stands, fans, goal, net, chart board, keeper, player, ball and icons are drawn with shapes; the kick, cheer, clap and "ohhh" sounds are made with the Web Audio API. The game loads no image, sound or font files from other sources, and uses no assets from other games.

The project setup and several modules are copied from [math-tank](https://github.com/iddocohen/math-tank) by the same author.

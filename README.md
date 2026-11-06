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
- **Settings:** the number range (for example 1 to 100, 200 to 300, or a custom range up to 0 to 1000), which modes the start screen offers, hint display ("immer" or "auf Wunsch") and hint distance, line directions and line length, round type, difficulty, adaptive difficulty, sound options and the locker room. Settings saved during a round apply when the settings page closes: a changed range, mode choice, hint, line, difficulty or adaptive setting gives the round a new target on the new board, and the goals, hearts, stars and time stay. Round type and goals per round apply from the next round.
- **Progress:** the progress page shows, per direction (+1, −1, +10, −10, +11, −11, +9, −9) and per mode, how many targets the child solved alone and how many with help, and which directions count as mastered.
- **Backup and moving to another device:** "Daten sichern" downloads settings, progress, bests and locker room data to a file, and "Daten laden" loads that file. The QR transfer moves the same data to another browser by QR code or link.
- **Start over:** the progress page has "Fortschritt zurücksetzen" (keeps the personal bests and the stars) and "Alles zurücksetzen" (progress, personal bests, stars and locker room; the settings stay). Each asks first. Save the data with "Daten sichern" before "Alles zurücksetzen" if you may want it back.
- **Locker room during a match:** with the locker room on, the shirt icon next to the gear ("Kabine") opens it with one tap. The round pauses while it is open and continues after "Zurück", with the chosen look.

All data stays in the browser where the game runs.

### Keeping the child's progress

The progress lives in the browser's own storage on that device (`localStorage`, under keys that start with `mathsoccer.`), not on a server.

- **Updates do not touch it.** A new version replaces only the game's files in the offline cache. Data saved by a newer version is never saved over by an older one.
- **If a version cannot read a save,** the game keeps a copy of it (under the same key with `.unreadable` added) before saving anything new. When a later version can read the copy, the settings page offers "Kopie wiederherstellen".
- **iPhone and iPad:** Safari deletes the data of a website that was not opened during 7 days of Safari use ([WebKit blog](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Add the game to the Home Screen (Share, then "Zum Home-Bildschirm") and play it from there: that copy counts only the days it is used itself, so a break does not delete the progress.
- **Clearing browser data deletes the progress.** Save it first with "Daten sichern" or "Spielstand übertragen" in the settings, and load it again afterwards.

Steps that clear browser data, each only after saving first:

- Safari on iPhone or iPad: **save first**, then Settings app, then Apps, then Safari, then "Clear History and Website Data" (older iOS: Settings, then Safari). To clear only this game: **save first**, then Safari, then Advanced, then Website Data, and remove `iddocohen.github.io`.
- Chrome: **save first**, then the three dots, then "Delete browsing data", choose "All time", and tick "Cookies, site data" and "Cached images and files".
- Removing the game from the Home Screen also removes that copy's data: **save first**.

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

The browser tests build the game and serve it on port 4273, and a second build for GitHub Pages under `/math-soccer/` on port 4274. A server already running on one of these ports is used as it is, so stop it first to test fresh code.

## Deployment

Every push to `main` publishes the game to GitHub Pages with the workflow [.github/workflows/pages.yml](.github/workflows/pages.yml). It installs the packages, runs `pnpm lint`, `pnpm typecheck` and `pnpm test`, builds with `vite build --base=/math-soccer/` and publishes `dist/`. In the repository settings, Pages uses "GitHub Actions" as its source.

## Assets and licenses

All art and sound are drawn or synthesized in code. The stands, fans, goal, net, chart board, keeper, player, ball and icons are drawn with shapes; the kick, cheer, clap and "ohhh" sounds are made with the Web Audio API. The game loads no image, sound or font files from other sources, and uses no assets from other games.

The project setup and several modules are copied from [math-tank](https://github.com/iddocohen/math-tank) by the same author.

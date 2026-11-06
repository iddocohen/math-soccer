# Mathe-Kicker (Math Soccer)

A browser soccer game that teaches children how the hundred chart works: every number has a square, and its neighbors sit one step to the side (+1, −1), one row down or up (+10, −10) and on the diagonals (+11, +9, −11, −9). The child shoots by typing a number, and the ball flies to that number's square on a chart that covers the goal.

**Play it:** https://iddocohen.github.io/math-soccer/ (after the first release)

The game runs fully in the browser. It needs no account, no server and no internet connection after the first load. The interface is in German.

## What the game is for

Many children can move along a row of the hundred chart but get stuck on columns and diagonals. This game trains those moves with one game, from the [product requirements](specs/001-math-soccer/source-prd.md) and [amendment 05](specs/001-math-soccer/amendment-05-keeper-main-game.md): the goal is open, a keeper stands in it, and hint numbers light up in a faint grid around an empty target square. A **hint pattern** decides which numbers light up:

- **Nachbarn:** the squares around the target, for example 45, 47, 36 and 56 around 46.
- **Mitte:** one square on each side of the target in one direction, so the target is the middle: 45 _ 47, or 36 _ 56 down.
- **Reihe:** two or three squares before the target in one direction, so the target continues the row: 16, 26, 36, then 46.
- **Formen:** a four-square shape known from falling-block games (a bar, a square, a T, an L, a J, an S or a Z) placed on the chart, with one or two squares empty. With two empty squares the child shoots them one after the other, and each one is a goal ([amendment 06](specs/001-math-soccer/amendment-06-tetris-shapes.md)).

With adaptive difficulty on, the game moves the child up a ladder from Nachbarn to Mitte, Reihe, Formen, Nachbarn two squares away and hints shown only on request, separately for each direction.

The game never punishes a mistake. A wrong number still flies to its own square, so the child can see where that number is. Fans cheer on a goal, clap on a correct square and make a soft "ohhh" on a miss, followed by encouraging clapping.

## How to play (tutorial for the child)

1. The start screen shows a big "Spielen" button: tap it, or press Enter or Space. When the parent allows it, a "Zeit-Challenge" button sits next to it (key Z).
2. Look at the empty target square and the numbers lit around it. Which number belongs there?
3. Type the number with the keyboard or the number pad on the screen, then press Enter. The ball flies to the square of that number.
4. The right number scores a goal. A wrong number lands on its own square; look where it landed and try again.
5. Stuck? Press H or the help button. Help comes in steps: first a hint, then the full chart with the target and your last number marked, then the answer. Help costs nothing.
6. Need a break? Press Escape or the pause button. Escape, Enter or the play button goes on.
7. **Zeit-Challenge:** score as many goals as you can before the clock at the top reaches 0:00. There are no hearts, so a miss costs only time. In the last 10 seconds the clock turns yellow and pulses. A ball already flying when the time runs out still counts. The end screen says, for example, "5 Tore in 2 Minuten" and shows your record for that time.
8. Goals earn stars. In the locker room ("Kabine") you spend stars on ball designs, a shirt color, your own shirt number and name, and the fans' scarf color. Stars never go down after a mistake.

### Keys and buttons

| Key | Button | What it does |
|-----|--------|--------------|
| Enter or Space | Spielen | Start a round on the start screen |
| Z | Zeit-Challenge | Start a time challenge on the start screen, when the parent allows it |
| K | Kabine | Open the locker room from the start screen |
| 0 to 9 | Number pad keys | Type the number |
| Backspace | ⌫ | Delete the last digit |
| Enter or Space | ⚽ | Shoot |
| H | ? | Next help step |
| Escape | Pause, Weiter | Pause and go on |
| (none) | Vollbild | Fullscreen, where the browser allows it |
| (none) | Vorlesen (speaker icon) | Read the task again, when "Vorlesen" is on |

On an iPad the number pad shows by itself: at the bottom right when the iPad is held sideways, across the bottom when it is held upright.

## Tutorial for parents

- **Open the parent area:** hold the gear icon for 2 seconds. A short tap or a key press does not open it, so a child does not open it by chance. The game pauses while it is open.
- **Settings:** the number range (for example 1 to 100, 200 to 300, or a custom range up to 0 to 1000), hint display ("immer" or "auf Wunsch") and hint distance, the allowed hint patterns ("Hinweis-Muster": Nachbarn, Mitte, Reihe, Formen), the allowed directions ("Richtungen"), the allowed shapes ("Formen"), the time challenge ("Zeit-Challenge erlauben" and its length: 1, 2, 3 or 5 minutes), round type for "Spielen", difficulty, adaptive difficulty, sound options (effects, crowd, the "ohhh", and "Vorlesen", which reads each task aloud with the browser's German voice), the number pad ("automatisch" shows it only on touch screens, "immer", "nie"), a clock during play, personal bests and the locker room. Settings saved during a round apply when the settings page closes: a changed range, hint, pattern, direction, shape, difficulty, adaptive or "Punkt nach voller Hilfe" setting gives the round a new target on the new board, and the goals, hearts, stars and time stay. Round type, goals per round and the challenge length apply from the next round.
- **Progress:** the progress page shows, per direction (+1, −1, +10, −10, +11, −11, +9, −9), how many targets the child solved alone and how many with help, the ladder step, and which directions count as mastered. Attempts and personal bests from the removed hole and line modes of earlier versions show as "früher". Time challenge records are listed per range and challenge length.
- **Backup and moving to another device:** "Daten sichern" downloads settings, progress, bests and locker room data to a file, and "Daten laden" loads that file. The QR transfer moves the same data to another browser by QR code or link.
- **Start over:** the progress page has "Fortschritt zurücksetzen" (keeps the personal bests and the stars) and "Alles zurücksetzen" (progress, personal bests, stars and locker room; the settings stay). Each asks first. Save the data with "Daten sichern" before "Alles zurücksetzen" if you may want it back.
- **Locker room during a match:** with the locker room on, the shirt icon next to the gear ("Kabine") opens it with one tap. The round pauses while it is open and continues after "Zurück", with the chosen look.

All data stays in the browser where the game runs.

### Keeping the child's progress

The progress lives in the browser's own storage on that device (`localStorage`, under keys that start with `mathsoccer.`), not on a server.

- **Updates do not touch it.** A new version replaces only the game's files in the offline cache. Data saved by a newer version is never saved over by an older one.
- **If a version cannot read a save,** the game keeps a copy of it (under the same key with `.unreadable` added) before saving anything new. When a later version can read the copy, the settings page offers "Kopie wiederherstellen". The start screen shows a short note when data was reset this way, and when saving stars, progress or bests failed during play.
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

`pnpm e2e` ends with a frame rate check in Chromium (`tests/e2e/performance.spec.ts`), which runs after every other browser has finished; `pnpm exec playwright test --project=performance --no-deps` runs it alone. Without a graphics card it is skipped.

The browser tests build the game and serve it on port 4273, and a second build for GitHub Pages under `/math-soccer/` on port 4274. A server already running on one of these ports is used as it is, so stop it first to test fresh code.

## Deployment

Every push to `main` publishes the game to GitHub Pages with the workflow [.github/workflows/pages.yml](.github/workflows/pages.yml). It installs the packages, runs `pnpm lint`, `pnpm typecheck` and `pnpm test`, builds with `vite build --base=/math-soccer/` and publishes `dist/`. In the repository settings, Pages uses "GitHub Actions" as its source.

## Assets and licenses

The game bundles a few free asset files in `public/assets/` (amendment 03). They ship with the build and the offline cache, so the game makes no request to other sites. The license of each file was checked on its source page.

| Use | File | Asset | Author | License | Source |
|-----|------|-------|--------|---------|--------|
| Pitch grass | `grass004_512.jpg` | Grass004, 1K color map resized to 512 px | ambientCG | CC0 1.0 | [ambientcg.com/view?id=Grass004](https://ambientcg.com/view?id=Grass004) |
| Classic soccer ball | `ball_rolling_grid.png` | Soccer ball animation sprites (8 by 8 rotation frames of 128 px) | Mustitz | CC0 1.0 | [opengameart.org](https://opengameart.org/content/soccer-ball-animation-sprites-and-3d-texture) |
| Goal cheer | `cheer.mp3` | Crowd Cheer (freesound 397434), trimmed to 2.5 s with a fade | FoolBoyMedia | CC0 1.0 | [freesound.org/s/397434](https://freesound.org/s/397434) |
| Soft "ohhh" | `ohh.mp3` | Crowd Sigh In Disappointment (freesound 764324), trimmed to 1.2 s | ShangusBurger | CC0 1.0 | [freesound.org/s/764324](https://freesound.org/s/764324) |
| Clapping | `clap.mp3` | Audience Clapping 03h (freesound 606967), trimmed to 1.5 s | Department64 | CC0 1.0 | [freesound.org/s/606967](https://freesound.org/s/606967) |
| Kick | `kick.mp3` | Soccer Ball Kick (freesound 555042) | bittermelonheart | CC0 1.0 | [freesound.org/s/555042](https://freesound.org/s/555042) |
| Numbers and headings | `Fredoka.ttf` | Fredoka (variable TTF) | The Fredoka Project Authors | SIL Open Font License 1.1 (text in `public/assets/OFL.txt`) | [fonts.google.com/specimen/Fredoka](https://fonts.google.com/specimen/Fredoka) |

Everything else is drawn or synthesized in code:

- **Scene** (Phaser shapes): stands with fans and scarves, floodlights, night sky, chalk lines, goal frame and net, chart board, keeper, player with shirt number and name, the tennis and ping-pong balls, and the ball designs from the locker room other than the classic ball.
- **Overlay** (HTML and CSS, inline SVG): buttons, hearts as balls, the shirt icon, the help chart, the number pad.
- **App icon**: a hand-written SVG (`public/icons/icon.svg`, a goal on grass) with PNG copies at 192 and 512 pixels.
- **Fallback sounds** (Web Audio API, made while playing): when a sound file cannot be loaded or decoded, a synthesized kick, cheer, clapping or "ohhh" plays instead.
- **Speech**: the browser's own German voice (speechSynthesis), only with "Vorlesen" on.

The project setup and several modules are copied from [math-tank](https://github.com/iddocohen/math-tank) by the same author.

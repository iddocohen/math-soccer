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

The patterns are grouped into six difficulty levels ([amendment 09](specs/001-math-soccer/amendment-09-difficulty-levels.md)): 1 "Gerade Linien" (across and down), 2 "Schräge Linien" (the diagonals), 3 "Formen", 4 "Formen mit 2 Lücken", 5 "X-Form" (the diagonal cross) and 6 "Ausschnitte" ([amendment 18](specs/001-math-soccer/amendment-18-cutouts.md)): a cut-out piece of the chart, such as a 3×3 box, a column, a row or an L, with a few numbers given and the other squares empty. The child fills the empty squares one after the other; the keeper waits at the side and steps in only for the last square, which is the goal. With adaptive difficulty on, the child moves up one level after 3 targets in a row solved alone, and down one when 2 of the last 3 targets needed help. A new level shows a short line such as "Neue Stufe: Schräge Linien!"; a level going down shows nothing.

The game never punishes a mistake. A wrong number still flies to its own square, so the child can see where that number is. Fans cheer on a goal, clap on a correct square and make a soft "ohhh" on a miss, followed by encouraging clapping.

## How to play (tutorial for the child)

1. The start screen shows a big "Spielen" button: tap it, or press Enter or Space. When the parent allows it, a "Zeit-Challenge" button sits next to it (key Z).
2. Look at the empty target square and the numbers lit around it. Which number belongs there?
3. Type the number with the keyboard or the number pad on the screen, then press Enter. The ball flies to the square of that number.
4. The right number scores a goal. A wrong number lands on its own square; look where it landed and try again.
5. Stuck? Press H or the help button. Help comes in four steps ([amendment 10](specs/001-math-soccer/amendment-10-row-column-helper.md), [amendment 14](specs/001-math-soccer/amendment-14-help-scales-and-home.md)): first the target's row lights up with a hint arrow and a row scale (0, 10, 20 …) appears to the right of the goal; then the column lights up and a column scale (1 to 10) appears above the crossbar; then the full chart with the target and your last number marked; then the answer. The scales show only during help and go away when the target is scored. Help costs nothing.
6. Need a break? Press Escape or the pause button. The pause screen has "Weiter" (Enter or Escape) and "Zum Start".
7. Want to stop? The house button ("Zum Start") next to pause asks "Runde beenden?". "Weiter" (Enter) plays on; "Zum Start" ends the round without an end screen. Stars and finished targets stay; the open target does not count.
8. **Zeit-Challenge:** score as many goals as you can before the clock at the top reaches 0:00. There are no hearts, so a miss costs only time. In the last 10 seconds the clock turns yellow and pulses. A ball already flying when the time runs out still counts. The end screen says, for example, "5 Tore in 2 Minuten" and shows your record for that time.
9. Goals earn stars ([amendment 19](specs/001-math-soccer/amendment-19-cup-arms-and-star-economy.md)): 1 star per goal, 2 more for a whole cutout, 3 for a won cup match and 10 for a won cup. In the locker room ("Kabine") you spend stars on ball designs, a shirt color, your own shirt number and name, the fans' scarf color, goal celebrations, and since [amendment 20](specs/001-math-soccer/amendment-20-new-shop-items.md) a ball trail ("Ballspur"), a goal effect ("Tor-Effekt"), a mascot ("Maskottchen"), the stadium ("Stadion": its name on the scoreboard, bigger stands, the floodlight color) and the weather ("Wetter"). Each item has a preview. Stars never go down after a mistake.
10. **Spielarten** ([amendment 21](specs/001-math-soccer/amendment-21-unlockable-modes.md)): in the locker room's group "Spielarten" you unlock game modes with stars. Each unlocked mode gets its own button on the start screen; a locked one shows a lock and its price and opens the locker room.
    - **Mauer** ("Freistoß mit Mauer", 200 stars, key M): a wall of 3 to 5 defenders covers some columns. The target and its hints are always free. A number behind the wall hits the wall; its square still shows where the number is. The wall moves after each goal.
    - **Torwart** ("Selbst ins Tor", 300 stars, key T): you are the keeper. A player of a cup team shoots at a square that flashes with no number and a yellow countdown ring. Type that square's number and press Enter before the ball arrives to save it. Help holds the ball until your next key. A round has 10 shots, and each save earns 1 star.
    - **Elfmeter** ("Elfmeterschießen", 600 stars, after "Selbst ins Tor", key E): a penalty shootout against a cup team. In each of 5 rounds you shoot once (as in "Spielen", one try) and then keep once (as in "Torwart"). Two rows of circles at the top show the goals and misses. If it is level after 5 rounds, single rounds follow until one side leads. A win shows "Elfmeter-Sieger!" with confetti and earns 5 stars; a loss shows "Knapp! Noch mal?" and takes nothing away.

### Keys and buttons

| Key | Button | What it does |
|-----|--------|--------------|
| Enter or Space | Spielen | Start a round on the start screen |
| Z | Zeit-Challenge | Start a time challenge on the start screen, when the parent allows it |
| K | Kabine | Open the locker room from the start screen |
| M | Mauer | Start "Freistoß mit Mauer", once unlocked |
| T | Torwart | Start "Selbst ins Tor", once unlocked |
| E | Elfmeter | Start "Elfmeterschießen", once unlocked |
| 0 to 9 | Number pad keys | Type the number |
| Backspace | ⌫ | Delete the last digit |
| Enter or Space | ⚽ | Shoot |
| H | ? | Next help step |
| Escape | Pause, Weiter | Pause and go on |
| (none) | Zum Start (house icon) | Ask "Runde beenden?" and go back to the start screen |
| (none) | Vollbild | Fullscreen, where the browser allows it |
| (none) | Vorlesen (speaker icon) | Read the task again, when "Vorlesen" is on |

On an iPad the number pad shows by itself: at the bottom right when the iPad is held sideways, across the bottom when it is held upright.

## Tutorial for parents

- **Open the parent area:** hold the gear icon for 2 seconds. A short tap or a key press does not open it, so a child does not open it by chance. The game pauses while it is open.
- **Settings:** the number range (for example 1 to 100, 200 to 300, or a custom range up to 0 to 1000), hint display ("immer" or "auf Wunsch") and hint distance, the levels under "Schwierigkeit" ("Stufe am Anfang" and "Schwerste Stufe", each with an example drawing), the allowed shapes ("Formen"; with every shape off, levels 3 and 4 are skipped), "Zeilen- und Spaltenhilfe" (on: a scale shown during help has all its labels; off: only the label of the target's row or column), the time challenge ("Zeit-Challenge erlauben" and its length: 1, 2, 3 or 5 minutes), round type for "Spielen", difficulty, adaptive difficulty, sound options (effects, crowd, the "ohhh", and "Vorlesen", which reads each task aloud with the browser's German voice), the number pad ("automatisch" shows it only on touch screens, "immer", "nie"), a clock during play, personal bests, the locker room, "Spielarten erlauben" (turns each unlockable mode's button on or off) and "Schussgeschwindigkeit" for "Selbst ins Tor" and the shootout's saves (langsam 10 s, mittel 8 s, schnell 5 s; the first shot of a round is always slow). Settings saved during a round apply when the settings page closes: a changed range, hint, level, shape, difficulty, adaptive or "Punkt nach voller Hilfe" setting gives the round a new target on the new board, and the goals, hearts, stars and time stay. Round type, goals per round and the challenge length apply from the next round.
- **Progress:** the progress page shows the child's current level ("Stufe jetzt: Stufe 2: Schräge Linien") and how many targets solved alone are still needed for the next one, targets solved alone and with help per level, and, per direction (+1, −1, +10, −10, +11, −11, +9, −9), how many targets the child solved alone and with help and which directions count as mastered. Attempts and personal bests from the removed hole and line modes of earlier versions show as "früher". Time challenge records are listed per range and challenge length. The unlockable modes have their own bests: "Mauer" per round type, "Torwart" as the most saves out of 10, "Elfmeter" as the number of shootouts won.
- **Backup and moving to another device:** "Daten sichern" downloads settings, progress, bests and locker room data to a file, and "Daten laden" loads that file. The QR transfer moves the same data to another browser by QR code or link.
- **Start over:** the progress page has "Fortschritt zurücksetzen" (keeps the personal bests and the stars) and "Alles zurücksetzen" (progress, personal bests, stars and locker room; the settings stay). Each asks first. Save the data with "Daten sichern" before "Alles zurücksetzen" if you may want it back.
- **Locker room during a match:** with the locker room on, the shirt icon next to the gear ("Kabine") opens it with one tap. The round pauses while it is open and continues after "Zurück", with the chosen look.

All data stays in the browser where the game runs.

### New versions

The game installs itself in the browser for offline play, so a new version reaches a device in the background ([amendment 12](specs/001-math-soccer/amendment-12-reliable-updates.md)):

- An open game looks for a new version when it loads, each time the start screen shows, when the tab comes back to the front, and every 5 minutes.
- A new version that is ready applies at once on the start screen. During a round it waits: the round end then says "Neue Version, startet gleich", and "Zurück" or "Nochmal" reloads the page with it ("Nochmal" starts the new round in the new version).
- Reloading the page applies a ready version, also during a round; the round continues in the new version. Clearing browser data is not needed for an update.
- The page reloads by itself at most once per version in a browser tab, so a broken update cannot cause a reload loop.

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

The browser tests build the game and serve it on port 4273, and a second build for GitHub Pages under `/math-soccer/` on port 4274. A server already running on one of these ports is used as it is, so stop it first to test fresh code. The update test (`tests/e2e/update.spec.ts`) builds two versions itself and serves them on port 4275.

## Deployment

Every push to `main` publishes the game to GitHub Pages with the workflow [.github/workflows/pages.yml](.github/workflows/pages.yml). It installs the packages, runs `pnpm lint`, `pnpm typecheck` and `pnpm test`, builds with `vite build --base=/math-soccer/` and publishes `dist/`. In the repository settings, Pages uses "GitHub Actions" as its source.

## Assets and licenses

The game bundles a few free asset files in `public/assets/` (amendments 03 and 22). They ship with the build and the offline cache, so the game makes no request to other sites. The license of each file was checked on its source page.

| Use | File | Asset | Author | License | Source |
|-----|------|-------|--------|---------|--------|
| Pitch grass | `grass004_512.jpg` | Grass004, 1K color map resized to 512 px | ambientCG | CC0 1.0 | [ambientcg.com/view?id=Grass004](https://ambientcg.com/view?id=Grass004) |
| Classic soccer ball | `ball_rolling_grid.png` | Soccer ball animation sprites (8 by 8 rotation frames of 128 px) | Mustitz | CC0 1.0 | [opengameart.org](https://opengameart.org/content/soccer-ball-animation-sprites-and-3d-texture) |
| Goal cheer | `cheer.mp3` | Crowd Cheer (freesound 397434), trimmed to 2.5 s with a fade | FoolBoyMedia | CC0 1.0 | [freesound.org/s/397434](https://freesound.org/s/397434) |
| Soft "ohhh" | `ohh.mp3` | Crowd Sigh In Disappointment (freesound 764324), trimmed to 1.2 s | ShangusBurger | CC0 1.0 | [freesound.org/s/764324](https://freesound.org/s/764324) |
| Clapping | `clap.mp3` | Audience Clapping 03h (freesound 606967), trimmed to 1.5 s | Department64 | CC0 1.0 | [freesound.org/s/606967](https://freesound.org/s/606967) |
| Kick | `kick.mp3` | Soccer Ball Kick (freesound 555042) | bittermelonheart | CC0 1.0 | [freesound.org/s/555042](https://freesound.org/s/555042) |
| Referee whistle | `whistle.mp3` | Referee whistle blow, gymnasium (freesound 218318), trimmed to 1.5 s, mono | SpliceSound | CC0 1.0 | [freesound.org/s/218318](https://freesound.org/s/218318) |
| Keeper catch | `catch.mp3` | Glove Catch 12 (freesound 164536), trimmed to 0.6 s, mono | martinimeniscus | CC0 1.0 | [freesound.org/s/164536](https://freesound.org/s/164536) |
| Ball on the wall | `wall.mp3` | Impact Sounds: `impactPunch_medium_000`, mono | Kenney | CC0 1.0 | [kenney.nl/assets/impact-sounds](https://kenney.nl/assets/impact-sounds) |
| Firework | `firework.mp3` | Firework Cluster (freesound 140717), mono | j1987 | CC0 1.0 | [freesound.org/s/140717](https://freesound.org/s/140717) |
| Confetti pop | `pop.mp3` | partypopper (freesound 26349), mono | Streety | CC0 1.0 | [freesound.org/s/26349](https://freesound.org/s/26349) |
| Buying in the locker room | `coin.mp3` | Coin Pickup (freesound 478647), trimmed to 0.8 s, mono | Phenala | CC0 1.0 | [freesound.org/s/478647](https://freesound.org/s/478647) |
| Unlocked mode and cup lift | `fanfare.mp3` | Success Fanfare Trumpets (freesound 456966), trimmed to 1.9 s with a fade, mono | FunWithSound | CC0 1.0 | [freesound.org/s/456966](https://freesound.org/s/456966) |
| Rain | `rain.mp3` | Slowly Raining Loop (freesound 177479), 15 s with a crossfaded loop point, mono | unfa | CC0 1.0 | [freesound.org/s/177479](https://freesound.org/s/177479) |
| Crowd murmur | `murmur.mp3` | Large Crowd Ambience (freesound 383768), 15 s with a crossfaded loop point, mono | a deleted Freesound account | CC0 1.0 | [freesound.org/s/383768](https://freesound.org/s/383768) |
| Ball trails, fireworks, light show | `star_04.png`, `star_06.png`, `star_07.png`, `fire_01.png`, `flare_01.png`, `light_01.png` | Particle Pack, white versions scaled to 64 px and tinted in code | Kenney | CC0 1.0 | [kenney.nl/assets/particle-pack](https://kenney.nl/assets/particle-pack) |
| Numbers and headings | `Fredoka.ttf` | Fredoka (variable TTF) | The Fredoka Project Authors | SIL Open Font License 1.1 (text in `public/assets/OFL.txt`) | [fonts.google.com/specimen/Fredoka](https://fonts.google.com/specimen/Fredoka) |

Everything else is drawn or synthesized in code:

- **Scene** (Phaser shapes): stands with fans and scarves, floodlights, night sky, chalk lines, goal frame and net, chart board, keeper, player with shirt number and name, the wall's defenders, the mascots, the tennis and ping-pong balls, and the ball designs from the locker room other than the classic ball.
- **Particles** drawn in code: the rainbow trail, the confetti, the light beams of the light show, rain and snow.
- **Overlay** (HTML and CSS, inline SVG): buttons, hearts as balls, the shirt icon, the help chart, the number pad.
- **App icon**: a hand-written SVG (`public/icons/icon.svg`, a goal on grass) with PNG copies at 192 and 512 pixels.
- **Fallback sounds** (Web Audio API, made while playing): when a sound file cannot be loaded or decoded, a synthesized stand-in plays instead, for every sound file above. The cup final's chant is always synthesized.
- **Speech**: the browser's own German voice (speechSynthesis), only with "Vorlesen" on.

The project setup and several modules are copied from [math-tank](https://github.com/iddocohen/math-tank) by the same author.

# Amendment 03: free assets for grass, ball, crowd sounds and numbers

**Date**: 2026-11-06
**Requested by**: the parent: "double check if there are online assets that can be used to make the game as it is also nicer, grass, etc.", then "Yes do it" to the recommended set.
**Changes**: research R2 and R10 (everything drawn or synthesized in code), FR-048 (asset list), the README.

## Assets

Every license was checked on the asset's own page during research. All files are bundled in the build, so the game stays offline and makes no external requests.

| Use | Asset | Author | License | Source page |
|-----|-------|--------|---------|-------------|
| Pitch grass | Grass004 (1K JPG color map, resized to 512 px) | ambientCG | CC0 | https://ambientcg.com/view?id=Grass004 |
| Classic soccer ball | Soccer ball animation sprites (8 by 8 grid of 128 px rotation frames) | Mustitz | CC0 | https://opengameart.org/content/soccer-ball-animation-sprites-and-3d-texture |
| Goal cheer | Crowd Cheer (sound 397434) | FoolBoyMedia | CC0 | https://freesound.org/s/397434 |
| Soft "ohhh" | Crowd Sigh In Disappointment (sound 764324) | ShangusBurger | CC0 | https://freesound.org/s/764324 |
| Clapping | Audience Clapping 03h (sound 606967) | Department64 | CC0 | https://freesound.org/s/606967 |
| Kick | Soccer Ball Kick (sound 555042) | bittermelonheart | CC0 | https://freesound.org/s/555042 |
| Numbers and headings | Fredoka (variable TTF) | The Fredoka Project Authors | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Fredoka |

Kept in code (no free asset fits): the goal and net, the fans, the goalkeeper, the player, tennis and ping-pong balls, and the ball designs from the locker room other than the classic ball.

## Behavior

- **FR-057**: The pitch MUST use the grass texture, tiled and darkened toward the evening palette, with the chalk lines drawn on top. The stands and night sky stay drawn.
- **FR-058**: The classic ball design MUST use the rotation sprite: the ball spins during flight (frames advanced with the flight) and rests on frame 0 at the kick spot. Other ball designs, tennis and ping-pong balls stay drawn in code. The ball still lands on the square of the typed number (FR-003).
- **FR-059**: The cheer, the soft "ohhh", the clapping and the kick MUST use the recorded clips, trimmed to fit the game:
  - cheer about 2.5 s with a fade out
  - "ohhh" about 1.2 s
  - clapping about 1.5 s
  - kick as is

  The parent's sound switches keep working: `sound.effects` (kick), `sound.crowd` (cheer, clap, ohh), `sound.ohh` (with it off, only the clapping plays). Sound starts after the first key or tap, as before. If a clip cannot be decoded, the synthesized sound from `src/audio/sfx.ts` plays instead.
- **FR-060**: Numbers on the board, the help chart, the typed number and headings MUST use Fredoka, bundled with the build (no Google Fonts request), with a system fallback font.
- **FR-061**: The README "Assets and licenses" section MUST list every bundled asset with author, license and source link, and the OFL text MUST ship next to the font file.

## Tests

- Unit: the ball sprite frame for a flight progress value stays within the 64 frames; the sound module falls back to synthesized sounds when a clip fails to decode; settings switches still gate each sound.
- e2e (Chromium): `noExternalRequests.spec.ts` still passes (no request leaves the site); `offline.spec.ts` still passes with the new files in the precache; `holes.spec.ts` still passes.
- Build: the PWA precache includes the new file types (jpg, png, mp3, ttf).

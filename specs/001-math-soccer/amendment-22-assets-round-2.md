# Amendment 22: particle images and new sounds

**Date**: 2026-11-13
**Requested by**: the parent: "See if any assets can be used to enhance anything accordingly", then "yes add assets to amendment 22" to the recommended set.
**Source**: research of 2026-11-13. Each license was checked on the asset's own page. All are CC0 (no attribution required). The downloads are in the session scratchpad under `asset-candidates-2/` (kenney/, freesound/).
**Changes**: amendment 20 (ball trails, goal effects, weather), amendment 21 (wall, keeper mode, unlock), and the sounds of amendment 03 (FR-059).

## Assets

| Use | Asset | License | Source |
|-----|-------|---------|--------|
| Ball trails (sparkles, stars, fire), fireworks and light show | Kenney Particle Pack: `star_*`, `spark_*`, `flame_*`/`fire_*`, `flare_*`, `light_*`, scaled to 64 px | CC0 | https://kenney.nl/assets/particle-pack |
| Ball hitting the wall or post | Kenney Impact Sounds: `impactSoft_medium_*` or `impactPunch_medium_*` (wall), `impactMetal_light_*` (post) | CC0 | https://kenney.nl/assets/impact-sounds |
| Referee whistle | Freesound 218318 "Referee whistle blow" | CC0 | https://freesound.org/s/218318 |
| Keeper catch | Freesound 164536 "Glove Catch" | CC0 | https://freesound.org/s/164536 |
| Firework | Freesound 140717 "Firework Cluster" | CC0 | https://freesound.org/s/140717 |
| Confetti pop | Freesound 26349 "partypopper" | CC0 | https://freesound.org/s/26349 |
| Buying (coin) | Freesound 478647 "Coin Pickup" | CC0 | https://freesound.org/s/478647 |
| Unlock fanfare | Freesound 456966 "Success Fanfare Trumpets" | CC0 | https://freesound.org/s/456966 |
| Rain loop | Freesound 177479 "Slowly Raining Loop", trimmed to about 15 s and looped | CC0 | https://freesound.org/s/177479 |
| Crowd murmur loop | Freesound 383768 "Large Crowd Ambience", trimmed to about 15 s and looped | CC0 | https://freesound.org/s/383768 |

Kept in code on purpose:
- **The mascots:** no matching free set exists, and there is no lion.
- **The players, keeper and wall defenders:** free figures are in another style.
- **The chant:** free chants are recordings of real crowds.
- **Confetti, rain and snow particles.**

## Behavior

- **FR-149**: The ball trails "sparkles", "stars" and "fire", and the goal effects "fireworks" and "light show", MUST use the particle images, tinted in code. "Rainbow" and "confetti" stay drawn in code. Particles keep the pooling of amendment 20.
- **FR-150**: The new sounds MUST play at these moments:
  - **Whistle:** at the start of every round and at the end of a cup match or shootout.
  - **Keeper catch:** when a keeper catches the ball, in every mode, and on a save in "Selbst ins Tor".
  - **Impact:** when a shot hits the wall in "Freistoß mit Mauer".
  - **Firework and confetti pop:** with their goal effects, and in the cup final.
  - **Coin:** when an item is bought in the locker room.
  - **Fanfare:** when a game mode is unlocked, and on the cup lift.
- **FR-151**: The rain loop MUST play quietly while the weather is rain. The crowd murmur MUST play very quietly under every match: well below the cheer, with no music, and stopped while paused. Both loops follow the sound switches.
- **FR-152**: Every new sound MUST follow the parent's switches:
  - **"Geräusche" (effects):** whistle, catch, impact, coin and fanfare.
  - **"Publikum" (crowd):** murmur, firework, pop and rain.

  Each sound has a synthesized fallback if a file is missing or fails to decode, as FR-059 does.
- **FR-153**: Clips MUST be trimmed and mono:
  - short sounds under 2 s;
  - loops about 15 s with a seamless loop point;
  - total added size under about 1.5 MB.

  They are added to the offline cache. The README asset table lists each asset with its source link and license.

## Tests

- Unit:
  - every new sound maps to its switch;
  - each falls back to synthesis when decoding fails;
  - the murmur stops while paused;
  - the rain loop plays only with rain weather;
  - the particle textures are used for the right trails and effects.
- e2e (Chromium):
  - no external request (all files bundled);
  - offline still works;
  - the precache includes the new files.
- One screenshot at 1280x800 of a sparkle trail and fireworks, checked by eye.

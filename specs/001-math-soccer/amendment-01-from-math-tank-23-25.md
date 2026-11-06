# Amendment 01: locker room from the match, keeping progress, settings apply at once

**Date**: 2026-11-06
**Requested by**: the parent, during implementation: "I just implemented in the math-tank the topic of saving persistence and going to the garage in the menu and reset, consider those too if needed here", and then the new math-tank amendment on settings.
**Source**: math-tank amendments 23 (garage from the battle), 24 (keeping the child's progress) and 25 (saved settings apply to the running round at once), in `~/dev/private/math-tank/specs/001-math-tanks/`.
**Changes**: FR-036a (replaced), FR-041, FR-043, FR-044, the README. Adds FR-049 to FR-052.

## 1. Locker room from the match (math-tank amendment 23)

- **FR-049**: With the locker room on, the match MUST show a locker room icon button next to the gear, at the same size, with the accessible name "Kabine". With the locker room off, the icon MUST NOT show.
- One tap or click opens the locker room over the match; no hold, because it is for the child. The match stays loaded underneath.
- A running round MUST pause while the locker room is open, the same way as for a parent screen: the timer stops and the match keys do nothing. A round the child had paused stays paused after closing.
- "Zurück" (and Escape) closes the locker room and the round continues.
- A look equipped or bought there MUST show at once on the player, ball and fans when the locker room closes, without a new round.

## 2. Keeping the child's progress (math-tank amendment 24)

- **FR-050**: The settings page MUST list the kinds of stored data whose kept copy under `<key>.unreadable` this version can read, and offer "Kopie wiederherstellen": it saves those copies as the current data, all or none, removes the copies, and reloads the page. If the save fails, nothing changes and a notice says so. A copy this version cannot read, or one from a newer version, is not offered.
- **FR-051**: The progress page MUST offer "Alles zurücksetzen": it clears progress, personal bests, stars and the locker room (including the total ever earned), and keeps the settings. It asks first, and the question reminds the parent to save the data before. All four are cleared together or not at all. The existing "Fortschritt zurücksetzen" stays.
- A new version of the game MUST NOT remove saved data: the offline cache cleanup touches only the game's files, and saves live in `localStorage` under `mathsoccer.` keys. Data from a newer version is never saved over; unreadable data is copied to `<key>.unreadable` before anything is saved over it.
- README: a section "Keeping the child's progress" (Safari deletes website data after 7 days without a visit; the Home Screen app keeps its own count), the Home Screen advice for iPad, and "save first" before every step that clears browser data.

## 3. Saved settings apply at once (math-tank amendment 25)

FR-036a ("settings apply at the next round") is replaced by:

- **FR-052**: When the parent saves settings during a running round, the change MUST apply when the settings page closes:
  - **Target-shaping settings** (range, modes offered, hint display, hint distance, line directions, line length, difficulty, adaptive, "Punkt nach voller Hilfe"): the match MUST get a new target (or a new line) built with the new settings, on a board drawn for the new range. Goals, hearts, stars and time played stay. The unfinished target is dropped without recording an attempt. If the running round's mode is no longer offered, the round continues in its mode until it ends.
  - **Round-shaping settings** (round type, goals per round) MUST keep their round-start values until the next round.
  - **Settings that change no target** (sound, "ohhh", speech, number pad, clock, records, locker room on or off) MUST apply at once without a new target.
  - Several saves while the page is open count as one change; the new target comes once, when the page closes, and only if a target-shaping setting changed.
  - A round the child had paused stays paused with the new target.
  - On the start screen, the locker room and the round end screen, the next round uses the saved settings, as before.
- A stored round whose range no longer matches the settings (for example after a restore) is still discarded on load.

## 4. Test ports (found during implementation)

math-tank's preview servers use ports 4173 and 4174. math-soccer MUST use its own ports, 4273 and 4274, in `playwright.config.ts`, so `reuseExistingServer` never tests math-tank's build.

## Tests first

- Controller: applying settings mid-round builds a new target with the new range and keeps goals, hearts, stars and time; round type and goals per round keep their round-start values; display-only changes keep the target.
- App: the change applies when the settings page closes after a save, once for several saves, not when nothing was saved; the locker room icon shows only with the locker room on; opening pauses, closing resumes; a paused round stays paused; keys do nothing while it is open; a look equipped there shows on the player after closing (`data-ball`, `data-shirt`).
- Persistence unit tests: kept copies offered and restored; not offered when unreadable or newer; all or none on a failed write; settings stay after "Alles zurücksetzen".
- e2e (Chromium): change the range from 1 to 100 to 1 to 20 mid-round, save, close: the board has 2 rows and goals stay; restore a kept locker room copy and see its stars on the start screen; open the locker room from a running round, equip a ball, close, and the round continues with the new ball.

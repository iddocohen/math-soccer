# Amendment 12: new versions reach open pages

**Date**: 2026-11-06
**Requested by**: the parent: "the latest update does not refresh existing pages that are open and I need to clean the browser accordingly. Do you know why?"
**Likely causes** (found by reading `src/app/swUpdate.ts`; not yet reproduced):
1. GitHub's Pages deploy failed twice, so for about 25 minutes no new version existed.
2. By design, a waiting version is applied only on the start screen, never during a round.
3. An open page checks for a new version only on load, when the tab returns to the front, and every 30 minutes.
4. A normal reload is served from the offline cache. The new version installs in the background and applies on the next start screen.

**Gap**: math-tank's two-version update test (`tests/e2e/updateServer.mjs`) was not copied, so nothing tests that an open page switches to a new build.
**Changes**: FR-051 and FR-051a as carried over from math-tank (`src/app/swUpdate.ts`).

## Behavior

- **FR-102**: The app MUST look for a new version each time the start screen shows, when the tab returns to the front, and every 5 minutes while the game is open. Today the interval is 30 minutes.
- **FR-103**: A waiting version MUST apply on the start screen at once, as today. If it is found during a round, the round end screen MUST show a short neutral line, "Neue Version, startet gleich". "Zurück" then applies it. "Nochmal" applies it first and then starts the new round.
- **FR-104**: Reloading the page with a waiting version MUST apply it, so the parent never needs to clear browser data. The loop guard stays.

## Tests

- e2e (Chromium): math-tank's update test, adapted with its own ports. It serves version A, opens the game, switches the server to version B, then checks:
  - the open start screen switches to B within the check interval;
  - a page in a running round stays on A until the round ends, then switches.
- Unit: the check schedule (start screen, focus, 5 minutes); the round end line shows only when a version is waiting.

## Found by the update test (T100)

`tests/e2e/update.spec.ts` reproduced two causes on top of the 30-minute check interval:

1. **A reload during a round never applied a waiting version.** A reload restores the stored round on the match screen, and the old rule applied a version only on the start screen. A child who keeps pressing "Nochmal" also never reaches the start screen. Fix: a waiting version applies at page load on any screen until the child's first key or touch; the restored round continues in the new version. With this rule turned off, the test "a reload during a round applies the new build" fails (the page stays on the old build).
2. **A page opened on a first visit, or after the browser data was cleared, never reloaded itself.** vite-plugin-pwa reloads only when workbox-window reports `isUpdate`, which is true only if a service worker controlled the page when it loaded. On such a page the new worker took control, but the page kept running the old build until a manual reload. Fix: `swUpdate.ts` reloads the page itself when the controller changes after it applies a version. The test "\"Zurück\" after a round applies a build that appeared during it" failed before this fix.

The test does not check the open start screen within the 5-minute interval (it would wait 5 minutes); the unit tests check the interval, and the e2e checks the start screen check and the check when the tab comes back to the front.

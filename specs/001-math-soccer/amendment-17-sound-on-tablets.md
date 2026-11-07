# Amendment 17: sound on iPad and Fire tablets

**Date**: 2026-11-07
**Requested by**: the parent: "Sound does not seem to be played automatically for ipad / amazon silk browser ... I believe this works with math-tank".

**Changes**: the spec edge case "Sound blocked by the browser" and research R10 (when audio is unlocked).

## Cause

Browsers start Web Audio suspended and resume it only inside a user gesture. iPad Safari and Silk (Chromium) count a key press, a click and the end of a touch as a gesture, but not the start of a touch.

- The game unlocked audio from one listener on `pointerdown`, `touchend` and `keydown`, and removed that listener after the first event.
- On a tablet the first event of a tap is `pointerdown`. The `resume()` call there stayed suspended, the listener was gone, and no later tap tried again, so the game stayed silent.
- math-tank has the same listener, but it also calls `sfx.unlock()` in the start button's click handler, which counts as a gesture. That is why math-tank plays sound on the same tablets.

## Rule

- Audio unlocks on `keydown`, `pointerup`, `touchend` and `click`, for the whole session, whenever the audio context is not running. `pointerdown` is not used.
- In the handler, the game calls `resume()` synchronously and plays a one-sample silent buffer. Nothing is awaited before them.
- The recorded clips are fetched and decoded beside the resume and never delay it. Until they are decoded, the synthesized sounds play.
- When the context is suspended or interrupted again (a hidden tab, a phone call), the next gesture resumes it. The game also tries to resume when the page comes back into view.
- The start tap (or key) also calls `sfx.unlock()`, as in math-tank.

## Code

- `src/audio/sfx.ts`: `unlock()` and `installUnlock()`.
- `src/app/App.tsx`: `startMatch` calls `sfx.unlock()`.

## Tests

- Unit: `src/audio/sfx.test.ts`, "unlock on iPad and Fire tablets (amendment 17)". A stand-in context resumes only when `resume()` is called during a gesture and otherwise stays suspended with a pending promise. The tests check:
  - `pointerdown` does not resume, and `touchend` resumes at once with a silent buffer.
  - `pointerup`, `click` and `keydown` each resume synchronously.
  - A resume refused outside a gesture keeps the listeners, and the next tap unlocks.
  - The resume does not wait for clips that never finish decoding, and the synthesized kick plays.
  - After an interruption the next tap resumes again, and `resume()` is called only while the context is not running.
  - The page coming back into view tries to resume, and the removed listeners do nothing.
- Playwright: the existing chromium, base-path, iPad and Fire projects run unchanged. They silence audio, so they show that the change breaks nothing, not that sound plays on a real tablet.

// Structure adapted from math-tank src/app/StartScreen.tsx.
/**
 * Start screen (contracts/screens.md "Start"): one big button per mode the parent offers, "Löcher", "Reihen" and
 * "Torwart" in this order, each with its key (1, 2, 3). The keys, and Enter or Space for the first offered mode (or the
 * mode named by `?mode=` in tests), are handled by the app's keyboard listener (src/app/keyboard.ts).
 *
 * The gear sits at the top right; the parent gate (T041) passes it in as `gear` and opens the parent menu after a
 * 2-second press. The fullscreen button shows only where the browser lets a page use fullscreen.
 *
 * With the locker room on (FR-044), a "Kabine" button (K) and the star total (`data-testid="star-total"`) show below
 * the modes; with it off, both are hidden.
 */
import type { ReactNode } from 'react';
import { MODES, type Mode } from '../core/types';
import { t } from '../i18n';

/** The key that starts a mode on the start screen: 1, 2 or 3. */
export function modeKey(mode: Mode): string {
  return String(MODES.indexOf(mode) + 1);
}

/** Asks the browser for fullscreen; a refusal leaves the game as it is. */
export function requestFullscreen(): void {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen().catch(() => {
    // Some browsers refuse fullscreen; the game still works.
  });
}

interface Props {
  /** The offered modes, in start screen order. */
  modes: readonly Mode[];
  onPlay: (mode: Mode) => void;
  gear?: ReactNode;
  /** The star balance and how to open the locker room; null when the parent turned the locker room off. */
  lockerRoom?: { stars: number; onOpen: () => void } | null;
}

export function StartScreen({ modes, onPlay, gear, lockerRoom = null }: Props) {
  const text = t();
  const canFullscreen = document.fullscreenEnabled === true;
  return (
    <main className="start" lang="de" data-testid="start">
      <div className="top-right">
        {gear}
        {canFullscreen && (
          <button type="button" className="icon-button" aria-label={text.start.fullscreen} onClick={requestFullscreen}>
            <span aria-hidden="true">⛶</span>
          </button>
        )}
      </div>
      <h1 className="start-title">{text.appName}</h1>
      <div className="start-modes">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            className="mode-button"
            data-mode={mode}
            aria-keyshortcuts={modeKey(mode)}
            onClick={() => onPlay(mode)}
          >
            {text.start.modes[mode]}
            <span className="mode-key" aria-hidden="true">
              {modeKey(mode)}
            </span>
          </button>
        ))}
      </div>
      {lockerRoom && (
        <div className="start-locker">
          <span className="star-total" data-testid="star-total" aria-label={text.start.starsLabel(lockerRoom.stars)}>
            {text.start.stars(lockerRoom.stars)}
          </span>
          <button type="button" data-testid="open-locker-room" aria-keyshortcuts="K" onClick={lockerRoom.onOpen}>
            {text.start.lockerRoom}
            <span className="mode-key" aria-hidden="true">
              {' '}
              K
            </span>
          </button>
        </div>
      )}
    </main>
  );
}

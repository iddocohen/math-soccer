// Structure adapted from math-tank src/app/StartScreen.tsx.
/**
 * Start screen (contracts/screens.md "Start", FR-068, FR-075, FR-105): one big "Spielen" button (Enter or Space), a
 * "Zeit-Challenge" button (Z) when the parent allows it, and a "Pokal" button (P) that opens the cup's bracket screen
 * (amendment 13, FR-105; CupBracket.tsx). The button carries the cup state as `data-cup-*`. Each button shows its key in small muted text (FR-101). The keys, and `?start=` in tests, are handled by the app's keyboard
 * listener (src/app/keyboard.ts).
 *
 * The gear sits at the top right; the parent gate (T041) passes it in as `gear` and opens the parent menu after a
 * 2-second press. The fullscreen button shows only where the browser lets a page use fullscreen.
 *
 * Modes to unlock (amendment 21, FR-141): below the start buttons, one button per mode the parent allows ("Spielarten
 * erlauben"): "Mauer" (M), "Torwart" (T), "Elfmeter" (E). An unlocked mode starts with a tap or its key; one whose game
 * comes later says "kommt bald" and does nothing. A locked mode shows greyed with a lock and its price, and a tap opens
 * the locker room at "Spielarten". Each carries `data-start=<mode>` and `data-mode-state` (ready, soon, locked).
 *
 * With the locker room on (FR-044), a "Kabine" button (K) and the star total (`data-testid="star-total"`) show below
 * the start buttons; with it off, both are hidden.
 *
 * Notices (FR-036, review H5 and M6): when stored data was reset on load, or a save failed during play, a short note
 * shows below the title with "OK" to close it. It never blocks the start buttons or their keys.
 */
import type { ReactNode } from 'react';
import type { ModeButton } from '../core/rewards/modes';
import { t } from '../i18n';
import type { StartKind } from './keyboard';

/** Asks the browser for fullscreen; a refusal leaves the game as it is. */
export function requestFullscreen(): void {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen().catch(() => {
    // Some browsers refuse fullscreen; the game still works.
  });
}

interface Props {
  /** The parent allows the time challenge: its button shows. */
  timeChallenge: boolean;
  onPlay: (kind: StartKind) => void;
  gear?: ReactNode;
  /** The cup's next match: the cup number, its stage (0 to 4) and the lost tries of that match. */
  cup?: { cup: number; stage: number; tries: number } | null;
  /** The star balance and how to open the locker room; null when the parent turned the locker room off. */
  lockerRoom?: { stars: number; onOpen: () => void } | null;
  /** The buttons of the modes to unlock (amendment 21); `onOpenModes` opens the locker room at "Spielarten". */
  modes?: { buttons: readonly ModeButton[]; onOpenModes: () => void };
  /** Short notes for the parent, each a list of lines, closed with "OK"; nothing shows when empty. */
  notices?: ReadonlyArray<{ id: string; lines: readonly string[]; onDismiss: () => void }>;
}

export function StartScreen({ timeChallenge, onPlay, gear, cup = null, lockerRoom = null, modes, notices = [] }: Props) {
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
      {notices.length > 0 && (
        <div className="start-notices" role="status" aria-live="polite">
          {notices.map((n) => (
            <div key={n.id} className="notice warn" data-testid={`start-notice-${n.id}`}>
              {n.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <button type="button" className="secondary-button" onClick={n.onDismiss}>
                {text.start.dismiss}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="start-buttons">
        <button type="button" className="start-button" data-start="play" aria-keyshortcuts="Enter Space" onClick={() => onPlay('play')}>
          {text.start.play}
          <span className="start-key" aria-hidden="true">
            Enter
          </span>
        </button>
        {timeChallenge && (
          <button type="button" className="start-button" data-start="time" aria-keyshortcuts="Z" onClick={() => onPlay('time')}>
            {text.start.timeChallenge}
            <span className="start-key" aria-hidden="true">
              Z
            </span>
          </button>
        )}
        {cup && (
          <button
            type="button"
            className="start-button"
            data-start="cup"
            data-cup-number={cup.cup}
            data-cup-stage={cup.stage}
            aria-keyshortcuts="P"
            onClick={() => onPlay('cup')}
          >
            {text.start.cup}
            <span className="start-key" aria-hidden="true">
              P
            </span>
          </button>
        )}
      </div>
      {modes && modes.buttons.length > 0 && (
        <div className="start-buttons start-modes">
          {modes.buttons.map((b) => {
            const name = text.start.modes[b.mode];
            const onClick = () => {
              if (b.state === 'ready') onPlay(b.mode);
              else if (b.state === 'locked') modes.onOpenModes();
            };
            return (
              <button
                key={b.mode}
                type="button"
                className="start-button start-mode"
                data-start={b.mode}
                data-mode-state={b.state}
                aria-keyshortcuts={b.state === 'soon' ? undefined : b.key}
                aria-disabled={b.state === 'soon' ? 'true' : undefined}
                aria-label={b.state === 'locked' ? text.start.modeLocked(name, b.price) : undefined}
                onClick={onClick}
              >
                <span>
                  {b.state === 'locked' && (
                    <span className="start-lock" aria-hidden="true">
                      🔒{' '}
                    </span>
                  )}
                  {name}
                </span>
                <span className="start-key" aria-hidden="true">
                  {b.state === 'locked' ? `${text.lockerRoom.price(b.price)} · ${b.key}` : b.state === 'soon' ? text.start.soon : b.key}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {lockerRoom && (
        <div className="start-locker">
          <span className="star-total" data-testid="star-total" aria-label={text.start.starsLabel(lockerRoom.stars)}>
            {text.start.stars(lockerRoom.stars)}
          </span>
          <button type="button" data-testid="open-locker-room" aria-keyshortcuts="K" onClick={lockerRoom.onOpen}>
            {text.start.lockerRoom}
            <span className="start-key" aria-hidden="true">
              {' '}
              K
            </span>
          </button>
        </div>
      )}
    </main>
  );
}

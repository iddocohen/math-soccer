// Copied from math-tank src/app/ParentGate.tsx.
/**
 * Parent gate (FR-034, contracts/screens.md "Parent gate"): the gear opens the parent menu only after a 2-second press
 * with mouse or touch. A short tap or any key does nothing: the gear is out of the tab order, ignores keys and has
 * no click handler. While pressed, a ring around the gear fills up.
 *
 * The menu offers "Einstellungen" and "Fortschritt". `onOpen` runs when the menu opens (the app pauses the
 * game), `onClose` when it is closed with "Schließen" (the app resumes), `onSettings` when the parent picks
 * "Einstellungen" and `onProgress` when the parent picks "Fortschritt" (the menu closes and the app shows that page,
 * which resumes the game when it closes).
 */
import { useState } from 'react';
import { t } from '../i18n';
import { noFocus } from './noFocus';
import { useHold } from './useHold';

export { HOLD_MS } from './useHold';
const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface Props {
  /**
   * Whether the menu shows, when the app keeps that state (the start screen and the match each have a gear). Without
   * it, the gate keeps its own state.
   */
  open?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSettings: () => void;
  onProgress: () => void;
}

export function ParentGate({ open: openFromApp, onOpen, onClose, onSettings, onProgress }: Props) {
  const m = t();
  const [ownOpen, setOpen] = useState(false);
  const open = openFromApp ?? ownOpen;
  const { progress, handlers } = useHold(() => {
    setOpen(true);
    onOpen();
  }, !open);

  const close = () => {
    setOpen(false);
    onClose();
  };

  const settings = () => {
    setOpen(false);
    onSettings();
  };

  const progressPage = () => {
    setOpen(false);
    onProgress();
  };

  return (
    <>
      <button
        type="button"
        className="icon-button parent-gate"
        data-testid="parent-gate"
        aria-label={m.start.gear}
        title={m.start.parentHint}
        {...noFocus}
        {...handlers}
      >
        <svg className="parent-gate-ring" data-testid="parent-gate-ring" data-progress={progress} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r={RING_RADIUS} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - progress)} />
        </svg>
        <span aria-hidden="true">⚙</span>
      </button>
      {open && (
        <div className="parent-menu-backdrop">
          <div className="parent-menu" role="dialog" aria-modal="true" aria-label={m.parent.title}>
            <h2>{m.parent.title}</h2>
            <button type="button" className="primary-button" onClick={settings}>
              {m.parent.settings}
            </button>
            <button type="button" className="secondary-button" onClick={progressPage}>
              {m.parent.progress}
            </button>
            <button type="button" className="secondary-button" onClick={close}>
              {m.parent.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

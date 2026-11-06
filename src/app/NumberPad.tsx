// Copied from math-tank src/app/NumberPad.tsx. No minus key (the ranges have no negative numbers); a shoot key takes the
// place of math-tank's fire button. The rule for "automatic" (numberPadShown) and the pointer hook come from math-tank
// src/core/view/screen.ts and src/app/useScreen.ts, trimmed to the pointer query.
/**
 * On-screen number pad (FR-031): keys 0 to 9, ⌫ and "Schießen". Each key calls the same controller method as the
 * keyboard (digits and Backspace through `typeKey`, the shoot key through `shoot`).
 *
 * Keys never take focus (tabIndex -1, mousedown default prevented), so a physical keyboard keeps working next to the
 * pad. Each key has a grid area (`d0` to `d9`, `bs`, `sh`), so the stylesheet orders them per layout: a phone-style
 * block (1 2 3 / 4 5 6 / 7 8 9 / ⌫ 0 shoot) at the bottom right when the screen is wider than high, two rows across
 * the bottom when it is higher than wide.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Digit } from '../core/match/entry';
import type { Settings } from '../core/settings/schema';
import { t } from '../i18n';

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/** The media query of a mouse or trackpad; without one, the device counts as a touch device. */
export const FINE_POINTER_QUERY = '(any-pointer: fine)';

/** Whether the pad shows: always, never, or with "automatic" only on a device without a fine pointer (touch). */
export function numberPadShown(setting: Settings['numberPad'], finePointer: boolean): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  return !finePointer;
}

/** True when the device has a mouse or trackpad; follows changes (a keyboard cover with a trackpad on an iPad). */
export function useFinePointer(): boolean {
  const read = () => (typeof window.matchMedia === 'function' ? window.matchMedia(FINE_POINTER_QUERY).matches : true);
  const [fine, setFine] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(FINE_POINTER_QUERY);
    const onChange = () => setFine(list.matches);
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, []);
  return fine;
}

interface Props {
  /** True while the child cannot shoot (ball in flight, pause, round end). */
  disabled: boolean;
  onDigit: (d: Digit) => void;
  onBackspace: () => void;
  onShoot: () => void;
}

export function NumberPad({ disabled, onDigit, onBackspace, onShoot }: Props) {
  const m = t().match;
  return (
    <div className="number-pad" data-testid="number-pad" role="group" aria-label={m.numberPad.label}>
      {DIGITS.map((d) => (
        <PadKey key={d} name={String(d)} area={`d${d}`} disabled={disabled} onPress={() => onDigit(d)}>
          {d}
        </PadKey>
      ))}
      <PadKey name="backspace" area="bs" label={m.numberPad.delete} disabled={disabled} onPress={onBackspace}>
        ⌫
      </PadKey>
      <PadKey name="shoot" area="sh" label={m.numberPad.shoot} disabled={disabled} onPress={onShoot}>
        ⚽
      </PadKey>
    </div>
  );
}

function PadKey({ name, area, label, disabled, onPress, children }: { name: string; area: string; label?: string; disabled: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`pad-key pad-key-${name}`}
      data-testid="pad-key"
      data-key={name}
      aria-label={label}
      style={{ gridArea: area }}
      tabIndex={-1}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

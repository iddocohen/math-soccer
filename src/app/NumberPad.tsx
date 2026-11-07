// Copied from math-tank src/app/NumberPad.tsx. No minus key (the ranges have no negative numbers); a shoot key takes the
// place of math-tank's fire button. Whether the pad shows is decided in src/core/view/screen.ts and src/app/useScreen.ts
// (amendment 16).
/**
 * On-screen number pad (FR-031): keys 0 to 9, ⌫ and "Schießen". Each key calls the same controller method as the
 * keyboard (digits and Backspace through `typeKey`, the shoot key through `shoot`).
 *
 * Keys never take focus (tabIndex -1, mousedown default prevented), so a physical keyboard keeps working next to the
 * pad. Each key has a grid area (`d0` to `d9`, `bs`, `sh`), so the stylesheet orders them per layout: a phone-style
 * block (1 2 3 / 4 5 6 / 7 8 9 / ⌫ 0 shoot) at the bottom right when the screen is wider than high, two rows across
 * the bottom when it is higher than wide.
 */
import type { ReactNode } from 'react';
import type { Digit } from '../core/match/entry';
import { t } from '../i18n';
import { noFocus } from './noFocus';

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

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
      disabled={disabled}
      {...noFocus}
      onKeyDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

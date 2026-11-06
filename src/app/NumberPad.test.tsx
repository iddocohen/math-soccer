// Copied from math-tank src/app/NumberPad.test.tsx; the minus key tests are replaced by the shoot key and the
// automatic setting.
/**
 * FR-031: the on-screen number pad. Its keys act like the keyboard's digits, Backspace and Enter, never take focus,
 * and are at least 48 by 48 CSS pixels through the class `pad-key`.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { NumberPad, numberPadShown } from './NumberPad';

function setup(over: { disabled?: boolean } = {}) {
  const onDigit = vi.fn();
  const onBackspace = vi.fn();
  const onShoot = vi.fn();
  render(<NumberPad disabled={over.disabled ?? false} onDigit={onDigit} onBackspace={onBackspace} onShoot={onShoot} />);
  return { onDigit, onBackspace, onShoot };
}

const key = (k: string) => screen.getByTestId('number-pad').querySelector(`[data-key="${k}"]`) as HTMLButtonElement | null;

afterEach(cleanup);

describe('NumberPad (FR-031)', () => {
  it('has the keys 0 to 9, ⌫ and the shoot key, and no minus key', () => {
    setup();
    const keys = screen.getAllByTestId('pad-key').map((b) => b.getAttribute('data-key'));
    expect([...keys].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace', 'shoot'].sort());
    expect(key('minus')).toBeNull();
    expect(key('backspace')!.getAttribute('aria-label')).toBe(t().match.numberPad.delete);
    expect(key('shoot')!.getAttribute('aria-label')).toBe(t().match.numberPad.shoot);
  });

  it('taps type digits, ⌫ deletes and the shoot key shoots, like the keyboard', () => {
    const { onDigit, onBackspace, onShoot } = setup();
    fireEvent.click(key('4')!);
    fireEvent.click(key('6')!);
    fireEvent.click(key('backspace')!);
    fireEvent.click(key('shoot')!);
    expect(onDigit.mock.calls).toEqual([[4], [6]]);
    expect(onBackspace).toHaveBeenCalledTimes(1);
    expect(onShoot).toHaveBeenCalledTimes(1);
  });

  it('keys never take focus and carry the pad-key class (48 by 48 CSS pixels at least)', () => {
    setup();
    for (const b of screen.getAllByTestId('pad-key')) {
      expect(b.getAttribute('tabindex')).toBe('-1');
      expect(b.classList.contains('pad-key')).toBe(true);
      expect(b.getAttribute('type')).toBe('button');
    }
  });

  it('disabled keys do nothing', () => {
    const { onDigit, onShoot } = setup({ disabled: true });
    fireEvent.click(key('5')!);
    fireEvent.click(key('shoot')!);
    expect(key('5')!.disabled).toBe(true);
    expect(onDigit).not.toHaveBeenCalled();
    expect(onShoot).not.toHaveBeenCalled();
  });
});

describe('numberPadShown (FR-031)', () => {
  it('always and never ignore the device', () => {
    for (const fine of [true, false]) {
      expect(numberPadShown('always', fine)).toBe(true);
      expect(numberPadShown('never', fine)).toBe(false);
    }
  });

  it('automatic shows the pad only without a mouse or trackpad (touch devices)', () => {
    expect(numberPadShown('auto', false)).toBe(true);
    expect(numberPadShown('auto', true)).toBe(false);
  });
});

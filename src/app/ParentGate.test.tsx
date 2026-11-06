// Copied from math-tank src/app/ParentGate.test.tsx.
/**
 * Parent gate (FR-034): only a 2-second press with mouse or touch opens
 * the parent menu; a short tap or any key does nothing.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { HOLD_MS, ParentGate } from './ParentGate';

const m = t();

function setup() {
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const onSettings = vi.fn();
  const onProgress = vi.fn();
  render(<ParentGate onOpen={onOpen} onClose={onClose} onSettings={onSettings} onProgress={onProgress} />);
  const gear = screen.getByTestId('parent-gate');
  return { onOpen, onClose, onSettings, onProgress, gear };
}

const menu = () => screen.queryByRole('dialog', { name: m.parent.title });

function hold(gear: HTMLElement, ms: number) {
  fireEvent.pointerDown(gear, { pointerId: 1, button: 0 });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ParentGate', () => {
  it('needs a hold of 2000 ms', () => {
    expect(HOLD_MS).toBe(2000);
  });

  it('a press released after 500 ms does not open the menu', () => {
    const { gear, onOpen } = setup();
    hold(gear, 500);
    fireEvent.pointerUp(gear, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(menu()).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('a press held for 2000 ms opens the menu and calls onOpen', () => {
    const { gear, onOpen } = setup();
    hold(gear, 2000);
    expect(menu()).not.toBeNull();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: m.parent.settings })).toBeTruthy();
  });

  it('releasing at 1900 ms cancels', () => {
    const { gear, onOpen } = setup();
    hold(gear, 1900);
    fireEvent.pointerUp(gear, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(menu()).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('leaving the gear or a cancelled pointer cancels the press', () => {
    const { gear, onOpen } = setup();
    hold(gear, 1000);
    fireEvent.pointerLeave(gear, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    hold(gear, 1000);
    fireEvent.pointerCancel(gear, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows the filling ring while held and empties it on release', () => {
    const { gear } = setup();
    const ring = screen.getByTestId('parent-gate-ring');
    expect(Number(ring.dataset.progress)).toBe(0);
    hold(gear, 1000);
    expect(Number(ring.dataset.progress)).toBeGreaterThanOrEqual(0.4);
    expect(Number(ring.dataset.progress)).toBeLessThan(0.6);
    fireEvent.pointerUp(gear, { pointerId: 1 });
    expect(Number(ring.dataset.progress)).toBe(0);
  });

  it('with the gear focused, Enter, Space or a key held for 3 s does not open it', () => {
    const { gear, onOpen } = setup();
    expect(gear.tabIndex).toBe(-1);
    gear.focus();
    for (const key of ['Enter', ' ', 'a', 'g']) {
      fireEvent.keyDown(gear, { key });
      for (let i = 0; i < 30; i++) {
        fireEvent.keyDown(gear, { key, repeat: true });
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }
      fireEvent.keyUp(gear, { key });
    }
    // A click without a press (as from a keyboard activation) does nothing either.
    fireEvent.click(gear);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(menu()).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('the menu offers "Fortschritt", which closes the menu and calls onProgress', () => {
    const { gear, onProgress, onClose } = setup();
    hold(gear, 2000);
    const progress = screen.getByRole('button', { name: m.parent.progress }) as HTMLButtonElement;
    expect(progress.disabled).toBe(false);
    fireEvent.click(progress);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the menu offers "Einstellungen"', () => {
    const { gear, onSettings, onClose } = setup();
    hold(gear, 2000);
    fireEvent.click(screen.getByRole('button', { name: m.parent.settings }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('"Schließen" closes the menu and calls onClose', () => {
    const { gear, onClose } = setup();
    hold(gear, 2000);
    fireEvent.click(screen.getByRole('button', { name: m.parent.close }));
    expect(menu()).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('with `open` from the app, the menu follows it, so a menu opened on another gear stays open', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ParentGate open={true} onOpen={vi.fn()} onClose={onClose} onSettings={vi.fn()} onProgress={vi.fn()} />);
    expect(menu()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: m.parent.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<ParentGate open={false} onOpen={vi.fn()} onClose={onClose} onSettings={vi.fn()} onProgress={vi.fn()} />);
    expect(menu()).toBeNull();
  });
});

// Copied from math-tank src/app/TransferDialog.test.tsx.
/**
 * The dialog shown when the game opens with a save link (FR-041): "Übernehmen" needs a
 * 2-second hold like the parent gate; a short tap and keys do nothing; "Abbrechen" changes nothing.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { TransferDialog } from './TransferDialog';

const m = t();
const SUMMARY = { stars: 37, record: 4, min: 550, max: 780 };

function setup(state: Parameters<typeof TransferDialog>[0]['state'] = { kind: 'ready', summary: SUMMARY }) {
  const onAccept = vi.fn();
  const onCancel = vi.fn();
  render(<TransferDialog state={state} onAccept={onAccept} onCancel={onCancel} />);
  return { onAccept, onCancel };
}

const accept = () => screen.getByRole('button', { name: m.transfer.accept });

function press(el: HTMLElement, ms: number) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
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

describe('TransferDialog', () => {
  it('names the stars, the record and the range', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: m.transfer.receiveTitle });
    expect(dialog.textContent).toContain('37 Sterne, Rekord 4 Tore, Zahlenraum 550 bis 780');
    expect(dialog.textContent).toContain(m.transfer.holdHint);
  });

  it('a short press on "Übernehmen" does nothing', () => {
    const { onAccept } = setup();
    press(accept(), 500);
    fireEvent.pointerUp(accept(), { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('a 2-second hold on "Übernehmen" calls onAccept once', () => {
    const { onAccept } = setup();
    press(accept(), 1000);
    expect(Number(screen.getByTestId('transfer-accept-ring').getAttribute('data-progress'))).toBeGreaterThan(0.3);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(onAccept).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('leaving the button stops the hold', () => {
    const { onAccept } = setup();
    press(accept(), 1000);
    fireEvent.pointerLeave(accept(), { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('Enter, Space and a click do nothing on "Übernehmen"', () => {
    const { onAccept } = setup();
    fireEvent.keyDown(accept(), { key: 'Enter' });
    fireEvent.keyDown(accept(), { key: ' ' });
    fireEvent.click(accept());
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('"Abbrechen" calls onCancel', () => {
    const { onAccept, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: m.transfer.decline }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('an invalid code says so and "Schließen" calls onCancel', () => {
    const { onAccept, onCancel } = setup({ kind: 'invalid' });
    expect(screen.getByRole('dialog').textContent).toContain(m.transfer.invalid);
    expect(screen.queryByRole('button', { name: m.transfer.accept })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: m.transfer.close }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('a failed take-over says that nothing changed and offers only "Schließen"', () => {
    const { onCancel } = setup({ kind: 'failed' });
    expect(screen.getByTestId('transfer-dialog').textContent).toContain(m.transfer.saveFailed);
    expect(screen.queryByRole('button', { name: m.transfer.accept })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: m.transfer.close }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('a take-over that stored only part of the save says so, not that nothing changed (review H6)', () => {
    const { onCancel } = setup({ kind: 'partial' });
    const text = screen.getByTestId('transfer-dialog').textContent!;
    expect(text).toContain(m.transfer.savePartial);
    expect(text).not.toContain('nichts geändert');
    fireEvent.click(screen.getByRole('button', { name: m.transfer.close }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

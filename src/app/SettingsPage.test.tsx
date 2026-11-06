// Structure adapted from math-tank src/app/SettingsPage.test.tsx.
/**
 * Settings page (T044, T046, FR-035, FR-041): every group, Save disabled while invalid with errors next to the fields,
 * saving through persistence, and the data group with "Daten sichern", "Daten laden" and the transfer link.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import { exportData } from '../core/storage/exportImport';
import { memoryKeyValue } from '../core/storage/keyValue';
import { emptyLockerRoom, emptyProgress, emptyRecords } from '../core/storage/schemas';
import { loadSettings } from '../core/storage/storage';
import { t } from '../i18n';
import { createPersistence } from './persistence';
import { SettingsPage } from './SettingsPage';

const S = t().settings;

function setup() {
  const kv = memoryKeyValue();
  const persistence = createPersistence(kv);
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<SettingsPage persistence={persistence} onSaved={onSaved} onClose={onClose} now={() => new Date('2026-11-06T12:00:00Z')} />);
  return { kv, persistence, onSaved, onClose };
}

const saveButton = () => screen.getByRole('button', { name: S.save }) as HTMLButtonElement;
const group = (name: string) => screen.getByRole('group', { name });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SettingsPage (T044, FR-035)', () => {
  it('shows the ten groups in order', () => {
    setup();
    const legends = screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent);
    expect(legends).toEqual([
      'Zahlenraum',
      'Spielarten',
      'Hinweise',
      'Reihen',
      'Runde',
      'Schwierigkeit',
      'Ton',
      'Bedienung',
      'Kabine',
      'Daten',
    ]);
  });

  it('saves a custom range of 200 to 500 and hands it to the app', () => {
    const { kv, onSaved } = setup();
    fireEvent.change(within(group('Zahlenraum')).getByLabelText(S.labels.rangePreset), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(S.labels.rangeMin), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText(S.labels.rangeMax), { target: { value: '500' } });
    fireEvent.click(saveButton());
    expect(loadSettings(kv).value.range).toEqual({ preset: 'custom', min: 200, max: 500 });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ range: { preset: 'custom', min: 200, max: 500 } }));
    expect(screen.getByText(S.saved)).toBeTruthy();
  });

  it('disables Save while invalid and shows the error next to the field', () => {
    setup();
    fireEvent.change(screen.getByLabelText(S.labels.rangePreset), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(S.labels.rangeMax), { target: { value: '5' } });
    expect(saveButton().disabled).toBe(true);
    expect(within(group('Zahlenraum')).getByText(t().settingsErrors.rangeSpan)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(S.labels.rangeMax), { target: { value: '50' } });
    expect(saveButton().disabled).toBe(false);
  });

  it('needs at least one mode, one hint distance and one line direction', () => {
    setup();
    const modes = group('Spielarten');
    for (const name of ['Löcher', 'Reihen', 'Torwart']) fireEvent.click(within(modes).getByLabelText(name));
    expect(within(modes).getByText(t().settingsErrors.noMode)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('shows "Tore pro Runde" only with a fixed number of goals and checks its limits', () => {
    setup();
    expect(screen.queryByLabelText(S.labels.goalsPerRound)).toBeNull();
    fireEvent.change(screen.getByLabelText(S.labels.roundType), { target: { value: 'goalCount' } });
    fireEvent.change(screen.getByLabelText(S.labels.goalsPerRound), { target: { value: '21' } });
    expect(screen.getByText(t().settingsErrors.goalsPerRound)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('"Schließen" calls onClose without saving', () => {
    const { kv, onClose, onSaved } = setup();
    fireEvent.click(screen.getByLabelText(S.labels.showClock));
    fireEvent.click(screen.getByRole('button', { name: t().parent.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(loadSettings(kv).value.showClock).toBe(false);
  });
});

describe('data group (T046, FR-041)', () => {
  it('"Daten laden" stores a valid file and reports it; a wrong file changes nothing', async () => {
    const { kv, onSaved } = setup();
    const input = screen.getByTestId('import-file') as HTMLInputElement;
    const text = exportData({
      settings: { ...defaultSettings(), showClock: true },
      progress: emptyProgress(),
      records: emptyRecords(),
      lockerRoom: { ...emptyLockerRoom(), stars: 5 },
    });
    fireEvent.change(input, { target: { files: [new File([text], 'save.json')] } });
    await waitFor(() => expect(screen.getByText(S.data.imported)).toBeTruthy());
    expect(loadSettings(kv).value.showClock).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { files: [new File(['nope'], 'x.json')] } });
    await waitFor(() => expect(screen.getByText(S.data.importFailed.notJson)).toBeTruthy());
    expect(loadSettings(kv).value.showClock).toBe(true);
  });

  it('"Daten sichern" downloads a dated file', () => {
    setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    fireEvent.click(screen.getByRole('button', { name: S.data.export }));
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('mathe-fussball-2026-11-06.json');
  });

  it('shows a transfer link with #save= and a QR code', async () => {
    setup();
    const transfer = screen.getByTestId('transfer');
    await waitFor(() => expect(transfer.getAttribute('data-transfer-link')).toMatch(/#save=v1\./));
    expect(screen.getByTestId('transfer-qr')).toBeTruthy();
  });
});

describe('SettingsPage: kept copies (amendment 01, FR-050)', () => {
  const COPY = 'mathsoccer.lockerroom.v1.unreadable';

  it('offers a readable kept copy, restores it and reloads', () => {
    const kv = memoryKeyValue({ [COPY]: JSON.stringify({ ...emptyLockerRoom(), stars: 30, totalEarned: 30 }) });
    const onRestored = vi.fn();
    render(<SettingsPage persistence={createPersistence(kv)} onSaved={() => {}} onClose={() => {}} onRestored={onRestored} />);
    expect(screen.getByTestId('backup-notice').textContent).toContain('Sterne und Kabine');
    fireEvent.click(screen.getByRole('button', { name: t().parent.restoreBackup }));
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(JSON.parse(kv.get('mathsoccer.lockerroom.v1')!)).toMatchObject({ stars: 30 });
    expect(kv.get(COPY)).toBeNull();
  });

  it('shows a notice and changes nothing when the restore cannot be saved', () => {
    const inner = memoryKeyValue({ [COPY]: JSON.stringify({ ...emptyLockerRoom(), stars: 30, totalEarned: 30 }) });
    const kv = {
      get: (k: string) => inner.get(k),
      set: (k: string, v: string) => {
        if (k === 'mathsoccer.lockerroom.v1') throw new DOMException('quota', 'QuotaExceededError');
        inner.set(k, v);
      },
      remove: (k: string) => inner.remove(k),
    };
    const onRestored = vi.fn();
    render(<SettingsPage persistence={createPersistence(kv)} onSaved={() => {}} onClose={() => {}} onRestored={onRestored} />);
    fireEvent.click(screen.getByRole('button', { name: t().parent.restoreBackup }));
    expect(onRestored).not.toHaveBeenCalled();
    expect(screen.getByText(t().parent.restoreFailed)).toBeTruthy();
    expect(inner.get(COPY)).not.toBeNull();
  });

  it('offers nothing without a readable copy', () => {
    render(<SettingsPage persistence={createPersistence(memoryKeyValue({ [COPY]: '{"stars":' }))} onSaved={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('backup-notice')).toBeNull();
  });
});

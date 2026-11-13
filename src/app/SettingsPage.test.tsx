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
import { emptyCup, emptyLockerRoom, emptyProgress, emptyRecords } from '../core/storage/schemas';
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
  it('shows the eleven groups in order, without "Spielarten", "Hinweis-Muster" or "Richtungen" (FR-069, amendment 09)', () => {
    setup();
    const legends = screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent);
    expect(legends).toEqual([
      'Zahlenraum',
      'Hinweise',
      'Formen',
      'Runde',
      'Zeit-Challenge',
      'Pokal',
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

  it('"Schwierigkeit" sets "Stufe am Anfang" and "Schwerste Stufe" with an example drawing per level (FR-085)', () => {
    const { kv } = setup();
    const difficulty = group('Schwierigkeit');
    const start = within(difficulty).getByLabelText(S.labels.startLevel) as HTMLSelectElement;
    const hardest = within(difficulty).getByLabelText(S.labels.hardestLevel) as HTMLSelectElement;
    expect([...start.options].map((o) => o.textContent)).toEqual([
      'Stufe 1: Gerade Linien',
      'Stufe 2: Schräge Linien',
      'Stufe 3: Formen',
      'Stufe 4: Formen mit 2 Lücken',
      'Stufe 5: X-Form',
      'Stufe 6: Ausschnitte',
    ]);
    expect([start.value, hardest.value]).toEqual(['1', '6']);
    // The shots per ball stay in the same group.
    expect(within(difficulty).getByLabelText(S.labels.difficulty)).toBeTruthy();
    const examples = within(difficulty).getByTestId('level-examples');
    expect(examples.querySelectorAll('li svg')).toHaveLength(6);
    // Level 6 shows a 3×3 cutout with one given number (amendment 18, FR-129).
    expect(examples.querySelector('li[data-level="6"] svg text')?.textContent).toBe('68');
    expect(examples.querySelectorAll('li[data-level="6"] .level-example-empty')).toHaveLength(8);
    fireEvent.change(hardest, { target: { value: '2' } });
    expect(examples.querySelector('li[data-level="3"]')?.getAttribute('data-in-range')).toBe('false');
    fireEvent.click(saveButton());
    expect(loadSettings(kv).value.levels).toEqual({ start: 1, hardest: 2 });
  });

  it('refuses a start level above the hardest level', () => {
    setup();
    const difficulty = group('Schwierigkeit');
    fireEvent.change(within(difficulty).getByLabelText(S.labels.startLevel), { target: { value: '4' } });
    fireEvent.change(within(difficulty).getByLabelText(S.labels.hardestLevel), { target: { value: '3' } });
    expect(within(difficulty).getByText(t().settingsErrors.levelOrder)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('"Formen" lists the seven shapes as switches, all on; all off skips levels 3 and 4 (FR-074, amendment 09)', () => {
    const { kv } = setup();
    const shapes = group('Formen');
    const names = ['Stab', 'Quadrat', 'T', 'L', 'J', 'S', 'Z'];
    expect(within(shapes).getAllByRole('checkbox')).toHaveLength(7);
    for (const name of names) expect((within(shapes).getByLabelText(name) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(shapes).getByLabelText('L'));
    fireEvent.click(saveButton());
    expect(loadSettings(kv).value.shapes.L).toBe(false);
    for (const name of names.filter((n) => n !== 'L')) fireEvent.click(within(shapes).getByLabelText(name));
    expect(saveButton().disabled).toBe(false);
    // Only levels 3 and 4 with no shape would offer nothing.
    const difficulty = group('Schwierigkeit');
    fireEvent.change(within(difficulty).getByLabelText(S.labels.startLevel), { target: { value: '3' } });
    fireEvent.change(within(difficulty).getByLabelText(S.labels.hardestLevel), { target: { value: '4' } });
    expect(within(difficulty).getByText(t().settingsErrors.noLevel)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('"Zeit-Challenge" turns the challenge off and sets 1, 2, 3 or 5 minutes (FR-076)', () => {
    const { kv } = setup();
    const challenge = group('Zeit-Challenge');
    const allowed = within(challenge).getByLabelText(S.labels.timeChallengeAllowed) as HTMLInputElement;
    expect(allowed.checked).toBe(true);
    const minutes = within(challenge).getByLabelText(S.labels.timeChallengeMinutes) as HTMLSelectElement;
    expect([...minutes.options].map((o) => o.textContent)).toEqual(['1 Minute', '2 Minuten', '3 Minuten', '5 Minuten']);
    expect(minutes.value).toBe('2');
    fireEvent.change(minutes, { target: { value: '5' } });
    fireEvent.click(allowed);
    fireEvent.click(saveButton());
    expect(loadSettings(kv).value.timeChallenge).toEqual({ allowed: false, minutes: 5 });
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
      cup: emptyCup(),
    });
    fireEvent.change(input, { target: { files: [new File([text], 'save.json')] } });
    await waitFor(() => expect(screen.getByText(S.data.imported)).toBeTruthy());
    expect(loadSettings(kv).value.showClock).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { files: [new File(['nope'], 'x.json')] } });
    await waitFor(() => expect(screen.getByText(S.data.importFailed.notJson)).toBeTruthy());
    expect(loadSettings(kv).value.showClock).toBe(true);
  });

  it('"Daten laden" that stored only part of the file says so, not that nothing changed (review H6)', async () => {
    const real = createPersistence(memoryKeyValue());
    const persistence = { ...real, importText: () => ({ ok: false as const, reason: 'storePartial' as const }) };
    render(<SettingsPage persistence={persistence} onSaved={() => {}} onClose={() => {}} />);
    const input = screen.getByTestId('import-file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([real.exportText()], 'save.json')] } });
    await waitFor(() => expect(screen.getByText(S.data.importFailed.storePartial)).toBeTruthy());
    expect(screen.queryByText(S.data.importFailed.storeFailed)).toBeNull();
  });

  it('"Daten sichern" downloads a dated file', () => {
    setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    fireEvent.click(screen.getByRole('button', { name: S.data.export }));
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('mathe-kicker-2026-11-06.json');
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

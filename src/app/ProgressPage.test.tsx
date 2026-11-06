/**
 * Progress page (T045, FR-039) and the persistence it reads (T043): a row per direction, the personal bests, and a reset
 * that asks first and keeps the stars and the bests.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import { memoryKeyValue } from '../core/storage/keyValue';
import { emptyLockerRoom, emptyProgress, emptyRecords, type AttemptRecord } from '../core/storage/schemas';
import { loadLockerRoom, loadProgress, loadRecords, saveLockerRoom, saveRecords } from '../core/storage/storage';
import { t } from '../i18n';
import { createPersistence } from './persistence';
import { ProgressPage } from './ProgressPage';

const P = t().progressPage;

function attempt(extra: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    at: '2026-11-06T12:00:00.000Z',
    mode: 'keeper',
    min: 1,
    max: 100,
    target: 46,
    directions: ['down'],
    hintDistance: { direct: true, vertical: true, diagonal: true, far: true },
    hintDisplay: 'always',
    level: 1,
    solved: true,
    helpStep: 0,
    misses: 0,
    responseMs: 4000,
    guess: false,
    ...extra,
  };
}

function setup() {
  const kv = memoryKeyValue();
  saveLockerRoom(kv, { ...emptyLockerRoom(), stars: 12 });
  const records = emptyRecords();
  records.bests['1-100|keeper|untilHearts'] = { goals: 6, timeMs: 125_000, at: '2026-11-06T12:00:00.000Z' };
  saveRecords(kv, records);
  const persistence = createPersistence(kv);
  persistence.recordAttempt(attempt(), defaultSettings());
  persistence.recordAttempt(attempt({ helpStep: 1 }), defaultSettings());
  persistence.recordAttempt(attempt({ directions: ['right'] }), defaultSettings());
  render(<ProgressPage persistence={persistence} onClose={() => {}} />);
  return { kv };
}

afterEach(cleanup);

describe('ProgressPage (T045)', () => {
  it('shows attempts, alone, with help and mastery per direction, only for directions with attempts', () => {
    setup();
    const table = screen.getByTestId('progress-table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Richtung', 'Versuche', 'allein', 'mit Hilfe', 'gemeistert']);
    const down = table.querySelector('tr[data-direction="down"]')!;
    const cells = [...down.children].map((c) => c.textContent);
    expect(cells).toEqual([P.directions.down, '2', '1', '1', P.masteredNo]);
    const right = [...table.querySelector('tr[data-direction="right"]')!.children].map((c) => c.textContent);
    expect(right.slice(1, 4)).toEqual(['1', '1', '0']);
    expect(table.querySelector('tr[data-direction="up"]')).toBeNull();
  });

  it('shows the current level and, per level, the targets solved alone and with help (FR-090)', () => {
    setup();
    const level = screen.getByTestId('progress-level');
    expect(level.getAttribute('data-level')).toBe('1');
    expect(level.textContent).toContain('Stufe jetzt: Stufe 1: Gerade Linien');
    const rows = [...screen.getByTestId('progress-levels').querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual(['Stufe 1: Gerade Linien', '2', '1']);
    expect(rows[4]).toEqual(['Stufe 5: X-Form', '0', '0']);
  });

  it('lists the personal bests', () => {
    setup();
    expect(screen.getByTestId('progress-bests').textContent).toBe('1 bis 100, bis die Bälle weg sind: 6 Tore in 2:05');
  });

  it('asks before resetting, then empties the progress and keeps the stars and the bests', () => {
    const { kv } = setup();
    fireEvent.click(screen.getByRole('button', { name: P.reset }));
    expect(screen.getByRole('alertdialog').textContent).toContain(P.resetConfirm);
    fireEvent.click(screen.getByRole('button', { name: P.resetNo }));
    expect(loadProgress(kv).value.attempts).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: P.reset }));
    fireEvent.click(screen.getByRole('button', { name: P.resetYes }));
    expect(loadProgress(kv).value).toEqual(emptyProgress());
    expect(loadLockerRoom(kv).value.stars).toBe(12);
    expect(screen.getByText(P.resetDone)).toBeTruthy();
    expect(screen.getByText(P.empty)).toBeTruthy();
    expect(screen.getByTestId('progress-bests')).toBeTruthy();
  });

  it('"Alles zurücksetzen" asks first with a reminder to save, then clears progress, bests and stars; the settings stay', () => {
    const { kv } = setup();
    const settingsBefore = kv.get('mathsoccer.settings.v1');
    fireEvent.click(screen.getByRole('button', { name: P.resetAll }));
    const question = screen.getByRole('alertdialog').textContent!;
    expect(question).toContain(P.resetAllConfirm);
    expect(question).toContain('sichert ihn vorher');
    fireEvent.click(screen.getByRole('button', { name: P.resetNo }));
    expect(loadLockerRoom(kv).value.stars).toBe(12);

    fireEvent.click(screen.getByRole('button', { name: P.resetAll }));
    fireEvent.click(screen.getByRole('button', { name: P.resetAllYes }));
    expect(loadProgress(kv).value.attempts).toHaveLength(0);
    expect(loadLockerRoom(kv).value).toEqual(emptyLockerRoom());
    expect(loadRecords(kv).value).toEqual(emptyRecords());
    expect(kv.get('mathsoccer.settings.v1')).toBe(settingsBefore);
    expect(screen.getByText(P.resetAllDone)).toBeTruthy();
    expect(screen.getByText(P.empty)).toBeTruthy();
    expect(screen.getByText(P.noBests)).toBeTruthy();
  });

  it('"Alles zurücksetzen" that stored only part says so, not that nothing changed (review H6)', () => {
    const persistence = { ...createPersistence(memoryKeyValue()), resetAll: () => ({ ok: false, partial: true }) };
    render(<ProgressPage persistence={persistence} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: P.resetAll }));
    fireEvent.click(screen.getByRole('button', { name: P.resetAllYes }));
    expect(screen.getByText(P.resetAllPartial)).toBeTruthy();
    expect(screen.queryByText(P.resetAllFailed)).toBeNull();
  });
});

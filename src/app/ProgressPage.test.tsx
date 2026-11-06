/**
 * Progress page (T045, FR-039) and the persistence it reads (T043): a row per direction with a "früher" total for the
 * removed modes (FR-070), personal bests with the old ones under "Früher", and a reset that asks first and keeps the
 * stars and the bests.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import { memoryKeyValue } from '../core/storage/keyValue';
import { emptyLockerRoom, emptyRecords, type AttemptRecord } from '../core/storage/schemas';
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
    difficultyStep: 0,
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
  records.bests['1-100|holes|untilHearts'] = { goals: 8, timeMs: 340_000, at: '2026-11-06T12:00:00.000Z' };
  saveRecords(kv, records);
  const persistence = createPersistence(kv);
  persistence.recordAttempt(attempt(), defaultSettings());
  persistence.recordAttempt(attempt({ helpStep: 1 }), defaultSettings());
  // Attempts from before amendment 05 (FR-070).
  persistence.recordAttempt(attempt({ mode: 'holes' }), defaultSettings());
  persistence.recordAttempt(attempt({ mode: 'lines' }), defaultSettings());
  persistence.recordAttempt(attempt({ mode: 'lines', directions: ['right'] }), defaultSettings());
  render(<ProgressPage persistence={persistence} onClose={() => {}} />);
  return { kv };
}

afterEach(cleanup);

describe('ProgressPage (T045)', () => {
  it('shows attempts, alone, with help, step and mastery per direction, and the earlier modes as one "früher" total', () => {
    setup();
    const table = screen.getByTestId('progress-table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Richtung', 'Versuche', 'allein', 'mit Hilfe', 'Stufe', 'gemeistert', 'früher']);
    const down = table.querySelector('tr[data-direction="down"]')!;
    const cells = [...down.children].map((c) => c.textContent);
    expect(cells.slice(0, 4)).toEqual([P.directions.down, '2', '1', '1']);
    expect(cells[4]).toContain(P.stepOf(1, 8));
    expect(cells[5]).toBe(P.masteredNo);
    expect(cells[6]).toBe('2');
    // A direction played only in the removed modes still has a row, with no goalkeeper attempts.
    const right = [...table.querySelector('tr[data-direction="right"]')!.children].map((c) => c.textContent);
    expect([right[1], right[6]]).toEqual(['0', '1']);
  });

  it('lists the personal bests, and the bests of the removed modes under "Früher"', () => {
    setup();
    expect(screen.getByTestId('progress-bests').textContent).toBe('1 bis 100, bis die Bälle weg sind: 6 Tore in 2:05');
    expect(screen.getByText(P.earlierBests)).toBeTruthy();
    expect(screen.getByTestId('progress-earlier-bests').textContent).toBe('1 bis 100, Löcher, bis die Bälle weg sind: 8 Tore in 5:40');
  });

  it('asks before resetting, then empties the progress and keeps the stars and the bests', () => {
    const { kv } = setup();
    fireEvent.click(screen.getByRole('button', { name: P.reset }));
    expect(screen.getByRole('alertdialog').textContent).toContain(P.resetConfirm);
    fireEvent.click(screen.getByRole('button', { name: P.resetNo }));
    expect(loadProgress(kv).value.attempts).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: P.reset }));
    fireEvent.click(screen.getByRole('button', { name: P.resetYes }));
    expect(loadProgress(kv).value).toEqual({ version: 1, attempts: [], directions: {} });
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

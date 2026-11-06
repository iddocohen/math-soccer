/**
 * The app shell (T022, T034 to T036): start screen, match overlay, round end, personal bests and keys. The Phaser game
 * is replaced by a stand-in so the app runs in jsdom; the stand-in keeps the controller, so a test can land the ball and
 * end the celebration as MatchScene does.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import type { MatchController } from '../core/match/MatchController';
import { emptyLockerRoom, emptyProgress, emptyRecords } from '../core/storage/schemas';
import { LOCKER_ROOM_KEY, PROGRESS_KEY, RECORDS_KEY, ROUND_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { encodeTransfer } from '../core/transfer/transfer';
import { App, modeFromUrl, seedFromUrl } from './App';

const game = vi.hoisted(() => ({ created: 0, destroyed: 0, controller: null as MatchController | null }));

vi.mock('../game/createGame', () => ({
  createGame: (_parent: HTMLElement, controller: MatchController) => {
    game.created++;
    game.controller = controller;
    return { game: {}, destroy: () => void game.destroyed++ };
  },
}));

beforeEach(() => {
  localStorage.clear();
  game.created = 0;
  game.destroyed = 0;
  game.controller = null;
});

/** Types the target, shoots, and lands the ball and ends the celebration as MatchScene does. */
function scoreGoal(): void {
  const target = screen.getByTestId('match').getAttribute('data-target')!;
  for (const k of target) fireEvent.keyDown(window, { key: k });
  fireEvent.keyDown(window, { key: 'Enter' });
  act(() => {
    game.controller!.ballLanded();
    game.controller!.celebrationDone();
  });
}

afterEach(cleanup);

describe('App', () => {
  it('shows one button per offered mode on the start screen', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), modes: { holes: true, lines: false, keeper: true } }));
    render(<App />);
    expect(screen.getByTestId('start')).toBeTruthy();
    const modes = Array.from(document.querySelectorAll('[data-mode]')).map((b) => b.getAttribute('data-mode'));
    expect(modes).toEqual(['holes', 'keeper']);
  });

  it('key 1 starts hole mode with the canvas under the overlay; digits type and Enter refuses 150', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    const match = screen.getByTestId('match');
    expect(match.getAttribute('data-phase')).toBe('aiming');
    await waitFor(() => expect(game.created).toBe(1));
    for (const k of ['1', '5', '0']) fireEvent.keyDown(window, { key: k });
    expect(screen.getByTestId('entry').textContent).toBe('150');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('message').textContent).toBe('Zahlen von 1 bis 100');
    expect(match.getAttribute('data-phase')).toBe('aiming');
  });

  it('Escape pauses the match and Enter resumes it', () => {
    render(<App />);
    fireEvent.click(document.querySelector('[data-mode="holes"]')!);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('message').textContent).toBe('');
  });

  it('continues a stored round after a refresh: the match shows with the same goals and target', () => {
    const first = render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    const target = screen.getByTestId('match').getAttribute('data-target');
    expect(localStorage.getItem(ROUND_KEY)).not.toBeNull();
    first.unmount();
    render(<App />);
    expect(screen.getByTestId('match').getAttribute('data-target')).toBe(target);
    expect(screen.getByTestId('match').getAttribute('data-goals')).toBe('0');
  });

  it('reads ?seed= and ?mode= for tests', () => {
    expect(seedFromUrl('?seed=42')).toBe(42);
    expect(seedFromUrl('?seed=x')).toBeUndefined();
    expect(modeFromUrl('?mode=keeper')).toBe('keeper');
    expect(modeFromUrl('?mode=penalty')).toBeUndefined();
  });

  it('the match carries the chart rows and the ball kind for tests', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    const match = screen.getByTestId('match');
    expect(match.getAttribute('data-rows')).toBe('10');
    expect(match.getAttribute('data-ball')).toBe('soccer');
    expect(screen.getByTestId('hearts').querySelectorAll('.heart')).toHaveLength(3);
    await waitFor(() => expect(game.controller).not.toBeNull());
  });

  it('the round end shows the result and "Neuer Rekord!", stores the best, and "Nochmal" starts a new round', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    expect(screen.getByTestId('goal-count').textContent).toBe('0 von 1 Toren');
    scoreGoal();
    expect(screen.getByTestId('round-end')).toBeTruthy();
    expect(screen.getByTestId('round-result').textContent).toMatch(/^1 Tor in \d+:\d\d$/);
    expect(screen.getByTestId('new-record').textContent).toBe('Neuer Rekord!');
    const stored = JSON.parse(localStorage.getItem(RECORDS_KEY)!) as { bests: Record<string, { goals: number }> };
    expect(stored.bests['1-100|holes|goalCount']?.goals).toBe(1);

    fireEvent.click(screen.getByText('Nochmal'));
    expect(screen.queryByTestId('round-end')).toBeNull();
    expect(screen.getByTestId('match').getAttribute('data-phase')).toBe('aiming');
  });

  it('shows the stored record when the round does not beat it, and no record with "Rekorde zeigen" off', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, bests: { '1-100|holes|goalCount': { goals: 1, timeMs: 0, at: '2026-11-01T00:00:00.000Z' } } }),
    );
    const first = render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    expect(screen.queryByTestId('new-record')).toBeNull();
    expect(screen.getByTestId('record').textContent).toBe('Dein Rekord: 1 Tor in 0:00');
    first.unmount();

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1, showRecords: false }));
    game.controller = null;
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    expect(screen.getByTestId('round-end')).toBeTruthy();
    expect(screen.queryByTestId('record')).toBeNull();
    expect(screen.queryByTestId('new-record')).toBeNull();
  });

  it('"Zurück" on the round end goes back to the start screen', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    fireEvent.click(screen.getByText('Zurück'));
    expect(screen.getByTestId('start')).toBeTruthy();
  });

  it('the help and pause buttons work like H and Escape', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.click(screen.getByTestId('help-button'));
    expect(screen.getByTestId('match').getAttribute('data-help')).toBe('1');
    fireEvent.click(screen.getByLabelText('Pause'));
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
    fireEvent.click(screen.getByLabelText('Weiter'));
    expect(screen.getByTestId('message').textContent).toBe('');
  });
});

describe('App parent screens (T041 to T046)', () => {
  /** Holds the gear for 2 seconds with fake timers. */
  function holdGear(): void {
    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByTestId('parent-gate'), { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();
  }

  it('the gear held in the match opens the menu and pauses; keys do nothing; closing resumes', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    holdGear();
    expect(screen.getByRole('dialog', { name: 'Für Eltern' })).toBeTruthy();
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('entry').textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(screen.getByTestId('settings-page')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByTestId('settings-page')).toBeNull();
    expect(screen.getByTestId('message').textContent).toBe('');
  });

  it('a short tap on the start screen gear does nothing; a hold opens "Fortschritt"', () => {
    render(<App />);
    fireEvent.pointerDown(screen.getByTestId('parent-gate'), { pointerId: 1, button: 0 });
    fireEvent.pointerUp(screen.getByTestId('parent-gate'), { pointerId: 1 });
    expect(screen.queryByRole('dialog')).toBeNull();
    holdGear();
    fireEvent.click(screen.getByRole('button', { name: 'Fortschritt' }));
    expect(screen.getByTestId('progress-page').textContent).toContain('Noch keine Versuche.');
  });

  it('saved settings change the offered modes on the start screen at once', () => {
    render(<App />);
    holdGear();
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    fireEvent.click(screen.getByLabelText('Torwart'));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    const modes = Array.from(document.querySelectorAll('[data-mode]')).map((b) => b.getAttribute('data-mode'));
    expect(modes).toEqual(['holes', 'lines']);
  });

  it('records an attempt per scored target in the progress (T043)', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY)!) as { attempts: Array<{ mode: string; solved: boolean }> };
    expect(progress.attempts).toHaveLength(1);
    expect(progress.attempts[0]).toMatchObject({ mode: 'holes', solved: true });
  });

  it('a #save= link asks first; "Übernehmen" held for 2 s takes over the save and clears the address', async () => {
    const data = {
      settings: { ...defaultSettings(), showClock: true },
      progress: emptyProgress(),
      records: emptyRecords(),
      lockerRoom: { ...emptyLockerRoom(), stars: 7 },
    };
    const { code } = await encodeTransfer(data, 'http://localhost/');
    window.history.replaceState(null, '', `/#save=${code}`);
    render(<App />);
    const accept = await screen.findByRole('button', { name: 'Übernehmen' });
    vi.useFakeTimers();
    fireEvent.pointerDown(accept, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();
    expect(screen.queryByTestId('transfer-dialog')).toBeNull();
    expect((JSON.parse(localStorage.getItem(LOCKER_ROOM_KEY)!) as { stars: number }).stars).toBe(7);
    expect((JSON.parse(localStorage.getItem(SETTINGS_KEY)!) as { showClock: boolean }).showClock).toBe(true);
    expect(window.location.hash).toBe('');
  });
});

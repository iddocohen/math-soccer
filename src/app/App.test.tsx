/**
 * The app shell (T022): start screen, match and keys. The Phaser game is replaced by a stand-in so the app runs in
 * jsdom.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import { ROUND_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { App, modeFromUrl, seedFromUrl } from './App';

const game = vi.hoisted(() => ({ created: 0, destroyed: 0 }));

vi.mock('../game/createGame', () => ({
  createGame: () => {
    game.created++;
    return { game: {}, destroy: () => void game.destroyed++ };
  },
}));

beforeEach(() => {
  localStorage.clear();
  game.created = 0;
  game.destroyed = 0;
});

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
});

/** The match overlay's locker room icon (amendment 01, FR-049). */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchController, type MatchView } from '../core/match/MatchController';
import { defaultSettings } from '../core/settings/defaults';
import { litLabels, MatchOverlay } from './MatchOverlay';
import type { Target } from '../core/types';

afterEach(cleanup);

function running(): MatchView {
  const c = new MatchController({ settings: defaultSettings, newSeed: () => 3 });
  c.start();
  return c.getState();
}

const noop = () => {};

describe('MatchOverlay locker room icon (FR-049)', () => {
  it('shows "Kabine" next to the gear at the gear size; one tap calls onLockerRoom; it never takes focus', () => {
    const open = vi.fn();
    render(<MatchOverlay state={running()} settings={defaultSettings()} gear={<button className="icon-button">gear</button>} onLockerRoom={open} onHelp={noop} onPause={noop} onResume={noop} />);
    const icon = screen.getByRole('button', { name: 'Kabine' });
    expect(icon.className).toContain('icon-button');
    expect(icon.nextElementSibling?.textContent).toBe('gear');
    expect(icon.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(icon);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows no icon without onLockerRoom (locker room off) and none on the round end', () => {
    const { rerender } = render(<MatchOverlay state={running()} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
    expect(screen.queryByRole('button', { name: 'Kabine' })).toBeNull();
    rerender(<MatchOverlay state={{ ...running(), phase: 'roundOver' }} settings={defaultSettings()} onLockerRoom={noop} onHelp={noop} onPause={noop} onResume={noop} />);
    expect(screen.queryByRole('button', { name: 'Kabine' })).toBeNull();
  });

  it('carries the chosen ball and shirt for tests', () => {
    render(<MatchOverlay state={running()} ball="ball.gold" shirt="shirt.white" settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
    const match = screen.getByTestId('match');
    expect(match.getAttribute('data-ball')).toBe('ball.gold');
    expect(match.getAttribute('data-shirt')).toBe('shirt.white');
  });
});

describe('MatchOverlay number pad, speaker and fullscreen (T061 to T063)', () => {
  it('shows the number pad only with `pad`; its keys reach the handlers and are off while paused', () => {
    const pad = { onDigit: vi.fn(), onBackspace: vi.fn(), onShoot: vi.fn() };
    const { rerender } = render(<MatchOverlay state={running()} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
    expect(screen.queryByTestId('number-pad')).toBeNull();
    expect(screen.getByTestId('match').getAttribute('data-number-pad')).toBe('false');
    rerender(<MatchOverlay state={running()} settings={defaultSettings()} pad={pad} onHelp={noop} onPause={noop} onResume={noop} />);
    expect(screen.getByTestId('match').getAttribute('data-number-pad')).toBe('true');
    const key = (k: string) => screen.getByTestId('number-pad').querySelector(`[data-key="${k}"]`) as HTMLButtonElement;
    fireEvent.click(key('7'));
    fireEvent.click(key('backspace'));
    fireEvent.click(key('shoot'));
    expect(pad.onDigit).toHaveBeenCalledWith(7);
    expect(pad.onBackspace).toHaveBeenCalledTimes(1);
    expect(pad.onShoot).toHaveBeenCalledTimes(1);
    rerender(<MatchOverlay state={{ ...running(), paused: true }} settings={defaultSettings()} pad={pad} onHelp={noop} onPause={noop} onResume={noop} />);
    expect(key('7').disabled).toBe(true);
  });

  it('shows the speaker icon only with onSpeak; it never takes focus and reads the task again', () => {
    const speak = vi.fn();
    const { rerender } = render(<MatchOverlay state={running()} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
    expect(screen.queryByRole('button', { name: 'Vorlesen' })).toBeNull();
    rerender(<MatchOverlay state={running()} settings={defaultSettings()} onSpeak={speak} onHelp={noop} onPause={noop} onResume={noop} />);
    const icon = screen.getByRole('button', { name: 'Vorlesen' });
    expect(icon.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(icon);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('shows the fullscreen icon where the browser allows fullscreen, and the clock only when the parent turned it on', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    try {
      render(<MatchOverlay state={{ ...running(), elapsedMs: 65_000 }} settings={{ ...defaultSettings(), showClock: true }} onHelp={noop} onPause={noop} onResume={noop} />);
      expect(screen.getByRole('button', { name: 'Vollbild' }).getAttribute('tabindex')).toBe('-1');
      expect(screen.getByTestId('clock').textContent).toBe('1:05');
    } finally {
      Object.defineProperty(document, 'fullscreenEnabled', { value: undefined, configurable: true });
    }
  });

  it('the pause button pauses and, while paused, the resume button resumes', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const { rerender } = render(<MatchOverlay state={running()} settings={defaultSettings()} onHelp={noop} onPause={pause} onResume={resume} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pause).toHaveBeenCalledTimes(1);
    rerender(<MatchOverlay state={{ ...running(), paused: true }} settings={defaultSettings()} onHelp={noop} onPause={pause} onResume={resume} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
  });
});

describe('lit labels and scales of the row and column helper (FR-094, amendment 10, amendment 14)', () => {
  const target: Target = { number: 46, hints: [36], directions: ['down'], level: 1, pattern: 'neighbors' };
  const at = (helpStep: number) => ({ helpStep, target, min: 1, max: 100, ball: null });

  it('shows no help sentence at any help step (amendment 14, FR-119)', () => {
    for (const helpStep of [0, 1, 2, 3, 4]) {
      const { unmount } = render(<MatchOverlay state={{ ...running(), target, helpStep }} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
      expect(screen.queryByTestId('help-text')).toBeNull();
      unmount();
    }
  });

  it('carries which scales show as data-scales: none, row, both, and none once scored (FR-115)', () => {
    const scalesAt = (helpStep: number, scored = false) => {
      const state: MatchView = { ...running(), target, helpStep, ...(scored ? { phase: 'celebrating', ball: { number: 46, outcome: 'goal', atMs: 0 } } : {}) };
      const { unmount } = render(<MatchOverlay state={state} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
      const value = screen.getByTestId('match').getAttribute('data-scales');
      unmount();
      return value;
    };
    expect([0, 1, 2, 3, 4].map((step) => scalesAt(step))).toEqual(['none', 'row', 'both', 'both', 'both']);
    expect(scalesAt(2, true)).toBe('none');
    expect(litLabels({ ...at(2), ball: { number: 46, outcome: 'goal', atMs: 0 } })).toEqual({ row: '', col: '' });
  });

  it('shows the home button "Zum Start" only with onHome, and not on the round end (FR-116)', () => {
    const home = vi.fn();
    const { unmount } = render(<MatchOverlay state={running()} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
    expect(screen.queryByTestId('home-button')).toBeNull();
    unmount();
    render(<MatchOverlay state={running()} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} onHome={home} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zum Start' }));
    expect(home).toHaveBeenCalledTimes(1);
  });

  it('carries the lit row and column labels as data-help-row and data-help-col', () => {
    expect(litLabels(at(0))).toEqual({ row: '', col: '' });
    expect(litLabels(at(1))).toEqual({ row: '40', col: '' });
    expect(litLabels(at(2))).toEqual({ row: '40', col: '6' });
    render(<MatchOverlay state={{ ...running(), target, helpStep: 2 }} settings={defaultSettings()} onHelp={noop} onPause={noop} onResume={noop} />);
    const match = screen.getByTestId('match');
    expect(match.getAttribute('data-help-row')).toBe('40');
    expect(match.getAttribute('data-help-col')).toBe('6');
  });
});

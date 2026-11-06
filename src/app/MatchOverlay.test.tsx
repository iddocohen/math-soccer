/** The match overlay's locker room icon (amendment 01, FR-049). */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchController, type MatchState } from '../core/match/MatchController';
import { defaultSettings } from '../core/settings/defaults';
import { MatchOverlay } from './MatchOverlay';

afterEach(cleanup);

function running(): MatchState {
  const c = new MatchController({ settings: defaultSettings, newSeed: () => 3 });
  c.start('holes');
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

// Amendment 12 (FR-103): the round end names a waiting new version in one short neutral line.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoundEnd } from './RoundEnd';

afterEach(cleanup);

function show(updateWaiting?: boolean) {
  render(<RoundEnd goals={3} elapsedMs={65_000} roundType="goalCount" record={null} updateWaiting={updateWaiting} onAgain={() => {}} onBack={() => {}} />);
}

describe('RoundEnd update line (FR-103)', () => {
  it('shows "Neue Version, startet gleich" when a new version waits', () => {
    show(true);
    expect(screen.getByTestId('update-note').textContent).toBe('Neue Version, startet gleich');
    expect(screen.getByText('Nochmal')).toBeTruthy();
    expect(screen.getByText('Zurück')).toBeTruthy();
  });

  it('shows no line without a waiting version', () => {
    show();
    expect(screen.queryByTestId('update-note')).toBeNull();
  });
});

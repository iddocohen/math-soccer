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

describe('RoundEnd after a cup match (amendment 13, FR-108, T102)', () => {
  function showCup(cup: { won: boolean; line: string; cupWon?: boolean }, calls: string[]) {
    render(
      <RoundEnd goals={3} elapsedMs={65_000} roundType="cup" record={null} cup={cup} onAgain={() => calls.push('again')} onBack={() => calls.push('back')} />,
    );
  }

  it('a win shows the line and one button "Weiter" that goes back to the bracket', () => {
    const calls: string[] = [];
    showCup({ won: true, line: 'Gewonnen! Weiter ins Halbfinale' }, calls);
    expect(screen.getByTestId('cup-result').textContent).toBe('Gewonnen! Weiter ins Halbfinale');
    expect(screen.queryByText('Nochmal')).toBeNull();
    screen.getByText('Weiter').click();
    expect(calls).toEqual(['back']);
    expect(screen.getByTestId('round-end').className).toBe('round-end');
  });

  it('a loss offers "Nochmal" and "Zurück"', () => {
    const calls: string[] = [];
    showCup({ won: false, line: 'Knapp! Noch mal gegen Adler 09?' }, calls);
    screen.getByText('Nochmal').click();
    screen.getByText('Zurück').click();
    expect(calls).toEqual(['again', 'back']);
  });

  it('a won final sits low on the screen, so the celebration stays in view', () => {
    showCup({ won: true, line: 'Gewonnen! Pokal 1 gehört dir!', cupWon: true }, []);
    expect(screen.getByTestId('round-end').className).toContain('cup-final-won');
  });
});

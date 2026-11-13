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
      <RoundEnd goals={3} elapsedMs={65_000} roundType="cup" record={null} outcome={{ kind: 'cup', cup }} onAgain={() => calls.push('again')} onBack={() => calls.push('back')} />,
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

describe('RoundEnd after a shootout (amendment 21 part 3, FR-148)', () => {
  const best = { goals: 3, timeMs: 0, at: 'x' };

  it('a win reads "Elfmeter-Sieger!" with the score, sits low for the confetti, and counts the wins', () => {
    render(
      <RoundEnd
        goals={4}
        elapsedMs={65_000}
        roundType="untilHearts"
        record={{ newRecord: false, best }}
        stars={5}
        outcome={{ kind: 'shootout', result: { kicks: 'opponent', childWon: true, names: ['Du', 'FC Blitz'], score: [4, 3] } }}
        onAgain={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole('heading').textContent).toBe('Elfmeter-Sieger!');
    expect(screen.getByTestId('round-result').textContent).toBe('4:3 gegen FC Blitz');
    expect(screen.getByTestId('record').textContent).toBe('3 Elfmeterschießen gewonnen');
    expect(screen.getByTestId('round-stars').textContent).toBe('+5 Sterne');
    expect(screen.getByTestId('round-end').className).toContain('cup-final-won');
    expect(screen.getByTestId('round-end').getAttribute('data-shootout-won')).toBe('true');
  });

  it('a loss reads "Knapp! Noch mal?" and offers "Nochmal"', () => {
    render(
      <RoundEnd goals={2} elapsedMs={65_000} roundType="untilHearts" record={null} stars={0} outcome={{ kind: 'shootout', result: { kicks: 'opponent', childWon: false, names: ['Du', 'Adler 09'], score: [2, 3] } }} onAgain={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByRole('heading').textContent).toBe('Knapp! Noch mal?');
    expect(screen.getByTestId('round-result').textContent).toBe('2:3 gegen Adler 09');
    expect(screen.getByText('Nochmal')).toBeTruthy();
    expect(screen.getByTestId('round-end').className).toBe('round-end');
  });
});

describe('RoundEnd after "Torwandschießen" and "Papa gegen Kind" (amendment 23, FR-157, FR-160)', () => {
  it('"Torwand" shows the hits out of 10 and the best', () => {
    render(
      <RoundEnd
        goals={7}
        elapsedMs={65_000}
        roundType="untilHearts"
        record={{ newRecord: false, best: { goals: 8, timeMs: 0, at: '' } }}
        outcome={{ kind: 'hits', shots: 10 }}
        onAgain={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByTestId('round-result').textContent).toBe('7 von 10 Treffern');
    expect(screen.getByTestId('record').textContent).toBe('Dein Rekord: 8 von 10 Treffern');
  });

  it('the child\'s win names him; a win of the grown-up names him and offers "Knapp! Revanche?"', () => {
    const { unmount } = render(
      <RoundEnd goals={4} elapsedMs={0} roundType="untilHearts" record={null} stars={7} outcome={{ kind: 'shootout', result: { kicks: 'grownup', childWon: true, names: ['Leo', 'Papa'], score: [4, 3] } }} onAgain={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByRole('heading').textContent).toBe('Leo gewinnt!');
    expect(screen.getByTestId('round-result').textContent).toBe('Leo 4:3 Papa');
    expect(screen.getByTestId('round-end').getAttribute('data-family-winner')).toBe('child');
    expect(screen.queryByTestId('family-lost')).toBeNull();
    unmount();
    render(
      <RoundEnd goals={2} elapsedMs={0} roundType="untilHearts" record={null} stars={2} outcome={{ kind: 'shootout', result: { kicks: 'grownup', childWon: false, names: ['Leo', 'Papa'], score: [2, 3] } }} onAgain={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByRole('heading').textContent).toBe('Papa gewinnt!');
    expect(screen.getByTestId('family-lost').textContent).toBe('Knapp! Revanche?');
    expect(screen.getByTestId('round-stars').textContent).toBe('+2 Sterne');
  });
});

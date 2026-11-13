/**
 * The app shell (T022, T034 to T036): start screen, match overlay, round end, personal bests and keys. The Phaser game
 * is replaced by a stand-in so the app runs in jsdom; the stand-in keeps the controller, so a test can land the ball and
 * end the celebration as MatchScene does.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../core/settings/defaults';
import type { MatchController } from '../core/match/MatchController';
import { emptyCup, emptyLockerRoom, emptyProgress, emptyRecords } from '../core/storage/schemas';
import { BASELINE, BASELINE_KEY, CUP_KEY, LOCKER_ROOM_KEY, PROGRESS_KEY, RECORDS_KEY, ROUND_KEY, SETTINGS_KEY } from '../core/storage/storage';
import { encodeTransfer } from '../core/transfer/transfer';
import { MatchController as Controller } from '../core/match/MatchController';
import { t } from '../i18n';
import { App, seedFromUrl, speedFromUrl, startFromUrl } from './App';

const game = vi.hoisted(() => ({ created: 0, destroyed: 0, looks: 0, controller: null as MatchController | null }));

vi.mock('../game/createGame', () => ({
  createGame: (_parent: HTMLElement, controller: MatchController) => {
    game.created++;
    game.controller = controller;
    return { game: {}, showLook: () => void game.looks++, destroy: () => void game.destroyed++ };
  },
}));

beforeEach(() => {
  localStorage.clear();
  // A browser past the stored data baseline (T106), so the data a test stores is read as it is.
  localStorage.setItem(BASELINE_KEY, BASELINE);
  game.created = 0;
  game.destroyed = 0;
  game.looks = 0;
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
  it('shows "Spielen", "Zeit-Challenge" and "Pokal" on the start screen, and no mode buttons (FR-068, FR-075, FR-105)', () => {
    render(<App />);
    expect(screen.getByTestId('start')).toBeTruthy();
    const buttons = Array.from(document.querySelectorAll('[data-start]')).map((b) => b.getAttribute('data-start'));
    expect(buttons).toEqual(['play', 'time', 'cup']);
    expect(document.querySelector('[data-start="play"]')!.textContent).toBe('SpielenEnter');
    // The key hint shows like "Z" on "Zeit-Challenge" (FR-101) and is hidden from screen readers.
    expect(document.querySelector('[data-start="play"] .start-key')!.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('[data-mode]')).toBeNull();
    // Keys 1 to 3 no longer start a round.
    for (const k of ['1', '2', '3']) fireEvent.keyDown(window, { key: k });
    expect(screen.queryByTestId('match')).toBeNull();
  });

  it('hides "Zeit-Challenge" and ignores Z when the parent does not allow it; Z starts a round when allowed', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), timeChallenge: { allowed: false, minutes: 2 } }));
    const first = render(<App />);
    expect(document.querySelector('[data-start="time"]')).toBeNull();
    fireEvent.keyDown(window, { key: 'z' });
    expect(screen.queryByTestId('match')).toBeNull();
    first.unmount();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings()));
    render(<App />);
    fireEvent.keyDown(window, { key: 'Z' });
    expect(screen.getByTestId('match').getAttribute('data-phase')).toBe('aiming');
  });

  it('Enter starts the goalkeeper game with the canvas under the overlay; digits type and Enter refuses 150', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
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
    fireEvent.click(document.querySelector('[data-start="play"]')!);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('message').textContent).toBe('');
  });

  it('continues a stored round after a refresh: the match shows with the same goals and target', () => {
    const first = render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    const target = screen.getByTestId('match').getAttribute('data-target');
    expect(localStorage.getItem(ROUND_KEY)).not.toBeNull();
    first.unmount();
    render(<App />);
    expect(screen.getByTestId('match').getAttribute('data-target')).toBe(target);
    expect(screen.getByTestId('match').getAttribute('data-goals')).toBe('0');
  });

  it('reads the test speed-up hook ?speed= (T092)', () => {
    expect(speedFromUrl('?speed=30')).toBe(30);
    expect(speedFromUrl('?speed=0.5')).toBe(0.5);
    expect(speedFromUrl('?speed=-1')).toBeUndefined();
    expect(speedFromUrl('')).toBeUndefined();
  });

  it('reads ?seed= and ?start= for tests', () => {
    expect(seedFromUrl('?seed=42')).toBe(42);
    expect(seedFromUrl('?seed=x')).toBeUndefined();
    expect(startFromUrl('?start=time')).toBe('time');
    expect(startFromUrl('?start=play')).toBe('play');
    expect(startFromUrl('?mode=keeper')).toBeUndefined();
  });

  it('the match carries the chart rows and the ball kind for tests', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    const match = screen.getByTestId('match');
    expect(match.getAttribute('data-rows')).toBe('10');
    expect(match.getAttribute('data-ball-kind')).toBe('soccer');
    expect(match.getAttribute('data-ball')).toBe('ball.classic');
    expect(screen.getByTestId('hearts').querySelectorAll('.heart')).toHaveLength(3);
    await waitFor(() => expect(game.controller).not.toBeNull());
  });

  it('the round end shows the result and "Neuer Rekord!", stores the best, and "Nochmal" starts a new round', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    expect(screen.getByTestId('goal-count').textContent).toBe('0 von 1 Toren');
    scoreGoal();
    expect(screen.getByTestId('round-end')).toBeTruthy();
    expect(screen.getByTestId('round-result').textContent).toMatch(/^1 Tor in \d+:\d\d$/);
    expect(screen.getByTestId('new-record').textContent).toBe('Neuer Rekord!');
    const stored = JSON.parse(localStorage.getItem(RECORDS_KEY)!) as { bests: Record<string, { goals: number }> };
    expect(stored.bests['1-100|keeper|goalCount']?.goals).toBe(1);

    fireEvent.click(screen.getByText('Nochmal'));
    expect(screen.queryByTestId('round-end')).toBeNull();
    expect(screen.getByTestId('match').getAttribute('data-phase')).toBe('aiming');
  });

  it('shows the stored record when the round does not beat it, and no record with "Rekorde zeigen" off', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ version: 1, bests: { '1-100|keeper|goalCount': { goals: 1, timeMs: 0, at: '2026-11-01T00:00:00.000Z' } } }),
    );
    const first = render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    expect(screen.queryByTestId('new-record')).toBeNull();
    expect(screen.getByTestId('record').textContent).toBe('Dein Rekord: 1 Tor in 0:00');
    first.unmount();

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1, showRecords: false }));
    game.controller = null;
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    expect(screen.getByTestId('round-end')).toBeTruthy();
    expect(screen.queryByTestId('record')).toBeNull();
    expect(screen.queryByTestId('new-record')).toBeNull();
  });

  it('"Zurück" on the round end goes back to the start screen', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    fireEvent.click(screen.getByText('Zurück'));
    expect(screen.getByTestId('start')).toBeTruthy();
  });

  it('the help and pause buttons work like H and Escape', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.click(screen.getByTestId('help-button'));
    expect(screen.getByTestId('match').getAttribute('data-help')).toBe('1');
    fireEvent.click(screen.getByLabelText('Pause'));
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
    fireEvent.click(screen.getByLabelText('Weiter'));
    expect(screen.getByTestId('message').textContent).toBe('');
  });

  it('the pause screen offers "Weiter" and "Zum Start"; Enter goes on (amendment 14, FR-117)', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryByTestId('pause-screen')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    const pauseScreen = screen.getByTestId('pause-screen');
    expect(pauseScreen.getAttribute('data-kind')).toBe('pause');
    expect(screen.getByTestId('pause-resume').textContent).toBe('Weiter');
    expect(screen.getByTestId('pause-home').textContent).toBe('Zum Start');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryByTestId('pause-screen')).toBeNull();
    expect(screen.getByTestId('match').getAttribute('data-phase')).toBe('aiming');
  });

  it('the home button asks "Runde beenden?"; "Weiter" goes on, "Zum Start" keeps stars and records no best (FR-116, FR-118)', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 3 }));
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    const stars = JSON.parse(localStorage.getItem(LOCKER_ROOM_KEY)!).stars as number;
    expect(stars).toBeGreaterThan(0);
    const attempts = JSON.parse(localStorage.getItem(PROGRESS_KEY)!).attempts.length as number;
    expect(attempts).toBe(1);
    expect(localStorage.getItem(ROUND_KEY)).not.toBeNull();

    fireEvent.click(screen.getByTestId('home-button'));
    expect(game.controller!.getState().paused).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Runde beenden?' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('pause-resume'));
    expect(screen.queryByTestId('pause-screen')).toBeNull();
    expect(game.controller!.getState().paused).toBe(false);

    fireEvent.click(screen.getByTestId('home-button'));
    fireEvent.click(screen.getByTestId('pause-home'));
    expect(screen.getByTestId('start')).toBeTruthy();
    expect(screen.queryByTestId('round-end')).toBeNull();
    expect(JSON.parse(localStorage.getItem(LOCKER_ROOM_KEY)!).stars).toBe(stars);
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).attempts).toHaveLength(attempts);
    expect(localStorage.getItem(ROUND_KEY)).toBeNull();
    const records = localStorage.getItem(RECORDS_KEY);
    expect(records === null || Object.keys(JSON.parse(records).bests ?? {}).length === 0).toBe(true);
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
    fireEvent.keyDown(window, { key: 'Enter' });
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

  it('a cup match whose cup was reset during it records nothing and gives no bonus; "Weiter" goes to the bracket', async () => {
    const cup = { version: 1, cup: 1, stage: 2, tries: 1, scores: [{ goals: 3, against: 0 }, { goals: 3, against: 1 }], trophies: [] };
    localStorage.setItem(CUP_KEY, JSON.stringify(cup));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), cupGoals: 3 }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Pokal' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t().cup.nextLabel) }));
    await waitFor(() => expect(game.controller).not.toBeNull());
    fireEvent.pointerDown(screen.getByTestId('cup-intro'));
    scoreGoal();

    holdGear();
    fireEvent.click(screen.getByRole('button', { name: 'Fortschritt' }));
    fireEvent.click(screen.getByRole('button', { name: t().progressPage.resetAll }));
    fireEvent.click(screen.getByRole('button', { name: t().progressPage.resetAllYes }));
    fireEvent.click(screen.getByRole('button', { name: t().progressPage.close }));
    expect(screen.queryByTestId('progress-page')).toBeNull();

    scoreGoal();
    scoreGoal();
    expect(screen.getByTestId('round-end')).toBeTruthy();
    const result = screen.getByTestId('cup-result');
    expect(result.textContent).toBe('Der Pokal wurde neu gestartet.');
    expect(result.getAttribute('data-cup-won')).toBe('false');
    // 1 star per goal and no bonus for the match; the reset cleared the star of the first goal.
    expect(screen.getByTestId('round-stars').textContent).toBe(t().roundEnd.stars(3));
    expect((JSON.parse(localStorage.getItem(LOCKER_ROOM_KEY)!) as { stars: number }).stars).toBe(2);
    expect(JSON.parse(localStorage.getItem(CUP_KEY)!)).toMatchObject({ cup: 1, stage: 0, tries: 0, scores: [] });

    expect(screen.queryByRole('button', { name: 'Nochmal' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t().cup.next }));
    expect(screen.getByTestId('cup-bracket').getAttribute('data-cup-stage')).toBe('0');
  });

  it('records an attempt per scored target in the progress (T043)', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY)!) as { attempts: Array<{ mode: string; solved: boolean }> };
    expect(progress.attempts).toHaveLength(1);
    expect(progress.attempts[0]).toMatchObject({ mode: 'keeper', solved: true });
  });

  it('a #save= link asks first; "Übernehmen" held for 2 s takes over the save and clears the address', async () => {
    const data = {
      settings: { ...defaultSettings(), showClock: true },
      progress: emptyProgress(),
      records: emptyRecords(),
      lockerRoom: { ...emptyLockerRoom(), stars: 7 },
      cup: emptyCup(),
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

/** The stored locker room. */
function storedLocker(): { stars: number; totalEarned: number; ball: string } {
  return JSON.parse(localStorage.getItem(LOCKER_ROOM_KEY)!) as { stars: number; totalEarned: number; ball: string };
}

describe('App: stars and locker room (US6)', () => {
  it('awards 1 star per goal at once, none again after a refresh, and shows them on the round end and the start screen', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 2 }));
    const first = render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    expect(storedLocker().stars).toBe(1);
    first.unmount();
    game.controller = null;

    render(<App />);
    await waitFor(() => expect(game.controller).not.toBeNull());
    expect(storedLocker().stars).toBe(1);
    scoreGoal();
    expect(storedLocker()).toMatchObject({ stars: 2, totalEarned: 2 });
    expect(screen.getByTestId('round-stars').textContent).toBe('+2 Sterne');
    fireEvent.click(screen.getByText('Zurück'));
    expect(screen.getByTestId('star-total').textContent).toBe('★ 2');
  });

  it('a miss takes no star away', async () => {
    localStorage.setItem(LOCKER_ROOM_KEY, JSON.stringify({ ...emptyLockerRoom(), stars: 5, totalEarned: 5 }));
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    const target = Number(screen.getByTestId('match').getAttribute('data-target'));
    for (const k of String(target === 1 ? 2 : target - 1)) fireEvent.keyDown(window, { key: k });
    fireEvent.keyDown(window, { key: 'Enter' });
    act(() => game.controller!.ballLanded());
    expect(storedLocker().stars).toBe(5);
  });

  it('K opens the locker room; buying and choosing a ball stores it, Escape goes back, and the match shows the ball', async () => {
    localStorage.setItem(LOCKER_ROOM_KEY, JSON.stringify({ ...emptyLockerRoom(), stars: 100, totalEarned: 100 }));
    render(<App />);
    fireEvent.keyDown(window, { key: 'k' });
    const room = screen.getByTestId('locker-room');
    expect(room.getAttribute('data-stars')).toBe('100');
    expect(screen.getByTestId('item-ball.rainbow').textContent).toContain('noch 20 Sterne');
    expect(screen.getByTestId('item-ball.rainbow').getAttribute('data-locked')).toBe('true');
    fireEvent.click(screen.getByTestId('item-ball.rainbow'));
    expect(screen.queryByTestId('buy-question')).toBeNull();
    fireEvent.click(screen.getByTestId('item-ball.gold'));
    expect(screen.getByTestId('buy-question').textContent).toContain('Für 75 Sterne kaufen?');
    fireEvent.click(screen.getByText('Ja'));
    expect(storedLocker()).toMatchObject({ stars: 25, ball: 'ball.gold' });
    expect(screen.getByTestId('item-ball.gold').getAttribute('data-chosen')).toBe('true');
    fireEvent.change(screen.getByTestId('shirt-number'), { target: { value: '7' } });
    fireEvent.change(screen.getByTestId('shirt-name'), { target: { value: 'Mia123' } });
    expect(JSON.parse(localStorage.getItem(LOCKER_ROOM_KEY)!)).toMatchObject({ shirtNumber: 7, shirtName: 'Mia' });
    // Keys typed into the fields never start a round.
    expect(screen.queryByTestId('match')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('star-total').textContent).toBe('★ 25');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('match').getAttribute('data-ball')).toBe('ball.gold');
    await waitFor(() => expect(game.controller).not.toBeNull());
  });

  it('with the locker room off, the star total, the button and K do nothing, and the round end shows no stars', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), lockerRoom: false, roundType: 'goalCount', goalsPerRound: 1 }));
    render(<App />);
    expect(screen.queryByTestId('star-total')).toBeNull();
    expect(screen.queryByTestId('open-locker-room')).toBeNull();
    fireEvent.keyDown(window, { key: 'k' });
    expect(screen.queryByTestId('locker-room')).toBeNull();
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    expect(screen.getByTestId('round-end')).toBeTruthy();
    expect(screen.queryByTestId('round-stars')).toBeNull();
  });
});

/** Holds the gear for 2 seconds with fake timers. */
function holdGearFor2s(): void {
  vi.useFakeTimers();
  fireEvent.pointerDown(screen.getByTestId('parent-gate'), { pointerId: 1, button: 0 });
  act(() => {
    vi.advanceTimersByTime(2100);
  });
  vi.useRealTimers();
}

describe('App: saved settings reach the running round when the settings page closes (amendment 01, FR-052)', () => {
  const S = t().settings;
  const openSettings = () => {
    holdGearFor2s();
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
  };
  const range = (max: string) => {
    fireEvent.change(screen.getByLabelText(S.labels.rangePreset), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(S.labels.rangeMin), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(S.labels.rangeMax), { target: { value: max } });
  };
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  const close = () => fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function startMatch(): Promise<HTMLElement> {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    return screen.getByTestId('match');
  }

  it('gives a new target on the new board when the page closes after a save; goals stay and the round continues', async () => {
    const apply = vi.spyOn(Controller.prototype, 'applySettings');
    const match = await startMatch();
    scoreGoal();
    openSettings();
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
    range('20');
    save();
    // Nothing changes while the page is open.
    expect(apply).not.toHaveBeenCalled();
    expect(match.getAttribute('data-rows')).toBe('10');
    close();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(match.getAttribute('data-rows')).toBe('2');
    expect(Number(match.getAttribute('data-target'))).toBeLessThanOrEqual(20);
    expect(match.getAttribute('data-goals')).toBe('1');
    expect(match.getAttribute('data-phase')).toBe('aiming');
    expect(screen.getByTestId('message').textContent).toBe('');
  });

  it('applies several saves once, with the latest settings', async () => {
    const apply = vi.spyOn(Controller.prototype, 'applySettings');
    await startMatch();
    openSettings();
    range('50');
    save();
    range('20');
    save();
    close();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]![0].range).toEqual({ preset: 'custom', min: 1, max: 20 });
  });

  it('changes nothing when the page closes without a save', async () => {
    const apply = vi.spyOn(Controller.prototype, 'applySettings');
    const match = await startMatch();
    const target = match.getAttribute('data-target');
    openSettings();
    range('20');
    close();
    expect(apply).not.toHaveBeenCalled();
    expect(match.getAttribute('data-target')).toBe(target);
    expect(match.getAttribute('data-rows')).toBe('10');
  });

  it('keeps a round the child paused paused, with the new target', async () => {
    const match = await startMatch();
    fireEvent.click(screen.getByLabelText('Pause'));
    openSettings();
    range('20');
    save();
    close();
    expect(match.getAttribute('data-rows')).toBe('2');
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
  });

  it('goals per round keep their round-start value on the goal counter', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 3 }));
    await startMatch();
    openSettings();
    fireEvent.change(screen.getByLabelText(S.labels.goalsPerRound), { target: { value: '8' } });
    save();
    close();
    expect(screen.getByTestId('goal-count').textContent).toBe('0 von 3 Toren');
  });

  it('does not touch the start screen; the next round uses the saved settings', () => {
    const apply = vi.spyOn(Controller.prototype, 'applySettings');
    render(<App />);
    openSettings();
    range('20');
    save();
    close();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('match').getAttribute('data-rows')).toBe('2');
  });
});

describe('App: locker room from the match (amendment 01, FR-049)', () => {
  async function startMatch(): Promise<HTMLElement> {
    render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    return screen.getByTestId('match');
  }

  it('one tap on "Kabine" opens the locker room over the match and pauses; keys do nothing in the match', async () => {
    localStorage.setItem(LOCKER_ROOM_KEY, JSON.stringify({ ...emptyLockerRoom(), stars: 100, totalEarned: 100 }));
    const match = await startMatch();
    fireEvent.click(screen.getByRole('button', { name: 'Kabine' }));
    expect(screen.getByTestId('locker-room')).toBeTruthy();
    expect(screen.getByTestId('match')).toBe(match);
    expect(game.controller!.getState().paused).toBe(true);
    const elapsed = game.controller!.getState().elapsedMs;
    act(() => game.controller!.tick(1000));
    expect(game.controller!.getState().elapsedMs).toBe(elapsed);
    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('entry').textContent).toBe('');
    expect(game.controller!.getState().phase).toBe('aiming');
  });

  it('equipping a ball and "Zurück" closes the locker room; the round continues with the new ball at once', async () => {
    localStorage.setItem(LOCKER_ROOM_KEY, JSON.stringify({ ...emptyLockerRoom(), stars: 100, totalEarned: 100 }));
    const match = await startMatch();
    fireEvent.click(screen.getByRole('button', { name: 'Kabine' }));
    fireEvent.click(screen.getByTestId('item-ball.gold'));
    fireEvent.click(screen.getByText('Ja'));
    fireEvent.click(screen.getByTestId('item-shirt.white'));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.queryByTestId('locker-room')).toBeNull();
    expect(game.controller!.getState().paused).toBe(false);
    expect(match.getAttribute('data-ball')).toBe('ball.gold');
    expect(match.getAttribute('data-shirt')).toBe('shirt.white');
    expect(game.looks).toBe(1);
  });

  it('Escape closes the locker room and the round continues', async () => {
    await startMatch();
    fireEvent.click(screen.getByRole('button', { name: 'Kabine' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('locker-room')).toBeNull();
    expect(game.controller!.getState().paused).toBe(false);
    expect(screen.getByTestId('message').textContent).toBe('');
  });

  it('a round the child paused stays paused after the locker room closes', async () => {
    await startMatch();
    fireEvent.click(screen.getByLabelText('Pause'));
    fireEvent.click(screen.getByRole('button', { name: 'Kabine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(game.controller!.getState().paused).toBe(true);
    expect(screen.getByTestId('message').textContent).toBe('Pause. Weiter mit Enter.');
  });

  it('with the locker room off, the match shows no "Kabine" icon', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), lockerRoom: false }));
    await startMatch();
    expect(screen.queryByRole('button', { name: 'Kabine' })).toBeNull();
  });
});

describe('App: review fixes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  /** A stored round with one goal, saved during the celebration of that goal. */
  function celebratingRound(over: Record<string, unknown> = {}) {
    return {
      version: 1,
      seed: 5,
      roundType: 'goalCount',
      challengeMinutes: null,
      goalsPerRound: 1,
      min: 1,
      max: 100,
      goals: 1,
      hearts: 3,
      missesInRow: 0,
      helpStep: 0,
      target: { number: 46, hints: [45], directions: ['right'], level: 1, pattern: 'neighbors' },
      targetCount: 1,
      starsThisRound: 2,
      elapsedMs: 9000,
      targetStartMs: 0,
      targetMisses: 0,
      missTimes: [],
      cupMatch: null,
      phase: 'celebrating',
      ...over,
    };
  }

  it('a refresh during the final goal\'s celebration shows the round end and saves the personal best once (M2)', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    localStorage.setItem(ROUND_KEY, JSON.stringify(celebratingRound()));
    const first = render(<App />);
    expect(screen.getByTestId('round-end')).toBeTruthy();
    expect(screen.getByTestId('new-record').textContent).toBe('Neuer Rekord!');
    const stored = JSON.parse(localStorage.getItem(RECORDS_KEY)!) as { bests: Record<string, { goals: number; timeMs: number }> };
    expect(stored.bests['1-100|keeper|goalCount']).toMatchObject({ goals: 1, timeMs: 9000 });
    expect(localStorage.getItem(ROUND_KEY)).toBeNull();
    first.unmount();
    // A second refresh has no round to continue, so nothing is saved again.
    render(<App />);
    expect(screen.getByTestId('start')).toBeTruthy();
  });

  it('continues a stored round after a refresh', () => {
    localStorage.setItem(ROUND_KEY, JSON.stringify(celebratingRound({ phase: 'aiming', goals: 0 })));
    render(<App />);
    expect(screen.getByTestId('match').getAttribute('data-target')).toBe('46');
    expect(screen.getByTestId('match').getAttribute('data-pattern')).toBe('neighbors');
  });

  it('clears data from before the stored data baseline once on start, without a notice (T106)', () => {
    localStorage.removeItem(BASELINE_KEY);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), version: 4, showClock: true }));
    localStorage.setItem(ROUND_KEY, JSON.stringify({ ...celebratingRound({ phase: 'aiming' }), version: 4 }));
    localStorage.setItem(`${LOCKER_ROOM_KEY}.unreadable`, '{"version":1');
    const view = render(<App />);
    expect(screen.getByTestId('start')).toBeTruthy();
    expect(screen.queryByTestId('start-notice-reset')).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(localStorage.getItem(ROUND_KEY)).toBeNull();
    expect(localStorage.getItem(`${LOCKER_ROOM_KEY}.unreadable`)).toBeNull();
    expect(localStorage.getItem(BASELINE_KEY)).toBe(BASELINE);
    view.unmount();
    // Data saved after the marker stays on the next start.
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), showClock: true }));
    render(<App />);
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it('a refresh keeps the round-start goals per round after the parent changed it (H7)', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 5 }));
    localStorage.setItem(ROUND_KEY, JSON.stringify(celebratingRound()));
    render(<App />);
    expect(screen.getByTestId('round-end')).toBeTruthy();
  });

  it('accepting a transfer during a match gives the round a target on the transferred range (M3, FR-052)', async () => {
    const first = render(<App />);
    fireEvent.keyDown(window, { key: 'Enter' });
    first.unmount();
    const data = {
      settings: { ...defaultSettings(), range: { preset: 'custom' as const, min: 1, max: 20 } },
      progress: emptyProgress(),
      records: emptyRecords(),
      lockerRoom: emptyLockerRoom(),
      cup: emptyCup(),
    };
    const { code } = await encodeTransfer(data, 'http://localhost/');
    window.history.replaceState(null, '', `/#save=${code}`);
    render(<App />);
    expect(screen.getByTestId('match')).toBeTruthy();
    const accept = await screen.findByRole('button', { name: 'Übernehmen' });
    vi.useFakeTimers();
    fireEvent.pointerDown(accept, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    vi.useRealTimers();
    expect(screen.queryByTestId('transfer-dialog')).toBeNull();
    expect(Number(screen.getByTestId('match').getAttribute('data-target'))).toBeLessThanOrEqual(20);
    expect((JSON.parse(localStorage.getItem(ROUND_KEY)!) as { max: number }).max).toBe(20);
  });

  it('a failed save during play shows one short note on the start screen, and "OK" closes it (M6)', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), roundType: 'goalCount', goalsPerRound: 1 }));
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === LOCKER_ROOM_KEY) throw new DOMException('quota', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    render(<App />);
    expect(screen.queryByTestId('start-notice-save')).toBeNull();
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(game.controller).not.toBeNull());
    scoreGoal();
    // Play goes on: the round end shows as usual.
    expect(screen.getByTestId('round-end')).toBeTruthy();
    fireEvent.click(screen.getByText('Zurück'));
    expect(screen.getByTestId('start-notice-save').textContent).toContain(t().start.saveFailed);
    fireEvent.click(screen.getByRole('button', { name: t().start.dismiss }));
    expect(screen.queryByTestId('start-notice-save')).toBeNull();
  });

  it('data reset on load shows a note on the start screen naming the kind and "Kopie wiederherstellen" (H5, FR-036)', () => {
    localStorage.setItem(PROGRESS_KEY, '{broken');
    render(<App />);
    const note = screen.getByTestId('start-notice-reset').textContent!;
    expect(note).toContain(t().storage.reset.invalid);
    expect(note).toContain('Fortschritt');
    expect(note).toContain('Kopie wiederherstellen');
    fireEvent.click(screen.getByRole('button', { name: t().start.dismiss }));
    expect(screen.queryByTestId('start-notice-reset')).toBeNull();
  });

  it('shows no note when the stored data loads cleanly', () => {
    render(<App />);
    expect(screen.queryByTestId('start-notice-reset')).toBeNull();
    expect(screen.queryByTestId('start-notice-save')).toBeNull();
  });
});

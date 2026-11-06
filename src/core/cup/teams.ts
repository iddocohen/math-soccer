/**
 * The made-up opponents of the cup (amendment 13, FR-107). Each team has a friendly German name, team colors for the
 * keeper's shirt and the stand scarves, and a keeper quirk. Quirks are looks only: they never change where the keeper
 * can reach and never change the math. No real clubs, players or league names are used.
 */

/** The keeper quirks (FR-107); the scene draws them (T102). */
export const QUIRKS = ['tall', 'small', 'beard', 'cap', 'celebratesSaves', 'looksLeft'] as const;
export type Quirk = (typeof QUIRKS)[number];

export interface CupTeam {
  id: string;
  name: string;
  /** Main color of the keeper's shirt and the scarves, as `#rrggbb`. */
  color: string;
  /** Second color, for stripes and trim. */
  trim: string;
  quirk: Quirk;
}

/** The eight teams, in the order the cup meets them. */
export const TEAMS: readonly CupTeam[] = [
  { id: 'blitz', name: 'FC Blitz', color: '#f2c230', trim: '#1d2a5c', quirk: 'small' },
  { id: 'loewen', name: 'Rote Löwen', color: '#d8382f', trim: '#ffffff', quirk: 'beard' },
  { id: 'adler', name: 'Adler 09', color: '#2f2f38', trim: '#e8b04a', quirk: 'tall' },
  { id: 'haie', name: 'Blaue Haie', color: '#2b6fd6', trim: '#cfe6ff', quirk: 'cap' },
  { id: 'turbo', name: 'Turbo Kicker', color: '#f07a1a', trim: '#2f2f38', quirk: 'celebratesSaves' },
  { id: 'froesche', name: 'Grüne Frösche', color: '#3aa64a', trim: '#f2e85c', quirk: 'looksLeft' },
  { id: 'sternenelf', name: 'Sternenelf', color: '#6a3fb5', trim: '#f2d24a', quirk: 'tall' },
  { id: 'woelfe', name: 'Wilde Wölfe', color: '#7a8590', trim: '#1f2630', quirk: 'beard' },
];

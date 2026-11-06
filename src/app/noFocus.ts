/** Props for a button that never takes focus, so keys keep going to the game. */
export const noFocus = { tabIndex: -1, onMouseDown: (e: { preventDefault(): void }) => e.preventDefault() } as const;

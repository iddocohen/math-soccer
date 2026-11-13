# Amendment 19: arms up in the cup lift, and fewer stars

**Date**: 2026-11-13
**Requested by**: the parent:
- "if the player wins and raises the hand at pokal, the arms still look they are down."
- "my son after pokal has so many stars now, and he already can buy everything 2 or three times, first we need to reduce that."

Answer: use the proposed amounts and prices, and keep his current balance.

**Changes**: the final win animation (FR-110), stars (FR-042, FR-112, FR-126) and item prices (FR-043, FR-113).

## Cup lift

- **FR-131**: During the cup lift the player's arms MUST be raised, with both hands holding the cup from below above his head. The arms stay up for the whole lift, then come down. The resting and kicking poses are unchanged.

## Stars earned

| Event | Before | New |
|-------|--------|-----|
| Goal (all game types) | 2 | 1 |
| Cup match won (bonus) | 5 | 3 |
| Cup won (bonus) | 20 | 10 |
| Cutout square (not the last) | 1 | 0 |
| Cutout completed (bonus) | 3 | 2 |

- **FR-132**: The amounts above MUST be used everywhere: the controller, the cup, cutouts and the round-end display.

## Prices

- **FR-133**: Item prices MUST be:
  - ball designs: 30 to 120 stars
  - shirt and scarf colors: 20 to 60
  - celebrations: 50 to 150

  The free starter items stay free. The exact price of each item is in `src/core/rewards/items.ts`, spread evenly from the cheapest to the most special item.
- Items already owned stay owned, and the current star balance stays. Nothing is taken away. Design call: losing stars would feel like a punishment.

## Tests

- Unit: the star amounts per event; every price is within its range; owned items and balance unchanged on load.
- Unit or e2e: the player pose during the cup lift has both arms above the head.

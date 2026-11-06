// Structure adapted from math-tank src/core/rewards/garage.test.ts.
import { describe, expect, it } from 'vitest';
import { LOCKER_ROOM } from '../storage/storage';
import { emptyLockerRoom } from '../storage/schemas';
import { BALL_DESIGNS, CELEBRATIONS, ITEMS, ITEM_KINDS, STARTER, ballDesign, celebrationOf, isFree, itemById } from './items';
import {
  award,
  buy,
  canBuy,
  chosen,
  cleanLockerRoom,
  cleanShirtName,
  equip,
  lookKey,
  lookOf,
  newStars,
  setShirtName,
  setShirtNumber,
  GOAL_STARS,
  starsNeeded,
} from './lockerRoom';

describe('items', () => {
  it('has ball designs, shirt colors and scarf colors with unique ids', () => {
    for (const kind of ITEM_KINDS) expect(ITEMS.filter((i) => i.kind === kind).length).toBeGreaterThan(3);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const item of ITEMS) expect(item.id.startsWith(`${item.kind}.`)).toBe(true);
  });

  it('costs 0 for free items and 5 to 40 stars otherwise', () => {
    for (const item of ITEMS) expect(item.price === 0 || (item.price >= 5 && item.price <= 40)).toBe(true);
    expect(ITEMS.some((i) => i.price === 5)).toBe(true);
    expect(ITEMS.some((i) => i.price === 40)).toBe(true);
  });

  it('gives the classic ball, the yellow and white shirts and the yellow scarves for free', () => {
    expect(ITEMS.filter((i) => i.price === 0).map((i) => i.id)).toEqual(['ball.classic', 'shirt.yellow', 'shirt.white', 'scarf.yellow', 'celebration.armsUp']);
    for (const id of Object.values(STARTER)) expect(isFree(id)).toBe(true);
  });

  it('has one ball item per ball design, and colors for shirts and scarves', () => {
    expect(ITEMS.filter((i) => i.kind === 'ball').map((i) => ballDesign(i.id))).toEqual([...BALL_DESIGNS]);
    for (const item of ITEMS) expect(item.color === null).toBe(item.kind === 'ball' || item.kind === 'celebration');
    expect(ballDesign('ball.nothing')).toBe('classic');
    expect(ballDesign('shirt.gold')).toBe('classic');
  });
});

describe('stars', () => {
  it('gives 2 stars per goal (amendment 05)', () => {
    expect(GOAL_STARS).toBe(2);
  });

  it('awards only stars not yet seen in the round, and nothing when a new round starts at 0', () => {
    expect(newStars(0, 2)).toBe(2);
    expect(newStars(2, 4)).toBe(2);
    expect(newStars(4, 4)).toBe(0);
    expect(newStars(6, 0)).toBe(0);
  });

  it('award adds to the balance and the total ever earned', () => {
    const l = award(award(emptyLockerRoom(), 2), 3);
    expect({ stars: l.stars, total: l.totalEarned }).toEqual({ stars: 5, total: 5 });
  });

  it('award never takes stars away', () => {
    const l = award(emptyLockerRoom(), 4);
    for (const n of [0, -2, 1.5, Number.NaN]) expect(award(l, n)).toEqual(l);
  });
});

describe('buy and equip', () => {
  const rich = () => award(emptyLockerRoom(), 25);

  it('buys an item for its price and equips it; the total ever earned stays', () => {
    const l = buy(rich(), 'ball.gold');
    expect(l).toMatchObject({ stars: 5, totalEarned: 25, owned: ['ball.gold'], ball: 'ball.gold' });
    expect(chosen(l, 'ball')).toBe('ball.gold');
  });

  it('does not buy without enough stars, twice, a free item or an unknown item', () => {
    const poor = award(emptyLockerRoom(), 4);
    expect(canBuy(poor, 'ball.blue')).toBe(false);
    expect(buy(poor, 'ball.blue')).toBe(poor);
    expect(starsNeeded(poor, 'ball.blue')).toBe(1);
    const once = buy(rich(), 'shirt.red');
    expect(buy(once, 'shirt.red')).toBe(once);
    expect(buy(rich(), 'shirt.white').stars).toBe(25);
    expect(buy(rich(), 'ball.square').stars).toBe(25);
  });

  it('equips owned and free items of the slot only', () => {
    const l = buy(rich(), 'scarf.red');
    expect(equip(l, 'scarf', 'scarf.yellow').scarfColor).toBe('scarf.yellow');
    expect(equip(l, 'scarf', 'scarf.red').scarfColor).toBe('scarf.red');
    expect(equip(l, 'shirt', 'shirt.white').shirtColor).toBe('shirt.white');
    expect(equip(l, 'ball', 'ball.flames')).toBe(l);
    expect(equip(l, 'ball', 'scarf.red')).toBe(l);
  });
});

describe('shirt number and name', () => {
  it('takes numbers 1 to 99 only', () => {
    const l = emptyLockerRoom();
    expect(setShirtNumber(l, 1).shirtNumber).toBe(1);
    expect(setShirtNumber(l, 99).shirtNumber).toBe(99);
    for (const n of [0, 100, 7.5, -3]) expect(setShirtNumber(l, n)).toBe(l);
  });

  it('keeps up to 10 letters, spaces and hyphens', () => {
    expect(cleanShirtName('Mia')).toBe('Mia');
    expect(cleanShirtName('Jönas-Lü')).toBe('Jönas-Lü');
    expect(cleanShirtName('Abcdefghijkl')).toBe('Abcdefghij');
    expect(cleanShirtName('M1a!<b>')).toBe('Mab');
    expect(setShirtName(emptyLockerRoom(), 'Leo7').shirtName).toBe('Leo');
  });
});

describe('stored locker room', () => {
  it('drops unknown, free and repeated bought items and puts the starter back for items not owned', () => {
    const cleaned = cleanLockerRoom({
      ...emptyLockerRoom(),
      owned: ['ball.gold', 'ball.gold', 'shirt.white', 'ball.starter'],
      ball: 'ball.flames',
      shirtColor: 'scarf.red',
      scarfColor: 'scarf.white',
    });
    expect(cleaned).toMatchObject({ owned: ['ball.gold'], ball: STARTER.ball, shirtColor: STARTER.shirt, scarfColor: STARTER.scarf });
  });

  it('loads through the storage parser with the cleaning', () => {
    expect(LOCKER_ROOM.parse({ ...emptyLockerRoom(), owned: ['ball.blue'], ball: 'ball.blue' })).toMatchObject({ ball: 'ball.blue' });
    expect(LOCKER_ROOM.parse({ ...emptyLockerRoom(), ball: 'ball.blue' })).toMatchObject({ ball: STARTER.ball });
    expect(LOCKER_ROOM.parse({ ...emptyLockerRoom(), shirtName: 'Ab<1>' })).toBeNull();
  });

  it('starts with no stars, the starter items and shirt number 10', () => {
    expect(emptyLockerRoom()).toMatchObject({ stars: 0, owned: [], ball: 'ball.classic', shirtColor: 'shirt.yellow', scarfColor: 'scarf.yellow', shirtNumber: 10 });
  });
});

describe('look', () => {
  it('turns the chosen items into the colors and the ball design the scene draws', () => {
    const l = { ...buy(award(emptyLockerRoom(), 40), 'ball.flames'), shirtColor: 'shirt.white', shirtName: 'Mia', shirtNumber: 7 };
    expect(lookOf(l)).toEqual({
      ball: 'flames',
      shirtColor: itemById('shirt.white')!.color,
      shirtNumber: 7,
      shirtName: 'Mia',
      scarfColor: 0xe8b923,
      celebration: 'armsUp',
    });
    expect(lookKey(lookOf(l))).not.toBe(lookKey(lookOf(emptyLockerRoom())));
  });
});

describe('celebrations (amendment 13, FR-113)', () => {
  it('has the group "Jubel": "Arme hoch" free and chosen by default, the others for 10 to 30 stars', () => {
    const items = ITEMS.filter((i) => i.kind === 'celebration');
    expect(items.map((i) => celebrationOf(i.id)).sort()).toEqual([...CELEBRATIONS].sort());
    expect(itemById('celebration.armsUp')!.price).toBe(0);
    for (const item of items.filter((i) => i.id !== 'celebration.armsUp')) {
      expect(item.price).toBeGreaterThanOrEqual(10);
      expect(item.price).toBeLessThanOrEqual(30);
    }
    expect(emptyLockerRoom().celebration).toBe('celebration.armsUp');
    expect(lookOf(emptyLockerRoom()).celebration).toBe('armsUp');
  });

  it('buys a celebration for its price and chooses it; another tap chooses an owned one again', () => {
    const bought = buy(award(emptyLockerRoom(), 12), 'celebration.slide');
    expect(bought).toMatchObject({ stars: 2, owned: ['celebration.slide'], celebration: 'celebration.slide' });
    expect(lookOf(bought).celebration).toBe('slide');
    const back = equip(bought, 'celebration', 'celebration.armsUp');
    expect(chosen(back, 'celebration')).toBe('celebration.armsUp');
    expect(chosen(equip(back, 'celebration', 'celebration.slide'), 'celebration')).toBe('celebration.slide');
  });

  it('does not buy or choose a celebration without the stars, and not one of another kind', () => {
    const poor = award(emptyLockerRoom(), 29);
    expect(canBuy(poor, 'celebration.backflip')).toBe(false);
    expect(buy(poor, 'celebration.backflip')).toBe(poor);
    expect(equip(poor, 'celebration', 'celebration.backflip')).toBe(poor);
    expect(equip(poor, 'celebration', 'ball.classic')).toBe(poor);
    expect(starsNeeded(poor, 'celebration.backflip')).toBe(1);
  });

  it('loads a chosen celebration that is not owned or unknown as "Arme hoch"', () => {
    expect(cleanLockerRoom({ ...emptyLockerRoom(), celebration: 'celebration.heart' }).celebration).toBe('celebration.armsUp');
    expect(cleanLockerRoom({ ...emptyLockerRoom(), celebration: 'celebration.moonwalk' }).celebration).toBe('celebration.armsUp');
    expect(cleanLockerRoom({ ...emptyLockerRoom(), owned: ['celebration.heart'], celebration: 'celebration.heart' }).celebration).toBe('celebration.heart');
    expect(celebrationOf('ball.gold')).toBe('armsUp');
  });

  it('stores the celebration; a locker room without one is not read', () => {
    const stored = { ...emptyLockerRoom(), stars: 3, owned: ['celebration.dance'], celebration: 'celebration.dance' };
    expect(LOCKER_ROOM.parse(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    const noCelebration: Record<string, unknown> = { ...stored };
    delete noCelebration.celebration;
    expect(LOCKER_ROOM.parse(noCelebration)).toBeNull();
  });
});

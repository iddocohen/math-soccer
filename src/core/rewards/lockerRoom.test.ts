// Structure adapted from math-tank src/core/rewards/garage.test.ts.
import { describe, expect, it } from 'vitest';
import { LOCKER_ROOM } from '../storage/storage';
import { emptyLockerRoom } from '../storage/schemas';
import { BALL_DESIGNS, ITEMS, ITEM_KINDS, STARTER, ballDesign, isFree, itemById } from './items';
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
  starsFor,
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
    expect(ITEMS.filter((i) => i.price === 0).map((i) => i.id)).toEqual(['ball.classic', 'shirt.yellow', 'shirt.white', 'scarf.yellow']);
    for (const id of Object.values(STARTER)) expect(isFree(id)).toBe(true);
  });

  it('has one ball item per ball design, and colors for shirts and scarves', () => {
    expect(ITEMS.filter((i) => i.kind === 'ball').map((i) => ballDesign(i.id))).toEqual([...BALL_DESIGNS]);
    for (const item of ITEMS) expect(item.color === null).toBe(item.kind === 'ball');
    expect(ballDesign('ball.nothing')).toBe('classic');
    expect(ballDesign('shirt.gold')).toBe('classic');
  });
});

describe('stars', () => {
  it('gives 1 per correct square and 3 more per finished line in line mode, 2 per goal in hole and keeper mode', () => {
    expect(starsFor('square', 'lines')).toBe(1);
    expect(starsFor('lineDone', 'lines')).toBe(4);
    expect(starsFor('goal', 'holes')).toBe(2);
    expect(starsFor('goal', 'keeper')).toBe(2);
    expect(starsFor('square', 'holes')).toBe(0);
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
    expect(lookOf(l)).toEqual({ ball: 'flames', shirtColor: itemById('shirt.white')!.color, shirtNumber: 7, shirtName: 'Mia', scarfColor: 0xe8b923 });
    expect(lookKey(lookOf(l))).not.toBe(lookKey(lookOf(emptyLockerRoom())));
  });
});

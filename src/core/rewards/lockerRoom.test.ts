// Structure adapted from math-tank src/core/rewards/garage.test.ts.
import { describe, expect, it } from 'vitest';
import { LOCKER_ROOM } from '../storage/storage';
import { emptyLockerRoom } from '../storage/schemas';
import {
  BALL_DESIGNS,
  CELEBRATIONS,
  FLOODLIGHTS,
  WEATHERS,
  STANDS,
  floodlightOf,
  standsOf,
  weatherOf,
  GOAL_EFFECTS,
  ITEMS,
  ITEM_KINDS,
  MASCOTS,
  PRICE_RANGES,
  STARTER,
  TRAILS,
  ballDesign,
  celebrationOf,
  goalEffectOf,
  isFree,
  itemById,
  mascotOf,
  trailOf,
} from './items';
import { STARS,
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
  cleanStadiumName,
  setStadiumName,
  stadiumNameShown,
  STADIUM_NAME_MAX,
  starsNeeded,
} from './lockerRoom';

describe('items', () => {
  it('has ball designs, shirt colors and scarf colors with unique ids', () => {
    // The stands are the one group of two: the usual and the bigger stands (amendment 20).
    for (const kind of ITEM_KINDS) expect(ITEMS.filter((i) => i.kind === kind).length).toBeGreaterThan(kind === 'stands' ? 1 : 3);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const item of ITEMS) expect(item.id.startsWith(`${item.kind}.`)).toBe(true);
  });

  it('costs 0 for free items, and otherwise a price within its kind\'s range (amendment 19, FR-133)', () => {
    expect(PRICE_RANGES).toEqual({
      ball: { min: 30, max: 120 },
      shirt: { min: 20, max: 60 },
      scarf: { min: 20, max: 60 },
      celebration: { min: 50, max: 150 },
      trail: { min: 40, max: 120 },
      goalEffect: { min: 60, max: 120 },
      mascot: { min: 80, max: 150 },
      stands: { min: 150, max: 150 },
      floodlight: { min: 40, max: 40 },
      weather: { min: 50, max: 100 },
    });
    for (const kind of ITEM_KINDS) {
      const prices = ITEMS.filter((i) => i.kind === kind && i.price > 0).map((i) => i.price);
      for (const price of prices) {
        expect(price).toBeGreaterThanOrEqual(PRICE_RANGES[kind].min);
        expect(price).toBeLessThanOrEqual(PRICE_RANGES[kind].max);
      }
      // The cheapest item costs the range's lowest price and the most special its highest, in locker room order.
      expect(prices[0]).toBe(PRICE_RANGES[kind].min);
      expect(prices[prices.length - 1]).toBe(PRICE_RANGES[kind].max);
      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    }
  });

  it('gives the classic ball, the yellow and white shirts and the yellow scarves for free', () => {
    expect(ITEMS.filter((i) => i.price === 0).map((i) => i.id)).toEqual([
      'ball.classic',
      'shirt.yellow',
      'shirt.white',
      'scarf.yellow',
      'celebration.armsUp',
      'trail.none',
      'goalEffect.none',
      'mascot.none',
      'stands.normal',
      'floodlight.white',
      'weather.evening',
    ]);
    for (const id of Object.values(STARTER)) expect(isFree(id)).toBe(true);
  });

  it('has one ball item per ball design, and colors for shirts and scarves', () => {
    expect(ITEMS.filter((i) => i.kind === 'ball').map((i) => ballDesign(i.id))).toEqual([...BALL_DESIGNS]);
    for (const item of ITEMS) expect(item.color !== null).toBe(item.kind === 'shirt' || item.kind === 'scarf');
    expect(ballDesign('ball.nothing')).toBe('classic');
    expect(ballDesign('shirt.gold')).toBe('classic');
  });
});

describe('stars', () => {
  it('gives 1 star per goal (amendment 19, FR-132)', () => {
    expect(STARS.goal).toBe(1);
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
  const rich = () => award(emptyLockerRoom(), 200);

  it('buys an item for its price and equips it; the total ever earned stays', () => {
    const l = buy(rich(), 'ball.gold');
    expect(l).toMatchObject({ stars: 125, totalEarned: 200, owned: ['ball.gold'], ball: 'ball.gold' });
    expect(chosen(l, 'ball')).toBe('ball.gold');
  });

  it('does not buy without enough stars, twice, a free item or an unknown item', () => {
    const poor = award(emptyLockerRoom(), 29);
    expect(canBuy(poor, 'ball.blue')).toBe(false);
    expect(buy(poor, 'ball.blue')).toBe(poor);
    expect(starsNeeded(poor, 'ball.blue')).toBe(1);
    const once = buy(rich(), 'shirt.red');
    expect(buy(once, 'shirt.red')).toBe(once);
    expect(buy(rich(), 'shirt.white').stars).toBe(200);
    expect(buy(rich(), 'ball.square').stars).toBe(200);
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

  it('keeps the star balance and the items bought at the old prices when it loads (amendment 19, FR-133)', () => {
    const before = {
      ...emptyLockerRoom(),
      stars: 87,
      totalEarned: 240,
      owned: ['ball.rainbow', 'shirt.orange', 'scarf.purple', 'celebration.backflip'],
      ball: 'ball.rainbow',
      shirtColor: 'shirt.orange',
      scarfColor: 'scarf.purple',
      celebration: 'celebration.backflip',
    };
    expect(LOCKER_ROOM.parse(JSON.parse(JSON.stringify(before)))).toEqual(before);
  });

  it('starts with no stars, the starter items and shirt number 10', () => {
    expect(emptyLockerRoom()).toMatchObject({ stars: 0, owned: [], ball: 'ball.classic', shirtColor: 'shirt.yellow', scarfColor: 'scarf.yellow', shirtNumber: 10 });
  });
});

describe('look', () => {
  it('turns the chosen items into the colors and the ball design the scene draws', () => {
    const l = { ...buy(award(emptyLockerRoom(), 100), 'ball.flames'), shirtColor: 'shirt.white', shirtName: 'Mia', shirtNumber: 7 };
    expect(lookOf(l)).toEqual({
      ball: 'flames',
      shirtColor: itemById('shirt.white')!.color,
      shirtNumber: 7,
      shirtName: 'Mia',
      scarfColor: 0xe8b923,
      celebration: 'armsUp',
      trail: 'none',
      goalEffect: 'none',
      mascot: 'none',
      stands: 'normal',
      floodlight: 'white',
      weather: 'evening',
      stadiumName: 'Mathe-Arena',
    });
    expect(lookKey(lookOf(l))).not.toBe(lookKey(lookOf(emptyLockerRoom())));
  });
});

describe('celebrations (amendment 13, FR-113)', () => {
  it('has the group "Jubel": "Arme hoch" free and chosen by default, the others for 50 to 150 stars', () => {
    const items = ITEMS.filter((i) => i.kind === 'celebration');
    expect(items.map((i) => celebrationOf(i.id)).sort()).toEqual([...CELEBRATIONS].sort());
    expect(itemById('celebration.armsUp')!.price).toBe(0);
    for (const item of items.filter((i) => i.id !== 'celebration.armsUp')) {
      expect(item.price).toBeGreaterThanOrEqual(50);
      expect(item.price).toBeLessThanOrEqual(150);
    }
    expect(emptyLockerRoom().celebration).toBe('celebration.armsUp');
    expect(lookOf(emptyLockerRoom()).celebration).toBe('armsUp');
  });

  it('buys a celebration for its price and chooses it; another tap chooses an owned one again', () => {
    const bought = buy(award(emptyLockerRoom(), 52), 'celebration.slide');
    expect(bought).toMatchObject({ stars: 2, owned: ['celebration.slide'], celebration: 'celebration.slide' });
    expect(lookOf(bought).celebration).toBe('slide');
    const back = equip(bought, 'celebration', 'celebration.armsUp');
    expect(chosen(back, 'celebration')).toBe('celebration.armsUp');
    expect(chosen(equip(back, 'celebration', 'celebration.slide'), 'celebration')).toBe('celebration.slide');
  });

  it('does not buy or choose a celebration without the stars, and not one of another kind', () => {
    const poor = award(emptyLockerRoom(), 149);
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

describe('trails, goal effects and mascots (amendment 20)', () => {
  it('has the groups with "Ohne" free and chosen by default, and the others within their price ranges', () => {
    const names = (kind: string) => ITEMS.filter((i) => i.kind === kind).map((i) => i.id.slice(kind.length + 1));
    expect(names('trail').sort()).toEqual([...TRAILS].sort());
    expect(names('goalEffect').sort()).toEqual([...GOAL_EFFECTS].sort());
    expect(names('mascot').sort()).toEqual([...MASCOTS].sort());
    expect(PRICE_RANGES.trail).toEqual({ min: 40, max: 120 });
    expect(PRICE_RANGES.goalEffect).toEqual({ min: 60, max: 120 });
    expect(PRICE_RANGES.mascot).toEqual({ min: 80, max: 150 });
    expect(emptyLockerRoom()).toMatchObject({ trail: 'trail.none', goalEffect: 'goalEffect.none', mascot: 'mascot.none' });
    expect(lookOf(emptyLockerRoom())).toMatchObject({ trail: 'none', goalEffect: 'none', mascot: 'none' });
  });

  it('buys and chooses an item of each group, and chooses "Ohne" again for free', () => {
    let l = award(emptyLockerRoom(), 400);
    l = buy(l, 'trail.fire');
    l = buy(l, 'goalEffect.fireworks');
    l = buy(l, 'mascot.lion');
    expect(l).toMatchObject({ stars: 400 - 95 - 90 - 150, trail: 'trail.fire', goalEffect: 'goalEffect.fireworks', mascot: 'mascot.lion' });
    expect(lookOf(l)).toMatchObject({ trail: 'fire', goalEffect: 'fireworks', mascot: 'lion' });
    for (const kind of ['trail', 'goalEffect', 'mascot'] as const) {
      const none = equip(l, kind, `${kind}.none`);
      expect(chosen(none, kind)).toBe(`${kind}.none`);
      expect(none.stars).toBe(l.stars);
    }
    expect(equip(l, 'mascot', 'trail.fire')).toBe(l);
    expect(equip(l, 'mascot', 'mascot.dog')).toBe(l);
  });

  it('does not buy without the stars', () => {
    const poor = award(emptyLockerRoom(), 149);
    expect(buy(poor, 'mascot.lion')).toBe(poor);
    expect(starsNeeded(poor, 'mascot.lion')).toBe(1);
    expect(canBuy(poor, 'trail.rainbow')).toBe(true);
  });

  it('reads the names of ids, and none for anything else', () => {
    expect(trailOf('trail.rainbow')).toBe('rainbow');
    expect(trailOf('ball.rainbow')).toBe('none');
    expect(goalEffectOf('goalEffect.lightShow')).toBe('lightShow');
    expect(goalEffectOf('goalEffect.thunder')).toBe('none');
    expect(mascotOf('mascot.penguin')).toBe('penguin');
    expect(mascotOf('mascot.cat')).toBe('none');
  });

  it('loads a locker room stored before amendment 20 with no trail, effect or mascot, and drops ones not owned', () => {
    const old: Record<string, unknown> = { ...emptyLockerRoom(), stars: 9, owned: ['ball.gold'], ball: 'ball.gold' };
    delete old.trail;
    delete old.goalEffect;
    delete old.mascot;
    expect(LOCKER_ROOM.parse(old)).toMatchObject({ stars: 9, ball: 'ball.gold', trail: 'trail.none', goalEffect: 'goalEffect.none', mascot: 'mascot.none' });
    expect(LOCKER_ROOM.parse({ ...emptyLockerRoom(), mascot: 'mascot.lion' })).toMatchObject({ mascot: 'mascot.none' });
    const stored = { ...emptyLockerRoom(), owned: ['mascot.lion', 'trail.stars'], mascot: 'mascot.lion', trail: 'trail.stars' };
    expect(LOCKER_ROOM.parse(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
});

describe('stadium and weather (amendment 20 part 2, FR-135, FR-138)', () => {
  const names = (kind: string) => ITEMS.filter((i) => i.kind === kind).map((i) => i.id.slice(kind.length + 1));

  it('has the stands, floodlight colors and weathers with the free one chosen by default, and prices in their ranges', () => {
    expect(names('stands')).toEqual([...STANDS]);
    expect(names('floodlight')).toEqual([...FLOODLIGHTS]);
    expect(names('weather')).toEqual([...WEATHERS]);
    expect(itemById('stands.big')!.price).toBe(150);
    for (const name of FLOODLIGHTS.filter((f) => f !== 'white')) expect(itemById(`floodlight.${name}`)!.price).toBe(40);
    for (const name of WEATHERS.filter((w) => w !== 'evening')) {
      const price = itemById(`weather.${name}`)!.price;
      expect(price).toBeGreaterThanOrEqual(50);
      expect(price).toBeLessThanOrEqual(100);
    }
    expect(isFree('stands.normal') && isFree('floodlight.white') && isFree('weather.evening')).toBe(true);
    expect(emptyLockerRoom()).toMatchObject({ stadiumName: 'Mathe-Arena', stands: 'stands.normal', floodlight: 'floodlight.white', weather: 'weather.evening' });
  });

  it('buys and chooses an item of each group, and chooses the free one again at no cost', () => {
    let l = award(emptyLockerRoom(), 300);
    l = buy(l, 'stands.big');
    l = buy(l, 'floodlight.purple');
    l = buy(l, 'weather.snow');
    expect(l).toMatchObject({ stars: 300 - 150 - 40 - 100, stands: 'stands.big', floodlight: 'floodlight.purple', weather: 'weather.snow' });
    expect(lookOf(l)).toMatchObject({ stands: 'big', floodlight: 'purple', weather: 'snow' });
    expect(buy(l, 'weather.rain')).toBe(l);
    expect(starsNeeded(l, 'weather.rain')).toBe(80 - 10);
    for (const [kind, free] of [
      ['stands', 'stands.normal'],
      ['floodlight', 'floodlight.white'],
      ['weather', 'weather.evening'],
    ] as const) {
      const back = equip(l, kind, free);
      expect(chosen(back, kind)).toBe(free);
      expect(back.stars).toBe(l.stars);
      // The bought item stays owned and is chosen again for free.
      expect(chosen(equip(back, kind, chosen(l, kind)), kind)).toBe(chosen(l, kind));
    }
    expect(equip(l, 'weather', 'weather.day')).toBe(l);
    expect(equip(l, 'weather', 'floodlight.gold')).toBe(l);
  });

  it('limits the stadium name to 14 letters, digits, spaces and hyphens', () => {
    expect(STADIUM_NAME_MAX).toBe(14);
    expect(cleanStadiumName('Fußball-Arena Nord')).toBe('Fußball-Arena ');
    expect(Array.from(cleanStadiumName('ÄÖÜäöüßéèàçñøå')).length).toBe(14);
    expect(cleanStadiumName('Arena 2026!')).toBe('Arena 2026');
    expect(cleanStadiumName('<b>Mia</b>')).toBe('bMiab');
    const l = setStadiumName(emptyLockerRoom(), 'Sonnenschein-Stadion');
    expect(l.stadiumName).toBe('Sonnenschein-S');
    expect(LOCKER_ROOM.parse(l)?.stadiumName).toBe('Sonnenschein-S');
    expect(LOCKER_ROOM.parse({ ...emptyLockerRoom(), stadiumName: 'A'.repeat(15) })).toBeNull();
  });

  it('shows "Mathe-Arena" while the name is empty', () => {
    expect(stadiumNameShown('')).toBe('Mathe-Arena');
    expect(stadiumNameShown('   ')).toBe('Mathe-Arena');
    expect(stadiumNameShown(' Mia Park ')).toBe('Mia Park');
    expect(lookOf(setStadiumName(emptyLockerRoom(), '')).stadiumName).toBe('Mathe-Arena');
  });

  it('loads a locker room stored before part 2 with the defaults, and drops an item not owned', () => {
    const old: Record<string, unknown> = { ...emptyLockerRoom() };
    for (const key of ['stadiumName', 'stands', 'floodlight', 'weather']) delete old[key];
    expect(LOCKER_ROOM.parse(old)).toMatchObject({ stadiumName: 'Mathe-Arena', stands: 'stands.normal', floodlight: 'floodlight.white', weather: 'weather.evening' });
    const cheat = cleanLockerRoom({ ...emptyLockerRoom(), weather: 'weather.snow', stands: 'stands.big', floodlight: 'weather.day' });
    expect(cheat).toMatchObject({ weather: 'weather.evening', stands: 'stands.normal', floodlight: 'floodlight.white' });
  });

  it('reads the names of ids, and the free one for anything else', () => {
    expect(standsOf('stands.big')).toBe('big');
    expect(standsOf('stands.huge')).toBe('normal');
    expect(floodlightOf('floodlight.green')).toBe('green');
    expect(floodlightOf('shirt.green')).toBe('white');
    expect(weatherOf('weather.sunset')).toBe('sunset');
    expect(weatherOf('weather.fog')).toBe('evening');
  });
});

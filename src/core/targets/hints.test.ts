import { describe, expect, it } from 'vitest';
import { layoutChart } from '../chart/layout';
import { directionsOf, hintOffsets, hintsFor, STEP } from './hints';

const chart = layoutChart(1, 100);

describe('STEP', () => {
  it('maps the 8 directions to their number steps', () => {
    expect(STEP).toEqual({ right: 1, left: -1, down: 10, up: -10, downRight: 11, upLeft: -11, downLeft: 9, upRight: -9 });
  });
});

describe('hintsFor', () => {
  it('hintsFor(46, direct) is 45, 47, 36, 56 (acceptance scenario US1-2)', () => {
    expect(hintsFor(chart, 46, 'direct')).toEqual([45, 47, 36, 56]);
  });

  it('gives only above and below for vertical, the four diagonals for diagonal, two squares away for far', () => {
    expect(hintsFor(chart, 46, 'vertical')).toEqual([36, 56]);
    expect(hintsFor(chart, 46, 'diagonal')).toEqual([35, 37, 55, 57]);
    expect(hintsFor(chart, 46, 'far')).toEqual([44, 48, 26, 66]);
  });

  it('drops hints off the chart: corners, edges and the end of the range', () => {
    expect(hintsFor(chart, 1, 'direct')).toEqual([2, 11]);
    expect(hintsFor(chart, 10, 'direct')).toEqual([9, 20]);
    expect(hintsFor(chart, 100, 'direct')).toEqual([99, 90]);
    expect(hintsFor(chart, 1, 'diagonal')).toEqual([12]);
    expect(hintsFor(chart, 11, 'far')).toEqual([13, 31]);
  });

  it('never wraps across a row edge: 20 has no hint 21 beside it', () => {
    expect(hintsFor(chart, 20, 'direct')).toEqual([19, 10, 30]);
    expect(hintsFor(chart, 20, 'diagonal')).toEqual([9, 29]);
  });

  it('drops squares outside the range in a partial row (205 to 480)', () => {
    const partial = layoutChart(205, 480);
    expect(hintsFor(partial, 205, 'direct')).toEqual([206, 215]);
    expect(hintsFor(partial, 480, 'direct')).toEqual([479, 470]);
  });

  it('gives one hint per offset at most', () => {
    for (const distance of ['direct', 'vertical', 'diagonal', 'far'] as const) {
      for (let n = 1; n <= 100; n++) expect(hintsFor(chart, n, distance).length).toBeLessThanOrEqual(hintOffsets(distance).length);
    }
  });
});

describe('directionsOf', () => {
  it('maps a hint above to down and a hint below to up', () => {
    expect(directionsOf(46, [36])).toEqual(['down']);
    expect(directionsOf(46, [56])).toEqual(['up']);
  });

  it('maps hints beside to right and left', () => {
    expect(directionsOf(46, [45])).toEqual(['right']);
    expect(directionsOf(46, [47])).toEqual(['left']);
  });

  it('maps diagonal hints to the diagonal directions', () => {
    expect(directionsOf(46, [35])).toEqual(['downRight']);
    expect(directionsOf(46, [57])).toEqual(['upLeft']);
    expect(directionsOf(46, [37])).toEqual(['downLeft']);
    expect(directionsOf(46, [55])).toEqual(['upRight']);
  });

  it('counts far hints as the matching direction', () => {
    expect(directionsOf(46, [44, 48, 26, 66])).toEqual(['right', 'left', 'down', 'up']);
  });

  it('lists each direction once, in the fixed order', () => {
    expect(directionsOf(46, [56, 36, 36, 45])).toEqual(['right', 'down', 'up']);
    expect(directionsOf(46, [])).toEqual([]);
  });
});

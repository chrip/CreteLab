import { describe, expect, it } from 'vitest';
import { volumeBreakdown } from '@cretelab/engine';
import { formatAmount, formatBreakdown, formatCompact, formatHalves, formatNumber, formatVolume, parseDecimal } from '../../app/utils/format';

describe('formatNumber', () => {
  it('uses the decimal comma in German and the point in English', () => {
    expect(formatNumber('de', 1234.5, 1)).toBe('1.234,5');
    expect(formatNumber('en', 1234.5, 1)).toBe('1,234.5');
  });
});

describe('formatCompact', () => {
  it('drops trailing zeros', () => {
    expect(formatCompact('de', 2)).toBe('2');
    expect(formatCompact('de', 2.5)).toBe('2,5');
    expect(formatCompact('en', 0.125, 3)).toBe('0.125');
  });
});

describe('formatAmount', () => {
  it.each([
    [0.35, 'kg', '350 g'],
    [0.2, 'l', '200 ml'],
    [4.54, 'kg', '4,5 kg'],
    [812.4, 'kg', '812 kg'],
    [1061.1, 'kg', '1.061 kg'],
    [0, 'kg', '0,0 kg'],
  ] as const)('%s %s → %s', (value, unit, expected) => {
    expect(formatAmount('de', value, unit)).toBe(expected);
  });
});

describe('formatVolume', () => {
  it('shows litres below 0.1 m³ and cubic metres above', () => {
    expect(formatVolume('de', 0.0148)).toBe('15 l');
    expect(formatVolume('de', 0.0045)).toBe('4,5 l');
    expect(formatVolume('de', 0.05)).toBe('50 l');
    expect(formatVolume('de', 0.001)).toBe('1,0 l');
    expect(formatVolume('de', 2.7)).toBe('2,70 m³');
    expect(formatVolume('en', 2.7)).toBe('2.70 m³');
  });
});

describe('parseDecimal', () => {
  it.each([
    ['2,5', 2.5],
    ['2.5', 2.5],
    [' 12 ', 12],
    ['.5', 0.5],
    [3, 3],
  ] as const)('reads %j as %s', (raw, expected) => {
    expect(parseDecimal(raw)).toBe(expected);
  });

  it.each(['', 'abc', '2,5 m', '1.000,5', null, undefined])('rejects %j', (raw) => {
    expect(parseDecimal(raw)).toBeNaN();
  });
});

describe('formatBreakdown', () => {
  it('a driveway in metres', () => {
    const b = volumeBreakdown('slab', { length: 6, width: 3, height: 0.15 })!;
    expect(formatBreakdown('de', b)).toBe('6 m × 3 m × 0,15 m = 2,70 m³');
    expect(formatBreakdown('en', b)).toBe('6 m × 3 m × 0.15 m = 2.70 m³');
  });

  it('a slab given by its area', () => {
    expect(formatBreakdown('de', volumeBreakdown('slab', { area: 25, height: 0.15 })!)).toBe('25 m² × 0,15 m = 3,75 m³');
  });

  it('a planter in cm: outer minus inner', () => {
    const b = volumeBreakdown('hollow', { length: 0.4, width: 0.4, height: 0.4, wall: 0.02 })!;
    expect(formatBreakdown('de', b)).toBe('(40 cm × 40 cm × 40 cm) − (36 cm × 36 cm × 38 cm) = 15 l');
  });

  it('twelve post holes', () => {
    const b = volumeBreakdown('cylinder', { diameter: 0.3, height: 0.8, count: 12 })!;
    expect(formatBreakdown('de', b)).toBe('π/4 × (30 cm)² × 80 cm × 12 = 0,68 m³');
  });

  it('a round pot', () => {
    const b = volumeBreakdown('hollow', { diameter: 0.4, height: 0.35, wall: 0.025 })!;
    expect(formatBreakdown('de', b)).toBe('(π/4 × (40 cm)² × 35 cm) − (π/4 × (35 cm)² × 32,5 cm) = 13 l');
  });
});

describe('formatHalves', () => {
  it('counts to the half like on site', () => {
    expect(formatHalves('de', 8.5)).toBe('8½');
    expect(formatHalves('de', 0.5)).toBe('½');
    expect(formatHalves('de', 3)).toBe('3');
    expect(formatHalves('en', 12)).toBe('12');
  });
});

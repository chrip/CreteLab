import { describe, expect, it } from 'vitest';
import { formatAmount, formatCompact, formatNumber, formatVolume, parseDecimal } from '../../app/utils/format';

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

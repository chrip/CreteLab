// Exposure classes: limits and the combination of several classes
// (DIN 1045-2; Zement-Merkblatt B 20 Tafel 2).
import { describe, it, expect } from 'vitest';
import {
  EXPOSURE_CLASSES, FROST_OR_WEAR, NEEDS_AIR, STRENGTH_CLASSES, isExposureClass,
  strictestLimits,
} from '../../src/index';
import { recipeFor } from './helpers';

describe('Maximum w/c ratio per class', () => {
  it('X0 has no limit', () => expect(EXPOSURE_CLASSES.X0.maxWz).toBeNull());
  it('XC1 allows 0,75', () => expect(EXPOSURE_CLASSES.XC1.maxWz).toBe(0.75));
  it('XF4 allows 0,50', () => expect(EXPOSURE_CLASSES.XF4.maxWz).toBe(0.5));

  it('the recipe applies the usual allowance of −0,02 when the exposure limit governs (XC1: 0,73)', () => {
    // C8/10 with CEM I 52,5 R: the Walz curve would allow far more than 0,75.
    const r = recipeFor({ strengthClass: 'C8/10', exposureClasses: ['XC1'], cementType: 'CEM I 52.5 R', margin: 3 });
    expect(r.wzSource).toBe('exposure');
    expect(r.wz).toBeCloseTo(0.73, 10);
  });

  it('X0 falls back to 0,75 as the exposure w/c', () => {
    const r = recipeFor({ strengthClass: 'C8/10', exposureClasses: ['X0'], cementType: 'CEM I 52.5 R', margin: 3 });
    expect(r.wzExposure).toBe(0.75);
    expect(r.limits.maxWz).toBe(Infinity);
  });
});

describe('Strength requirements', () => {
  it('C20/25 satisfies XC1 (needs C16/20)', () => {
    expect(STRENGTH_CLASSES['C20/25'].fckCube).toBeGreaterThanOrEqual(EXPOSURE_CLASSES.XC1.minFckCube);
  });

  it('C12/15 does not satisfy XC4 (needs C25/30)', () => {
    expect(STRENGTH_CLASSES['C12/15'].fckCube).toBeLessThan(EXPOSURE_CLASSES.XC4.minFckCube);
  });
});

describe('Combining exposure classes: the strictest limit wins (strictestLimits)', () => {
  it('XC4 + XD1 → w/z 0,55, 300 kg, C30/37', () => {
    expect(strictestLimits(['XC4', 'XD1'])).toEqual({ maxWz: 0.55, minCement: 300, minFckCube: 37 });
  });

  it('no classes → no limits', () => {
    expect(strictestLimits([])).toEqual({ maxWz: Infinity, minCement: 0, minFckCube: 0 });
  });

  it('X0 alone has no w/c limit', () => {
    expect(strictestLimits(['X0']).maxWz).toBe(Infinity);
  });

  it('air entrainment relaxes XF2/XF3 only, the other classes keep their limits', () => {
    // XF2 air-entrained: 0,55 / 300 / C25/30; XD2 still demands 0,50 / 320 / C35/45.
    expect(strictestLimits(['XF2', 'XD2'], { airEntrained: true }))
      .toEqual({ maxWz: 0.5, minCement: 320, minFckCube: 45 });
    expect(strictestLimits(['XF3', 'XC4'], { airEntrained: true }))
      .toEqual({ maxWz: 0.55, minCement: 300, minFckCube: 30 });
    // XF4 has no relaxed variant.
    expect(strictestLimits(['XF4'], { airEntrained: true })).toEqual(strictestLimits(['XF4']));
  });
});

describe('Class groups', () => {
  it('frost and wear classes (stricter fines limit, B 20 Tafel 23)', () => {
    expect([...FROST_OR_WEAR]).toEqual(['XF1', 'XF2', 'XF3', 'XF4', 'XM1', 'XM2', 'XM3']);
  });

  it('XF2–XF4 usually need air entrainment', () => {
    expect([...NEEDS_AIR]).toEqual(['XF2', 'XF3', 'XF4']);
  });

  it('isExposureClass recognises the class names only', () => {
    expect(isExposureClass('XC4')).toBe(true);
    expect(isExposureClass('XC5')).toBe(false);
    expect(isExposureClass(null)).toBe(false);
  });
});

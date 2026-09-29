/**
 * Minimum strength class per exposure class (DIN 1045-2, Zement-Merkblatt B 9 Tafel 3/4).
 *
 * Regression: the minimum used to hold cylinder strengths (the first number of the class
 * name) while it was compared against the cube strength. Every check was one class too
 * lax, e.g. C20/25 was accepted for XC4 (needs C25/30).
 */
import { describe, it, expect } from 'vitest';
import {
  EXPOSURE_CLASSES, EXPOSURE_CLASS_NAMES, STRENGTH_CLASSES, lowestClassWith, strictestLimits,
  type ExposureClass, type StrengthClass,
} from '../../src/index';

const DIN_MIN_CLASS: Record<ExposureClass, StrengthClass> = {
  X0: 'C8/10',
  XC1: 'C16/20', XC2: 'C16/20', XC3: 'C20/25', XC4: 'C25/30',
  XD1: 'C30/37', XD2: 'C35/45', XD3: 'C35/45',
  XS1: 'C30/37', XS2: 'C35/45', XS3: 'C35/45',
  XF1: 'C25/30', XF2: 'C35/45', XF3: 'C35/45', XF4: 'C30/37', // XF2/XF3 without air (B 9 Tafel 8); XF4 always air-entrained
  XA1: 'C25/30', XA2: 'C35/45', XA3: 'C35/45',
  XM1: 'C30/37', XM2: 'C35/45', XM3: 'C35/45',
};

const satisfies = (strength: StrengthClass, exposure: ExposureClass) =>
  STRENGTH_CLASSES[strength].fckCube >= EXPOSURE_CLASSES[exposure].minFckCube;
const lowestAccepted = (exposure: ExposureClass) => lowestClassWith(EXPOSURE_CLASSES[exposure].minFckCube);

describe('Minimum strength class per exposure class (DIN 1045-2)', () => {
  it('covers every exposure class', () => {
    expect(Object.keys(DIN_MIN_CLASS).sort()).toEqual([...EXPOSURE_CLASS_NAMES].sort());
  });

  for (const [exposure, minClass] of Object.entries(DIN_MIN_CLASS) as [ExposureClass, StrengthClass][]) {
    it(`${exposure}: lowest accepted class is ${minClass}`, () => {
      expect(lowestAccepted(exposure)).toBe(minClass);
    });
  }

  it('rejects C20/25 for XC4 and accepts C25/30', () => {
    expect(satisfies('C20/25', 'XC4')).toBe(false);
    expect(satisfies('C25/30', 'XC4')).toBe(true);
  });

  it('XF2/XF3 with air entrainment: C25/30, w/z 0,55, z 300 (B 9 Tafel 8)', () => {
    for (const cls of ['XF2', 'XF3'] as const) {
      expect(strictestLimits([cls], { airEntrained: true }))
        .toEqual({ maxWz: 0.55, minCement: 300, minFckCube: STRENGTH_CLASSES['C25/30'].fckCube });
      expect(strictestLimits([cls]))
        .toEqual({ maxWz: 0.5, minCement: 320, minFckCube: STRENGTH_CLASSES['C35/45'].fckCube });
    }
  });

  it('minFckCube is a cube strength: XC4 + XF4 + XD3 needs C35/45', () => {
    const { minFckCube } = strictestLimits(['XC4', 'XF4', 'XD3']);
    expect(minFckCube).toBe(STRENGTH_CLASSES['C35/45'].fckCube);
    expect(STRENGTH_CLASSES['C30/37'].fckCube).toBeLessThan(minFckCube);
  });
});

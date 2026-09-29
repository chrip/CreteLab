/**
 * Regression tests for fixes from an earlier field review:
 * 1. Zero moisture must mean dry aggregate, not the default moisture.
 * 2. The waterproofing admixture takes part in the volume balance (Stoffraum).
 * 3. The fly ash maximum per cement type (flyAshMaxFactor) is enforced.
 * 4. No C1/C2/C3 duplicates among the consistency classes.
 */
import { describe, it, expect } from 'vitest';
import {
  CEMENT_TYPES, CONSISTENCY_CLASSES, WATERPROOFING_DENSITY, checkRecipe, normalizeMix, waterDemand,
  type Recipe,
} from '../../src/index';
import { mix, recipeFor } from './helpers';

describe('Zero moisture means dry aggregate', () => {
  it('moisture [0, 0, 0] adds all the water, the same as no moisture', () => {
    const zero = recipeFor({ moisture: [0, 0, 0] });
    const none = recipeFor({ moisture: null });
    expect(zero.materials.addedWater).toBe(none.materials.addedWater);
    expect(zero.materials.addedWater).toBe(Math.round(zero.materials.water));
    expect(zero.grainGroups.map((g) => g.moisturePct)).toEqual([0, 0, 0]);
  });

  it('a zero entry keeps its zero next to non-zero entries', () => {
    expect(recipeFor({ moisture: [0, 3, 0] }).grainGroups.map((g) => g.moisturePct)).toEqual([0, 3, 0]);
  });
});

describe('Waterproofing admixture in the volume balance (Stoffraum)', () => {
  const without = recipeFor({ waterproofingPct: 0 });
  const withWu = recipeFor({ waterproofingPct: 2 });

  it('its mass is the percentage of the cement', () => {
    expect(withWu.materials.waterproofing).toBeCloseTo(withWu.materials.cement * 0.02, 10);
  });

  it('its volume reduces the aggregate volume by m/ρ', () => {
    const vWu = withWu.materials.waterproofing / WATERPROOFING_DENSITY;
    expect(withWu.volumes.waterproofing).toBe(Math.round(vWu));
    expect(withWu.volumes.aggregate).toBeLessThan(without.volumes.aggregate);
    expect(Math.abs(without.volumes.aggregate - withWu.volumes.aggregate - vWu)).toBeLessThanOrEqual(1);
  });

  it('the absolute volumes still add up to 1 000 dm³', () => {
    const v = withWu.volumes;
    const sum = v.cement + v.water + v.flyAsh + v.silicaFume + v.waterproofing + v.air + v.aggregate;
    expect(Math.abs(sum - 1000)).toBeLessThanOrEqual(3); // rounding of seven parts
  });

  it('is capped at 5 % of the cement', () => {
    expect(normalizeMix(mix({ waterproofingPct: 8 })).waterproofingPct).toBe(5);
  });
});

describe('Fly ash maximum per cement type (flyAshMaxFactor)', () => {
  it('CEM I types allow 0,33', () => {
    for (const t of ['CEM I 32.5 N', 'CEM I 42.5 N', 'CEM I 42.5 R', 'CEM I 52.5 N', 'CEM I 52.5 R'] as const) {
      expect(CEMENT_TYPES[t].flyAshMaxFactor).toBe(0.33);
    }
  });

  it('slag cements (no P, V or D) allow 0,33 (B 20 p. 5, Beispiel IV)', () => {
    // "fs ≤ 0,33 · z bei Zementen ohne P, V und D"; Beispiel IV: CEM III/A 42,5 N
    // with "z = 322/(1 + 0,4 ∙ 0,33) = 285 kg", "f = 0,33 ∙ 285".
    for (const t of ['CEM II/A-S 42.5 N', 'CEM II/B-S 42.5 N', 'CEM III/A 42.5 N', 'CEM III/B 42.5 N'] as const) {
      expect(CEMENT_TYPES[t].flyAshMaxFactor).toBe(0.33);
    }
  });

  it('CEM III/A: 40 % is clamped to 33 %, 33 % passes', () => {
    expect(normalizeMix(mix({ cementType: 'CEM III/A 42.5 N', flyAshPct: 40 })).flyAshPct).toBe(33);
    expect(normalizeMix(mix({ cementType: 'CEM III/A 42.5 N', flyAshPct: 33 })).flyAshPct).toBe(33);
  });

  it('CEM I: 40 % is clamped to 33 %, 33 % passes', () => {
    expect(normalizeMix(mix({ cementType: 'CEM I 42.5 N', flyAshPct: 40 })).flyAshPct).toBe(33);
    expect(normalizeMix(mix({ cementType: 'CEM I 42.5 N', flyAshPct: 33 })).flyAshPct).toBe(33);
  });

  it('the recipe never credits more fly ash than 0,33 · z', () => {
    const r = recipeFor({ cementType: 'CEM III/A 42.5 N', flyAshPct: 50 });
    expect(r.materials.flyAsh / r.materials.cement).toBeCloseTo(0.33, 10);
  });
});

describe('Consistency classes: no C1/C2/C3 duplicates', () => {
  const classes: readonly string[] = CONSISTENCY_CLASSES;

  it('C1, C2 and C3 are not offered', () => {
    for (const c of ['C1', 'C2', 'C3']) expect(classes).not.toContain(c);
  });

  it('F1, F2, F3 are offered', () => {
    for (const c of ['F1', 'F2', 'F3']) expect(classes).toContain(c);
  });

  it('C0 is still offered (no F0 equivalent)', () => {
    expect(classes).toContain('C0');
  });

  it('water demand B32 (k = 4,20): F1 = 1100/7,20 = 152,8, F3 = 1300/7,20 = 180,6', () => {
    expect(Math.abs(waterDemand('B32', 'F1') - 152.8)).toBeLessThan(0.1);
    expect(Math.abs(waterDemand('B32', 'F3') - 180.6)).toBeLessThan(0.1);
  });
});

describe('normalizeMix keeps every input inside the range B 20 allows', () => {
  it('removes duplicate exposure classes', () => {
    expect(normalizeMix(mix({ exposureClasses: ['XC4', 'XF1', 'XC4'] })).exposureClasses).toEqual(['XC4', 'XF1']);
  });

  it('clamps the Vorhaltemaß to 3–12 and replaces 0 or NaN by 9', () => {
    expect(normalizeMix(mix({ margin: 2 })).margin).toBe(3);
    expect(normalizeMix(mix({ margin: 15 })).margin).toBe(12);
    expect(normalizeMix(mix({ margin: 0 })).margin).toBe(9);
    expect(normalizeMix(mix({ margin: NaN })).margin).toBe(9);
  });

  it('clamps air to 0–12 % and the additions to 0 and their maximum', () => {
    const n = normalizeMix(mix({ airPct: -3, flyAshPct: -5, silicaFumePct: NaN, waterproofingPct: -1 }));
    expect([n.airPct, n.flyAshPct, n.silicaFumePct, n.waterproofingPct]).toEqual([0, 0, 0, 0]);
    expect(normalizeMix(mix({ airPct: 20 })).airPct).toBe(12);
  });

  it('leaves valid inputs untouched', () => {
    const input = mix({ margin: 5, airPct: 4.5, flyAshPct: 20, silicaFumePct: 8, waterproofingPct: 2 });
    expect(normalizeMix(input)).toEqual(input);
  });
});

describe('checkRecipe warnings', () => {
  const codes = (r: Recipe) => r.warnings.map((w) => w.code);

  it('strength-below-exposure: C20/25 is too weak for XC4 (needs C25/30)', () => {
    const r = recipeFor({ strengthClass: 'C20/25', exposureClasses: ['XC4'] });
    expect(r.warnings).toContainEqual({
      code: 'strength-below-exposure', params: { strengthClass: 'C20/25', minFckCube: 30 },
    });
    expect(codes(recipeFor({ strengthClass: 'C25/30', exposureClasses: ['XC4'] }))).not.toContain('strength-below-exposure');
  });

  it('strength-below-exposure: C30/37 with XF2 needs air entrainment (B 9 Tafel 8)', () => {
    const base = { strengthClass: 'C30/37', sieveLine: 'B16' } as const;
    expect(codes(recipeFor({ ...base, exposureClasses: ['XF2'], airPct: 0 }))).toContain('strength-below-exposure');
    expect(codes(recipeFor({ ...base, exposureClasses: ['XF2'], airPct: 4.5 }))).not.toContain('strength-below-exposure');
  });

  it('high-air: more than 10 % air', () => {
    expect(recipeFor({ airPct: 11 }).warnings).toContainEqual({ code: 'high-air', params: { airPct: 11 } });
    expect(codes(recipeFor({ airPct: 10 }))).not.toContain('high-air');
  });

  it('wz-exceeded: a recipe with more water than the exposure w/c allows', () => {
    const input = mix({ exposureClasses: ['XC4'] });
    const r = recipeFor({ exposureClasses: ['XC4'] });
    const fake: Recipe = { ...r, materials: { ...r.materials, water: 200, cement: 300 } };
    expect(checkRecipe(input, fake)).toContainEqual({ code: 'wz-exceeded', params: { wz: 0.67, maxWz: 0.6 } });
  });

  it('wz-exceeded is not raised when additions count through the equivalent w/c', () => {
    const input = mix({ exposureClasses: ['XC4'], flyAshPct: 20 });
    const r = recipeFor({ exposureClasses: ['XC4'], flyAshPct: 20 });
    const fake: Recipe = { ...r, materials: { ...r.materials, water: 200, cement: 300 } };
    expect(checkRecipe(input, fake).map((w) => w.code)).not.toContain('wz-exceeded');
  });

  it('the default mix has no warnings', () => {
    expect(recipeFor().warnings).toEqual([]);
  });
});

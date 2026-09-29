/**
 * Zement-Merkblatt B 20 (2.2017) Anhang examples run through the whole engine
 * (computeRecipe), with the Vorhaltemaß set to B 20's total margin 1,48·σ + v (σ = 3).
 *
 * The engine takes the water demand from the Tafel 3 formula; B 20 allows the table
 * or the formula ("entweder über Werte aus Tafel 3 oder über die angegebenen Formeln")
 * and picks the larger table value in Beispiel I/II. Where both agree (Beispiel III,
 * 180 l) the whole chain can be compared; for Beispiel I only the steps before water.
 */
import { describe, it, expect } from 'vitest';
import type { MixInput } from '../../src/index';
import { near, recipeFor } from './helpers';

const base: Partial<MixInput> = {
  aggregate: 'quartz-gravel', plasticizer: 'none', airPct: 0, flyAshPct: 0, silicaFumePct: 0,
  waterproofingPct: 0, moisture: null,
};

describe('B 20 Beispiel I (p. 13–14): XC1, C20/25, B32, F3, CEM II 42,5 N', () => {
  const recipe = recipeFor({
    ...base, strengthClass: 'C20/25', exposureClasses: ['XC1'], sieveLine: 'B32', consistency: 'F3',
    cementType: 'CEM II/A-LL 42.5 N', margin: 1.48 * 3 + 3,
  });

  it('target "fcm,dry,cube ≥ 34,6 N/mm²"', () => near(recipe.targetStrength, 34.6, 0.05, 'target'));
  it('Walz curve governs: "w/zermittelt = 0,68 ≤ 0,73"', () => {
    near(recipe.wzWalz, 0.68, 0.02, 'w/z Walz');
    expect(recipe.wzSource).toBe('strength');
  });
});

describe('B 20 Beispiel III (p. 15–18): XC4/XD1/XF2, B16, F2, crushed limestone, CEM I 52,5 R, BV', () => {
  const beispielIII: Partial<MixInput> = {
    ...base, exposureClasses: ['XC4', 'XD1', 'XF2'], sieveLine: 'B16', consistency: 'F2', aggregate: 'limestone',
    cementType: 'CEM I 52.5 R', plasticizer: 'BV', margin: 1.48 * 3 + 5,
  };

  describe('Variante 1: C35/45 without air entrainment', () => {
    const recipe = recipeFor({ ...beispielIII, strengthClass: 'C35/45' });
    it('water "w = 0,93 ∙ 198 = 184 l"', () => expect(recipe.materials.water).toBe(184));
    it('target "fcm,dry,cube ≥ 58,4 N/mm²"', () => near(recipe.targetStrength, 58.4, 0.05, 'target'));
    it('Walz curve "w/zermittelt = 0,53"', () => near(recipe.wzWalz, 0.53, 0.02, 'w/z Walz'));
    it('XF2 without air governs: "w/z = 0,50 - 0,02 = 0,48"', () => {
      expect(recipe.wzExposure).toBe(0.5);
      near(recipe.wz, 0.48, 0.001, 'w/z');
      expect(recipe.wzSource).toBe('exposure');
    });
    it('cement "z = 184/0,48 = 383 kg/m³" (≥ 320)', () => {
      expect(recipe.materials.cement).toBe(383);
      expect(recipe.limits.minCement).toBe(320);
    });
  });

  describe('Variante 2: C30/37 air-entrained, 4,5 Vol.-% air', () => {
    const recipe = recipeFor({ ...beispielIII, strengthClass: 'C30/37', airPct: 4.5 });
    // B 20 assumes 1,5 % natural air here, the engine 2 % (B 20 p. 5): 169 l vs 171,5 l,
    // target 60,2 vs 58,5 N/mm². Both effects nearly cancel in the cement content.
    it('water within 3 l of "w = 184 - 3 ∙ 5 = 169 l"', () => near(recipe.materials.water, 169, 3, 'water'));
    it('w/z within 0,02 of "w/zermittelt = 0,52"', () => near(recipe.wz, 0.52, 0.02, 'w/z'));
    it('cement within 2 % of "z = 170/0,52 = 327 kg/m3"', () => near(recipe.materials.cement, 327, 327 * 0.02, 'cement'));
    it('Stoffraum uses "Luftgehalt: Annahme 4,5 Vol.-%" = 45 dm³', () => expect(recipe.volumes.air).toBe(45));
    it('4,5 % reaches the B16 minimum, so XF2 uses its air-entrained limits: 0,55 − 0,02 = 0,53, z ≥ 300', () => {
      expect(recipe.airEntrained).toBe(true);
      expect(recipe.wzExposure).toBe(0.55);
      expect(recipe.limits.minCement).toBe(300);
    });
  });
});

describe('XF2 with too little air falls back to the limits without air entrainment', () => {
  it('3,5 % air in a B16 mix (minimum 4,5 %) keeps w/z ≤ 0,50 and z ≥ 320', () => {
    const recipe = recipeFor({
      ...base, strengthClass: 'C35/45', exposureClasses: ['XF2'], sieveLine: 'B16', consistency: 'F2',
      cementType: 'CEM I 52.5 R', margin: 9, airPct: 3.5,
    });
    expect(recipe.airEntrained).toBe(false);
    expect(recipe.wzExposure).toBe(0.5);
    expect(recipe.limits.minCement).toBe(320);
  });
});

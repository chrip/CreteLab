/**
 * Additions (fly ash, silica fume) reduce the cement (Zement-Merkblatt B 20, section 7.2).
 *
 * They count towards the binder with k-values:
 *
 *   (w/z)eq = w / (z + k_f·f + k_s·s)
 *
 * For the same target (w/z)eq and water, more effective binder means less cement:
 *
 *   z = w / (w/z · (1 + k_f·f/z + k_s·s/z))
 */
import { describe, it, expect } from 'vitest';
import { K_FLY_ASH, K_SILICA_FUME, SILICA_FUME_MAX_FACTOR, equivalentWz, normalizeMix } from '../../src/index';
import { mix, recipeFor } from './helpers';

/** Cement from water, governing w/c and the addition shares (fractions of the cement). */
function computeCement(water: number, wz: number, flyAsh = 0, silicaFume = 0) {
  return water / (wz * (1 + K_FLY_ASH * flyAsh + K_SILICA_FUME * silicaFume));
}

describe('k-values (B 20 section 7.2)', () => {
  it('fly ash k = 0,4, silica fume k = 1,0', () => {
    expect(K_FLY_ASH).toBe(0.4);
    expect(K_SILICA_FUME).toBe(1.0);
  });
});

describe('Cement reduction with fly ash (k = 0,4)', () => {
  it('no fly ash: 180/0,60 = 300 kg', () => {
    expect(Math.abs(computeCement(180, 0.6) - 300)).toBeLessThan(1);
  });

  it('15 % fly ash divides the cement by 1 + 0,4 · 0,15 = 1,06', () => {
    const base = computeCement(180, 0.6);
    const withFa = computeCement(180, 0.6, 0.15);
    expect(withFa).toBeLessThan(base);
    expect(Math.abs(base / withFa - 1.06)).toBeLessThan(0.01);
  });

  it('33 % fly ash (maximum): 300/1,132 ≈ 265 kg', () => {
    expect(Math.abs(computeCement(180, 0.6, 0.33) - 265.5)).toBeLessThan(1.5);
  });

  it('the fly ash mass is a share of the reduced cement, not of the baseline', () => {
    const z = computeCement(180, 0.6, 0.2);
    expect(z * 0.2).toBeLessThan(computeCement(180, 0.6) * 0.2);
  });

  it('the equivalent w/c equals the governing w/c', () => {
    const z = computeCement(180, 0.6, 0.15);
    expect(Math.abs(equivalentWz(180, z, z * 0.15, 0) - 0.6)).toBeLessThan(0.01);
  });
});

describe('Cement reduction with silica fume (k = 1,0)', () => {
  it('8 % silica fume divides the cement by 1,08', () => {
    const base = computeCement(180, 0.55);
    const withSf = computeCement(180, 0.55, 0, 0.08);
    expect(withSf).toBeLessThan(base);
    expect(Math.abs(base / withSf - 1.08)).toBeLessThan(0.01);
  });

  it('silica fume reduces the cement more than the same share of fly ash', () => {
    expect(computeCement(180, 0.55, 0, 0.08)).toBeLessThan(computeCement(180, 0.55, 0.08, 0));
  });

  it('the equivalent w/c equals the governing w/c', () => {
    const z = computeCement(180, 0.55, 0, 0.08);
    expect(Math.abs(equivalentWz(180, z, 0, z * 0.08) - 0.55)).toBeLessThan(0.01);
  });

  it('is credited up to 0,11 · z (normalizeMix caps the share)', () => {
    expect(SILICA_FUME_MAX_FACTOR).toBe(0.11);
    expect(normalizeMix(mix({ silicaFumePct: 20 })).silicaFumePct).toBe(11);
  });
});

describe('Cement reduction with fly ash and silica fume together', () => {
  it('both together reduce the cement more than either alone', () => {
    const both = computeCement(190, 0.55, 0.15, 0.08);
    expect(both).toBeLessThan(computeCement(190, 0.55, 0.15, 0));
    expect(both).toBeLessThan(computeCement(190, 0.55, 0, 0.08));
    expect(both).toBeLessThan(computeCement(190, 0.55));
  });

  it('the equivalent w/c equals the governing w/c', () => {
    const z = computeCement(190, 0.55, 0.15, 0.08);
    expect(Math.abs(equivalentWz(190, z, z * 0.15, z * 0.08) - 0.55)).toBeLessThan(0.01);
  });

  it('the total binder (z + f + s) exceeds the cement without additions, because k_f < 1', () => {
    const z = computeCement(190, 0.55, 0.15, 0.08);
    expect(z + z * 0.15 + z * 0.08).toBeGreaterThan(computeCement(190, 0.55));
  });
});

describe('Additions through computeRecipe', () => {
  // C30/37 with XC4: the Walz curve governs and the cement stays above the 280 kg minimum.
  const base = { strengthClass: 'C30/37', exposureClasses: ['XC4'], cementType: 'CEM I 42.5 N' } as const;
  const plain = recipeFor({ ...base, exposureClasses: ['XC4'] });
  const fa = recipeFor({ ...base, exposureClasses: ['XC4'], flyAshPct: 20 });
  const sf = recipeFor({ ...base, exposureClasses: ['XC4'], silicaFumePct: 8 });

  it('fly ash lowers the cement by 1 + 0,4 · 0,2 = 1,08, the water stays', () => {
    expect(fa.materials.water).toBe(plain.materials.water);
    expect(Math.abs(plain.materials.cement / fa.materials.cement - 1.08)).toBeLessThan(0.01);
    expect(fa.materials.flyAsh).toBeCloseTo(fa.materials.cement * 0.2, 10);
  });

  it('the equivalent w/c of the recipe matches the design w/c', () => {
    expect(plain.equivalentWz).toBeNull();
    expect(Math.abs((fa.equivalentWz ?? 0) - fa.wz)).toBeLessThanOrEqual(0.01);
    expect(Math.abs((sf.equivalentWz ?? 0) - sf.wz)).toBeLessThanOrEqual(0.01);
  });

  it('never goes below the exposure minimum cement', () => {
    const r = recipeFor({ exposureClasses: ['XD1'], strengthClass: 'C30/37', flyAshPct: 33, silicaFumePct: 11 });
    expect(r.materials.cement).toBe(300);
  });
});

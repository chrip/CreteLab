/**
 * Plasticisers (BV, FM): water and cement reduction (Zement-Merkblatt B 20).
 *
 * BV/FM reduce the water needed for the workability while the w/c ratio (set by
 * strength and exposure) stays the same:
 *
 *   w_new = w₀ · (1 − saving)
 *   z_new = w_new / (w/z) = z₀ · (1 − saving)
 *
 * So water AND cement drop by the same factor; the mix is simply more economical.
 * Additions (fly ash, silica fume) work differently: they lower the cement through the
 * equivalent w/c while the water stays the same.
 */
import { describe, it, expect } from 'vitest';
import { PLASTICIZER_EFFECT, isPlasticizer, waterWithPlasticizer } from '../../src/index';
import { recipeFor } from './helpers';

const cement = (water: number, wz: number) => water / wz;

describe('Plasticiser water saving (B 20: BV 5–10 %, FM 15–25 %)', () => {
  it('BV saves 7 %', () => expect(PLASTICIZER_EFFECT.BV.waterSavingPct).toBe(7));
  it('FM saves 20 %', () => expect(PLASTICIZER_EFFECT.FM.waterSavingPct).toBe(20));
  it('no plasticiser saves nothing', () => expect(waterWithPlasticizer(190, 'none')).toBe(190));

  it('isPlasticizer recognises none, BV and FM only', () => {
    for (const p of ['none', 'BV', 'FM']) expect(isPlasticizer(p)).toBe(true);
    expect(isPlasticizer('LP')).toBe(false);
    expect(isPlasticizer(null)).toBe(false);
  });
});

describe('BV (Betonverflüssiger): water and cement reduction', () => {
  const w0 = 190;
  const wz = 0.6;

  it('reduces water by 7 % (rounded to whole litres)', () => {
    const w = waterWithPlasticizer(w0, 'BV');
    expect(Math.abs(w - w0 * 0.93)).toBeLessThanOrEqual(1);
    expect(Number.isInteger(w)).toBe(true);
  });

  it('reference cement without BV: 190/0,60 ≈ 317 kg', () => {
    expect(Math.abs(cement(w0, wz) - 316.7)).toBeLessThan(1);
  });

  it('cement drops by the same factor as the water', () => {
    const w = waterWithPlasticizer(w0, 'BV');
    expect(cement(w, wz)).toBeLessThan(cement(w0, wz));
    expect(Math.abs(w / w0 - cement(w, wz) / cement(w0, wz))).toBeLessThan(0.01);
  });

  it('w/c stays the same', () => {
    const w = waterWithPlasticizer(w0, 'BV');
    expect(Math.abs(w / cement(w, wz) - wz)).toBeLessThan(0.01);
  });
});

describe('FM (Fließmittel): stronger water and cement reduction', () => {
  const w0 = 190;
  const wz = 0.55;

  it('reduces water by 20 %', () => {
    expect(Math.abs(waterWithPlasticizer(w0, 'FM') - w0 * 0.8)).toBeLessThanOrEqual(1);
  });

  it('reduces cement more than BV', () => {
    expect(cement(waterWithPlasticizer(w0, 'FM'), wz)).toBeLessThan(cement(waterWithPlasticizer(w0, 'BV'), wz));
  });

  it('cement drops by the same factor as the water', () => {
    const w = waterWithPlasticizer(w0, 'FM');
    expect(Math.abs(w / w0 - cement(w, wz) / cement(w0, wz))).toBeLessThan(0.01);
  });

  it('w/c stays the same', () => {
    const w = waterWithPlasticizer(w0, 'FM');
    expect(Math.abs(w / cement(w, wz) - wz)).toBeLessThan(0.01);
  });
});

describe('Plasticiser vs additions: different mechanisms', () => {
  const w0 = 190;
  const wz = 0.6;
  const kFlyAsh = 0.4;
  const flyAsh = 0.15;

  it('the plasticiser reduces water and cement proportionally', () => {
    const w = waterWithPlasticizer(w0, 'BV');
    expect(Math.abs(w / w0 - cement(w, wz) / cement(w0, wz))).toBeLessThan(0.01);
  });

  it('fly ash reduces cement but not water', () => {
    const credit = 1 + kFlyAsh * flyAsh; // 1,06
    const z = cement(w0, wz * credit);
    expect(z).toBeLessThan(cement(w0, wz));
    expect(Math.abs(w0 / (z * credit) - wz)).toBeLessThan(0.01); // (w/z)eq = w/z
  });

  it('BV + fly ash: both reductions stack, the lowest cement of all', () => {
    const wBv = waterWithPlasticizer(w0, 'BV');
    const credit = 1 + kFlyAsh * flyAsh;
    const both = cement(wBv, wz * credit);
    expect(both).toBeLessThan(cement(wBv, wz));
    expect(both).toBeLessThan(cement(w0, wz * credit));
    expect(both).toBeLessThan(cement(w0, wz));
  });
});

describe('Plasticisers through computeRecipe', () => {
  const base = { strengthClass: 'C25/30', exposureClasses: ['XC4'], sieveLine: 'B32', consistency: 'F3' } as const;
  const none = recipeFor({ ...base, exposureClasses: [...base.exposureClasses], plasticizer: 'none' });
  const bv = recipeFor({ ...base, exposureClasses: [...base.exposureClasses], plasticizer: 'BV' });
  const fm = recipeFor({ ...base, exposureClasses: [...base.exposureClasses], plasticizer: 'FM' });

  it('water: none > BV > FM, with the same w/c', () => {
    expect(bv.materials.water).toBe(waterWithPlasticizer(none.materials.water, 'BV'));
    expect(fm.materials.water).toBe(waterWithPlasticizer(none.materials.water, 'FM'));
    expect(bv.wz).toBe(none.wz);
    expect(fm.wz).toBe(none.wz);
  });

  it('cement falls with the water until the exposure minimum (280 kg for XC4) stops it', () => {
    expect(bv.materials.cement).toBeLessThan(none.materials.cement);
    expect(fm.materials.cement).toBeLessThanOrEqual(bv.materials.cement);
    expect(fm.materials.cement).toBeGreaterThanOrEqual(280);
  });

  it('flowable consistency F4–F6 requires FM', () => {
    for (const consistency of ['F4', 'F5', 'F6'] as const) {
      for (const plasticizer of ['none', 'BV'] as const) {
        expect(() => recipeFor({ consistency, plasticizer })).toThrow('fm-required');
      }
      expect(recipeFor({ consistency, plasticizer: 'FM' }).materials.plasticizerL).toBe(0.2);
    }
  });

  it('F4–F6 start from the F3 water demand', () => {
    const f3 = recipeFor({ consistency: 'F3', plasticizer: 'FM' });
    const f5 = recipeFor({ consistency: 'F5', plasticizer: 'FM' });
    expect(f5.materials.water).toBe(f3.materials.water);
  });
});

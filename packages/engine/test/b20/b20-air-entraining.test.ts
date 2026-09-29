// Air-entraining agent (LP): water saving, strength loss and dosage (Zement-Merkblatt B 20,
// Tafel 7 and Beispiel III), plus the minimum air content of air-entrained concrete.
import { describe, it, expect } from 'vitest';
import {
  AIR_DOSAGE_L_PER_PCT, AIR_STRENGTH_LOSS_PER_PCT, AIR_WATER_SAVING_PER_PCT, PLASTICIZER_EFFECT,
  minAirContent, waterWithAddedAir,
} from '../../src/index';
import { recipeFor } from './helpers';

describe('Water saving: about 5 l per added Vol.-% air (B 20 Tafel 7)', () => {
  it('180 l with 4 % added air → 160 l', () => expect(waterWithAddedAir(180, 4)).toBe(160));
  it('200 l with 2 % added air → 190 l', () => expect(waterWithAddedAir(200, 2)).toBe(190));
  it('150 l with 0 % added air → unchanged', () => expect(waterWithAddedAir(150, 0)).toBe(150));
  it('the saving is 5 l per %', () => expect(AIR_WATER_SAVING_PER_PCT).toBe(5));
});

describe('Strength loss: about 3,5 N/mm² per added Vol.-% air (B 20 Tafel 7)', () => {
  it('4 % air costs 14 N/mm² (30 → 16)', () => expect(30 - 4 * AIR_STRENGTH_LOSS_PER_PCT).toBe(16));
  it('2 % air costs 7 N/mm² (50 → 43)', () => expect(50 - 2 * AIR_STRENGTH_LOSS_PER_PCT).toBe(43));

  it('the recipe adds the loss of the added air to the target strength', () => {
    const plain = recipeFor({ airPct: 0 });
    const lp = recipeFor({ airPct: 6 }); // 4 % above the natural 2 %
    expect(lp.airStrengthLoss).toBe(14);
    expect(lp.targetStrength).toBeCloseTo(plain.targetStrength + 14, 1);
  });
});

describe('Admixture dosage', () => {
  it('air-entraining agent: 0,05 l/m³ per % air', () => {
    expect(AIR_DOSAGE_L_PER_PCT).toBe(0.05);
    expect(recipeFor({ airPct: 4 }).materials.airEntrainerL).toBeCloseTo(0.2, 10);
    expect(recipeFor({ airPct: 10 }).materials.airEntrainerL).toBeCloseTo(0.5, 10);
    expect(recipeFor({ airPct: 0 }).materials.airEntrainerL).toBe(0);
  });

  it('air above 12 % is clamped to 12 % (0,6 l/m³)', () => {
    // Changed: the old helper dosed 15 % as 0,75 l/m³; normalizeMix now caps the air at 12 %.
    const recipe = recipeFor({ airPct: 15 });
    expect(recipe.airPct).toBe(12);
    expect(recipe.materials.airEntrainerL).toBeCloseTo(0.6, 10);
  });

  it('BV is dosed at 0,5 l/m³, FM at 0,2 l/m³, none at 0', () => {
    expect(PLASTICIZER_EFFECT.BV.dosageL).toBe(0.5);
    expect(PLASTICIZER_EFFECT.FM.dosageL).toBe(0.2);
    expect(recipeFor({ plasticizer: 'BV' }).materials.plasticizerL).toBe(0.5);
    expect(recipeFor({ plasticizer: 'FM' }).materials.plasticizerL).toBe(0.2);
    expect(recipeFor({ plasticizer: 'none' }).materials.plasticizerL).toBe(0);
  });
});

describe('Minimum air content of air-entrained concrete (BTD 2022, Tabelle 6.3.5.a)', () => {
  it('by maximum grain: 8 → 5,5 %, 16 → 4,5 %, 32 → 4,0 %, 63 → 3,5 %', () => {
    expect(minAirContent(8, 'F3')).toBe(5.5);
    expect(minAirContent(16, 'F3')).toBe(4.5);
    expect(minAirContent(32, 'F3')).toBe(4.0);
    expect(minAirContent(63, 'F3')).toBe(3.5);
  });

  it('one point more for flowable concrete F4–F6', () => {
    for (const c of ['F4', 'F5', 'F6']) expect(minAirContent(16, c)).toBe(5.5);
    for (const c of ['C0', 'F1', 'F2', 'F3']) expect(minAirContent(16, c)).toBe(4.5);
  });

  it('the recipe counts as air-entrained only when the air reaches the minimum', () => {
    expect(recipeFor({ sieveLine: 'B32', airPct: 4.0 }).airEntrained).toBe(true);
    expect(recipeFor({ sieveLine: 'B32', airPct: 3.9 }).airEntrained).toBe(false);
    expect(recipeFor({ sieveLine: 'B8', airPct: 5.0 }).airEntrained).toBe(false);
    expect(recipeFor({ sieveLine: 'B32', airPct: 0 }).airEntrained).toBe(false);
  });

  it('F4 needs one point more air to count as air-entrained', () => {
    const fm = { sieveLine: 'B32', consistency: 'F4', plasticizer: 'FM' } as const;
    expect(recipeFor({ ...fm, airPct: 4.5 }).airEntrained).toBe(false);
    expect(recipeFor({ ...fm, airPct: 5.0 }).airEntrained).toBe(true);
  });
});

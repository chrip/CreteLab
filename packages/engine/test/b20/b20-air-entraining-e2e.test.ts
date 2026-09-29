/**
 * Air-entrained concrete through the whole engine (computeRecipe), following
 * Zement-Merkblatt B 20 (2.2017):
 *   - the input is the TOTAL air content ("Luftgehalt: Annahme 4,5 Vol.-%", p. 17)
 *   - compacted concrete holds ~2 % air anyway ("ca. 2 % Luftporen (20 l/m3)", p. 5)
 *   - only the added air saves water: 5 l per Vol.-% (Tafel 9), after the BV
 *     reduction ("w = 184 - 3 ∙ 5 = 169 l", p. 17)
 *   - and costs 3,5 N/mm² per Vol.-%, added to the target strength
 *     ("fcm,dry,cube ≥ (37/0,92) + 1,48 ∙ 3 + 5 + 3 ∙ 3,5", p. 17)
 * B 20 Beispiel III assumes 1,5 % natural air there; the engine uses the 2 % of p. 5.
 */
import { describe, it, expect } from 'vitest';
import { NATURAL_AIR_PCT, type MixInput } from '../../src/index';
import { recipeFor } from './helpers';

const beispielIII: Partial<MixInput> = {
  strengthClass: 'C30/37', exposureClasses: ['XC4', 'XD1', 'XF2'], sieveLine: 'B16', consistency: 'F2',
  aggregate: 'limestone', cementType: 'CEM I 52.5 R', margin: 5, plasticizer: 'BV',
  flyAshPct: 0, silicaFumePct: 0, waterproofingPct: 0, moisture: null,
};
const run = (airPct: number) => recipeFor({ ...beispielIII, airPct });

describe('Air entrainment end to end (B 20 Beispiel III Variante 2 rules)', () => {
  const plain = run(0);
  const lp = run(4.5);

  it('without air entrainment the engine assumes 2 % compaction air (20 dm³)', () => {
    expect(NATURAL_AIR_PCT).toBe(2);
    expect(plain.volumes.air).toBe(20);
    expect(plain.airPct).toBe(2);
    expect(plain.addedAirPct).toBe(0);
  });

  it('4,5 % target air means 45 dm³ in the Stoffraum, not 20 + 45', () => {
    expect(lp.volumes.air).toBe(45);
    expect(lp.addedAirPct).toBe(2.5);
  });

  it('water: plain mix (formula → crushed → BV) is 184 l, as in B 20', () => {
    expect(plain.materials.water).toBe(184);
  });

  it('water saving counts only the added air: 184 − 2,5 · 5 = 171,5 l', () => {
    expect(lp.materials.water).toBe(171.5);
  });

  it('target strength rises by 2,5 · 3,5 = 8,75 N/mm²', () => {
    expect(Math.abs(lp.targetStrength - plain.targetStrength - 8.75)).toBeLessThanOrEqual(0.1);
    expect(lp.airStrengthLoss).toBe(8.75);
  });

  it('an entered air content at or below 2 % changes nothing', () => {
    const low = run(1.5);
    expect(low.volumes.air).toBe(20);
    expect(low.materials.water).toBe(plain.materials.water);
    expect(low.targetStrength).toBe(plain.targetStrength);
  });

  it('the air-entraining agent is dosed only when air is requested', () => {
    expect(plain.materials.airEntrainerL).toBe(0);
    expect(lp.materials.airEntrainerL).toBeCloseTo(0.225, 10);
  });
});

/**
 * Unit tests for the B 20 mix design building blocks and the Anhang examples
 * (Zement-Merkblatt B 20, Abschnitt 15). Tolerances of ±5–10 kg/m³ or l/m³ absorb
 * the rounding in the standard.
 */
import { describe, it, expect } from 'vitest';
import {
  AGGREGATES, AIR_STRENGTH_LOSS_PER_PCT, CEMENT_TYPES, CRUSHED_WATER_FACTOR, EXPOSURE_CLASSES, GRADINGS,
  SIEVE_LINES, addedWater, distributeAggregate, equivalentWz, normalizeMix, strengthFromWz, targetStrength,
  waterDemand, waterWithAddedAir, wzFromStrength,
} from '../../src/index';
import { mix, near, recipeFor } from './helpers';

describe('Water demand and consistency (B 20 Tafel 3)', () => {
  it('formula w = 1200/(k + 3): A32/F2 ≈ 141,5 l, B32/F2 ≈ 166,7 l', () => {
    near(waterDemand('A32', 'F2'), 141.5, 0.5, 'A32/F2');
    near(waterDemand('B32', 'F2'), 166.7, 0.5, 'B32/F2');
  });

  it('the A/B32 k-value is the mean of A32 and B32, close to 4,84', () => {
    near((SIEVE_LINES.A32.k + SIEVE_LINES.B32.k) / 2, 4.84, 0.01, 'mean k');
    expect(SIEVE_LINES['A/B32'].k).toBe(4.84);
  });
});

describe('Moisture correction: added water (B 20 Tafel 9 step 7)', () => {
  it('B32, 1 852 kg at 4,5/3,0/2,0 %: 30,8 + 13,9 + 14,1 l in the aggregate, 131 l to add', () => {
    const groups = distributeAggregate(1852, 'B32', [4.5, 3.0, 2.0]);
    const inAggregate = groups.map((g) => (g.massDry * g.moisturePct) / 100);
    near(inAggregate[0], 30.8, 0.5, 'sand');
    near(inAggregate[1], 13.9, 0.5, 'fine gravel');
    near(inAggregate[2], 14.1, 0.5, 'coarse gravel');
    near(addedWater(190, groups), 131.2, 0.5, 'added water');
    near(groups[0]?.massMoist, 715.8, 0.5, 'wet sand');
  });
});

describe('Aggregate and exposure adjustments', () => {
  it('crushed aggregate needs about 10 % more water', () => {
    expect(CRUSHED_WATER_FACTOR).toBe(1.1);
    const rounded = recipeFor({ aggregate: 'quartz-gravel' }).materials.water;
    const crushed = recipeFor({ aggregate: 'limestone' }).materials.water;
    near(crushed / rounded, 1.1, 0.01, 'crushed / rounded');
  });

  it('max w/z: XC1 0,75, XC3 0,65, X0 none', () => {
    expect(EXPOSURE_CLASSES.XC1.maxWz).toBe(0.75);
    expect(EXPOSURE_CLASSES.XC3.maxWz).toBe(0.65);
    expect(EXPOSURE_CLASSES.X0.maxWz).toBeNull();
  });
});

describe('Additions (B 20 section 7.2)', () => {
  it('fly ash lowers the equivalent w/z', () => {
    expect(equivalentWz(190, 290, 96, 0)).toBeLessThan(equivalentWz(190, 290, 0, 0));
  });

  it('maximum fly ash for 300 kg cement is 0,33 · 300 ≈ 99 kg', () => {
    near(CEMENT_TYPES['CEM I 42.5 N'].flyAshMaxFactor * 300, 99, 2, 'max fly ash');
    expect(normalizeMix(mix({ flyAshPct: 99 })).flyAshPct).toBe(33);
  });

  it('fly ash and silica fume together lower the equivalent w/z further', () => {
    const both = equivalentWz(190, 280, 50, 20);
    expect(both).toBeGreaterThan(0);
    expect(both).toBeLessThan(1);
    expect(both).toBeLessThan(equivalentWz(190, 280, 0, 0));
  });
});

describe('Air entrainment', () => {
  it('saves about 5 l water per % air', () => near(180 - waterWithAddedAir(180, 4), 20, 1, 'saving'));
  it('costs about 3,5 N/mm² per % air', () => near(6 * AIR_STRENGTH_LOSS_PER_PCT, 21, 1, 'loss'));
});

describe('Densities and the volume balance (Stoffraum)', () => {
  it('granite has a density of 2,6–2,8 kg/dm³', () => {
    expect(AGGREGATES.granite.density).toBeGreaterThanOrEqual(2.6);
    expect(AGGREGATES.granite.density).toBeLessThanOrEqual(2.8);
  });

  it('a computed recipe fills 1 000 dm³ and holds a plausible aggregate mass', () => {
    const r = recipeFor({ aggregate: 'granite' });
    const v = r.volumes;
    const sum = v.cement + v.water + v.flyAsh + v.silicaFume + v.waterproofing + v.air + v.aggregate;
    expect(Math.abs(sum - 1000)).toBeLessThanOrEqual(3);
    expect(r.materials.aggregate).toBeGreaterThan(1700);
    expect(r.materials.aggregate).toBeLessThan(2100);
  });
});

describe('B 20 Beispiel I: XC1, F3, B32, CEM II/A-LL 42,5 N, no additions', () => {
  // B 20 p. 13–14: sand/gravel B32, D = 32 mm, ρg = 2,65 kg/dm³. Result: z = 279, w = 190, g = 1 852.
  it('water demand: B32/F3 = 1300/(4,20 + 3) = 180,6 (B 20 takes the larger table value 190)', () => {
    const w = waterDemand('B32', 'F3');
    expect(w).toBeGreaterThanOrEqual(180);
    expect(w).toBeLessThanOrEqual(182);
  });

  it('Stoffraum: z = 279, w = 190, air = 18 dm³ → g ≈ 1 852 kg', () => {
    const rhoZ = CEMENT_TYPES['CEM II/A-LL 42.5 N'].density;
    const g = Math.round((1000 - 279 / rhoZ - 190 - 18) * AGGREGATES['quartz-gravel'].density);
    near(g, 1852, 10, 'g');
  });

  it('fines: 279 + 0,04 · 1 852 ≈ 353 kg (limit 450 at this cement content)', () => {
    const fines = Math.round(279 + 1852 * GRADINGS.B32.fines0125);
    near(fines, 353, 15, 'fines');
    expect(fines).toBeLessThanOrEqual(450);
  });

  it('the B32 grain groups add up to 100 %', () => {
    const groups = GRADINGS.B32.groups;
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.reduce((s, g) => s + g.pct, 0)).toBe(100);
  });

  it('added water with 4,5/3,0/2,0 % moisture ≈ 131 l', () => {
    near(addedWater(190, distributeAggregate(1852, 'B32', [4.5, 3.0, 2.0])), 131, 10, 'added water');
  });
});

describe('B 20 Beispiel II: XC1, F3, A/B16, CEM II/A-LL 42,5 N, BV 7 %', () => {
  // B 20 p. 14–15: sand + crushed A/B16, k = 4,13. Result: z = 287, w = 195, g = 1 816.
  it('the A/B16 k-value is the mean of A16 (4,60) and B16 (3,66) = 4,13', () => {
    near((SIEVE_LINES.A16.k + SIEVE_LINES.B16.k) / 2, 4.13, 0.01, 'k');
  });

  it('F3 with crushed aggregate (+10 %) ≈ 197 l', () => {
    const w = waterDemand('A/B16', 'F3') * CRUSHED_WATER_FACTOR;
    expect(w).toBeGreaterThanOrEqual(190);
    expect(w).toBeLessThanOrEqual(210);
  });

  it('the A/B16 grain groups are three and add up to 100 %', () => {
    const groups = GRADINGS['A/B16'].groups;
    expect(groups).toHaveLength(3);
    expect(groups.reduce((s, g) => s + g.pct, 0)).toBe(100);
  });

  it('A/B16 has 3 % fines below 0,125 mm', () => {
    expect(GRADINGS['A/B16'].fines0125).toBe(0.03);
  });
});

describe('B 20 Beispiel III: XC4/XD1/XF2, F2, B16, CEM I 52,5 R, BV', () => {
  it('the Walz curve and its inverse round-trip for 52,5 R', () => {
    const f = strengthFromWz(0.55, '52.5R');
    const wz = wzFromStrength(f ?? 0, '52.5R');
    // 0,002 absorbs the one-decimal rounding of the strength.
    near(wz, 0.55, 0.002, 'w/z');
  });

  it('Stoffraum Variante 1: z = 383, w = 184 → g ≈ 1 800 kg', () => {
    const g = Math.round((1000 - 383 / 3.1 - 184 - 18) * 2.65);
    near(g, 1800, 20, 'g');
  });

  it('target strength with v = 5: 45/0,92 + 5 = 53,9 N/mm² (v is the only margin)', () => {
    near(targetStrength(45, 5), 53.9, 0.2, 'target');
  });
});

describe('B 20 Beispiel IV: XC4/XF1/XA1, F3, A/B16, CEM III/A 42,5 N, fly ash + BV', () => {
  // B 20 p. 18–19: z = 285, f = 95 (≤ 0,33 · 285), w = 158, g = 1 853, added water ≈ 103 l.
  it('(w/z)eq = 158/(285 + 0,4 · 95) ≈ 0,49, within 0,45–0,60', () => {
    const eq = equivalentWz(158, 285, 95, 0);
    expect(eq).toBeLessThan(0.6);
    expect(eq).toBeGreaterThan(0.45);
  });

  it('maximum fly ash 0,33 · 285 ≈ 94 kg', () => near(0.33 * 285, 94.1, 0.5, 'max fly ash'));

  it('added water with 5/3/1 % moisture, g = 1 853, w = 158 l ≈ 103 l', () => {
    const groups = distributeAggregate(1853, 'A/B16', [5.0, 3.0, 1.0]);
    expect(groups).toHaveLength(3);
    const added = addedWater(158, groups);
    expect(added).toBeGreaterThanOrEqual(90);
    expect(added).toBeLessThanOrEqual(120);
  });

  it('CEM III/A 42,5 N uses the 42,5 Walz curve and flyAshMaxFactor 0,33', () => {
    expect(CEMENT_TYPES['CEM III/A 42.5 N'].curve).toBe('42.5');
    expect(CEMENT_TYPES['CEM III/A 42.5 N'].flyAshMaxFactor).toBe(0.33);
  });
});

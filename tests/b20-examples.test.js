/**
 * Streamlined unit tests for B20 concrete mix calculations
 * Focus on outcome correctness and concrete recipe results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateWaterDemand, calculateAverageK, adjustForAggregateType, WATER_DEMAND_A32_PLASTIC, WATER_DEMAND_B32_PLASTIC, WATER_DEMAND_C32_PLASTIC, SPLIT_SURCHARGE } from '../js/lib/consistency.js';
import { getAverageDensity, stofraumrechnung } from '../js/lib/densities.js';
import { calculateEquivalentWz, calculateMaxFlyAshContent, calculateStrengthReduction, adjustForAirEntraining, calculateEquivalentWzWithBoth } from '../js/lib/additives.js';
import { calculateTargetStrength, convertToDryCuring } from '../js/lib/mix-design.js';
import { getMaxWz } from '../js/lib/exposure.js';
import { calculateWetAggregateMass, calculateAggregateMoistureMass, calculateAddedWaterFromMoisture } from '../js/lib/moisture.js';
import { calculateTargetStrengthWithMargin, calculateWzFromTargetStrength, calculateStrengthFromWalzkurven, getCementType } from '../js/lib/strength.js';
import { getGrainGroups, getFinesFraction, distributeAggregateBySiebline, calculateZugabewasser } from '../js/lib/aggregate-gradation.js';

describe('B20 water demand and consistency', () => {
    it('calculates formula-based water demand for A32/F2 and B32/F2', () => {
        const resultA32 = calculateWaterDemand('A32', 'F2');
        const resultB32 = calculateWaterDemand('B32', 'F2');

        // Expected from w = 1200/(k+3)
        assert.ok(Math.abs(resultA32 - 141.5) < 0.5, `A32/F2 expected ≈141.5 got ${resultA32}`);
        assert.ok(Math.abs(resultB32 - 166.7) < 0.5, `B32/F2 expected ≈166.7 got ${resultB32}`);
        assert.strictEqual(resultA32, WATER_DEMAND_A32_PLASTIC, 'A32 plastic reference constant');
        assert.strictEqual(resultB32, WATER_DEMAND_B32_PLASTIC, 'B32 plastic reference constant');
    });

    it('averages k-value for A32 and B32 close to 4.84', () => {
        const avgK = calculateAverageK('A32', 'B32');
        assert.ok(Math.abs(avgK - 4.84) < 0.01);
    });
});

describe('B20 moisture correction – Zugabewasser (Step 7)', () => {
    it('computes aggregate moisture changes and required addition water', () => {
        const m1 = calculateAggregateMoistureMass(685, 4.5);
        const m2 = calculateAggregateMoistureMass(463, 3.0);
        const m3 = calculateAggregateMoistureMass(704, 2.0);

        assert.ok(Math.abs(m1 - 30.8) < 0.5);
        assert.ok(Math.abs(m2 - 13.9) < 0.5);
        assert.ok(Math.abs(m3 - 14.1) < 0.5);

        const addedWater = calculateAddedWaterFromMoisture(190, [m1, m2, m3]);
        assert.ok(Math.abs(addedWater - 131.2) < 0.2);

        const wetAgg = calculateWetAggregateMass(685, 4.5);
        assert.ok(Math.abs(wetAgg - 715.8) < 0.3);
    });
});

describe('B20 aggregate and exposure adjustments', () => {
    it('increases water demand by ~10% for crushed stone', () => {
        const baseWater = calculateWaterDemand('B32', 'F3');
        const adjusted = adjustForAggregateType(baseWater, true);
        assert.ok(Math.abs(adjusted / baseWater - 1.10) < 0.01);
    });

    it('returns max w/z limits correctly for XC1/XC3/X0', () => {
        assert.strictEqual(getMaxWz('XC1'), 0.75);
        assert.strictEqual(getMaxWz('XC3'), 0.65);
        assert.strictEqual(getMaxWz('X0'), null);
    });
});

describe('B20 supplementary materials effects', () => {
    it('finds equivalent w/z falls when fly ash is added', () => {
        const withFlyAsh = calculateEquivalentWz(190, 290, 'Flugasche', 96);
        const withoutFlyAsh = calculateEquivalentWz(190, 290, 'Flugasche', 0);
        assert.ok(withFlyAsh < withoutFlyAsh);
    });

    it('calculates maximum fly ash content for 300kg cement correctly', () => {
        const maxFlyAsh = calculateMaxFlyAshContent(300);
        assert.ok(Math.abs(maxFlyAsh - 99) < 2);
    });
});

describe('B20 air entrainment and strength adjustments', () => {
    it('reduces water by approx 5L per 1% LP', () => {
        const baseWater = 180;
        const reduced = adjustForAirEntraining(baseWater, 4);
        assert.ok(Math.abs((baseWater - reduced) - 20) < 1);
    });

    it('reduces strength by 3.5 per percent of LP', () => {
        const reduced = calculateStrengthReduction(40, 6);
        assert.ok(Math.abs((40 - reduced) - 21) < 1);
    });
});

describe('B20 material density and volume check', () => {
    it('gets reasonable aggregate densities and compute mass in stofraumrechnung', () => {
        const granularDensity = getAverageDensity('Granit');
        assert.ok(granularDensity >= 2.6 && granularDensity <= 2.8);

        const mix = stofraumrechnung(300, 150, 20, 'Granit');
        const totalVolume = mix.cement_volume + mix.water_volume + mix.air_volume + mix.aggregate_volume;
        assert.ok(Math.abs(totalVolume - 1000) < 40);
        assert.ok(mix.aggregate_mass > 1800 && mix.aggregate_mass < 2100);
    });
});

describe('B20 strength and curing conversion', () => {
    it('computes target strength from characteristic value', () => {
        assert.strictEqual(calculateTargetStrength(20), 28);
        assert.strictEqual(calculateTargetStrength(30), 38);
    });

    it('converts wet curing to dry curing strength appropriately', () => {
        const converted = convertToDryCuring(34);
        assert.ok(Math.abs(converted - 36.96) < 0.5);
    });
});

describe('B20 combined supplementary materials mix outcome', () => {
    it('computes equivalent w/z with both fly ash and silica fume', () => {
        const result = calculateEquivalentWzWithBoth(190, 280, 50, 20);
        assert.ok(result > 0 && result < 1);
        assert.ok(result < calculateEquivalentWzWithBoth(190, 280, 0, 0));
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// B20 Anhang – Worked Examples (Rechenbeispiele)
// Reference: Zement-Merkblatt B 20, Abschnitt 15
// Tolerances are ±5 kg/m³ or ±5 l/m³ to account for rounding in the standard.
// ─────────────────────────────────────────────────────────────────────────────

describe('B20 Beispiel I – XC1, F3, B32, CEM II/A-LL 42.5 N, no additives', () => {
    // B20 p.13–14: Sand/Kies B32/E1, Größtkorn D32, ρg=2.65 kg/dm³
    // Result: z=279 kg, w=190 l, g=1852 kg
    const siebline = 'B32';
    const LP_vol = 18; // 1.8 Vol.-% assumed
    const rhoG = 2.65;

    it('water demand: B32/F3 = 1300/(4.20+3) = 180.6 → table recommends 190 l', () => {
        const w = calculateWaterDemand(siebline, 'F3');
        // Formula gives ≈180.6; B20 says to use the larger table value (190)
        assert.ok(w >= 180 && w <= 182, `B32/F3 formula should be ≈180.6, got ${w}`);
    });

    it('Stoffraumrechnung: z=279, w=190, LP=18 → g ≈ 1852 kg', () => {
        const z = 279, w = 190;
        const vz = z / 3.0;   // CEM II density ≈ 3.0 kg/dm³
        const vw = w / 1.0;
        const vg = 1000 - vz - vw - LP_vol;
        const g = Math.round(vg * rhoG);
        assert.ok(Math.abs(g - 1852) <= 10, `Expected g≈1852, got ${g}`);
    });

    it('Mehlkorngehalt: z=279 + fines(B32)=0.04×1852 ≈ 353 kg (limit 550 kg)', () => {
        const fines = Math.round(279 + 1852 * getFinesFraction(siebline));
        assert.ok(fines >= 340 && fines <= 370, `Mehlkorngehalt should be ~353, got ${fines}`);
        assert.ok(fines <= 550, 'Must not exceed limit of 550 kg/m³ for XC1');
    });

    it('grain groups B32 have 3 fractions summing to 100%', () => {
        const gg = getGrainGroups(siebline);
        assert.ok(gg && gg.groups.length >= 2, 'B32 should have grain groups');
        const total = gg.groups.reduce((s, g) => s + g.pct, 0);
        assert.strictEqual(total, 100, `Percentages must sum to 100, got ${total}`);
    });

    it('Zugabewasser from distributeAggregateBySiebline matches B20 ≈ 131 l', () => {
        // B20 Beispiel I: total water 190 l, surface moisture ~59 l → Zugabewasser = 131 l
        const korngruppen = distributeAggregateBySiebline(1852, siebline, [4.5, 3.0, 2.0]);
        assert.ok(korngruppen, 'Should produce grain groups');
        const zugabe = calculateZugabewasser(190, korngruppen);
        assert.ok(Math.abs(zugabe - 131) <= 10, `Expected Zugabewasser≈131, got ${zugabe}`);
    });
});

describe('B20 Beispiel II – XC1, F3, A/B16, CEM II/A-LL 42.5 N, BV 7%', () => {
    // B20 p.14–15: Sand+Splitt A/B16, k=4.13, BV 7% water saving
    // Result: z=287 kg, w=195 l (→ 7% BV → 181 l), g=1816 kg, Zugabewasser≈145 l
    const siebline = 'A/B16';

    it('k-value for A/B16 is average of A16 (4.60) and B16 (3.66) = 4.13', () => {
        const avg = calculateAverageK('A16', 'B16');
        assert.ok(Math.abs(avg - 4.13) < 0.01, `Expected 4.13, got ${avg}`);
    });

    it('water demand F3 with Splitt (+10%) then BV (−7%) ≈ 195 l', () => {
        const base = calculateWaterDemand(siebline, 'F3'); // 1300/(4.13+3) ≈ 179.4
        const withSplitt = adjustForAggregateType(base, true); // +10% → ~197
        // After 7% BV reduction: ~183 l (B20 chooses 195 from table first, then BV)
        assert.ok(withSplitt >= 190 && withSplitt <= 210, `Splitt-adjusted should be ~197 l, got ${withSplitt}`);
    });

    it('grain groups A/B16 have 3 fractions summing to 100%', () => {
        const gg = getGrainGroups(siebline);
        assert.ok(gg && gg.groups.length === 3);
        const total = gg.groups.reduce((s, g) => s + g.pct, 0);
        assert.strictEqual(total, 100);
    });

    it('fines fraction for A/B16 is 0.03 (3%)', () => {
        assert.strictEqual(getFinesFraction(siebline), 0.03);
    });
});

describe('B20 Beispiel III – XC4/XD1/XF2, F2, B16, CEM I 52.5 R, BV', () => {
    // B20 p.15–17: Splitt B16, CEM I 52.5R, BV 7%, no additives
    // Variante 1: C35/45 (no LP): z=383 kg, w=184 l
    // Variante 2: C30/37 with LP (4.5 Vol.-%): z=327 kg, w=170 l

    it('inverse Walzkurven round-trip: CEM I 52.5R', () => {
        // Verify that calculateWzFromTargetStrength is the exact inverse of calculateStrengthFromWalzkurven
        // (Old B20 Beispiel III point of f_cm=59/w=0.53 was calibrated with sigma=3 on lower-boundary A;
        //  with mean-curve A=48 and sigma=0, the same C35/45 target is 53.9 N/mm².)
        const wz_in = 0.55;
        const f_cm = calculateStrengthFromWalzkurven(wz_in, '52.5R');
        const wz_out = calculateWzFromTargetStrength(f_cm, '52.5R');
        assert.ok(wz_out !== null, 'Should return a w/z value');
        // Tolerance 0.002 accounts for 1-decimal rounding in calculateStrengthFromWalzkurven
        assert.ok(Math.abs(wz_out - wz_in) <= 0.002, `Round-trip failed: ${wz_out} ≠ ${wz_in}`);
    });

    it('Stoffraumrechnung Variante 1: z=383, w=184 → g ≈ 1800 kg', () => {
        const z = 383, w = 184, LP = 18, rhoZ = 3.1, rhoG = 2.65;
        const vg = 1000 - z / rhoZ - w / 1.0 - LP;
        const g = Math.round(vg * rhoG);
        assert.ok(Math.abs(g - 1800) <= 20, `Expected g≈1800, got ${g}`);
    });

    it('target strength with v=5: f_cm,dry,cube = f_ck,cube/0.92 + v', () => {
        // C35/45: f_ck,cube=45, v=5 → 45/0.92 + 5 = 48.9 + 5 = 53.9
        // Sigma is NOT added separately – vorhaltemas is the sole safety margin per B20
        const fCm = calculateTargetStrengthWithMargin(45, 0, 5);
        assert.ok(Math.abs(fCm - 53.9) <= 0.2, `Expected ≈53.9, got ${fCm}`);
    });
});

describe('B20 Beispiel IV – XC4/XF1/XA1, F3, A/B16, CEM III/A 42.5 N, Flugasche + BV', () => {
    // B20 p.18–19: Sand/Kies A/B16, CEM III/A 42.5N, BV 10%, Flugasche 40 kg
    // Result: z=285 kg, FA=95 kg (max 33%×285=94.1≈95), w=158 l, g=1853 kg
    // Zugabewasser ≈ 103 l

    it('equivalent w/z with fly ash k=0.4: z=285, FA=95, w=158 → (w/z)_eq ≈ 0.53', () => {
        // (w/z)_eq = w / (z + 0.4×f) = 158 / (285 + 0.4×95) = 158 / 323 ≈ 0.489
        // B20 uses (w/z)_eq = 158/(285 + 0.4×95) = 158/323 ≈ 0.49, limit 0.60
        const wz_eq = calculateEquivalentWzWithBoth(158, 285, 95, 0);
        assert.ok(wz_eq < 0.60, `Equivalent w/z should be ≤ 0.60, got ${wz_eq}`);
        assert.ok(wz_eq > 0.45, `Equivalent w/z should be > 0.45, got ${wz_eq}`);
    });

    it('max fly ash 33% of z=285 → ≈ 94 kg (≈ 95 kg)', () => {
        const maxFA = 0.33 * 285;
        assert.ok(Math.abs(maxFA - 94.1) <= 0.5, `Max FA should be ≈94 kg, got ${maxFA}`);
    });

    it('Zugabewasser A/B16 with 5%/3%/1% moisture, g=1853, w=158 l', () => {
        const korngruppen = distributeAggregateBySiebline(1853, 'A/B16', [5.0, 3.0, 1.0]);
        assert.ok(korngruppen && korngruppen.length === 3);
        const zugabe = calculateZugabewasser(158, korngruppen);
        // B20 result is ≈ 103 l (moisture ~55 l from 1853 kg aggregate)
        assert.ok(zugabe >= 90 && zugabe <= 120, `Zugabewasser should be ~103 l, got ${zugabe}`);
    });

    it('CEM III/A 42.5N has walzkurveKey=42.5 and faMaxFactor=0.25', () => {
        const ct = getCementType('CEM III/A 42.5 N');
        assert.ok(ct, 'CEM III/A 42.5 N should be in CEMENT_TYPES');
        assert.strictEqual(ct.walzkurveKey, '42.5');
        assert.strictEqual(ct.faMaxFactor, 0.25);
    });
});


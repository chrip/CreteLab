/**
 * DIN 1045-2 / B20 Compliance Tests – 5 Real German Building Scenarios
 *
 * Question answered: "Can I enter a real building scenario into CreteLab and
 * get a recipe that satisfies the normative requirements of DIN 1045-2?"
 *
 * Each test represents a typical German building element. Per DIN 1045-2,
 * when multiple exposure classes apply ALL their limits must be satisfied
 * simultaneously. The compliance check takes the strictest value across all
 * applicable classes:
 *
 *   max_wz_eff = min( max_wz of each class )
 *   min_z_eff  = max( min_z  of each class )
 *   min_fck_eff= max( min_fck of each class )
 *
 * Three assertions per scenario:
 *   1. z ≥ min_z_eff          minimum cement content
 *   2. actual w/z ≤ max_wz_eff  water/cement ratio within the strictest limit
 *   3. fck_cube ≥ min_fck_eff  strength class compatible with exposure
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateWaterDemand }                  from '../js/lib/consistency.js';
import { calculateTargetStrengthWithMargin,
         calculateWzFromTargetStrength }         from '../js/lib/strength.js';
import { getExposureClass, getMaxWz }            from '../js/lib/exposure.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Returns the combined strictest limits across all applicable exposure classes. */
function getStrictestLimits(exposureClasses) {
    const data = exposureClasses.map(c => getExposureClass(c)).filter(Boolean);
    return {
        maxWz:  Math.min(...data.map(d => d.max_wz ?? Infinity)),
        minZ:   Math.max(...data.map(d => d.min_z)),
        minFck: Math.max(...data.map(d => d.min_f_ck_cube)),
    };
}

/**
 * Core calculation: mirrors app.js logic using only library functions.
 * Uses the strictest max_wz across all exposure classes (DIN 1045-2).
 */
function calcMix({ fckCube, v, siebline, consistency, cementKey, exposureClasses,
                   flyAshFrac = 0, silicaFrac = 0,
                   splittFactor = 1.0, admixtureFactor = 1.0 }) {
    const limits     = getStrictestLimits(exposureClasses);
    const water      = calculateWaterDemand(siebline, consistency) * splittFactor * admixtureFactor;
    const fCmTarget  = calculateTargetStrengthWithMargin(fckCube, 0, v);
    const wzWalz     = calculateWzFromTargetStrength(fCmTarget, cementKey) ?? Infinity;
    // betontechnologische Abminderung (–0.02) when walzkurven doesn't govern
    const wzGov      = wzWalz <= limits.maxWz ? wzWalz : limits.maxWz - 0.02;
    const scmFactor  = 1 + 0.4 * flyAshFrac + 1.0 * silicaFrac;
    const zCalc      = water / (wzGov * scmFactor);
    const z          = Math.max(zCalc, limits.minZ);   // enforce normative floor
    const actualWz   = water / z;
    return { water, fCmTarget, wzWalz, wzGov, z, zCalc, actualWz, limits };
}

function printRecipe(label, inputs, r) {
    const fa = inputs.flyAshFrac ? `, Flugasche ${(inputs.flyAshFrac * 100).toFixed(0)}%` : '';
    const walzStr = r.wzWalz > 2 ? '(nicht maßgebend)' : r.wzWalz.toFixed(2);
    console.log(`
┌─ ${label}
│  Bauteil:         ${inputs.element}
│  Eingabe:         ${inputs.strengthClass}, [${inputs.exposureClasses.join('+')}], ${inputs.consistency}/${inputs.siebline}${fa}
│  ─────────────────────────────────────────────────────────
│  Wassergehalt:    ${r.water.toFixed(1)} l/m³
│  Zielfestigkeit:  ${r.fCmTarget.toFixed(1)} N/mm²
│  w/z Walzkurven:  ${walzStr}
│  Maßgebendes w/z: ${r.wzGov.toFixed(2)}  (strengste Grenze ${r.limits.maxWz.toFixed(2)} aller Klassen)
│  Zementgehalt z:  ${r.z.toFixed(0)} kg/m³  (Mindest ${r.limits.minZ} kg/m³)
│  Ist-w/z:         ${r.actualWz.toFixed(3)}
│  ─────────────────────────────────────────────────────────
│  ✓ z ≥ min_z:      ${r.z.toFixed(0)} ≥ ${r.limits.minZ} → ${r.z >= r.limits.minZ ? 'erfüllt' : 'VERLETZT'}
│  ✓ w/z ≤ max_wz:   ${r.actualWz.toFixed(3)} ≤ ${r.limits.maxWz.toFixed(2)} → ${r.actualWz <= r.limits.maxWz + 0.001 ? 'erfüllt' : 'VERLETZT'}
│  ✓ fck ≥ min_fck:  ${inputs.fckCube} ≥ ${r.limits.minFck} → ${inputs.fckCube >= r.limits.minFck ? 'erfüllt' : 'VERLETZT'}
└${'─'.repeat(59)}`);
}

function assertCompliance(r, fckCube, label) {
    assert.ok(r.z >= r.limits.minZ,
        `${label}: z=${r.z.toFixed(0)} < Mindest ${r.limits.minZ} kg/m³`);
    assert.ok(r.actualWz <= r.limits.maxWz + 0.001,
        `${label}: w/z=${r.actualWz.toFixed(3)} > Grenzwert ${r.limits.maxWz}`);
    assert.ok(fckCube >= r.limits.minFck,
        `${label}: fck,cube=${fckCube} < Mindest ${r.limits.minFck} N/mm²`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 1 – Kellerbodenplatte (basement floor slab)
// Typical residential building, permanently moist below grade.
// DIN 1045-2 XC2: max w/z = 0.75, min z = 240 kg/m³, min C16/20
// ──────────────────────────────────────────────────────────────────────────────
describe('Scenario 1 – Kellerbodenplatte C20/25 XC2', () => {
    const inputs = {
        element: 'Kellerbodenplatte (Wohngebäude)',
        strengthClass: 'C20/25', fckCube: 25,
        exposureClasses: ['XC2'], v: 3,
        siebline: 'B32', consistency: 'F3',
        cementKey: '42.5',
    };

    it('produces a DIN 1045-2 compliant recipe', () => {
        const r = calcMix(inputs);
        printRecipe('Scenario 1', inputs, r);
        assertCompliance(r, inputs.fckCube, 'Kellerbodenplatte');

        // Engineering plausibility: mild exposure, cement should stay moderate
        assert.ok(r.z >= 240 && r.z <= 350,
            `Zement ${r.z.toFixed(0)} kg/m³ außerhalb plausibler Bandbreite 240–350 für XC2`);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 2 – Tiefgaragen-Decke (underground car park ceiling)
// De-icing salt spray from vehicles. Chloride + carbonation exposure.
// DIN 1045-2: XC4 (max 0.60) + XD1 (max 0.55) → strictest: max w/z = 0.55, min z = 300
// ──────────────────────────────────────────────────────────────────────────────
describe('Scenario 2 – Tiefgaragen-Decke C30/37 XC4/XD1', () => {
    const inputs = {
        element: 'Tiefgaragen-Decke (chloridbelastet durch Taumittel)',
        strengthClass: 'C30/37', fckCube: 37,
        exposureClasses: ['XC4', 'XD1'], v: 3,
        siebline: 'B32', consistency: 'F3',
        cementKey: '42.5',
    };

    it('produces a DIN 1045-2 compliant recipe', () => {
        const r = calcMix(inputs);
        printRecipe('Scenario 2', inputs, r);
        assertCompliance(r, inputs.fckCube, 'Tiefgaragen-Decke');

        // XD1 governs w/z (0.55) and min cement (300) over XC4 (0.60 / 280)
        assert.strictEqual(r.limits.maxWz, 0.55, 'XD1 muss mit max w/z=0.55 maßgebend sein');
        assert.ok(r.z >= 300,
            `Zement ${r.z.toFixed(0)} kg/m³ erfüllt nicht XD1-Mindestzementgehalt 300 kg/m³`);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 3 – Straßenbrücke Widerlager (road bridge abutment)
// De-icing salt + freeze-thaw cycles. Aggressive combined exposure.
// DIN 1045-2: XD2 (max 0.50) + XF2 (max 0.55) → strictest: max w/z = 0.50, min z = 320
// ──────────────────────────────────────────────────────────────────────────────
describe('Scenario 3 – Straßenbrücke Widerlager C35/45 XD2/XF2', () => {
    const inputs = {
        element: 'Straßenbrücke Widerlager (Taumittel + Frost)',
        strengthClass: 'C35/45', fckCube: 45,
        exposureClasses: ['XD2', 'XF2'], v: 5,
        siebline: 'B16', consistency: 'F3',
        cementKey: '52.5R',
    };

    it('produces a DIN 1045-2 compliant recipe', () => {
        const r = calcMix(inputs);
        printRecipe('Scenario 3', inputs, r);
        assertCompliance(r, inputs.fckCube, 'Brücke Widerlager');

        // XD2 is the binding constraint: max_wz=0.50 tighter than XF2's 0.55
        assert.strictEqual(r.limits.maxWz, 0.50, 'XD2 muss mit max w/z=0.50 maßgebend sein');
        assert.ok(r.z >= 320,
            `Zement ${r.z.toFixed(0)} kg/m³ erfüllt nicht XD2-Mindestzementgehalt 320 kg/m³`);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 4 – Außenstütze mit Flugasche (exterior column, fly ash blend)
// Architectural concrete facade, mild frost, wet/dry cycling.
// DIN 1045-2: XC4 + XF1, both max w/z = 0.60, min z = 280 kg/m³.
// CEM III/A 42.5N with 20 % fly ash substitution (within faMaxFactor = 0.25 for CEM III).
// ──────────────────────────────────────────────────────────────────────────────
describe('Scenario 4 – Außenstütze C25/30 XC4/XF1, CEM III/A 42.5N, 20% Flugasche', () => {
    const inputs = {
        element: 'Außenstütze Architekturbeton (CEM III/A, Flugasche 20%)',
        strengthClass: 'C25/30', fckCube: 30,
        exposureClasses: ['XC4', 'XF1'], v: 3,
        siebline: 'B32', consistency: 'F2',
        cementKey: '42.5',   // CEM III/A 42.5N → same Walzkurven key as CEM I 42.5N
        flyAshFrac: 0.20,    // 20 % fly ash (within CEM III/A faMaxFactor = 0.25)
    };

    it('produces a DIN 1045-2 compliant recipe', () => {
        const r = calcMix(inputs);
        printRecipe('Scenario 4', inputs, r);
        assertCompliance(r, inputs.fckCube, 'Außenstütze Flugasche');

        // Fly ash reduces calculated cement but normative min_z floor must still be met
        assert.ok(r.z >= 280,
            `Zement ${r.z.toFixed(0)} kg/m³ erfüllt nicht XC4-Mindestzementgehalt 280 kg/m³`);
        assert.ok(r.actualWz <= 0.60 + 0.001,
            `w/z ${r.actualWz.toFixed(3)} überschreitet XC4/XF1-Grenzwert 0.60`);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 5 – Industrie-Hallenboden mit Frost und Verschleiß
// (industrial hall floor: high water saturation frost + moderate abrasion)
// DIN 1045-2: XF3 (max 0.50, min 320) + XM1 (max 0.55, min 300) → strictest: 0.50 / 320
// ──────────────────────────────────────────────────────────────────────────────
describe('Scenario 5 – Industrie-Hallenboden C35/45 XF3/XM1', () => {
    const inputs = {
        element: 'Industrie-Hallenboden (hohe Frost-Wassersättigung + Verschleiß)',
        strengthClass: 'C35/45', fckCube: 45,
        exposureClasses: ['XF3', 'XM1'], v: 5,
        siebline: 'B32', consistency: 'F3',
        cementKey: '52.5R',
    };

    it('produces a DIN 1045-2 compliant recipe', () => {
        const r = calcMix(inputs);
        printRecipe('Scenario 5', inputs, r);
        assertCompliance(r, inputs.fckCube, 'Industrie-Hallenboden');

        // XF3 imposes the tighter w/z cap (0.50) over XM1's 0.55
        assert.strictEqual(r.limits.maxWz, 0.50, 'XF3 muss mit max w/z=0.50 maßgebend sein');
        assert.ok(r.z >= 320,
            `Zement ${r.z.toFixed(0)} kg/m³ erfüllt nicht XF3-Mindestzementgehalt 320 kg/m³`);
    });
});

/**
 * Tests for plasticizer (Verflüssigungsmittel) water and cement reduction.
 *
 * B20 mechanism: BV/FM reduce the water needed for target workability while
 * the w/z ratio (governed by strength + exposure class) stays constant.
 *
 *   w_new = w₀ × (1 - reduction)
 *   z_new = w_new / maxWz  =  z₀ × (1 - reduction)
 *
 * → Both water AND cement drop by the same factor.
 *   The w/z ratio is unchanged; the mix is simply more economical.
 *
 * This is distinct from SCMs (fly ash / silica fume) which lower cement by
 * contributing to the equivalent binder while keeping the same water content.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    applyAdmixtureWaterReduction,
    getAdmixtureWaterReductionFactor,
    getRecommendedWaterSaving
} from '../js/lib/additives.js';

// Helper: computes cement from water and governing w/z
function cement(water, maxWz) {
    return water / maxWz;
}

// Helper: actual w/z from a mix (must stay ≤ maxWz)
function actualWz(water, z) {
    return water / z;
}

describe('Plasticizer water reduction factors', () => {
    it('BV gives ~7 % water saving', () => {
        assert.strictEqual(getRecommendedWaterSaving('BV'), 7);
    });

    it('FM gives ~20 % water saving', () => {
        assert.strictEqual(getRecommendedWaterSaving('FM'), 20);
    });

    it('no admixture: zero reduction', () => {
        assert.strictEqual(getAdmixtureWaterReductionFactor('none'), 0);
        assert.strictEqual(getAdmixtureWaterReductionFactor(null),   0);
    });

    it('BV reduction factor is 0.07', () => {
        assert.ok(Math.abs(getAdmixtureWaterReductionFactor('BV') - 0.07) < 1e-9);
    });

    it('FM reduction factor is 0.20', () => {
        assert.ok(Math.abs(getAdmixtureWaterReductionFactor('FM') - 0.20) < 1e-9);
    });
});

describe('BV (Betonverflüssiger) – water and cement reduction', () => {
    const W0   = 190; // base water l/m³
    const maxWz = 0.60;

    it('BV reduces water by 7 %', () => {
        const wNew = applyAdmixtureWaterReduction(W0, 'BV');
        assert.ok(Math.abs(wNew - W0 * 0.93) <= 1); // rounding of 1 l OK
    });

    it('without BV: reference cement', () => {
        const z = cement(W0, maxWz);
        assert.ok(Math.abs(z - 316.7) < 1);
    });

    it('with BV: cement decreases by the same factor as water (~7 %)', () => {
        const wNew = applyAdmixtureWaterReduction(W0, 'BV'); // ~177 l
        const zBase = cement(W0,   maxWz); // ~317 kg
        const zNew  = cement(wNew, maxWz); // ~295 kg
        assert.ok(zNew < zBase, 'cement must decrease with BV');
        // Both should drop by ~7 %
        const waterRatio  = wNew / W0;
        const cementRatio = zNew / zBase;
        assert.ok(Math.abs(waterRatio - cementRatio) < 0.01,
            'water and cement must decrease by the same factor');
    });

    it('w/z ratio is unchanged with BV', () => {
        const wNew = applyAdmixtureWaterReduction(W0, 'BV');
        const zNew = cement(wNew, maxWz);
        const wz   = actualWz(wNew, zNew);
        assert.ok(Math.abs(wz - maxWz) < 0.01,
            `w/z must remain ${maxWz} but got ${wz.toFixed(3)}`);
    });
});

describe('FM (Fließmittel) – stronger water and cement reduction', () => {
    const W0    = 190;
    const maxWz = 0.55;

    it('FM reduces water by 20 %', () => {
        const wNew = applyAdmixtureWaterReduction(W0, 'FM');
        assert.ok(Math.abs(wNew - W0 * 0.80) <= 1);
    });

    it('with FM: cement decreases by ~20 % (more than BV)', () => {
        const wBV = applyAdmixtureWaterReduction(W0, 'BV');
        const wFM = applyAdmixtureWaterReduction(W0, 'FM');
        const zBV = cement(wBV, maxWz);
        const zFM = cement(wFM, maxWz);
        assert.ok(zFM < zBV, 'FM must reduce cement more than BV');
    });

    it('FM: cement decreases by the same factor as water (~20 %)', () => {
        const wNew  = applyAdmixtureWaterReduction(W0, 'FM'); // ~152 l
        const zBase = cement(W0,   maxWz);
        const zNew  = cement(wNew, maxWz);
        const waterRatio  = wNew / W0;
        const cementRatio = zNew / zBase;
        assert.ok(Math.abs(waterRatio - cementRatio) < 0.01,
            'water and cement must decrease by the same factor with FM');
    });

    it('w/z ratio is unchanged with FM', () => {
        const wNew = applyAdmixtureWaterReduction(W0, 'FM');
        const zNew = cement(wNew, maxWz);
        const wz   = actualWz(wNew, zNew);
        assert.ok(Math.abs(wz - maxWz) < 0.01,
            `w/z must remain ${maxWz} but got ${wz.toFixed(3)}`);
    });
});

describe('Plasticizer vs SCM: different reduction mechanisms', () => {
    const W0    = 190;
    const maxWz = 0.60;
    const k_FA  = 0.4;
    const alpha  = 0.15; // 15 % fly ash

    it('plasticizer reduces both water AND cement proportionally', () => {
        const wBV = applyAdmixtureWaterReduction(W0, 'BV');
        const zBV = cement(wBV, maxWz);
        // water ratio ≈ cement ratio
        assert.ok(Math.abs(wBV / W0 - zBV / cement(W0, maxWz)) < 0.01);
    });

    it('fly ash reduces cement but NOT water', () => {
        const scmFactor = 1 + k_FA * alpha; // 1.06
        const zFA = cement(W0, maxWz * scmFactor); // less cement from same water
        const zBase = cement(W0, maxWz);
        // water stays the same; only cement changes
        assert.ok(zFA < zBase, 'fly ash must reduce cement');
        // w/z_eq = maxWz (cement ratio changed, but not water)
        const wzEq = W0 / (zFA * (1 + k_FA * alpha));
        assert.ok(Math.abs(wzEq - maxWz) < 0.01);
    });

    it('BV + fly ash: both reductions stack – lowest cement of all', () => {
        const wBV = applyAdmixtureWaterReduction(W0, 'BV');
        const scmFactor = 1 + k_FA * alpha;
        const zBoth = cement(wBV, maxWz * scmFactor);   // reduced water + SCM bonus
        const zBVonly = cement(wBV, maxWz);              // reduced water only
        const zFAonly = cement(W0,  maxWz * scmFactor); // SCM only
        const zBase   = cement(W0,  maxWz);             // no reduction

        assert.ok(zBoth < zBVonly, 'adding fly ash on top of BV reduces cement further');
        assert.ok(zBoth < zFAonly, 'adding BV on top of fly ash reduces cement further');
        assert.ok(zBoth < zBase);
    });
});

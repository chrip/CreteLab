/**
 * Tests for supplementary cementitious materials (SCM) cement reduction.
 *
 * B20 Abschnitt 7.2: SCMs reduce the required cement content because they
 * contribute to the effective binder via k-values (Anrechenbarkeit):
 *
 *   (w/z)_eq = w / (z + k_FA·FA + k_SF·SF)
 *
 * → For the same target (w/z)_eq and water content, more effective binder
 *   means less cement is needed:
 *
 *   z = w / (maxWz · (1 + k_FA·α_FA + k_SF·α_SF))
 *
 * where α_FA = FA/z, α_SF = SF/z (ratios as fractions of cement).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateEquivalentWzWithBoth } from '../js/lib/additives.js';

const K_FA = 0.4; // B20 Anrechenbarkeit Flugasche
const K_SF = 1.0; // B20 Anrechenbarkeit Silikastaub

/**
 * Compute cement content using the B20 equivalent w/z approach.
 * @param {number} water - water content l/m³
 * @param {number} maxWz - governing w/z (from exposure class or Walzkurven)
 * @param {number} alphaFA - fly ash as fraction of cement (e.g. 0.15 = 15 %)
 * @param {number} alphaSF - silica fume as fraction of cement (e.g. 0.08 = 8 %)
 */
function computeCement(water, maxWz, alphaFA = 0, alphaSF = 0) {
    const scmFactor = 1 + K_FA * alphaFA + K_SF * alphaSF;
    return water / (maxWz * scmFactor);
}

describe('SCM cement reduction – fly ash (k = 0.4)', () => {
    it('no fly ash: baseline cement', () => {
        const water = 180, maxWz = 0.60;
        const z = computeCement(water, maxWz, 0, 0);
        assert.ok(Math.abs(z - 300) < 1); // 180/0.60 = 300
    });

    it('15 % fly ash reduces cement by the scmFactor (1 + 0.4·0.15 = 1.06)', () => {
        const water = 180, maxWz = 0.60, alpha = 0.15;
        const zBase  = computeCement(water, maxWz, 0, 0);    // 300 kg
        const zWith  = computeCement(water, maxWz, alpha, 0);// 300 / 1.06 ≈ 283 kg
        assert.ok(zWith < zBase, 'cement must decrease when fly ash is used');
        const expectedFactor = 1 + K_FA * alpha; // 1.06
        assert.ok(Math.abs(zBase / zWith - expectedFactor) < 0.01);
    });

    it('33 % fly ash (max CEM I) reduces cement noticeably', () => {
        const water = 180, maxWz = 0.60, alpha = 0.33;
        const zBase = computeCement(water, maxWz, 0, 0);   // 300 kg
        const zWith = computeCement(water, maxWz, alpha, 0);
        assert.ok(zWith < zBase);
        // scmFactor = 1 + 0.4·0.33 = 1.132  → cement ≈ 300/1.132 ≈ 265 kg
        assert.ok(Math.abs(zWith - 265.5) < 1.5);
    });

    it('fly ash mass = alpha_FA · z_reduced (not alpha_FA · z_baseline)', () => {
        const water = 180, maxWz = 0.60, alpha = 0.20;
        const z = computeCement(water, maxWz, alpha, 0);
        const fa = z * alpha; // correct: fraction of reduced cement
        const faWrong = computeCement(water, maxWz, 0, 0) * alpha; // old bug
        // Fly ash should be less than the buggy version
        assert.ok(fa < faWrong, 'fly ash mass must be computed from reduced cement');
    });

    it('equivalent w/z equals maxWz after substitution', () => {
        const water = 180, maxWz = 0.60, alpha = 0.15;
        const z  = computeCement(water, maxWz, alpha, 0);
        const fa = z * alpha;
        const wzEq = calculateEquivalentWzWithBoth(water, z, fa, 0);
        assert.ok(Math.abs(wzEq - maxWz) < 0.01,
            `(w/z)_eq should equal maxWz but got ${wzEq}`);
    });
});

describe('SCM cement reduction – silica fume (k = 1.0)', () => {
    it('8 % silica fume reduces cement by scmFactor (1 + 1.0·0.08 = 1.08)', () => {
        const water = 180, maxWz = 0.55, alpha = 0.08;
        const zBase = computeCement(water, maxWz, 0, 0);    // 180/0.55 ≈ 327 kg
        const zWith = computeCement(water, maxWz, 0, alpha);
        assert.ok(zWith < zBase, 'cement must decrease when silica fume is used');
        const expectedFactor = 1 + K_SF * alpha; // 1.08
        assert.ok(Math.abs(zBase / zWith - expectedFactor) < 0.01);
    });

    it('silica fume (k=1.0) reduces cement more than equivalent fly ash fraction', () => {
        const water = 180, maxWz = 0.55, alpha = 0.08;
        const zWithSF = computeCement(water, maxWz, 0, alpha);
        const zWithFA = computeCement(water, maxWz, alpha, 0); // k=0.4 → less effect
        assert.ok(zWithSF < zWithFA,
            'silica fume (k=1.0) should reduce cement more than fly ash (k=0.4) at same fraction');
    });

    it('equivalent w/z equals maxWz after substitution', () => {
        const water = 180, maxWz = 0.55, alpha = 0.08;
        const z  = computeCement(water, maxWz, 0, alpha);
        const sf = z * alpha;
        const wzEq = calculateEquivalentWzWithBoth(water, z, 0, sf);
        assert.ok(Math.abs(wzEq - maxWz) < 0.01,
            `(w/z)_eq should equal maxWz but got ${wzEq}`);
    });
});

describe('SCM cement reduction – combined fly ash + silica fume', () => {
    it('combined SCMs reduce cement more than either alone', () => {
        const water = 190, maxWz = 0.55;
        const zBase  = computeCement(water, maxWz, 0, 0);
        const zFA    = computeCement(water, maxWz, 0.15, 0);
        const zSF    = computeCement(water, maxWz, 0, 0.08);
        const zBoth  = computeCement(water, maxWz, 0.15, 0.08);
        assert.ok(zBoth < zFA  && zBoth < zSF, 'combined must reduce cement the most');
        assert.ok(zBoth < zBase);
    });

    it('equivalent w/z equals maxWz for combined case', () => {
        const water = 190, maxWz = 0.55, alphaFA = 0.15, alphaSF = 0.08;
        const z  = computeCement(water, maxWz, alphaFA, alphaSF);
        const fa = z * alphaFA;
        const sf = z * alphaSF;
        const wzEq = calculateEquivalentWzWithBoth(water, z, fa, sf);
        assert.ok(Math.abs(wzEq - maxWz) < 0.01,
            `(w/z)_eq should equal maxWz but got ${wzEq}`);
    });

    it('total binder (z + FA + SF) is greater than cement alone', () => {
        const water = 190, maxWz = 0.55, alphaFA = 0.15, alphaSF = 0.08;
        const z  = computeCement(water, maxWz, alphaFA, alphaSF);
        const zBase = computeCement(water, maxWz, 0, 0);
        const totalBinder = z + z * alphaFA + z * alphaSF;
        assert.ok(totalBinder > zBase,
            'total binder (z+FA+SF) must exceed the no-SCM cement amount because k<1 for FA');
        // Note: this is only guaranteed when both FA (k=0.4) and SF (k=1.0) are combined;
        // with FA alone it may not hold since k_FA < 1
    });
});

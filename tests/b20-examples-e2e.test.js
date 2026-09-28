/**
 * Zement-Merkblatt B 20 (2.2017) Anhang examples run through the whole engine
 * (computeRecipe), with the Vorhaltemaß set to B 20's total margin 1,48·σ + v (σ = 3).
 *
 * The engine takes the water demand from the Tafel 3 formula; B 20 allows the table
 * or the formula ("entweder über Werte aus Tafel 3 oder über die angegebenen Formeln")
 * and picks the larger table value in Beispiel I/II. Where both agree (Beispiel III,
 * 180 l) the whole chain can be compared; for Beispiel I only the steps before water.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeRecipe } from '../js/lib/recipe.js';

const base = {
    volume: 1, aggregateType: 'Kiessand (Quarz)', admixtureType: 'none',
    useAirEntraining: false, airEntrainingPercent: 0, useFlyAsh: false, flyAshPercent: 0,
    useSilicaFume: false, silicaFumePercent: 0, useWaterproofing: false, waterproofPercent: 0,
    useMoisture: false, moisture0_2: 0, moisture2_8: 0, moisture8plus: 0
};
const near = (a, e, tol, what) => assert.ok(Math.abs(a - e) <= tol, `${what}: expected ${e} ± ${tol}, got ${a}`);

describe('B 20 Beispiel I (p. 13–14): XC1, C20/25, B32, F3, CEM II 42,5 N', () => {
    const { recipe } = computeRecipe({ ...base, strengthClass: 'C20/25', siebline: 'B32', consistencyClass: 'F3',
        cementType: 'CEM II/A-LL 42.5 N', vorhaltemas: 1.48 * 3 + 3 }, ['XC1']);

    it('target "fcm,dry,cube ≥ 34,6 N/mm²"', () => near(recipe.fCmTarget, 34.6, 0.05, 'target'));
    it('Walz curve governs: "w/zermittelt = 0,68 ≤ 0,73"', () => {
        near(recipe.wzWalz, 0.68, 0.02, 'w/z Walz');
        assert.strictEqual(recipe.wzSource, 'walz');
    });
});

describe('B 20 Beispiel III (p. 15–18): XC4/XD1/XF2, B16, F2, Splitt, CEM I 52,5 R, BV', () => {
    const beispielIII = { ...base, siebline: 'B16', consistencyClass: 'F2', aggregateType: 'Dichter Kalkstein',
        cementType: 'CEM I 52.5 R', admixtureType: 'BV', vorhaltemas: 1.48 * 3 + 5 };

    describe('Variante 1: C35/45 without LP', () => {
        const { recipe } = computeRecipe({ ...beispielIII, strengthClass: 'C35/45' }, ['XC4', 'XD1', 'XF2']);
        it('water "w = 0,93 ∙ 198 = 184 l"', () => assert.strictEqual(recipe.materials.water, 184));
        it('target "fcm,dry,cube ≥ 58,4 N/mm²"', () => near(recipe.fCmTarget, 58.4, 0.05, 'target'));
        it('Walz curve "w/zermittelt = 0,53"', () => near(recipe.wzWalz, 0.53, 0.02, 'w/z Walz'));
        it('XF2 without LP governs: "w/z = 0,50 - 0,02 = 0,48"', () => {
            assert.strictEqual(recipe.wzExposure, 0.50);
            near(recipe.wzLimit, 0.48, 0.001, 'w/z');
            assert.strictEqual(recipe.wzSource, 'exposure');
        });
        it('cement "z = 184/0,48 = 383 kg/m³" (≥ 320)', () => {
            assert.strictEqual(recipe.materials.cement, 383);
            assert.strictEqual(recipe.minZeff, 320);
        });
    });

    describe('Variante 2: C30/37 as LP concrete, 4,5 Vol.-% air', () => {
        const { recipe } = computeRecipe({ ...beispielIII, strengthClass: 'C30/37',
            useAirEntraining: true, airEntrainingPercent: 4.5 }, ['XC4', 'XD1', 'XF2']);
        // B 20 assumes 1,5 % natural air here, the engine 2 % (B 20 p. 5): 169 l vs 171,5 l,
        // target 60,2 vs 58,5 N/mm². Both effects nearly cancel in the cement content.
        it('water within 3 l of "w = 184 - 3 ∙ 5 = 169 l"', () => near(recipe.materials.water, 169, 3, 'water'));
        it('w/z within 0,02 of "w/zermittelt = 0,52"', () => near(recipe.wzLimit, 0.52, 0.02, 'w/z'));
        it('cement within 2 % of "z = 170/0,52 = 327 kg/m3"', () => near(recipe.materials.cement, 327, 327 * 0.02, 'cement'));
        it('Stoffraum uses "Luftgehalt: Annahme 4,5 Vol.-%" = 45 dm³', () => assert.strictEqual(recipe.airVolumeDm3, 45));
        it('4,5 % reaches the B16 minimum, so XF2 uses its LP limits: 0,55 − 0,02 = 0,53, z ≥ 300', () => {
            assert.strictEqual(recipe.airEntrained, true);
            assert.strictEqual(recipe.wzExposure, 0.55);
            assert.strictEqual(recipe.minZeff, 300);
        });
    });
});

describe('XF2 with too little air falls back to the limits without LP', () => {
    it('3,5 % air in a B16 mix (minimum 4,5 %) keeps w/z ≤ 0,50 and z ≥ 320', () => {
        const { recipe } = computeRecipe({ ...base, strengthClass: 'C35/45', siebline: 'B16', consistencyClass: 'F2',
            cementType: 'CEM I 52.5 R', vorhaltemas: 9, useAirEntraining: true, airEntrainingPercent: 3.5 }, ['XF2']);
        assert.strictEqual(recipe.airEntrained, false);
        assert.strictEqual(recipe.wzExposure, 0.50);
        assert.strictEqual(recipe.minZeff, 320);
    });
});

/**
 * Air-entrained concrete through the whole engine (computeRecipe), following
 * Zement-Merkblatt B 20 (2.2017):
 *   - the form field is the TOTAL air content ("Luftgehalt: Annahme 4,5 Vol.-%", p. 17)
 *   - compacted concrete holds ~2 % air anyway ("ca. 2 % Luftporen (20 l/m3)", p. 5)
 *   - only the added air saves water: 5 l per Vol.-% (Tafel 9), after the BV
 *     reduction ("w = 184 - 3 ∙ 5 = 169 l", p. 17)
 *   - and costs 3,5 N/mm² per Vol.-%, added to the target strength
 *     ("fcm,dry,cube ≥ (37/0,92) + 1,48 ∙ 3 + 5 + 3 ∙ 3,5", p. 17)
 * B 20 Beispiel III assumes 1,5 % natural air there; the engine uses the 2 % of p. 5.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeRecipe, NATURAL_AIR_PCT } from '../js/lib/recipe.js';

const beispielIII = {
    volume: 1, strengthClass: 'C30/37', siebline: 'B16', consistencyClass: 'F2',
    aggregateType: 'Dichter Kalkstein', cementType: 'CEM I 52.5 R', vorhaltemas: 5,
    admixtureType: 'BV', useFlyAsh: false, flyAshPercent: 0, useSilicaFume: false, silicaFumePercent: 0,
    useWaterproofing: false, waterproofPercent: 0, useMoisture: false,
    moisture0_2: 0, moisture2_8: 0, moisture8plus: 0
};
const classes = ['XC4', 'XD1', 'XF2'];
const run = air => computeRecipe({ ...beispielIII, useAirEntraining: air > 0, airEntrainingPercent: air }, classes).recipe;

describe('Air entrainment end to end (B 20 Beispiel III Variante 2 rules)', () => {
    const plain = run(0);
    const lp = run(4.5);

    it('without LP the engine assumes 2 % compaction air (20 dm³)', () => {
        assert.strictEqual(NATURAL_AIR_PCT, 2);
        assert.strictEqual(plain.airVolumeDm3, 20);
    });

    it('4,5 % target air means 45 dm³ in the Stoffraum, not 20 + 45', () => {
        assert.strictEqual(lp.airVolumeDm3, 45);
        assert.strictEqual(lp.addedAirPct, 2.5);
    });

    it('water: plain mix (formula → Splitt → BV) is 184 l, as in B 20', () => {
        assert.strictEqual(plain.materials.water, 184);
    });

    it('water saving counts only the added air: 184 − 2,5 · 5 = 171,5 l', () => {
        assert.strictEqual(lp.materials.water, 171.5);
    });

    it('target strength rises by 2,5 · 3,5 = 8,75 N/mm²', () => {
        assert.ok(Math.abs(lp.fCmTarget - plain.fCmTarget - 8.75) <= 0.1,
            `Δ fcm = ${lp.fCmTarget - plain.fCmTarget}`);
        assert.strictEqual(lp.lpStrengthLoss, 8.75);
    });

    it('an entered air content at or below 2 % changes nothing', () => {
        const low = run(1.5);
        assert.strictEqual(low.airVolumeDm3, 20);
        assert.strictEqual(low.materials.water, plain.materials.water);
        assert.strictEqual(low.fCmTarget, plain.fCmTarget);
    });
});

/**
 * Minimum strength class per exposure class (DIN 1045-2, Zement-Merkblatt B 9 Tafel 3/4).
 *
 * Regression: min_f_ck_cube used to hold cylinder strengths (the first number of the
 * class name) while satisfiesExposureRequirements() compares against the cube strength.
 * Every check was one class too lax, e.g. C20/25 was accepted for XC4 (needs C25/30).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { satisfiesExposureRequirements, getStrictestLimits, getAvailableExposureClasses } from '../js/lib/exposure.js';
import { getAvailableClasses, getStrengthClass } from '../js/lib/strength.js';

const DIN_MIN_CLASS = {
    X0: 'C8/10',
    XC1: 'C16/20', XC2: 'C16/20', XC3: 'C20/25', XC4: 'C25/30',
    XD1: 'C30/37', XD2: 'C35/45', XD3: 'C35/45',
    XS1: 'C30/37', XS2: 'C35/45', XS3: 'C35/45',
    XF1: 'C25/30', XF2: 'C35/45', XF3: 'C35/45', XF4: 'C30/37', // XF2/XF3 without LP (B 9 Tafel 8); XF4 always LP
    XA1: 'C25/30', XA2: 'C35/45', XA3: 'C35/45',
    XM1: 'C30/37', XM2: 'C35/45', XM3: 'C35/45'
};

const lowestAccepted = exposure => getAvailableClasses().find(c => satisfiesExposureRequirements(c, exposure));

describe('Minimum strength class per exposure class (DIN 1045-2)', () => {
    it('covers every exposure class', () => {
        assert.deepStrictEqual(Object.keys(DIN_MIN_CLASS).sort(), [...getAvailableExposureClasses()].sort());
    });

    for (const [exposure, minClass] of Object.entries(DIN_MIN_CLASS)) {
        it(`${exposure}: lowest accepted class is ${minClass}`, () => {
            assert.strictEqual(lowestAccepted(exposure), minClass);
        });
    }

    it('rejects C20/25 for XC4 and accepts C25/30', () => {
        assert.strictEqual(satisfiesExposureRequirements('C20/25', 'XC4'), false);
        assert.strictEqual(satisfiesExposureRequirements('C25/30', 'XC4'), true);
    });

    it('XF2/XF3 with air entrainment: C25/30, w/z 0,55, z 300 (B 9 Tafel 8)', () => {
        for (const cls of ['XF2', 'XF3']) {
            assert.deepStrictEqual(getStrictestLimits([cls], { airEntrained: true }),
                { maxWz: 0.55, minZ: 300, minFck: getStrengthClass('C25/30').f_ck_cube });
            assert.deepStrictEqual(getStrictestLimits([cls]),
                { maxWz: 0.50, minZ: 320, minFck: getStrengthClass('C35/45').f_ck_cube });
        }
    });

    it('getStrictestLimits().minFck is a cube strength: XC4 + XF4 + XD3 needs C35/45', () => {
        const { minFck } = getStrictestLimits(['XC4', 'XF4', 'XD3']);
        assert.strictEqual(minFck, getStrengthClass('C35/45').f_ck_cube);
        assert.ok(getStrengthClass('C30/37').f_ck_cube < minFck, 'C30/37 must not pass XD3');
    });
});

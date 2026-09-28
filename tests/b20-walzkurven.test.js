/**
 * Tests for Walzkurven (Roll curves) calculations according to Zement-Merkblatt B 20
 * Tests the relationship between concrete compressive strength, cement strength class,
 * and water-cement ratio.
 *
 * A values are calibrated to the MEAN curve of B20 Bild 1.
 * Vorhaltemaß (v) is the sole statistical safety margin per B20; sigma must not
 * be added separately (previous lower-boundary calibration + sigma=3 was double-counting).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import {
    CEMENT_CLASSES,
    getCementClass,
    calculateStrengthFromWalzkurven,
    calculateStrengthWithSupplementaryMaterials,
    calculateWzFromTargetStrength,
    calculateTargetStrengthWithMargin
} from '../js/lib/strength.js';

const BILD_1 = JSON.parse(readFileSync(new URL('./fixtures/b20-bild1-points.json', import.meta.url), 'utf8'));

describe('B20 cement strength classes (Walz curves f = A · e^(−b · w/z))', () => {
    it('32,5 / 42,5 / 52,5 use A = 127 / 156 / 187 and a common b = 2,2', () => {
        assert.deepStrictEqual([getCementClass('32.5').A, getCementClass('42.5').A, getCementClass('52.5').A], [127, 156, 187]);
        for (const key of Object.keys(CEMENT_CLASSES)) assert.strictEqual(CEMENT_CLASSES[key].b, 2.2);
    });

    it('B 20 Bild 1 has one curve per strength class, so R cements share it', () => {
        assert.strictEqual(getCementClass('42.5R').A, getCementClass('42.5').A);
        assert.strictEqual(getCementClass('52.5R').A, getCementClass('52.5').A);
        assert.strictEqual(getCementClass('42.5').name, 'CEM I 42.5 N');
    });

    it('returns null for unknown cement class', () => {
        assert.strictEqual(getCementClass('unknown'), null);
    });
});

describe('Walz curves match B 20 Bild 1', () => {
    for (const [cls, points] of Object.entries(BILD_1.curves)) {
        it(`${cls}: within 1,2 N/mm² of the ${points.length} digitised chart points`, () => {
            for (const [wz, fc] of points) {
                const f = calculateStrengthFromWalzkurven(wz, cls);
                assert.ok(Math.abs(f - fc) <= 1.2, `w/z ${wz}: chart ${fc}, model ${f}`);
            }
        });
    }

    // w/z values the B 20 / BTD examples read from the chart (independent of the fit)
    const READINGS = [
        ['42.5', 35, 0.68, 'B 20 Beispiel I/II'],
        ['42.5', 37, 0.65, 'B 20 Beispiel 4 (arrow in Bild 1)'],
        ['42.5', 50, 0.53, 'B 20 Beispiel IV / Tafel 8'],
        ['52.5R', 59, 0.53, 'B 20 Beispiel III Variante 1'],
        ['52.5R', 60, 0.52, 'B 20 Beispiel III Variante 2'],
        ['32.5', 35, 0.58, 'BTD 2022 9.2 (N28 = 42,5)']
    ];
    for (const [cls, fc, wz, src] of READINGS) {
        it(`${src}: ${fc} N/mm² with ${cls} → w/z ${wz} (± 0,02 chart reading)`, () => {
            const got = calculateWzFromTargetStrength(fc, cls);
            assert.ok(Math.abs(got - wz) <= 0.02, `expected ${wz}, got ${got}`);
        });
    }

    it('returns null for invalid w/z ratio (zero, negative, undefined)', () => {
        assert.strictEqual(calculateStrengthFromWalzkurven(0, '42.5'), null);
        assert.strictEqual(calculateStrengthFromWalzkurven(-0.5, '42.5'), null);
        assert.strictEqual(calculateStrengthFromWalzkurven(undefined, '42.5'), null);
    });

    it('returns null for unknown cement class', () => {
        assert.strictEqual(calculateStrengthFromWalzkurven(0.5, 'unknown'), null);
    });
});

describe('B20 Walzkurven with fly ash (supplementary materials)', () => {
    it('10 % fly ash lowers A by 2 %, 20 % by 4 %', () => {
        const base = calculateStrengthFromWalzkurven(0.5, '42.5');
        const fa10 = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.1, 0);
        const fa20 = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.2, 0);
        assert.ok(Math.abs(fa10 / base - 0.98) < 0.003, `ratio ${fa10 / base}`);
        assert.ok(Math.abs(fa20 / base - 0.96) < 0.003, `ratio ${fa20 / base}`);
        assert.ok(fa20 < fa10);
    });

    it('returns same result as Walzkurven when no supplementary materials', () => {
        assert.strictEqual(calculateStrengthWithSupplementaryMaterials(0.55, '42.5', 0, 0),
                           calculateStrengthFromWalzkurven(0.55, '42.5'));
    });
});

describe('B20 Zielfestigkeit – calculateTargetStrengthWithMargin', () => {
    it('uses only vorhaltemas as safety margin (sigma=0 per B20)', () => {
        // f_cm,dry,cube = f_ck,cube / 0.92 + v
        // C30/37: f_ck_cube=37, v=3 → 37/0.92 + 3 = 40.2 + 3 = 43.2
        const result = calculateTargetStrengthWithMargin(37, 0, 3);
        assert.ok(Math.abs(result - 43.2) < 0.1, `Expected ~43.2, got ${result}`);
    });

    it('sigma parameter is ignored (legacy API compat)', () => {
        // Passing sigma=3 should give the same result as sigma=0
        const withSigma = calculateTargetStrengthWithMargin(37, 3, 3);
        const withoutSigma = calculateTargetStrengthWithMargin(37, 0, 3);
        assert.strictEqual(withSigma, withoutSigma);
    });

    it('scales correctly with different vorhaltemas values', () => {
        const v3 = calculateTargetStrengthWithMargin(25, 0, 3);
        const v5 = calculateTargetStrengthWithMargin(25, 0, 5);
        assert.ok(v5 - v3 > 1.9 && v5 - v3 < 2.1, `Expected Δ≈2, got ${v5 - v3}`);
    });
});

describe('B20 Walzkurven – calculateWzFromTargetStrength', () => {
    it('inverse of calculateStrengthFromWalzkurven', () => {
        const wz_original = 0.6;
        const strength = calculateStrengthFromWalzkurven(wz_original, '42.5');
        const wz_back = calculateWzFromTargetStrength(strength, '42.5');
        // Tolerance of 0.002 accounts for 1-decimal rounding in calculateStrengthFromWalzkurven
        assert.ok(Math.abs(wz_back - wz_original) <= 0.002, `Round-trip failed: ${wz_back} ≠ ${wz_original}`);
    });

    it('C30/37 with CEM I 42.5 N and v=3 gives plausible cement content', () => {
        // f_ck_cube=37, v=3: target = 37/0.92 + 3 = 43.2
        const target = calculateTargetStrengthWithMargin(37, 0, 3);
        const wz = calculateWzFromTargetStrength(target, '42.5');
        // With F3/B32: water ≈ 181 l/m³ → cement = 181/wz
        const water = 1300 / (4.20 + 3); // B32, F3
        const cement = water / wz;
        // Realistic range for C30/37: 280–370 kg/m³
        assert.ok(cement >= 280 && cement <= 370, `Expected cement 280–370, got ${cement.toFixed(0)}`);
    });

    it('returns null for invalid target strength', () => {
        assert.strictEqual(calculateWzFromTargetStrength(0, '42.5'), null);
        assert.strictEqual(calculateWzFromTargetStrength(-5, '42.5'), null);
        assert.strictEqual(calculateWzFromTargetStrength(null, '42.5'), null);
    });
});

describe('B20 Walzkurven integration with concrete strength classes', () => {
    it('C20/25 with CEM I 42.5 N at w/z=0.68 exceeds target strength', () => {
        // With sigma=0, v=3: target = 25/0.92 + 3 = 30.2 N/mm²
        const target = calculateTargetStrengthWithMargin(25, 0, 3);
        const strength = calculateStrengthFromWalzkurven(0.68, '42.5');
        assert.ok(strength >= target, `strength ${strength} should exceed target ${target}`);
    });

    it('C35/45 with CEM I 52.5 R – walzkurven w/z is plausible', () => {
        // With v=5: target = 45/0.92 + 5 = 53.9
        const target = calculateTargetStrengthWithMargin(45, 0, 5);
        const wz = calculateWzFromTargetStrength(target, '52.5R');
        // Walzkurven w/z for high-strength class should be in realistic range
        assert.ok(wz > 0.5 && wz < 1.0, `Expected w/z 0.5–1.0, got ${wz}`);
    });
});

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

import {
    CEMENT_CLASSES,
    getCementClass,
    calculateStrengthFromWalzkurven,
    calculateStrengthWithSupplementaryMaterials,
    calculateWzFromTargetStrength,
    calculateTargetStrengthWithMargin
} from '../js/lib/strength.js';

describe('B20 cement strength classes', () => {
    it('provides cement class data for 42.5 N', () => {
        const result = getCementClass('42.5');
        assert.ok(result);
        assert.strictEqual(result.name, 'CEM I 42.5 N');
        // A=31 calibrated to mean curve of B20 Bild 1
        assert.strictEqual(result.A, 31);
        assert.strictEqual(result.n, 0.67);
    });

    it('provides cement class data for 32.5 N', () => {
        const result = getCementClass('32.5');
        assert.ok(result);
        assert.strictEqual(result.A, 22);
        assert.strictEqual(result.n, 0.67);
    });

    it('provides cement class data for 42.5 R', () => {
        const result = getCementClass('42.5R');
        assert.ok(result);
        assert.strictEqual(result.A, 37);
    });

    it('provides cement class data for 52.5 N', () => {
        const result = getCementClass('52.5');
        assert.ok(result);
        assert.strictEqual(result.A, 44);
        assert.strictEqual(result.n, 0.67);
    });

    it('provides rapid hardening cement class data for 52.5 R', () => {
        const result = getCementClass('52.5R');
        assert.ok(result);
        assert.strictEqual(result.A, 48);
    });

    it('returns null for unknown cement class', () => {
        assert.strictEqual(getCementClass('unknown'), null);
    });
});

describe('B20 Walzkurven calculation (no supplementary materials)', () => {
    it('calculates strength for CEM I 42.5 N with w/z = 0.5', () => {
        // f_cm = 31 * (1/0.5)^0.67 = 31 * 2^0.67 ≈ 31 * 1.591 ≈ 49.3
        const result = calculateStrengthFromWalzkurven(0.5, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 49.3) < 1.0, `Expected ~49.3, got ${result}`);
    });

    it('calculates strength for CEM I 42.5 N with w/z = 0.6', () => {
        // f_cm = 31 * (1/0.6)^0.67 = 31 * 1.667^0.67 ≈ 31 * 1.408 ≈ 43.6
        const result = calculateStrengthFromWalzkurven(0.6, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 43.6) < 1.0, `Expected ~43.6, got ${result}`);
    });

    it('calculates strength for CEM I 52.5 N with w/z = 0.5', () => {
        // f_cm = 44 * 2^0.67 ≈ 44 * 1.591 ≈ 70.0
        const result = calculateStrengthFromWalzkurven(0.5, '52.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 70.0) < 1.0, `Expected ~70.0, got ${result}`);
    });

    it('calculates strength for CEM I 52.5 N with w/z = 0.6', () => {
        // f_cm = 44 * 1.408 ≈ 61.9
        const result = calculateStrengthFromWalzkurven(0.6, '52.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 61.9) < 1.0, `Expected ~61.9, got ${result}`);
    });

    it('calculates strength for CEM I 42.5 N with w/z = 0.55 (typical value)', () => {
        // f_cm = 31 * (1/0.55)^0.67 ≈ 31 * 1.818^0.67 ≈ 31 * 1.493 ≈ 46.3
        const result = calculateStrengthFromWalzkurven(0.55, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 46.3) < 1.0, `Expected ~46.3, got ${result}`);
    });

    it('returns null for invalid w/z ratio (zero)', () => {
        assert.strictEqual(calculateStrengthFromWalzkurven(0, '42.5'), null);
    });

    it('returns null for invalid w/z ratio (negative)', () => {
        assert.strictEqual(calculateStrengthFromWalzkurven(-0.5, '42.5'), null);
    });

    it('returns null for undefined w/z ratio', () => {
        assert.strictEqual(calculateStrengthFromWalzkurven(undefined, '42.5'), null);
    });

    it('returns null for unknown cement class', () => {
        assert.strictEqual(calculateStrengthFromWalzkurven(0.5, 'unknown'), null);
    });
});

describe('B20 Walzkurven with fly ash (supplementary materials)', () => {
    it('calculates strength reduction with 10% fly ash replacement', () => {
        // effectiveA = 31 * (1 - 0.1*0.2) = 31 * 0.98 = 30.38
        // f_cm = 30.38 * (1/0.5)^0.67 ≈ 30.38 * 1.591 ≈ 48.3
        const result = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.1, 0);
        assert.ok(result);
        assert.ok(Math.abs(result - 48.3) < 1.0, `Expected ~48.3, got ${result}`);
    });

    it('calculates strength with 20% fly ash replacement', () => {
        // effectiveA = 31 * (1 - 0.2*0.2) = 31 * 0.96 = 29.76
        // f_cm = 29.76 * 1.591 ≈ 47.3
        const result = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.2, 0);
        assert.ok(result);
        assert.ok(Math.abs(result - 47.3) < 1.0, `Expected ~47.3, got ${result}`);
        // Should be lower than with 10% fly ash
        const with10pct = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.1, 0);
        assert.ok(result < with10pct);
    });

    it('returns same result as Walzkurven when no supplementary materials', () => {
        const wz = 0.55;
        const cementClass = '42.5';
        const walzkurvenResult = calculateStrengthFromWalzkurven(wz, cementClass);
        const supResult = calculateStrengthWithSupplementaryMaterials(wz, cementClass, 0, 0);
        assert.strictEqual(walzkurvenResult, supResult);
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

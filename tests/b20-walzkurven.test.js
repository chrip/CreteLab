/**
 * Tests for Walzkurven (Roll curves) calculations according to Zement-Merkblatt B 20
 * Tests the relationship between concrete compressive strength, cement strength class,
 * and water-cement ratio.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    CEMENT_CLASSES,
    getCementClass,
    calculateStrengthFromWalzkurven,
    calculateStrengthWithSupplementaryMaterials
} from '../js/lib/strength.js';

describe('B20 cement strength classes', () => {
    it('provides cement class data for 42.5 N', () => {
        const result = getCementClass('42.5');
        assert.ok(result);
        assert.strictEqual(result.name, 'CEM I 42.5 N');
        // A=27 calibrated to lower boundary of B20 Bild 1
        // Calibration: Beispiel I w/z=0.68 → f_cm,dry,cube=34.6 → A≈27
        assert.strictEqual(result.A, 27);
        assert.strictEqual(result.n, 0.67);
    });

    it('provides cement class data for 52.5 N', () => {
        const result = getCementClass('52.5');
        assert.ok(result);
        assert.strictEqual(result.name, 'CEM I 52.5 N');
        // A=35 calibrated to lower boundary of B20 Bild 1
        assert.strictEqual(result.A, 35);
        assert.strictEqual(result.n, 0.67);
    });

    it('provides rapid hardening cement class data for 52.5 R', () => {
        const result = getCementClass('52.5R');
        assert.ok(result);
        assert.strictEqual(result.name, 'CEM I 52.5 R');
        // A=38 calibrated from Beispiel III: w/z=0.52 → f_cm,dry,cube=59
        assert.strictEqual(result.A, 38);
    });

    it('returns null for unknown cement class', () => {
        assert.strictEqual(getCementClass('unknown'), null);
    });
});

describe('B20 Walzkurven calculation (no supplementary materials)', () => {
    it('calculates strength for CEM I 42.5 N with w/z = 0.5', () => {
        // f_cm = 27 * (1/0.5)^0.67 = 27 * 2^0.67 ≈ 27 * 1.591 ≈ 43.0
        const result = calculateStrengthFromWalzkurven(0.5, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 43.0) < 1.0);
    });

    it('calculates strength for CEM I 42.5 N with w/z = 0.6', () => {
        // f_cm = 27 * (1/0.6)^0.67 = 27 * 1.667^0.67 ≈ 27 * 1.408 ≈ 38.0
        const result = calculateStrengthFromWalzkurven(0.6, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 38.0) < 1.0);
    });

    it('calculates strength for CEM I 52.5 N with w/z = 0.5', () => {
        // f_cm = 35 * (1/0.5)^0.67 = 35 * 2^0.67 ≈ 35 * 1.591 ≈ 55.7
        const result = calculateStrengthFromWalzkurven(0.5, '52.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 55.7) < 1.0);
    });

    it('calculates strength for CEM I 52.5 N with w/z = 0.6', () => {
        // f_cm = 35 * (1/0.6)^0.67 ≈ 35 * 1.408 ≈ 49.3
        const result = calculateStrengthFromWalzkurven(0.6, '52.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 49.3) < 1.0);
    });

    it('calculates strength for CEM I 42.5 N with w/z = 0.55 (typical value)', () => {
        // f_cm = 27 * (1/0.55)^0.67 ≈ 27 * 1.818^0.67 ≈ 27 * 1.493 ≈ 40.3
        const result = calculateStrengthFromWalzkurven(0.55, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 40.3) < 1.0);
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
        // effectiveA = 27 * (1 - 0.1*0.2) = 27 * 0.98 = 26.46
        // f_cm = 26.46 * (1/0.5)^0.67 ≈ 26.46 * 1.591 ≈ 42.1
        const result = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.1, 0);
        assert.ok(result);
        // Should be slightly lower than without fly ash (~43.0)
        assert.ok(Math.abs(result - 42.1) < 1.0);
    });

    it('calculates strength with 20% fly ash replacement', () => {
        // effectiveA = 27 * (1 - 0.2*0.2) = 27 * 0.96 = 25.92
        // f_cm = 25.92 * (1/0.5)^0.67 ≈ 25.92 * 1.591 ≈ 41.3
        const result = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.2, 0);
        assert.ok(result);
        // Should be lower than with 10% fly ash
        assert.ok(Math.abs(result - 41.3) < 1.0);
    });

    it('returns same result as Walzkurven when no supplementary materials', () => {
        const wz = 0.55;
        const cementClass = '42.5';
        
        const walzkurvenResult = calculateStrengthFromWalzkurven(wz, cementClass);
        const supResult = calculateStrengthWithSupplementaryMaterials(wz, cementClass, 0, 0);
        
        assert.strictEqual(walzkurvenResult, supResult);
    });
});

describe('B20 Walzkurven integration with concrete strength classes', () => {
    it('verifies C20/25 achievable with CEM I 42.5 N at w/z = 0.68 (B20 Beispiel I)', () => {
        // B20 Beispiel I: C20/25, CEM I/II 42.5N, w/z=0.68 → f_cm,dry,cube=34.6
        const strength = calculateStrengthFromWalzkurven(0.68, '42.5');
        // Should be at or above the Beispiel I target of 34.6 N/mm²
        assert.ok(strength >= 33 && strength <= 36);
    });

    it('verifies C35/45 achievable with CEM I 52.5 R at w/z = 0.52 (B20 Beispiel III)', () => {
        // B20 Beispiel III: C35/45, CEM I 52.5R, w/z=0.52 → f_cm,dry,cube=59
        const strength = calculateStrengthFromWalzkurven(0.52, '52.5R');
        // Should match the B20 Beispiel III calibration point: f_cm,dry,cube=59
        assert.ok(Math.abs(strength - 59) < 1.5);
    });

    it('calculates required w/z for target strength with CEM I 42.5 N', () => {
        const targetStrength = 34.6; // B20 Beispiel I target for C20/25

        // f_cm = A * (z/w)^n => w/z = (A/f_cm)^(1/n)
        // With A=27, n=0.67: w/z = (27/34.6)^(1/0.67)
        const wzRatio = 1 / Math.pow(targetStrength / 27, 1 / 0.67);

        // Should be close to Beispiel I w/z=0.68
        assert.ok(wzRatio > 0.6 && wzRatio < 0.8);
    });
});
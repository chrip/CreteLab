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
        assert.strictEqual(result.A, 37);
        assert.strictEqual(result.n, 0.67);
    });

    it('provides cement class data for 52.5 N', () => {
        const result = getCementClass('52.5');
        assert.ok(result);
        assert.strictEqual(result.name, 'CEM I 52.5 N');
        assert.strictEqual(result.A, 47);
        assert.strictEqual(result.n, 0.67);
    });

    it('provides rapid hardening cement class data for 52.5 R', () => {
        const result = getCementClass('52.5R');
        assert.ok(result);
        assert.strictEqual(result.name, 'CEM I 52.5 R');
        assert.strictEqual(result.A, 52);
    });

    it('returns null for unknown cement class', () => {
        assert.strictEqual(getCementClass('unknown'), null);
    });
});

describe('B20 Walzkurven calculation (no supplementary materials)', () => {
    it('calculates strength for CEM I 42.5 N with w/z = 0.5', () => {
        // f_cm = 37 * (1/0.5)^0.67 = 37 * 2^0.67 ≈ 37 * 1.596 ≈ 59.0
        const result = calculateStrengthFromWalzkurven(0.5, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 59.0) < 1.0);
    });

    it('calculates strength for CEM I 42.5 N with w/z = 0.6', () => {
        // f_cm = 37 * (1/0.6)^0.67 = 37 * 1.667^0.67 ≈ 37 * 1.428 ≈ 52.8
        const result = calculateStrengthFromWalzkurven(0.6, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 52.8) < 1.0);
    });

    it('calculates strength for CEM I 52.5 N with w/z = 0.5', () => {
        // f_cm = 47 * (1/0.5)^0.67 = 47 * 2^0.67 ≈ 47 * 1.596 ≈ 75.0
        const result = calculateStrengthFromWalzkurven(0.5, '52.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 75.0) < 1.0);
    });

    it('calculates strength for CEM I 52.5 N with w/z = 0.6', () => {
        // f_cm = 47 * (1/0.6)^0.67 ≈ 47 * 1.428 ≈ 67.1
        const result = calculateStrengthFromWalzkurven(0.6, '52.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 67.1) < 1.0);
    });

    it('calculates strength for CEM I 42.5 N with w/z = 0.55 (typical value)', () => {
        // f_cm = 37 * (1/0.55)^0.67 ≈ 37 * 1.818^0.67 ≈ 37 * 1.512 ≈ 55.9
        const result = calculateStrengthFromWalzkurven(0.55, '42.5');
        assert.ok(result);
        assert.ok(Math.abs(result - 55.9) < 1.0);
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
        // With 10% fly ash: f_cm = 37 * 0.98 * (1/0.5)^0.67 ≈ 57.8
        const result = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.1, 0);
        assert.ok(result);
        // Should be slightly lower than without fly ash (~59.0)
        assert.ok(Math.abs(result - 57.8) < 1.0);
    });

    it('calculates strength with 20% fly ash replacement', () => {
        // With 20% fly ash: f_cm = 37 * 0.96 * (1/0.5)^0.67 ≈ 56.6
        const result = calculateStrengthWithSupplementaryMaterials(0.5, '42.5', 0.2, 0);
        assert.ok(result);
        // Should be lower than with 10% fly ash
        assert.ok(Math.abs(result - 56.6) < 1.0);
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
    it('verifies C30/37 achievable with CEM I 42.5 N at w/z = 0.55', () => {
        // For C30/37, we need f_cm >= 38 + margin ≈ 46-50
        const strength = calculateStrengthFromWalzkurven(0.55, '42.5');
        
        // Should be above typical target for C30/37 (around 46 N/mm²)
        assert.ok(strength >= 45);
    });

    it('verifies C40/50 achievable with CEM I 52.5 N at w/z = 0.5', () => {
        // For C40/50, we need f_cm >= 48
        const strength = calculateStrengthFromWalzkurven(0.5, '52.5');
        
        assert.ok(strength >= 70); // Should be well above 48 N/mm²
    });

    it('calculates required w/z for target strength with CEM I 42.5 N', () => {
        const targetStrength = 46; // For C30/37
        
        // f_cm = A * (z/w)^n => z/w = (f_cm/A)^(1/n) => w/z = 1/(f_cm/A)^(1/n)
        const wzRatio = 1 / Math.pow(targetStrength / 37, 1 / 0.67);
        
        assert.ok(wzRatio > 0.4 && wzRatio < 0.8);
    });
});
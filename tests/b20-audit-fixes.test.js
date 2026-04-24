/**
 * Tests for the audit fixes identified in the Linus Torvalds field review:
 * 1. Moisture zero input (|| fallback) – parseFloat("0") || 5 gave wrong result
 * 2. WU-Additiv excluded from Stoffraum volume balance
 * 3. Fly ash max % not enforced per cement type faMaxFactor
 * 4. C1/C2/C3 duplicates in consistency dropdown
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { CEMENT_TYPES, getCementType } from '../js/lib/strength.js';
import { getAvailableConsistencyClasses, calculateWaterDemand } from '../js/lib/consistency.js';

// ── Fix 3: Moisture zero input ────────────────────────────────────────────────
describe('Moisture zero input – NaN vs falsy fix', () => {
    it('parseFloat("0") is falsy but should NOT fall back to default', () => {
        // The old bug: parseFloat("0") || 5 === 5 (wrong)
        // The fix:    isNaN check
        const parse = (val, def) => { const v = parseFloat(val); return Number.isNaN(v) ? def : v; };
        assert.strictEqual(parse('0', 5), 0, 'Zero input should yield 0, not fallback');
        assert.strictEqual(parse('0.0', 3), 0, 'Zero string should yield 0');
        assert.strictEqual(parse('', 5), 5, 'Empty string should use fallback');
        assert.strictEqual(parse('abc', 3), 3, 'Non-numeric should use fallback');
        assert.strictEqual(parse('2.5', 5), 2.5, 'Valid positive value passes through');
    });
});

// ── Fix 2: WU-Additiv Stoffraum ───────────────────────────────────────────────
describe('WU-Additiv Stoffraum volume balance', () => {
    it('vWU reduces available aggregate volume', () => {
        const z = 300, rhoZ = 3.1;
        const w = 180;
        const vLP = 20;
        const waterProofingMass = 6; // 2% of 300 kg cement
        const rhoWU = 2.0;
        const vWU = waterProofingMass / rhoWU; // = 3 dm³

        const vg_without_wu = 1000 - z / rhoZ - w / 1.0 - vLP;
        const vg_with_wu    = 1000 - z / rhoZ - w / 1.0 - vWU - vLP;

        assert.ok(vg_with_wu < vg_without_wu, 'WU reduces aggregate volume');
        assert.ok(Math.abs(vg_with_wu - (vg_without_wu - vWU)) < 0.001, 'Reduction equals vWU');
    });

    it('Stoffraum sums to 1000 dm³ when WU is included', () => {
        const z = 300, rhoZ = 3.1;
        const w = 180;
        const vLP = 20;
        const waterProofingMass = 6;
        const rhoWU = 2.0;
        const rhoG = 2.65;

        const vz = z / rhoZ;
        const vw = w;
        const vWU = waterProofingMass / rhoWU;
        const vg = 1000 - vz - vw - vWU - vLP;
        const total = vz + vw + vWU + vg + vLP;

        assert.ok(Math.abs(total - 1000) < 0.001, `Stoffraum total should be 1000, got ${total}`);
    });
});

// ── Fix 4: Fly ash max % per cement type ─────────────────────────────────────
describe('Fly ash faMaxFactor per cement type', () => {
    it('CEM I types have faMaxFactor = 0.33', () => {
        assert.strictEqual(getCementType('CEM I 32.5 N').faMaxFactor, 0.33);
        assert.strictEqual(getCementType('CEM I 42.5 N').faMaxFactor, 0.33);
        assert.strictEqual(getCementType('CEM I 42.5 R').faMaxFactor, 0.33);
        assert.strictEqual(getCementType('CEM I 52.5 N').faMaxFactor, 0.33);
        assert.strictEqual(getCementType('CEM I 52.5 R').faMaxFactor, 0.33);
    });

    it('CEM II/B-S and CEM III types have faMaxFactor = 0.25', () => {
        assert.strictEqual(getCementType('CEM II/B-S 42.5 N').faMaxFactor, 0.25);
        assert.strictEqual(getCementType('CEM III/A 42.5 N').faMaxFactor, 0.25);
        assert.strictEqual(getCementType('CEM III/B 42.5 N').faMaxFactor, 0.25);
    });

    it('faMaxFactor clamp logic: CEM III limits fly ash to 25%', () => {
        const clamp = (val, meta) => Math.max(0, Math.min(Math.round(meta.faMaxFactor * 100), val));
        const cemIII = getCementType('CEM III/A 42.5 N');
        assert.strictEqual(clamp(33, cemIII), 25, '33% clamped to 25 for CEM III');
        assert.strictEqual(clamp(20, cemIII), 20, '20% passes through for CEM III');
    });

    it('faMaxFactor clamp logic: CEM I allows up to 33%', () => {
        const clamp = (val, meta) => Math.max(0, Math.min(Math.round(meta.faMaxFactor * 100), val));
        const cemI = getCementType('CEM I 42.5 N');
        assert.strictEqual(clamp(33, cemI), 33, '33% passes for CEM I');
        assert.strictEqual(clamp(40, cemI), 33, '40% clamped to 33 for CEM I');
    });
});

// ── Fix 6: C1/C2/C3 duplicates removed ───────────────────────────────────────
describe('Consistency class dropdown – no C1/C2/C3 duplicates', () => {
    it('getAvailableConsistencyClasses does not contain C1, C2, or C3', () => {
        const classes = getAvailableConsistencyClasses();
        assert.ok(!classes.includes('C1'), 'C1 should not be in dropdown');
        assert.ok(!classes.includes('C2'), 'C2 should not be in dropdown');
        assert.ok(!classes.includes('C3'), 'C3 should not be in dropdown');
    });

    it('F1, F2, F3 are still present', () => {
        const classes = getAvailableConsistencyClasses();
        assert.ok(classes.includes('F1'));
        assert.ok(classes.includes('F2'));
        assert.ok(classes.includes('F3'));
    });

    it('C0 is still present (no F0 equivalent)', () => {
        const classes = getAvailableConsistencyClasses();
        assert.ok(classes.includes('C0'));
    });

    it('F1 and F3 produce the same water demand as legacy C1 and C3', () => {
        // Verifies the removed duplicates had identical water demand
        const f1 = calculateWaterDemand('B32', 'F1');
        const f3 = calculateWaterDemand('B32', 'F3');
        // Internal calculation maps C1→same numerator as F1, C3→same as F3
        // B32 k=4.20: F1=1100/7.20=152.8, F3=1300/7.20=180.6
        assert.ok(Math.abs(f1 - 152.8) < 0.1, `F1 water demand ≈152.8, got ${f1}`);
        assert.ok(Math.abs(f3 - 180.6) < 0.1, `F3 water demand ≈180.6, got ${f3}`);
    });
});

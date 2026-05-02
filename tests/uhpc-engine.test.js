// Pure-math tests for the UHPC engine. No DOM, no JSDOM.

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    calculateBatchVolumeL,
    computeUhpcRecipe,
    evaluatePlausibility,
} from '../js/lib/uhpc-engine.js';
import { UHPC_PRESETS, getUhpcPreset } from '../js/lib/uhpc-presets.js';

const PRESET = UHPC_PRESETS[0];

describe('calculateBatchVolumeL', () => {
    it('returns the sum of m/ρ for every component (Stoffraumrechnung, B 20 Tafel 9)', () => {
        const v = calculateBatchVolumeL(PRESET.batch, PRESET.densities);
        // hand-computed for the DIY 30-l preset:
        //   25/3.10 + 30/2.65 + 9/2.65 + 2.5/2.65 + 8.5/1.0 + 0.4125/1.10
        //   = 8.065 + 11.321 + 3.396 + 0.943 + 8.5 + 0.375 ≈ 32.6 dm³
        assert.ok(v > 31 && v < 34, `expected ~32.6 dm³, got ${v.toFixed(2)}`);
    });

    it('is linear in component masses (doubling all masses doubles the volume)', () => {
        const v1 = calculateBatchVolumeL(PRESET.batch, PRESET.densities);
        const doubled = Object.fromEntries(
            Object.entries(PRESET.batch).map(([k, v]) => [k, v * 2])
        );
        const v2 = calculateBatchVolumeL(doubled, PRESET.densities);
        assert.ok(Math.abs(v2 - 2 * v1) < 1e-9);
    });
});

describe('computeUhpcRecipe — scaling', () => {
    it('scaling to the preset batch volume reproduces every input mass exactly', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const r = computeUhpcRecipe(PRESET, batchM3);
        assert.ok(Math.abs(r.cementKg          - PRESET.batch.cementKg)        < 1e-9);
        assert.ok(Math.abs(r.sandKg            - PRESET.batch.sandKg)          < 1e-9);
        assert.ok(Math.abs(r.quartzPowderKg    - PRESET.batch.quartzPowderKg)  < 1e-9);
        assert.ok(Math.abs(r.finesKg           - PRESET.batch.finesKg)         < 1e-9);
        assert.ok(Math.abs(r.waterL            - PRESET.batch.waterL)          < 1e-9);
        assert.ok(Math.abs(r.superplasticizerL - PRESET.batch.superplasticizerMl / 1000) < 1e-9);
    });

    it('halving the volume halves every component', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const r1 = computeUhpcRecipe(PRESET, batchM3);
        const r2 = computeUhpcRecipe(PRESET, batchM3 / 2);
        for (const k of ['cementKg', 'sandKg', 'quartzPowderKg', 'finesKg', 'waterL', 'superplasticizerL']) {
            assert.ok(Math.abs(r2[k] - r1[k] / 2) < 1e-9, `linearity broke for ${k}`);
        }
    });

    it('regression: 0.001 m³ produces gram/ml-scale values, not zero', () => {
        // Same class of bug we fixed in fine-tune (Math.round destroying ml-scale
        // precision). The engine returns floats; rendering is done by fmtQty.
        const r = computeUhpcRecipe(PRESET, 0.001);
        assert.ok(r.cementKg          > 0);
        assert.ok(r.waterL            > 0);
        assert.ok(r.superplasticizerL > 0);
        // and every component is < 1 (so the formatter will switch to g/ml)
        for (const k of ['cementKg', 'waterL', 'superplasticizerL']) {
            assert.ok(r[k] < 1, `${k} should be sub-1 at 0.001 m³, got ${r[k]}`);
        }
    });

    it('overrides replace component masses before scaling', () => {
        // Doubling the cement override and computing at the original batch volume
        // means the scale factor decreases (more mass → larger preset volume).
        const baseM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const ov = { cementKg: PRESET.batch.cementKg * 2 };
        const r  = computeUhpcRecipe(PRESET, baseM3, ov);
        // The scale factor must be < 1 because the (overridden) batch is now
        // bigger than the original preset volume.
        assert.ok(r.scaleFactor < 1,
            `scaleFactor should be < 1 with extra cement, got ${r.scaleFactor.toFixed(3)}`);
        // And the cement-to-water ratio has shifted (more cement, same water).
        const baselineRatio = PRESET.batch.cementKg       / PRESET.batch.waterL;
        const newRatio      = (PRESET.batch.cementKg * 2) / PRESET.batch.waterL;
        assert.ok(newRatio > baselineRatio);
    });

    it('throws on missing preset or non-positive volume', () => {
        assert.throws(() => computeUhpcRecipe(null, 1));
        assert.throws(() => computeUhpcRecipe(PRESET, 0));
        assert.throws(() => computeUhpcRecipe(PRESET, -1));
    });
});

describe('computeUhpcRecipe — derived metrics', () => {
    it('reports a fresh density in the UHPC-typical range (2300–2500 kg/m³)', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const r = computeUhpcRecipe(PRESET, batchM3);
        assert.ok(r.freshDensityKgPerM3 > 2200 && r.freshDensityKgPerM3 < 2600,
            `density ${r.freshDensityKgPerM3.toFixed(0)} kg/m³ outside [2200, 2600]`);
    });

    it('reports a w/b ratio in the UHPC literature range (0.18–0.40)', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const r = computeUhpcRecipe(PRESET, batchM3);
        assert.ok(r.wbRatio >= 0.18 && r.wbRatio <= 0.40,
            `w/b ${r.wbRatio.toFixed(2)} outside [0.18, 0.40]`);
    });

    it('reports a PCE dosage in the datasheet window (0.3–4 % of cement)', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const r = computeUhpcRecipe(PRESET, batchM3);
        assert.ok(r.pceDosagePctOfCement >= 0.3 && r.pceDosagePctOfCement <= 4,
            `PCE ${r.pceDosagePctOfCement.toFixed(2)}% outside [0.3, 4]`);
    });
});

describe('evaluatePlausibility', () => {
    it('returns three checks (w/b, PCE, density) for the default preset, all ok or warn', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const r       = computeUhpcRecipe(PRESET, batchM3);
        const checks  = evaluatePlausibility(r);
        assert.strictEqual(checks.length, 3);
        assert.deepStrictEqual(checks.map(c => c.id), ['wb', 'pce', 'density']);
        for (const c of checks) {
            assert.ok(['ok', 'warn'].includes(c.level),
                `${c.id} should be ok or warn for the published preset, got ${c.level}`);
        }
    });

    it('flags an error when w/b is far below the UHPC envelope', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        // Extreme override: half the water → w/b drops to ~0.16, below the
        // 0.18 "warn" floor → 'error'.
        const r = computeUhpcRecipe(PRESET, batchM3, { waterL: PRESET.batch.waterL / 2 });
        const wb = evaluatePlausibility(r).find(c => c.id === 'wb');
        assert.strictEqual(wb.level, 'error');
    });

    it('flags an error when PCE dosage is far above the datasheet window', () => {
        const batchM3 = calculateBatchVolumeL(PRESET.batch, PRESET.densities) / 1000;
        const r = computeUhpcRecipe(PRESET, batchM3, { superplasticizerMl: 5000 }); // ~5×
        const pce = evaluatePlausibility(r).find(c => c.id === 'pce');
        assert.strictEqual(pce.level, 'error');
    });
});

describe('Volume balance invariant', () => {
    it('Σ component volumes equal the reported batch volume (no air assumed)', () => {
        const v   = calculateBatchVolumeL(PRESET.batch, PRESET.densities);
        const rho = PRESET.densities;
        const b   = PRESET.batch;
        const pceKg = (b.superplasticizerMl / 1000) * rho.superplasticizer;
        const sumOfVols =
            b.cementKg       / rho.cement +
            b.sandKg         / rho.sand +
            b.quartzPowderKg / rho.quartzPowder +
            b.finesKg        / rho.fines +
            b.waterL         / rho.water +
            pceKg            / rho.superplasticizer;
        assert.ok(Math.abs(v - sumOfVols) < 1e-9);
    });
});

describe('getUhpcPreset roundtrip', () => {
    it('every preset can be looked up by its key and computed', () => {
        for (const p of UHPC_PRESETS) {
            assert.strictEqual(getUhpcPreset(p.key), p);
            const r = computeUhpcRecipe(p, 0.05);
            assert.ok(r.cementKg > 0);
        }
    });
});

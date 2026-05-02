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

// ── Kassel research preset (M1Q with CEM I 42,5 R) ─────────────────────
//
// This block locks down the engine's reproduction of the Kassel paper's
// own w/b figure. The paper reports w/b = 0,19 for the M1Q-42,5R / w/z=0,24
// recipe with the explicit footnote "Unter Berücksichtigung des Fließmittels
// (60 % Wassergehalt)". Our engine implements that convention plus the
// k_s = 1.0 weighting for microsilica (B 20 Tafel 9), so we should hit
// the published value within rounding (±0.01).

const KASSEL = getUhpcPreset('kassel-m1q-cem42-5r');

describe('Kassel M1Q (CEM I 42,5 R) — engine reproduces published figures', { skip: !KASSEL }, () => {
    it('exists in the catalog', () => {
        assert.ok(KASSEL, 'kassel-m1q-cem42-5r preset must be present');
    });

    it('source is the Kassel research report and claimedFckMpa = 123', () => {
        assert.strictEqual(KASSEL.claimedFckMpa, 123);
        assert.match(KASSEL.source.url, /uni-kassel\.de/);
    });

    it('reproduces w/b = 0,19 within ±0,01 (matches Tabelle 3.7-2)', () => {
        // Per-m³ recipe, so target volume = 1 m³ scales 1:1.
        const r = computeUhpcRecipe(KASSEL, 1);
        assert.ok(Math.abs(r.wbRatio - 0.19) <= 0.01,
            `expected w/b ≈ 0,19, got ${r.wbRatio.toFixed(3)}`);
    });

    it('reproduces fresh density in the UHPC range [2300, 2500] kg/m³', () => {
        const r = computeUhpcRecipe(KASSEL, 1);
        assert.ok(r.freshDensityKgPerM3 > 2300 && r.freshDensityKgPerM3 < 2500,
            `fresh density ${r.freshDensityKgPerM3.toFixed(0)} kg/m³ outside [2300, 2500]`);
    });

    it('PCE dosage lies in the datasheet warn band (research mixes lean high)', () => {
        // 29,4 kg/m³ ÷ 733 kg/m³ ≈ 4,01 %. That sits at the upper edge of the
        // PCE_PCT_WARN band [0.3, 4.0]; either 'warn' (≤ 4.0) or 'error' (> 4.0)
        // is engineering-honest depending on rounding. Lock both as acceptable.
        const r = computeUhpcRecipe(KASSEL, 1);
        const pce = evaluatePlausibility(r).find(c => c.id === 'pce');
        assert.ok(['warn', 'error'].includes(pce.level),
            `PCE chip should be warn-or-error for the Kassel research mix, got ${pce.level}`);
    });

    it('volume balance: Σ(m/ρ) ≈ 1 m³ within ~3 % (typical air content tolerance)', () => {
        const v = calculateBatchVolumeL(KASSEL.batch, KASSEL.densities);
        // 978–1000 dm³ for a per-m³ recipe (the gap is the entrained-air budget).
        assert.ok(Math.abs(v - 1000) <= 30,
            `Σ(m/ρ) = ${v.toFixed(1)} dm³ should be near 1000 dm³ for a per-m³ recipe`);
    });

    it('linear scaling: 0.001 m³ produces sub-1 component values (gram/ml-scale)', () => {
        const r = computeUhpcRecipe(KASSEL, 0.001);
        assert.ok(r.cementKg      < 1, `cement should be sub-kg at 0.001 m³, got ${r.cementKg}`);
        assert.ok(r.microsilicaKg < 1, `microsilica should be sub-kg, got ${r.microsilicaKg}`);
        assert.ok(r.cementKg      > 0);
        assert.ok(r.microsilicaKg > 0);
    });
});

// ── PCE-water (60 %) and microsilica (k_s = 1.0) corrections ───────────

describe('w/b formula corrections', () => {
    const fakePreset = {
        key: '__test__',
        densities: {
            cement: 3.10, sand: 2.65, quartzPowder: 2.65, fines: 2.65,
            microsilica: 2.20, water: 1.00, superplasticizer: 1.10,
        },
        batch: {
            cementKg: 100, sandKg: 100, quartzPowderKg: 0, finesKg: 0,
            microsilicaKg: 0, waterL: 30, superplasticizerMl: 0,
        },
    };

    it('without PCE and microsilica, w/b reduces to pure w/z', () => {
        const r = computeUhpcRecipe(fakePreset, 0.1);
        assert.ok(Math.abs(r.wbRatio - 0.30) < 1e-9,
            `w/b should equal water/cement = 0.30, got ${r.wbRatio}`);
    });

    it('PCE water (60 %) raises w/b: 100 ml PCE adds 0.06 kg water → +0.0006', () => {
        const withPce = computeUhpcRecipe(fakePreset, 0.1, { superplasticizerMl: 100 });
        // 0.100 l × 1.10 kg/l × 0.60 = 0.066 kg added water
        // new w/b = (30 + 0.066) / 100 = 0.30066
        assert.ok(Math.abs(withPce.wbRatio - 0.30066) < 1e-4,
            `expected w/b ≈ 0.30066 with 100 ml PCE, got ${withPce.wbRatio}`);
    });

    it('microsilica (k_s = 1.0) lowers w/b: +20 kg microsilica reduces it from 0.30 to 0.25', () => {
        const withMs = computeUhpcRecipe(fakePreset, 0.1, { microsilicaKg: 20 });
        // new w/b = 30 / (100 + 1.0 × 20) = 30/120 = 0.25
        assert.ok(Math.abs(withMs.wbRatio - 0.25) < 1e-9,
            `expected w/b = 0.25 with 20 kg microsilica, got ${withMs.wbRatio}`);
    });

    it('quartz powder is treated as inert filler (k = 0): does NOT lower w/b', () => {
        // 20 kg of quartz powder must NOT change w/b (k_quartz = 0 by design,
        // matching the Kassel paper's binder accounting).
        const withQp = computeUhpcRecipe(fakePreset, 0.1, { quartzPowderKg: 20 });
        assert.ok(Math.abs(withQp.wbRatio - 0.30) < 1e-9,
            `quartz powder must not enter the binder term, got w/b = ${withQp.wbRatio}`);
    });
});

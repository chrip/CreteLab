// Sanity checks on the UHPC preset catalog. These tests do NOT verify
// engineering correctness — that's done in uhpc-scaling.test.js (math)
// and uhpc.test.js (UI). Here we just ensure the data invariants hold.

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { UHPC_PRESETS, getUhpcPreset } from '../js/lib/uhpc-presets.js';

describe('UHPC preset catalog', () => {
    it('exports at least one preset', () => {
        assert.ok(UHPC_PRESETS.length >= 1);
    });

    it('each preset has a stable key, generic label, and a verifiable source', () => {
        for (const p of UHPC_PRESETS) {
            assert.match(p.key,   /^[a-z0-9-]+$/, `key must be slug-safe: ${p.key}`);
            assert.ok(p.label && p.label.length > 0,            `label missing for ${p.key}`);
            assert.ok(p.source && p.source.url,                 `source.url missing for ${p.key}`);
            assert.match(p.source.url, /^https?:\/\//,          `source.url must be http(s): ${p.source.url}`);
            assert.ok(['youtube', 'paper', 'datasheet'].includes(p.source.type),
                `source.type unknown: ${p.source.type}`);
        }
    });

    it('every preset has positive masses for the four mandatory components', () => {
        for (const p of UHPC_PRESETS) {
            assert.ok(p.batch.cementKg       > 0, `${p.key}: cement > 0`);
            assert.ok(p.batch.sandKg         > 0, `${p.key}: sand > 0`);
            assert.ok(p.batch.quartzPowderKg >= 0, `${p.key}: quartz powder >= 0`);
            assert.ok(p.batch.waterL         > 0, `${p.key}: water > 0`);
        }
    });

    it('every preset has plausible densities (0.5 ≤ ρ ≤ 5.0 kg/dm³)', () => {
        for (const p of UHPC_PRESETS) {
            for (const [name, rho] of Object.entries(p.densities)) {
                assert.ok(rho >= 0.5 && rho <= 5.0,
                    `${p.key}: ρ_${name} = ${rho} outside plausible range`);
            }
        }
    });

    it('keys are unique', () => {
        const keys = UHPC_PRESETS.map(p => p.key);
        assert.strictEqual(new Set(keys).size, keys.length);
    });

    it('getUhpcPreset returns the matching entry, or null', () => {
        const first = UHPC_PRESETS[0];
        assert.strictEqual(getUhpcPreset(first.key), first);
        assert.strictEqual(getUhpcPreset('does-not-exist'), null);
    });

    it('w/b ratio of every preset lies in the UHPC literature range (0.18–0.40)', () => {
        // Per fib Model Code 2010 §5.1 [2] and DAfStb Heft 561 [1]: UHPC mixes
        // typically have w/b 0.20–0.30. We allow a slightly wider 0.18–0.40
        // band to accept DIY recipes that lean wetter for workability.
        for (const p of UHPC_PRESETS) {
            const binder = p.batch.cementKg + 0.4 * p.batch.quartzPowderKg;
            const wb = p.batch.waterL / binder;
            assert.ok(wb >= 0.18 && wb <= 0.40,
                `${p.key}: w/b = ${wb.toFixed(2)} outside [0.18, 0.40]`);
        }
    });

    it('every preset carries its own non-empty mixingSteps array', () => {
        for (const p of UHPC_PRESETS) {
            assert.ok(Array.isArray(p.mixingSteps),
                `${p.key}: mixingSteps must be an array`);
            assert.ok(p.mixingSteps.length >= 3,
                `${p.key}: mixingSteps should have at least 3 entries (got ${p.mixingSteps.length})`);
            for (const step of p.mixingSteps) {
                assert.ok(typeof step === 'string' && step.trim().length > 0,
                    `${p.key}: every mixingSteps entry must be a non-empty string`);
            }
        }
    });

    it('mixingSteps placeholders only reference known component keys', () => {
        const KNOWN = new Set([
            'cementKg', 'sandKg', 'quartzPowderKg', 'finesKg',
            'microsilicaKg', 'waterL', 'superplasticizerL',
        ]);
        for (const p of UHPC_PRESETS) {
            for (const step of p.mixingSteps) {
                const matches = [...step.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
                for (const key of matches) {
                    assert.ok(KNOWN.has(key),
                        `${p.key}: unknown placeholder {${key}} in mixingSteps`);
                }
            }
        }
    });

    it('placeholders never reference a component that is zero in the batch', () => {
        // Otherwise the rendered step would say "0,00 kg Quarzmehl" — silly.
        const COMPONENT_TO_BATCH = {
            cementKg:          'cementKg',
            sandKg:            'sandKg',
            quartzPowderKg:    'quartzPowderKg',
            finesKg:           'finesKg',
            microsilicaKg:     'microsilicaKg',
            waterL:            'waterL',
            superplasticizerL: 'superplasticizerMl',
        };
        for (const p of UHPC_PRESETS) {
            for (const step of p.mixingSteps) {
                const matches = [...step.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
                for (const key of matches) {
                    const batchKey = COMPONENT_TO_BATCH[key];
                    assert.ok(p.batch[batchKey] > 0,
                        `${p.key}: step references {${key}} but batch.${batchKey} = ${p.batch[batchKey]}`);
                }
            }
        }
    });
});

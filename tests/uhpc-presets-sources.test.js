/**
 * Grey Element DIY presets must match the recipes printed on the cited pages.
 *
 * Regression: 'diy-mortar-20kg-batch' dropped the 1600 g Kalksteinmehl and 400 g
 * Microsilica listed in the article, and 'diy-pce-30l-batch' cited a video whose
 * description lists no amounts, and booked the 2,5 kg Quarzmehl as reactive
 * Microsilica (which lowered the w/b ratio and raised the strength estimate).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getUhpcPreset } from '../js/lib/uhpc-presets.js';
import { computeUhpcRecipe } from '../js/lib/uhpc-engine.js';

describe('Grey Element DIY presets match their sources', () => {
    it('diy-mortar-20kg-batch: 8 kg CEM I, 10 kg Sand 0–2, 1600 g Kalksteinmehl, 400 g Microsilica, 2,4 l Wasser, 150 ml PCE', () => {
        const p = getUhpcPreset('diy-mortar-20kg-batch');
        assert.strictEqual(p.source.url, 'https://www.grey-element.de/beton-basics/hochfesten-beton-uhpc-selber-herstellen/');
        assert.deepStrictEqual(p.batch, {
            cementKg: 8, sandKg: 10, quartzPowderKg: 0, finesKg: 1.6,
            microsilicaKg: 0.4, waterL: 2.4, superplasticizerMl: 150
        });
    });

    it('diy-pce-30l-batch: cites the Betonmöbel article, not the video without amounts', () => {
        const p = getUhpcPreset('diy-pce-30l-batch');
        assert.strictEqual(p.source.url, 'https://www.grey-element.de/beton-basics/beton-zur-herstellung-von-betonm%C3%B6beln/');
        assert.ok(!p.source.url.includes('youtube.com'));
    });

    it('diy-pce-30l-batch: 25 kg Zement, 30 kg Sand + 9 kg Quarzsand, 2,5 kg Quarzmehl, 8,5 l Wasser, no Microsilica', () => {
        const p = getUhpcPreset('diy-pce-30l-batch');
        assert.deepStrictEqual(p.batch, {
            cementKg: 25, sandKg: 39, quartzPowderKg: 2.5, finesKg: 0,
            microsilicaKg: 0, waterL: 8.5, superplasticizerMl: 375
        });
    });

    it('diy-pce-30l-batch: inert Quarzmehl does not count as binder, so w/b is ≈ 0,35', () => {
        const r = computeUhpcRecipe(getUhpcPreset('diy-pce-30l-batch'), 0.01);
        assert.ok(Math.abs(r.wbRatio - 0.35) < 0.005, `w/b ${r.wbRatio}`);
    });

    it('diy-mortar-20kg-batch: Microsilica counts as binder, so w/b is ≈ 0,30', () => {
        const r = computeUhpcRecipe(getUhpcPreset('diy-mortar-20kg-batch'), 0.01);
        assert.ok(Math.abs(r.wbRatio - 0.297) < 0.005, `w/b ${r.wbRatio}`);
    });
});

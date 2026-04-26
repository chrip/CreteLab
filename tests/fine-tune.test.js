import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import {
    applyAdmixtureWaterReduction,
    calculateStrengthReduction,
    getAdmixtureDosage,
    SUPPLEMENTARY_MATERIALS,
} from '../js/lib/additives.js';
import { calculateStrengthFromWalzkurven } from '../js/lib/strength.js';

const html = fs.readFileSync(path.resolve('fine-tune.html'), 'utf8');

// Mirrors PRESETS in fine-tune.js — used to compute expected values.
const PRESETS = {
    c20: { z: 280, w: 195, g: 1820, klasse: 'C20/25' },
    c25: { z: 300, w: 190, g: 1800, klasse: 'C25/30' },
    c30: { z: 340, w: 185, g: 1740, klasse: 'C30/37' },
    c40: { z: 400, w: 175, g: 1660, klasse: 'C40/50' },
};

describe('Fine-tune page – E2E and B20 plausibility', () => {
    let win, doc;

    before(async () => {
        const dom = new JSDOM(html, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        win = dom.window;
        doc = win.document;

        // Globals fine-tune.js needs at module-load time.
        global.window         = win;
        global.document       = doc;
        global.location       = win.location;
        global.sessionStorage = win.sessionStorage;
        global.HTMLElement        = win.HTMLElement;
        global.HTMLInputElement   = win.HTMLInputElement;
        global.HTMLSelectElement  = win.HTMLSelectElement;
        global.Event = win.Event;

        await import('../js/fine-tune.js');
    });

    // --- DOM helpers ---

    function check(id, val = true) {
        const el = doc.getElementById(id);
        el.checked = val;
        el.dispatchEvent(new win.Event('change'));
    }

    function setPreset(value) {
        const el = doc.getElementById('mixPreset');
        el.value = value;
        el.dispatchEvent(new win.Event('change'));
    }

    function setVolume(v) {
        const el = doc.getElementById('tuneVolume');
        el.value = String(v);
        el.dispatchEvent(new win.Event('input'));
    }

    function getSteps() {
        return Array.from(doc.getElementById('shoppingItems').querySelectorAll('li'))
            .map(li => li.textContent);
    }

    function isListVisible() {
        return !doc.getElementById('shoppingList').classList.contains('hidden');
    }

    function getStrengthText() {
        return doc.getElementById('strengthResult').textContent;
    }

    // Extracts the estimated fck value from "ca. 34 N/mm²" in the strength panel.
    function extractFck(text) {
        const m = /ca\.\s*(\d+)\s*N/.exec(text);
        return m ? parseInt(m[1], 10) : null;
    }

    function isWarningVisible() {
        return !doc.getElementById('combineWarning').classList.contains('hidden');
    }

    const ALL_CHECKBOXES = ['useExtraCement', 'useFlyAsh', 'useSilica', 'useBV', 'useFM', 'useLP'];

    // Reset to clean state before every test.
    beforeEach(() => {
        ALL_CHECKBOXES.forEach(id => check(id, false));
        setPreset('c25');
        setVolume(1);
    });

    // ── Initial state ─────────────────────────────────────────────────────────

    it('no additive checked: step list is hidden', () => {
        assert.strictEqual(isListVisible(), false);
    });

    it('no additive checked: strength panel shows base class, no estimate', () => {
        const text = getStrengthText();
        assert.ok(text.includes('C25/30'), `expected C25/30 in: ${text}`);
        assert.ok(!/N\/mm²/.test(text), 'no N/mm² value shown without any additives');
    });

    // ── Extra cement ──────────────────────────────────────────────────────────

    it('extra cement: step list appears with cement as first dry step', () => {
        check('useExtraCement');
        assert.ok(isListVisible());
        const steps = getSteps();
        assert.ok(steps[0].includes('Zement'), `first step should be cement, got: ${steps[0]}`);
    });

    it('extra cement: quantity = 10% of cement × volume', () => {
        const { z } = PRESETS.c25;
        check('useExtraCement');
        const expected = Math.round(z * 0.10); // 30 kg for c25 at 1 m³
        assert.ok(getSteps()[0].includes(`${expected},00 kg`),
            `expected ${expected},00 kg in step, got: ${getSteps()[0]}`);
    });

    it('extra cement: quantity scales with volume', () => {
        check('useExtraCement');
        const qty1 = parseFloat(/(\d+(?:[.,]\d+)?)\s*kg/.exec(getSteps()[0])[1].replace(',', '.'));
        setVolume(2);
        const qty2 = parseFloat(/(\d+(?:[.,]\d+)?)\s*kg/.exec(getSteps()[0])[1].replace(',', '.'));
        assert.strictEqual(qty2, qty1 * 2);
    });

    it('extra cement: increases estimated fck (lower effective w/z)', () => {
        const { z, w } = PRESETS.c25;
        const baseFck = Math.round(calculateStrengthFromWalzkurven(w / z, '42.5') - 8);
        check('useExtraCement');
        const fck = extractFck(getStrengthText());
        assert.ok(fck !== null, 'fck estimate should be visible');
        assert.ok(fck > baseFck, `extra cement: fck ${fck} should exceed base ${baseFck}`);
    });

    // ── Fly ash ───────────────────────────────────────────────────────────────

    it('fly ash: step appears as dry addition with correct quantity', () => {
        const { z } = PRESETS.c25;
        check('useFlyAsh');
        const step = getSteps().find(s => s.includes('Flugasche'));
        assert.ok(step, 'fly ash step must appear');
        const expected = Math.round(z * 0.15); // 45 kg
        assert.ok(step.includes(`${expected},00 kg`),
            `expected ${expected},00 kg in: ${step}`);
    });

    it('fly ash: B20 dosage (15%) is within the 33% ceiling for all presets', () => {
        for (const [id, { z }] of Object.entries(PRESETS)) {
            const used = Math.round(z * 0.15);
            const maxB20 = z * SUPPLEMENTARY_MATERIALS.Flugasche.maxContentWithoutPVd; // 0.33
            assert.ok(used <= maxB20,
                `Preset ${id}: fly ash ${used} kg exceeds B20 max ${maxB20.toFixed(0)} kg`);
        }
    });

    it('fly ash: increases estimated fck via k=0.4 equivalent binder', () => {
        const { z, w } = PRESETS.c25;
        const baseFck = Math.round(calculateStrengthFromWalzkurven(w / z, '42.5') - 8);
        check('useFlyAsh');
        assert.ok(extractFck(getStrengthText()) > baseFck,
            'fly ash (k=0.4) should raise effective fck');
    });

    // ── Silica fume ───────────────────────────────────────────────────────────

    it('silica: step appears as dry addition with correct quantity', () => {
        const { z } = PRESETS.c25;
        check('useSilica');
        const step = getSteps().find(s => s.includes('Silikastaub'));
        assert.ok(step, 'silica step must appear');
        const expected = Math.round(z * 0.08); // 24 kg
        assert.ok(step.includes(`${expected},00 kg`),
            `expected ${expected},00 kg in: ${step}`);
    });

    it('silica: B20 dosage (8%) is within the 11% ceiling for all presets', () => {
        for (const [id, { z }] of Object.entries(PRESETS)) {
            const used = Math.round(z * 0.08);
            const maxB20 = z * SUPPLEMENTARY_MATERIALS.Silikastaub.maxContent; // 0.11
            assert.ok(used <= maxB20,
                `Preset ${id}: silica ${used} kg exceeds B20 max ${maxB20.toFixed(0)} kg`);
        }
    });

    it('silica: increases estimated fck via k=1.0 equivalent binder', () => {
        const { z, w } = PRESETS.c25;
        const baseFck = Math.round(calculateStrengthFromWalzkurven(w / z, '42.5') - 8);
        check('useSilica');
        assert.ok(extractFck(getStrengthText()) > baseFck,
            'silica (k=1.0) should raise effective fck');
    });

    // ── Betonverflüssiger (BV) ────────────────────────────────────────────────

    it('BV: dosage is 0.5 l/m³ per B20 Tafel 7 typical', () => {
        check('useBV');
        const step = getSteps().find(s => s.includes('Betonverflüssiger'));
        assert.ok(step, 'BV step must appear');
        // fmtQty(0.5, 'l') → '500 ml'
        assert.ok(step.match(/500\s*ml/), `expected 500 ml in: ${step}`);
        assert.strictEqual(getAdmixtureDosage('BV'), 0.5);
    });

    it('BV: reduces water demand by 7% (B20 typical saving)', () => {
        const { w } = PRESETS.c25;
        const baseWater = Math.round(w);
        const expected  = applyAdmixtureWaterReduction(baseWater, 'BV'); // 177 l
        check('useBV');
        const waterStep = getSteps().at(-1);
        assert.ok(waterStep.includes('Wasser'), 'last step must be water');
        assert.ok(waterStep.includes(String(expected)),
            `water step should show ${expected} l, got: ${waterStep}`);
        assert.ok(expected < baseWater, '7% reduction must lower the water quantity');
    });

    it('BV: increases estimated fck by lowering w/z', () => {
        const { z, w } = PRESETS.c25;
        const baseFck = Math.round(calculateStrengthFromWalzkurven(w / z, '42.5') - 8);
        check('useBV');
        assert.ok(extractFck(getStrengthText()) > baseFck,
            'BV should raise fck (less water → lower w/z)');
    });

    // ── Luftporenbildner (LP) ─────────────────────────────────────────────────

    it('LP: dosage is 0.2 l/m³ (typical for 4% air target)', () => {
        check('useLP');
        const step = getSteps().find(s => s.includes('Luftporenbildner'));
        assert.ok(step, 'LP step must appear');
        // fmtQty(0.2, 'l') → '200 ml'
        assert.ok(step.match(/200\s*ml/), `expected 200 ml in: ${step}`);
        assert.strictEqual(getAdmixtureDosage('LP'), 0.2);
    });

    it('LP: reduces fck by ~14 N/mm² (4% air × 3.5 N/mm²)', () => {
        const { z, w } = PRESETS.c25;
        const baseFcm = calculateStrengthFromWalzkurven(w / z, '42.5');
        const baseFck = Math.round(baseFcm - 8);
        check('useLP');
        const fck = extractFck(getStrengthText());
        assert.ok(fck < baseFck, 'LP must lower fck');
        const penalty = baseFck - fck;
        // 3.5 N/mm² per 1% air × 4% = 14 N/mm², allow ±2 for rounding
        assert.ok(Math.abs(penalty - 14) <= 2,
            `LP penalty should be ~14 N/mm², got ${penalty} (baseFck=${baseFck}, tunedFck=${fck})`);
    });

    it('LP: does not reduce water quantity (only BV does)', () => {
        const { w } = PRESETS.c25;
        const baseWater = Math.round(w);
        check('useLP');
        const waterStep = getSteps().at(-1);
        assert.ok(waterStep.includes(String(baseWater)),
            `LP alone must not reduce water (expected ${baseWater} l): ${waterStep}`);
    });

    it('LP: water step notes that LP is dissolved in mixing water', () => {
        check('useLP');
        assert.ok(getSteps().at(-1).includes('eingerührten'),
            'water step should mention dissolved additives');
    });

    // ── Small-volume precision (regression: 0.001 m³ rendered "0 ml") ─────────

    it('volume 0.001 m³: water step shows a positive amount, not "0 ml"', () => {
        // c25 preset has 190 l/m³ → 0.001 m³ = 0.19 l = 190 ml.
        // Bug was Math.round(190 * 0.001) = 0 → fmtQty(0,'l') → "0 ml".
        check('useExtraCement');  // need at least one item to make the step list visible
        setVolume(0.001);

        const waterStep = getSteps().at(-1);
        assert.ok(waterStep.includes('Wasser'), `last step must be water, got: ${waterStep}`);
        assert.ok(!/\b0\s*ml\b/.test(waterStep), `water must not render as "0 ml": ${waterStep}`);
        assert.ok(!/\b0\s*l\b/.test(waterStep),  `water must not render as "0 l": ${waterStep}`);

        // c25 default: 190 l/m³ × 0.001 m³ = 0.19 l → 190 ml
        const m = /(\d+(?:[.,]\d+)?)\s*(ml|l)\b/.exec(waterStep);
        assert.ok(m, `expected a numeric water amount, got: ${waterStep}`);
        const value = parseFloat(m[1].replace(',', '.'));
        const inLiters = m[2] === 'ml' ? value / 1000 : value;
        assert.ok(inLiters > 0.15 && inLiters < 0.25,
            `water amount should be ~0.19 l (190 ml), got ${value} ${m[2]} = ${inLiters} l`);
    });

    it('volume 0.001 m³ with BV: water reduction still leaves a positive amount', () => {
        check('useBV');
        setVolume(0.001);

        const waterStep = getSteps().at(-1);
        assert.ok(!/\b0\s*ml\b/.test(waterStep),
            `BV-reduced water must not render as "0 ml": ${waterStep}`);
        // 190 × 0.93 ≈ 177 l/m³ × 0.001 = 0.177 l ≈ 177 ml
        assert.ok(/\d+\s*ml/.test(waterStep), `expected ml-scale water, got: ${waterStep}`);
    });

    // ── LP + Silica combination warning ───────────────────────────────────────

    it('LP + Silica: combination warning is shown (frost + dense silica matrix conflict)', () => {
        check('useLP');
        check('useSilica');
        assert.ok(isWarningVisible(), 'warning must appear for LP + Silikastaub');
    });

    it('LP + Silica: warning disappears when Silica is unchecked', () => {
        check('useLP');
        check('useSilica');
        check('useSilica', false);
        assert.strictEqual(isWarningVisible(), false);
    });

    it('LP + Silica: warning disappears when LP is unchecked', () => {
        check('useLP');
        check('useSilica');
        check('useLP', false);
        assert.strictEqual(isWarningVisible(), false);
    });

    // ── Water step ────────────────────────────────────────────────────────────

    it('water step is always last, appears only when at least one additive is selected', () => {
        // Nothing checked → no list at all
        assert.strictEqual(isListVisible(), false);

        check('useExtraCement');
        const steps = getSteps();
        assert.ok(steps.at(-1).includes('Wasser'), 'water must be the last step');
    });

    it('water step mentions dissolved additives when BV or LP is selected', () => {
        check('useBV');
        assert.ok(getSteps().at(-1).includes('eingerührten'));

        // Reset, try with LP only
        check('useBV', false);
        check('useLP');
        assert.ok(getSteps().at(-1).includes('eingerührten'));
    });

    // ── Mixing order (B20: dry first, wet last) ───────────────────────────────

    it('all selected: dry additions precede wet ones; water is last', () => {
        // BV and FM are mutually exclusive — checking them in order leaves FM on, BV cleared.
        ALL_CHECKBOXES.forEach(id => check(id));
        const steps = getSteps();

        assert.strictEqual(steps.length, 6,
            `expected 6 steps (5 additives + water; BV cleared by FM), got ${steps.length}`);

        const idx = (keyword) => steps.findIndex(s => s.includes(keyword));
        const cementIdx = idx('Zement');
        const flyAshIdx = idx('Flugasche');
        const silicaIdx = idx('Silikastaub');
        const fmIdx     = idx('Fließmittel');
        const lpIdx     = idx('Luftporenbildner');
        const waterIdx  = idx('Wasser');

        assert.strictEqual(idx('Betonverflüssiger'), -1, 'BV must be absent (cleared by FM)');

        // Dry additions come before wet ones (B20 mixing sequence)
        assert.ok(cementIdx < fmIdx,  'cement (dry) must precede FM (wet)');
        assert.ok(flyAshIdx < fmIdx,  'fly ash (dry) must precede FM (wet)');
        assert.ok(silicaIdx < fmIdx,  'silica (dry) must precede FM (wet)');
        assert.ok(fmIdx     < lpIdx,  'FM must precede LP');
        assert.ok(lpIdx     < waterIdx, 'LP must precede water');
        assert.strictEqual(waterIdx, 5, 'water must be the very last step');
    });

    // ── Preset switching ──────────────────────────────────────────────────────

    it('switching preset updates additive quantities', () => {
        check('useExtraCement');
        const parseKg = step => parseFloat(/(\d+(?:[.,]\d+)?)\s*kg/.exec(step)[1].replace(',', '.'));
        const kg25 = parseKg(getSteps()[0]);

        setPreset('c30'); // z=340, 10% = 34 kg
        const kg30 = parseKg(getSteps()[0]);

        assert.ok(kg30 > kg25, `c30 (z=340) should give larger extra cement than c25 (z=300)`);
        assert.strictEqual(kg30, Math.round(PRESETS.c30.z * 0.10));
    });

    it('all preset w/z values are within B20 exposure class limits', () => {
        // B20 Tafel 9 limits by typical exposure class for each preset
        const limits = {
            c20: 0.75,  // XC1
            c25: 0.70,  // XC2
            c30: 0.60,  // XC3 / XF1
            c40: 0.45,  // XF3 / XD2
        };
        for (const [id, { z, w }] of Object.entries(PRESETS)) {
            const wz = w / z;
            assert.ok(wz <= limits[id],
                `Preset ${id}: w/z ${wz.toFixed(3)} exceeds B20 max ${limits[id]}`);
        }
    });

    // ── Combined scenario ─────────────────────────────────────────────────────

    it('extra cement + fly ash + silica + BV together: fck is significantly higher', () => {
        const { z, w } = PRESETS.c25;
        const baseFck = Math.round(calculateStrengthFromWalzkurven(w / z, '42.5') - 8);

        check('useExtraCement');
        check('useFlyAsh');
        check('useSilica');
        check('useBV');

        const fck = extractFck(getStrengthText());
        assert.ok(fck > baseFck + 5,
            `all strength additives should push fck well above base ${baseFck}, got ${fck}`);
    });

    // ── Fließmittel (FM) ──────────────────────────────────────────────────────

    it('FM: step appears and shows dosage from lib', () => {
        check('useFM');
        const step = getSteps().find(s => s.includes('Fließmittel'));
        assert.ok(step, 'FM step must appear');
        // getAdmixtureDosage('FM') = 0.2 l/m³ → fmtQty(0.2, 'l') → '200 ml'
        assert.ok(step.match(/200\s*ml/), `expected 200 ml in: ${step}`);
    });

    it('FM: reduces water demand by 20% (B20 typical for FM)', () => {
        const { w } = PRESETS.c25;
        const baseWater = Math.round(w);
        const expected  = applyAdmixtureWaterReduction(baseWater, 'FM'); // ~152 l
        check('useFM');
        const waterStep = getSteps().at(-1);
        assert.ok(waterStep.includes(String(expected)),
            `water step should show ${expected} l (20% FM reduction), got: ${waterStep}`);
        assert.ok(expected < baseWater * 0.85, 'FM must reduce water by more than 15%');
    });

    it('FM: increases estimated fck more than BV (stronger water reduction)', () => {
        const { z, w } = PRESETS.c25;
        const baseFck = Math.round(calculateStrengthFromWalzkurven(w / z, '42.5') - 8);

        check('useBV');
        const fckBV = extractFck(getStrengthText());
        check('useBV', false);

        check('useFM');
        const fckFM = extractFck(getStrengthText());
        check('useFM', false);

        assert.ok(fckFM > fckBV,
            `FM (20% reduction) should give higher fck than BV (7%): FM=${fckFM}, BV=${fckBV}`);
        assert.ok(fckFM > baseFck, 'FM must increase fck above base');
    });

    it('FM: water step notes dissolved admixture', () => {
        check('useFM');
        assert.ok(getSteps().at(-1).includes('eingerührten'));
    });

    // ── BV ⊕ FM mutual exclusion ──────────────────────────────────────────────

    it('BV ⊕ FM: checking FM while BV is on auto-unchecks BV', () => {
        check('useBV');
        check('useFM');
        assert.strictEqual(doc.getElementById('useBV').checked, false, 'BV should be cleared');
        assert.strictEqual(doc.getElementById('useFM').checked, true,  'FM should remain on');
    });

    it('BV ⊕ FM: checking BV while FM is on auto-unchecks FM', () => {
        check('useFM');
        check('useBV');
        assert.strictEqual(doc.getElementById('useFM').checked, false, 'FM should be cleared');
        assert.strictEqual(doc.getElementById('useBV').checked, true,  'BV should remain on');
    });

    it('BV ⊕ FM: only one plasticizer step appears at a time', () => {
        check('useBV');
        check('useFM');  // should clear BV
        const steps = getSteps().join(' | ');
        assert.ok( steps.includes('Fließmittel'),         'FM step expected');
        assert.ok(!steps.includes('Betonverflüssiger'),   'BV step must be gone');
    });

    it('LP cancels out gains when combined with all strength-increasing additives', () => {
        check('useExtraCement');
        check('useFlyAsh');
        check('useBV');
        const fckWithout = extractFck(getStrengthText());

        check('useLP');
        const fckWithLP = extractFck(getStrengthText());

        assert.ok(fckWithLP < fckWithout,
            `LP must reduce fck even when combined with other additives (${fckWithLP} < ${fckWithout})`);
    });
});

// ── app.js → fine-tune sessionStorage handoff ─────────────────────────────────
// The full round-trip (import fine-tune.js with pre-set sessionStorage) cannot be
// tested here because ES modules are cached for the process lifetime and fine-tune.js
// is already imported above. These unit tests validate the two pieces in isolation.

import { getRecommendedWaterSaving } from '../js/lib/additives.js';

describe('app.js → fine-tune handoff: wBase reversal and flag storage', () => {
    // Mirrors the formula in app.js displayRecipe():
    //   wBase = Math.round(w_reduced * 100 / (100 - savingPct))
    function computeWBase(wReduced, admixtureType) {
        const saving = (admixtureType === 'BV' || admixtureType === 'FM')
            ? getRecommendedWaterSaving(admixtureType) : 0;
        return saving > 0
            ? Math.round(wReduced * 100 / (100 - saving))
            : wReduced;
    }

    // Mirrors applyAdmixtureWaterReduction logic (Math.round(w * (1 - saving/100)))
    function applyReduction(wBase, admixtureType) {
        const saving = getRecommendedWaterSaving(admixtureType) / 100;
        return Math.round(wBase * (1 - saving));
    }

    it('BV: wBase reversal is the inverse of applyAdmixtureWaterReduction', () => {
        for (const base of [185, 190, 195, 200, 210]) {
            const reduced  = applyReduction(base, 'BV');
            const restored = computeWBase(reduced, 'BV');
            assert.strictEqual(restored, base,
                `round-trip failed for w=${base}: reduced=${reduced}, restored=${restored}`);
        }
    });

    it('FM: wBase reversal is the inverse of applyAdmixtureWaterReduction', () => {
        for (const base of [185, 190, 195]) {
            const reduced  = applyReduction(base, 'FM');
            const restored = computeWBase(reduced, 'FM');
            assert.strictEqual(restored, base,
                `FM round-trip failed for w=${base}: reduced=${reduced}, restored=${restored}`);
        }
    });

    it('no admixture: wBase equals the stored water unchanged', () => {
        assert.strictEqual(computeWBase(190, 'none'), 190);
        assert.strictEqual(computeWBase(190, null),   190);
    });

    it('useBV flag is only set when admixtureType is exactly BV (not FM)', () => {
        // Fine-tune BV checkbox uses 7% reduction; FM (20%) is a different product.
        // Storing useBV=true for FM would misrepresent the reduction in fine-tune.
        const buildFlags = (admixtureType) => ({ useBV: admixtureType === 'BV' });
        assert.strictEqual(buildFlags('BV').useBV,   true);
        assert.strictEqual(buildFlags('FM').useBV,   false);
        assert.strictEqual(buildFlags('none').useBV, false);
    });
});

// Parity test: Luftporenbildner (LP) via main form vs. via fine-tune.
//
// LP is unusual: the main form does not list LP as a "material" — it just
// raises the air content (Vol-%) which lowers the cube strength and modestly
// reduces water demand. Fine-tune, on the other hand, shows a concrete
// product dosage (≈ 0.2 l/m³).  So the parity check is two-fold:
//
//   (a) Both paths agree directionally on strength loss (LP lowers fck).
//   (b) Fine-tune renders the lib's typical LP product dosage (0.2 l/m³).

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { getAdmixtureDosage } from '../js/lib/additives.js';

const indexHtml    = fs.readFileSync(path.resolve('index.html'),     'utf8');
const fineTuneHtml = fs.readFileSync(path.resolve('fine-tune.html'), 'utf8');

function installGlobals(win) {
    global.window           = win;
    global.document         = win.document;
    global.location         = win.location;
    global.sessionStorage   = win.sessionStorage;
    global.HTMLElement      = win.HTMLElement;
    global.HTMLInputElement = win.HTMLInputElement;
    global.HTMLSelectElement= win.HTMLSelectElement;
    global.HTMLButtonElement= win.HTMLButtonElement;
    global.Event            = win.Event;
}

const fire = (el, type, win) => el.dispatchEvent(new win.Event(type));

function readWaterFromMainTable(doc) {
    const row = Array.from(doc.querySelectorAll('#recipeBody tr'))
        .find(r => /Wasser/i.test(r.textContent));
    if (!row) return null;
    const m = /([0-9]+(?:[.,][0-9]+)?)\s*l/.exec(row.querySelectorAll('td')[1].textContent);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function extractLpDosageFromTune(doc) {
    const items = Array.from(doc.querySelectorAll('#shoppingItems li')).map(li => li.textContent);
    const step  = items.find(s => /Luftporen/.test(s));
    if (!step) return null;
    // Step renders 0.2 l/m³ as "200 ml" via the ml threshold, so try ml first.
    const ml = /([0-9]+(?:[.,][0-9]+)?)\s*ml/.exec(step);
    if (ml) return parseFloat(ml[1].replace(',', '.')) / 1000;
    const l  = /([0-9]+(?:[.,][0-9]+)?)\s*l\b/.exec(step);
    return l ? parseFloat(l[1].replace(',', '.')) : null;
}

function extractTunedFckFromStrengthPanel(doc) {
    const text = doc.getElementById('strengthResult').textContent;
    const m = /ca\.\s*(\d+)\s*N/.exec(text);
    return m ? parseInt(m[1], 10) : null;
}

describe('Cross-page parity: Luftporenbildner via main form vs. via fine-tune', () => {
    let recipeWithLP, recipeNoLP;
    let waterMainWithLP, waterMainNoLP;
    let lpDosageTune, fckTuneNoLP, fckTuneWithLP;

    before(async () => {
        const mainDom = new JSDOM(indexHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        installGlobals(mainDom.window);
        const { initialize } = await import('../js/app.js');
        initialize();

        const mainDoc = mainDom.window.document;
        mainDoc.getElementById('strengthClass').value = 'C25/30';
        const xc1 = mainDoc.getElementById('exposureClassContainer').querySelector('input[value="XC1"]');
        xc1.checked = true; fire(xc1, 'change', mainDom.window);

        // Run 1: with LP (default 4 % air target)
        const useLP = mainDoc.getElementById('useAirEntraining');
        useLP.checked = true; fire(useLP, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeWithLP    = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));
        waterMainWithLP = readWaterFromMainTable(mainDoc);

        // Run 2: without LP
        useLP.checked = false; fire(useLP, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeNoLP    = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));
        waterMainNoLP = readWaterFromMainTable(mainDoc);

        // Phase 2: fine-tune from no-LP recipe, observe baseline fck, then add LP
        const tuneDom = new JSDOM(fineTuneHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        tuneDom.window.sessionStorage.setItem('creteLab_finetune', JSON.stringify(recipeNoLP));
        installGlobals(tuneDom.window);
        await import('../js/fine-tune.js');

        const tuneDoc = tuneDom.window.document;

        // Baseline (need a non-LP user-checked additive to make the strength panel
        // show a numeric estimate; pick extra cement, then untick it after reading).
        const useExtra = tuneDoc.getElementById('useExtraCement');
        useExtra.checked = true; fire(useExtra, 'change', tuneDom.window);
        fckTuneNoLP = extractTunedFckFromStrengthPanel(tuneDoc);

        // Now add LP on top
        const lp = tuneDoc.getElementById('useLP');
        lp.checked = true; fire(lp, 'change', tuneDom.window);
        lpDosageTune  = extractLpDosageFromTune(tuneDoc);
        fckTuneWithLP = extractTunedFckFromStrengthPanel(tuneDoc);
    });

    it('captured both main runs and the fine-tune addition', () => {
        assert.ok(recipeWithLP && recipeNoLP);
        assert.ok(lpDosageTune !== null && lpDosageTune > 0,
            `fine-tune must produce an LP step with a positive dosage (got ${lpDosageTune})`);
    });

    it('main with LP stored useLP=true; main without stored useLP=false', () => {
        assert.strictEqual(recipeWithLP.useLP, true);
        assert.strictEqual(recipeNoLP.useLP,   false);
    });

    it('main form: LP reduces water demand (air pores partially replace water)', () => {
        assert.ok(waterMainWithLP < waterMainNoLP,
            `main with-LP water (${waterMainWithLP}) must be < no-LP water (${waterMainNoLP})`);
    });

    it('fine-tune: LP step shows the lib’s typical product dosage', () => {
        const expected = getAdmixtureDosage('LP'); // 0.2 l/m³
        assert.ok(Math.abs(lpDosageTune - expected) < 0.01,
            `fine-tune LP dosage ${lpDosageTune} l/m³ should equal lib value ${expected}`);
    });

    it('fine-tune: adding LP lowers the estimated fck (matches main-form direction)', () => {
        assert.ok(fckTuneWithLP < fckTuneNoLP,
            `LP must lower the strength estimate: noLP=${fckTuneNoLP}, withLP=${fckTuneWithLP}`);
        // ~14 N/mm² total at 4 % air (3.5 × 4); tolerate a wide band for rounding.
        const drop = fckTuneNoLP - fckTuneWithLP;
        assert.ok(drop >= 8 && drop <= 18,
            `LP penalty should be ~14 N/mm², got ${drop}`);
    });
});

// Parity test: does adding FM (Fließmittel) in fine-tune produce the same
// water amount the main form would have produced if FM had been picked in
// the plasticizer dropdown there directly?

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

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

function readWaterFromTuneSteps(doc) {
    const items = Array.from(doc.querySelectorAll('#shoppingItems li')).map(li => li.textContent);
    const step  = items.find(s => /Wasser/.test(s));
    const m     = /([0-9]+(?:[.,][0-9]+)?)\s*l\b/.exec(step);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
}

describe('Cross-page parity: FM via main form vs. via fine-tune', () => {
    let recipeWithFM, recipeNoFM;
    let waterMainWithFM, waterTuneFM;

    before(async () => {
        const mainDom = new JSDOM(indexHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        installGlobals(mainDom.window);
        const { initialize } = await import('../js/app.js');
        initialize();

        const mainDoc = mainDom.window.document;
        mainDoc.getElementById('strengthClass').value = 'C25/30';
        const xc1 = mainDoc.getElementById('exposureClassContainer').querySelector('input[value="XC1"]');
        xc1.checked = true; fire(xc1, 'change', mainDom.window);

        const adm = mainDoc.getElementById('admixtureType');
        adm.value = 'FM'; fire(adm, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeWithFM    = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));
        waterMainWithFM = readWaterFromMainTable(mainDoc);

        adm.value = 'none'; fire(adm, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeNoFM = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));

        const tuneDom = new JSDOM(fineTuneHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        tuneDom.window.sessionStorage.setItem('creteLab_finetune', JSON.stringify(recipeNoFM));
        installGlobals(tuneDom.window);
        await import('../js/fine-tune.js');

        const tuneDoc = tuneDom.window.document;
        const fm = tuneDoc.getElementById('useFM');
        fm.checked = true; fire(fm, 'change', tuneDom.window);
        waterTuneFM = readWaterFromTuneSteps(tuneDoc);
    });

    it('captured both main runs and the fine-tune addition', () => {
        assert.ok(recipeWithFM && recipeNoFM);
        assert.ok(waterMainWithFM > 0 && waterTuneFM > 0);
    });

    it('main with FM stored useFM=true; main without FM stored useFM=false', () => {
        assert.strictEqual(recipeWithFM.useFM, true);
        assert.strictEqual(recipeNoFM.useFM,   false);
    });

    it('handoff base water (wBase) matches with vs. without FM (±1 l rounding)', () => {
        // app.js reverses the FM reduction before storing; the round-trip can
        // drift by 1 l vs. computing the base directly without FM.
        assert.ok(Math.abs(recipeWithFM.w - recipeNoFM.w) <= 1,
            `wBase should match within 1 l: with-FM=${recipeWithFM.w} vs no-FM=${recipeNoFM.w}`);
    });

    it('fine-tune water (FM applied) matches main-form water (FM applied) within 1 l', () => {
        assert.ok(Math.abs(waterTuneFM - waterMainWithFM) <= 1,
            `expected fine-tune water ≈ main-with-FM water: ` +
            `tune=${waterTuneFM} l, main=${waterMainWithFM} l`);
    });

    it('FM yields a clearly larger water reduction than BV would (≥ 12 l on this recipe)', () => {
        // Just a sanity check that FM reduced water more aggressively than 7 %.
        const reduction = recipeNoFM.w - waterTuneFM;
        assert.ok(reduction >= 12,
            `FM should remove ≥ 12 l vs base ${recipeNoFM.w} l, got Δ=${reduction}`);
    });
});

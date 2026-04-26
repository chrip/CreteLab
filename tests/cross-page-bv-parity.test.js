// Parity test: does adding BV (Betonverflüssiger) in fine-tune produce the
// same water amount the main form would have produced if BV had been picked
// in the plasticizer dropdown there directly?
//
//   1. Main form C25/30 + XC1 + admixtureType=BV → record water (post-BV)
//   2. Main form C25/30 + XC1 + admixtureType=none → record water (full)
//   3. Hand off the no-BV recipe to fine-tune, tick BV
//   4. Fine-tune water step should match step 1.

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

describe('Cross-page parity: BV via main form vs. via fine-tune', () => {
    let recipeWithBV, recipeNoBV;
    let waterMainWithBV, waterTuneBV;

    before(async () => {
        const mainDom = new JSDOM(indexHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        installGlobals(mainDom.window);
        const { initialize } = await import('../js/app.js');
        initialize();

        const mainDoc = mainDom.window.document;
        mainDoc.getElementById('strengthClass').value = 'C25/30';
        const xc1 = mainDoc.getElementById('exposureClassContainer').querySelector('input[value="XC1"]');
        xc1.checked = true; fire(xc1, 'change', mainDom.window);

        // Run 1: with BV
        const adm = mainDoc.getElementById('admixtureType');
        adm.value = 'BV'; fire(adm, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeWithBV    = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));
        waterMainWithBV = readWaterFromMainTable(mainDoc);

        // Run 2: without BV
        adm.value = 'none'; fire(adm, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeNoBV = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));

        // Phase 2: fine-tune with no-BV recipe, tick BV
        const tuneDom = new JSDOM(fineTuneHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        tuneDom.window.sessionStorage.setItem('creteLab_finetune', JSON.stringify(recipeNoBV));
        installGlobals(tuneDom.window);
        await import('../js/fine-tune.js');

        const tuneDoc = tuneDom.window.document;
        const bv = tuneDoc.getElementById('useBV');
        bv.checked = true; fire(bv, 'change', tuneDom.window);
        waterTuneBV = readWaterFromTuneSteps(tuneDoc);
    });

    it('captured both main runs and the fine-tune addition', () => {
        assert.ok(recipeWithBV && recipeNoBV);
        assert.ok(waterMainWithBV > 0 && waterTuneBV > 0);
    });

    it('main with BV stored useBV=true; main without BV stored useBV=false', () => {
        assert.strictEqual(recipeWithBV.useBV, true);
        assert.strictEqual(recipeNoBV.useBV,   false);
    });

    it('handoff base water (wBase) is identical with vs. without BV', () => {
        // app.js reverses the 7 % BV reduction before storing, so wBase matches.
        assert.strictEqual(recipeWithBV.w, recipeNoBV.w,
            `wBase should match: with-BV=${recipeWithBV.w} vs no-BV=${recipeNoBV.w}`);
    });

    it('fine-tune water (BV applied) matches main-form water (BV applied) within 1 l', () => {
        assert.ok(Math.abs(waterTuneBV - waterMainWithBV) <= 1,
            `expected fine-tune water ≈ main-with-BV water: ` +
            `tune=${waterTuneBV} l, main=${waterMainWithBV} l`);
    });
});

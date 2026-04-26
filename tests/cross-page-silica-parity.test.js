// Parity test: does adding Silikastaub in fine-tune produce the same silica
// mass the main form would have produced if silica had been ticked there
// directly?
//
// The two paths cannot fully coincide:
//   • main form with silica reduces cement via equivalent binder
//     (z = w / (maxWz × (1 + k_s·α_s)) — with k_s=1.0 and α_s=0.08 the
//     cement is up to 8 % lower than without silica, so silica = 8 % of
//     that smaller cement).
//   • fine-tune adds 8 % of the *delivered* (no-silica) cement, which is
//     larger — so fine-tune lands ~8 % higher in the unclamped regime.
//   • when the recipe hits the minimum-cement floor for the exposure
//     class (e.g. XC1 ≥ 240 kg/m³), the gap shrinks to a few percent.
// 10 % tolerance covers both regimes with margin; 25 % was a sloppy guard.

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

function readSilicaKgFromMainTable(doc) {
    const row = Array.from(doc.querySelectorAll('#recipeBody tr'))
        .find(r => /Silikastaub|Silica/i.test(r.textContent));
    if (!row) return null;
    const m = /([0-9]+(?:[.,][0-9]+)?)/.exec(row.querySelectorAll('td')[1].textContent);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function readSilicaKgFromTuneSteps(doc) {
    const items = Array.from(doc.querySelectorAll('#shoppingItems li')).map(li => li.textContent);
    const step  = items.find(s => /Silikastaub/.test(s));
    const m     = /([0-9]+(?:[.,][0-9]+)?)\s*kg/.exec(step);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
}

describe('Cross-page parity: Silikastaub via main form vs. via fine-tune', () => {
    let recipeWithSF, recipeNoSF;
    let silicaMain, silicaTune;

    before(async () => {
        const mainDom = new JSDOM(indexHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        installGlobals(mainDom.window);
        const { initialize } = await import('../js/app.js');
        initialize();

        const mainDoc = mainDom.window.document;
        mainDoc.getElementById('strengthClass').value = 'C25/30';
        const xc1 = mainDoc.getElementById('exposureClassContainer').querySelector('input[value="XC1"]');
        xc1.checked = true; fire(xc1, 'change', mainDom.window);

        const useSF = mainDoc.getElementById('useSilicaFume');
        useSF.checked = true; fire(useSF, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeWithSF = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));
        silicaMain   = readSilicaKgFromMainTable(mainDoc);

        useSF.checked = false; fire(useSF, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();
        recipeNoSF = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));

        const tuneDom = new JSDOM(fineTuneHtml, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });
        tuneDom.window.sessionStorage.setItem('creteLab_finetune', JSON.stringify(recipeNoSF));
        installGlobals(tuneDom.window);
        await import('../js/fine-tune.js');

        const tuneDoc = tuneDom.window.document;
        const sf = tuneDoc.getElementById('useSilica');
        sf.checked = true; fire(sf, 'change', tuneDom.window);
        silicaTune = readSilicaKgFromTuneSteps(tuneDoc);
    });

    it('captured both main runs and the fine-tune addition', () => {
        assert.ok(recipeWithSF && recipeNoSF);
        assert.ok(silicaMain  > 0, `main silica should be > 0, got ${silicaMain}`);
        assert.ok(silicaTune  > 0, `tune silica should be > 0, got ${silicaTune}`);
    });

    it('main with silica stored useSilica=true; main without stored useSilica=false', () => {
        assert.strictEqual(recipeWithSF.useSilica, true);
        assert.strictEqual(recipeNoSF.useSilica,   false);
    });

    it('water demand from the main form is independent of silica', () => {
        assert.strictEqual(recipeWithSF.w, recipeNoSF.w,
            `water should be silica-independent: with=${recipeWithSF.w} vs no=${recipeNoSF.w}`);
    });

    it('fine-tune silica mass agrees with main-form silica within ±10 % tolerance', () => {
        // Theoretical max gap is ~8 % (1/1.08 − 1) when neither side hits the
        // min-cement floor; on this C25/30 + XC1 recipe the with-silica side
        // does hit the floor, so the actual gap is ~4 %. 10 % covers both.
        const rel = Math.abs(silicaTune - silicaMain) / silicaMain;
        assert.ok(rel <= 0.10,
            `silica mass should agree within 10 %: main=${silicaMain} kg/m³, ` +
            `tune=${silicaTune} kg/m³ (Δ=${rel.toFixed(2)})`);
    });

    it('fine-tune silica is at least as high as main-form (uses larger cement base)', () => {
        assert.ok(silicaTune >= silicaMain - 1,
            `fine-tune silica (${silicaTune}) should be >= main silica (${silicaMain})`);
    });
});

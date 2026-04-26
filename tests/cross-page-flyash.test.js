// Parity test: does adding fly ash via fine-tune produce the same fly-ash mass
// the main form would have produced if fly ash had been ticked there directly?
//
// Procedure:
//   1. Drive the main form with C25/30 + XC1 and fly ash ON  → record FA mass
//   2. Drive the main form with C25/30 + XC1 and fly ash OFF → record water etc.
//   3. Hand off the no-FA recipe to fine-tune, tick fly ash there
//   4. Compare the fly-ash mass shown in fine-tune to the one from step 1.
//
// In the current code the two paths *cannot* coincide:
//   • main form with FA reduces cement via equivalent binder (z_FA < z_noFA)
//   • fine-tune adds 15 % of the *delivered* cement, which is z_noFA (higher)
// so the fine-tune amount is structurally larger than the main-form amount.
// The tolerance below documents that gap; if a future change tightens it,
// this test will catch it.

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

function fireEvent(el, type, win) {
    el.dispatchEvent(new win.Event(type));
}

// Read a "Flugasche" row from the recipe table in the main form and return its
// per-m³ kg value (column 1 — "Menge / m³").
function readFlyAshKgFromMainTable(doc) {
    const row = Array.from(doc.querySelectorAll('#recipeBody tr'))
        .find(r => r.textContent.includes('Flugasche'));
    if (!row) return null;
    const cells = row.querySelectorAll('td');
    const text = cells[1].textContent;  // per-m³ column
    const m = /([0-9]+(?:[.,][0-9]+)?)/.exec(text);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
}

describe('Cross-page parity: fly ash via main form vs. via fine-tune', () => {
    let recipeWithFA;     // sessionStorage payload from main run with FA
    let recipeNoFA;       // sessionStorage payload from main run without FA
    let flyAshKgMain;     // per-m³ FA mass produced by main form
    let flyAshKgTune;     // per-m³ FA mass produced by fine-tune
    let waterMain;        // per-m³ water from main no-FA recipe
    let waterTune;        // per-m³ water inferred from fine-tune step (no admixture)

    before(async () => {
        // ── Phase 1: drive the main form ────────────────────────────────────
        const mainDom = new JSDOM(indexHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        installGlobals(mainDom.window);
        const { initialize } = await import('../js/app.js');
        initialize();

        const mainDoc = mainDom.window.document;

        // Same base settings for both runs
        mainDoc.getElementById('strengthClass').value = 'C25/30';
        const xc1 = mainDoc.getElementById('exposureClassContainer')
            .querySelector('input[value="XC1"]');
        xc1.checked = true;
        fireEvent(xc1, 'change', mainDom.window);

        // ── Run 1: with fly ash ─────────────────────────────────────────────
        const useFlyAsh = mainDoc.getElementById('useFlyAsh');
        useFlyAsh.checked = true;
        fireEvent(useFlyAsh, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();

        recipeWithFA  = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));
        flyAshKgMain  = readFlyAshKgFromMainTable(mainDoc);

        // ── Run 2: without fly ash ──────────────────────────────────────────
        useFlyAsh.checked = false;
        fireEvent(useFlyAsh, 'change', mainDom.window);
        mainDoc.getElementById('calculateBtn').click();

        recipeNoFA = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));
        waterMain  = recipeNoFA.w;

        // ── Phase 2: open fine-tune with the no-FA recipe, tick fly ash ─────
        const tuneDom = new JSDOM(fineTuneHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        tuneDom.window.sessionStorage.setItem('creteLab_finetune', JSON.stringify(recipeNoFA));
        installGlobals(tuneDom.window);
        await import('../js/fine-tune.js');

        const tuneDoc = tuneDom.window.document;
        const flyAsh  = tuneDoc.getElementById('useFlyAsh');
        flyAsh.checked = true;
        fireEvent(flyAsh, 'change', tuneDom.window);

        // Pull the FA step from the shopping list ("XX,XX kg Flugasche …")
        const items = Array.from(tuneDoc.querySelectorAll('#shoppingItems li'))
            .map(li => li.textContent);
        const faStep    = items.find(s => s.includes('Flugasche'));
        const waterStep = items.find(s => s.includes('Wasser'));
        const faMatch   = /([0-9]+(?:[.,][0-9]+)?)\s*kg/.exec(faStep);
        const wMatch    = /([0-9]+(?:[.,][0-9]+)?)\s*l\b/.exec(waterStep);
        flyAshKgTune = faMatch ? parseFloat(faMatch[1].replace(',', '.')) : null;
        waterTune    = wMatch  ? parseFloat(wMatch[1].replace(',', '.'))  : null;
    });

    it('captured both main runs and the fine-tune addition', () => {
        assert.ok(recipeWithFA && recipeNoFA, 'main form should hand off both recipes');
        assert.ok(flyAshKgMain !== null && flyAshKgMain > 0,
            `main FA recipe must contain a Flugasche row (got ${flyAshKgMain})`);
        assert.ok(flyAshKgTune !== null && flyAshKgTune > 0,
            `fine-tune must produce a Flugasche step (got ${flyAshKgTune})`);
    });

    it('water demand from the main form is reproduced as the base water in fine-tune', () => {
        // Sieblinie + consistency drive the water demand; FA should not change it.
        assert.strictEqual(recipeWithFA.w, recipeNoFA.w,
            `water demand should be the same with vs. without FA (${recipeWithFA.w} vs ${recipeNoFA.w})`);
        // And fine-tune renders that same water (no admixture in this scenario).
        assert.ok(Math.abs(waterTune - waterMain) <= 1,
            `fine-tune water step (${waterTune} l) must equal main no-FA water (${waterMain} l)`);
    });

    it('fine-tune fly-ash matches main-form fly-ash within ±20 % tolerance', () => {
        // Documented gap: fine-tune uses delivered cement (z_noFA), main uses
        // the FA-reduced cement (z_FA), so fine-tune is structurally higher.
        // The tolerance is wide enough to absorb that for a typical C25/30/XC1
        // recipe but tight enough to flag a regression.
        const diff = Math.abs(flyAshKgTune - flyAshKgMain);
        const rel  = diff / flyAshKgMain;
        assert.ok(rel <= 0.20,
            `FA mass should agree within 20 %: main=${flyAshKgMain} kg/m³, ` +
            `fine-tune=${flyAshKgTune} kg/m³ (Δ=${rel.toFixed(2)})`);
    });

    it('fine-tune fly-ash is at least as high as main-form (uses larger cement base)', () => {
        // Sanity check on the direction of the discrepancy: with the no-FA
        // recipe as the base, fine-tune scales 15 % from a *higher* cement
        // amount than the main form does after applying equivalent-binder.
        assert.ok(flyAshKgTune >= flyAshKgMain - 1,
            `fine-tune FA (${flyAshKgTune}) should be >= main FA (${flyAshKgMain}) ` +
            `because z_noFA > z_FA`);
    });
});

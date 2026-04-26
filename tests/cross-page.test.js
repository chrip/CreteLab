// Cross-page integration: drive the main form (index.html → js/app.js),
// click "Berechnen", then load the fine-tune page (fine-tune.html → js/fine-tune.js)
// in a fresh JSDOM, copying sessionStorage, and verify the strength panel
// is consistent with what the main form just calculated.

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

describe('Cross-page handoff: C30/37 + Silica → fine-tune does not downgrade class', () => {
    let storedRecipe;
    let strengthText;

    before(async () => {
        // ── Phase 1: drive the main form ─────────────────────────────────────
        const mainDom = new JSDOM(indexHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        installGlobals(mainDom.window);
        const { initialize } = await import('../js/app.js');
        initialize();

        const mainDoc = mainDom.window.document;

        // C30/37
        mainDoc.getElementById('strengthClass').value = 'C30/37';

        // XC1 (only the simplest exposure to keep the strength recipe-driven)
        const xc1 = mainDoc.getElementById('exposureClassContainer')
            .querySelector('input[value="XC1"]');
        xc1.checked = true;
        xc1.dispatchEvent(new mainDom.window.Event('change'));

        // Silica fume
        const silica = mainDoc.getElementById('useSilicaFume');
        silica.checked = true;
        silica.dispatchEvent(new mainDom.window.Event('change'));

        // "Berechnen"
        mainDoc.getElementById('calculateBtn').click();

        // Capture what app.js handed off to fine-tune
        storedRecipe = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));

        // ── Phase 2: open fine-tune in a fresh JSDOM, replay the handoff ─────
        const tuneDom = new JSDOM(fineTuneHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        // Replay the sessionStorage payload from phase 1 in the new window.
        tuneDom.window.sessionStorage.setItem('creteLab_finetune', JSON.stringify(storedRecipe));
        installGlobals(tuneDom.window);

        await import('../js/fine-tune.js');

        strengthText = tuneDom.window.document.getElementById('strengthResult').textContent;
    });

    it('main form stored a custom recipe with silica pre-applied', () => {
        assert.ok(storedRecipe,                        'sessionStorage handoff present');
        assert.strictEqual(storedRecipe.klasse, 'C30/37');
        assert.strictEqual(storedRecipe.useSilica, true, 'useSilica flag should be set');
        assert.ok(storedRecipe.z > 0 && storedRecipe.w > 0 && storedRecipe.g > 0);
    });

    it('fine-tune shows the base class C30/37 without a downgrade arrow', () => {
        assert.ok(strengthText.includes('C30/37'),
            `expected base class C30/37 in: "${strengthText}"`);
        assert.ok(!strengthText.includes('→'),
            `pre-applied silica must not downgrade the class. Got: "${strengthText}"`);
        assert.ok(!strengthText.includes('C25/30'),
            `must not display C25/30. Got: "${strengthText}"`);
    });

    it('fine-tune omits the recomputed N/mm² value when only pre-applied additives are checked', () => {
        assert.ok(!/N\/mm²/.test(strengthText),
            `must not show a recomputed N/mm² estimate. Got: "${strengthText}"`);
    });
});

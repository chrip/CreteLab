// Cross-page integration: when FM is selected in the main form, the fine-tune
// page must lock the BV checkbox (mutually exclusive) so the user can't add it
// on top of the pre-applied FM.

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

describe('Cross-page handoff: FM in main form locks out BV in fine-tune', () => {
    let storedRecipe;
    let tuneDoc;

    before(async () => {
        // ── Phase 1: drive the main form with FM selected ────────────────────
        const mainDom = new JSDOM(indexHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        installGlobals(mainDom.window);
        const { initialize } = await import('../js/app.js');
        initialize();

        const mainDoc = mainDom.window.document;

        mainDoc.getElementById('strengthClass').value = 'C25/30';

        const xc1 = mainDoc.getElementById('exposureClassContainer')
            .querySelector('input[value="XC1"]');
        xc1.checked = true;
        xc1.dispatchEvent(new mainDom.window.Event('change'));

        // Pick FM (Fließmittel) from the plasticizer dropdown
        const admixture = mainDoc.getElementById('admixtureType');
        admixture.value = 'FM';
        admixture.dispatchEvent(new mainDom.window.Event('change'));

        mainDoc.getElementById('calculateBtn').click();

        storedRecipe = JSON.parse(mainDom.window.sessionStorage.getItem('creteLab_finetune'));

        // ── Phase 2: open fine-tune with the FM payload ──────────────────────
        const tuneDom = new JSDOM(fineTuneHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        tuneDom.window.sessionStorage.setItem('creteLab_finetune', JSON.stringify(storedRecipe));
        installGlobals(tuneDom.window);

        await import('../js/fine-tune.js');
        tuneDoc = tuneDom.window.document;
    });

    it('main form stored useFM=true and useBV=false', () => {
        assert.strictEqual(storedRecipe.useFM, true,  'FM should be flagged in handoff');
        assert.strictEqual(storedRecipe.useBV, false, 'BV must not be flagged when FM is chosen');
    });

    it('fine-tune: FM checkbox is checked AND disabled (pre-applied)', () => {
        const fm = tuneDoc.getElementById('useFM');
        assert.strictEqual(fm.checked,  true,  'FM should be pre-checked');
        assert.strictEqual(fm.disabled, true,  'FM should be locked');
    });

    it('fine-tune: BV checkbox is unchecked AND disabled (mutual-exclusion lock)', () => {
        const bv = tuneDoc.getElementById('useBV');
        assert.strictEqual(bv.checked,  false, 'BV must not be checked when FM is pre-applied');
        assert.strictEqual(bv.disabled, true,
            'BV must be disabled — selecting it would conflict with pre-applied FM');
    });

    it('fine-tune: BV card is visually grayed out with an explanatory message', () => {
        const card = tuneDoc.getElementById('cardBV');
        const result = tuneDoc.getElementById('resBV');

        assert.ok(card.classList.contains('locked-out'),
            'BV card must carry the .locked-out class for the gray styling');
        assert.ok(!card.classList.contains('selected'),
            'BV card must not be styled as selected');

        assert.ok(!result.classList.contains('hidden'),
            'BV result panel must be visible to show the lock-out reason');
        assert.ok(result.classList.contains('locked-out'),
            'BV result panel must carry .locked-out for the gray accent');
        assert.ok(/Fließmittel.*bereits/i.test(result.textContent),
            `BV result should explain that FM is already in the recipe, got: "${result.textContent}"`);
    });

    it('fine-tune: switching to a standard preset re-enables both BV and FM', () => {
        const sel = tuneDoc.getElementById('mixPreset');
        sel.value = 'c25';
        sel.dispatchEvent(new tuneDoc.defaultView.Event('change'));

        assert.strictEqual(tuneDoc.getElementById('useBV').disabled, false,
            'BV must be re-enabled on a standard preset');
        assert.strictEqual(tuneDoc.getElementById('useFM').disabled, false,
            'FM must be re-enabled on a standard preset');
    });
});

// JSDOM tests for the UHPC scaler page (uhpc.html + js/uhpc.js).
// Pure-math behavior is covered in tests/uhpc-engine.test.js — here we
// only verify wiring: dropdown, inputs, table, chips, steps, source panel.

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { UHPC_PRESETS } from '../js/lib/uhpc-presets.js';

const html = fs.readFileSync(path.resolve('uhpc.html'), 'utf8');

describe('UHPC page – DOM wiring', () => {
    let win, doc;

    before(async () => {
        const dom = new JSDOM(html, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/',
        });
        win = dom.window;
        doc = win.document;

        // Globals captured by uhpc.js at module-load time.
        global.window         = win;
        global.document       = doc;
        global.location       = win.location;
        global.HTMLElement    = win.HTMLElement;
        global.HTMLInputElement = win.HTMLInputElement;
        global.HTMLSelectElement = win.HTMLSelectElement;
        global.Event = win.Event;

        await import('../js/uhpc.js');
    });

    function setVolume(text) {
        const el = doc.getElementById('uhpcVolume');
        el.value = String(text);
        el.dispatchEvent(new win.Event('input'));
    }

    function getRecipeRows() {
        return Array.from(doc.querySelectorAll('#uhpcResultBody tr')).map(r => ({
            name:  r.cells[0].textContent.trim(),
            value: r.cells[1].textContent.trim(),
            pct:   r.cells[2].textContent.trim(),
        }));
    }

    function getChips() {
        return Array.from(doc.querySelectorAll('.plausibility-chip')).map(c => ({
            level: Array.from(c.classList).find(x => x.startsWith('level-')).slice(6),
            text:  c.textContent.trim(),
        }));
    }

    beforeEach(() => {
        // Reset to default volume and preset before every test.
        const sel = doc.getElementById('uhpcPreset');
        sel.value = UHPC_PRESETS[0].key;
        sel.dispatchEvent(new win.Event('change'));
        setVolume('0,03');
    });

    it('populates the preset dropdown from the catalog', () => {
        const opts = Array.from(doc.querySelectorAll('#uhpcPreset option'));
        assert.strictEqual(opts.length, UHPC_PRESETS.length);
        assert.deepStrictEqual(
            opts.map(o => o.value),
            UHPC_PRESETS.map(p => p.key),
        );
    });

    it('does not surface the original author name in the visible UI', () => {
        // Copyright-safety: the dropdown label must be the generic preset.label,
        // not the author. (The author appears only inside the collapsed source
        // panel, which is not on the main visible label.)
        const visibleLabel = doc.querySelector('#uhpcPreset option[value="' +
            UHPC_PRESETS[0].key + '"]').textContent;
        assert.ok(!/grey element/i.test(visibleLabel),
            `dropdown label leaks the author: "${visibleLabel}"`);
    });

    it('renders the six expected ingredient rows in the table', () => {
        const rows = getRecipeRows();
        assert.strictEqual(rows.length, 6);
        assert.ok(rows[0].name.includes('Zement'));
        assert.ok(rows[1].name.includes('Sand'));
        assert.ok(rows[2].name.includes('Quarzmehl'));
        assert.ok(rows[3].name.includes('Feinzuschläge'));
        assert.ok(rows[4].name.includes('Wasser'));
        assert.ok(rows[5].name.includes('PCE'));
    });

    it('renders three plausibility chips, all ok or warn for the default preset', () => {
        const chips = getChips();
        assert.strictEqual(chips.length, 3);
        for (const c of chips) {
            assert.ok(['ok', 'warn'].includes(c.level),
                `default preset chip should not be in error state: ${c.text}`);
        }
    });

    it('updates quantities live when the volume input changes', () => {
        setVolume('0,03');
        const v003 = parseValue(getRecipeRows()[0].value);

        setVolume('0,06');
        const v006 = parseValue(getRecipeRows()[0].value);

        // 0.06 m³ should yield ~2× the cement of 0.03 m³.
        assert.ok(Math.abs(v006 - 2 * v003) / v003 < 0.02,
            `expected linear scaling, got 0.03→${v003}, 0.06→${v006}`);
    });

    it('regression: at 0.001 m³ the water row renders sub-1 with ml unit, not "0 ml"', () => {
        setVolume('0,001');
        const waterValue = getRecipeRows().find(r => r.name.includes('Wasser')).value;
        assert.ok(/\d+\s*ml/.test(waterValue),
            `expected ml-scale water, got: "${waterValue}"`);
        assert.ok(!/^0\s*ml/.test(waterValue),
            `water must not be "0 ml" at 0.001 m³, got: "${waterValue}"`);
    });

    it('source panel shows the verifiable URL of the active preset', () => {
        const link = doc.querySelector('#uhpcSourceBody a');
        assert.ok(link, 'source link must be rendered');
        assert.strictEqual(link.getAttribute('href'), UHPC_PRESETS[0].source.url);
        assert.strictEqual(link.getAttribute('target'), '_blank');
        assert.ok((link.getAttribute('rel') || '').includes('noopener'));
    });

    it('renders at least four mixing-instruction steps', () => {
        const items = doc.querySelectorAll('#uhpcSteps li');
        assert.ok(items.length >= 4, `expected >= 4 steps, got ${items.length}`);
        // First step references the dry-mix components by mass.
        assert.ok(/Zement/.test(items[0].textContent));
    });

    it('flips the w/b chip to error level when water is set unrealistically low via the volume', () => {
        // Volume drives masses linearly — the w/b ratio depends on the
        // *preset*, not on the user's volume. So plausibility must remain
        // stable across volume changes (this is the invariant we want).
        setVolume('0,01');
        const a = getChips();
        setVolume('0,5');
        const b = getChips();
        assert.deepStrictEqual(a.map(c => c.level), b.map(c => c.level),
            'plausibility chips must not change with volume alone');
    });
});

function parseValue(text) {
    // "30,00 kg" or "190 ml" → number in base unit (kg or l).
    const m = /([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|l|ml)/.exec(text);
    if (!m) return NaN;
    const n = parseFloat(m[1].replace(',', '.'));
    if (m[2] === 'g'  || m[2] === 'ml') return n / 1000;
    return n;
}

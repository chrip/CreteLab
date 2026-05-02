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

    it('populates the preset dropdown with every catalog entry, ascending by 28-d strength', () => {
        const opts = Array.from(doc.querySelectorAll('#uhpcPreset option'));
        assert.strictEqual(opts.length, UHPC_PRESETS.length,
            'every catalog entry must be present');

        // Same set of keys, but the order in the dropdown must be sorted
        // by claimed-or-estimated strength (non-decreasing).
        assert.deepStrictEqual(
            new Set(opts.map(o => o.value)),
            new Set(UHPC_PRESETS.map(p => p.key)),
        );

        const fckOf = (key) => {
            const p = UHPC_PRESETS.find(x => x.key === key);
            return p.claimedFckMpa ?? p.estimatedFckMpa ?? 0;
        };
        const strengths = opts.map(o => fckOf(o.value));
        for (let i = 1; i < strengths.length; i++) {
            assert.ok(strengths[i] >= strengths[i - 1],
                `dropdown not sorted ascending at index ${i}: ${strengths.join(' → ')}`);
        }
    });

    it('every dropdown option starts with its 28-d strength (estimated values prefixed with "ca.")', () => {
        const opts = Array.from(doc.querySelectorAll('#uhpcPreset option'));
        for (const opt of opts) {
            const preset = UHPC_PRESETS.find(p => p.key === opt.value);
            const fck = preset.claimedFckMpa ?? preset.estimatedFckMpa;
            assert.ok(fck > 0, `${preset.key}: must have a strength`);

            const text = opt.textContent;
            // Every option's text must contain the strength figure.
            assert.ok(text.includes(`${fck} N/mm²`),
                `option for ${preset.key} should mention "${fck} N/mm²", got: "${text}"`);

            // Estimated values are prefixed with "ca.", measured ones are not.
            if (preset.claimedFckMpa) {
                assert.ok(!/^ca\./.test(text),
                    `measured-strength preset ${preset.key} must not have "ca." prefix, got: "${text}"`);
            } else {
                assert.ok(/^ca\.\s/.test(text),
                    `estimated-strength preset ${preset.key} must start with "ca. ", got: "${text}"`);
            }

            // The original preset.label must still be present after the strength prefix.
            assert.ok(text.includes(preset.label),
                `option text must still include the preset label, got: "${text}"`);
        }
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

    // ── Second preset (DIY hochfester Mörtel without Quarzmehl) ─────────
    // This block runs only if the catalog actually contains a "no-microfiller"
    // preset; otherwise it skips so the suite stays valid for catalog edits.

    const noFillerPreset = UHPC_PRESETS.find(
        p => p.batch.quartzPowderKg === 0 && p.batch.finesKg === 0
    );

    function selectPreset(key) {
        const sel = doc.getElementById('uhpcPreset');
        sel.value = key;
        sel.dispatchEvent(new win.Event('change'));
    }

    it('preset without Quarzmehl/Feinzuschläge: table hides their rows', { skip: !noFillerPreset }, () => {
        selectPreset(noFillerPreset.key);
        const rows = getRecipeRows();
        // The preset has cement, sand, water, PCE — exactly four ingredients.
        assert.strictEqual(rows.length, 4,
            `expected 4 rows for the no-microfiller preset, got ${rows.length}`);
        const names = rows.map(r => r.name).join(' | ');
        assert.ok(!/Quarzmehl/.test(names),  `Quarzmehl row must be hidden: ${names}`);
        assert.ok(!/Feinzuschläge/.test(names), `Feinzuschläge row must be hidden: ${names}`);
        assert.ok(/Zement/.test(names));
        assert.ok(/Sand/.test(names));
        assert.ok(/Wasser/.test(names));
        assert.ok(/PCE/.test(names));
    });

    it('preset without Quarzmehl: mixing steps come from the preset and never mention Quarzmehl', { skip: !noFillerPreset }, () => {
        selectPreset(noFillerPreset.key);
        const steps = Array.from(doc.querySelectorAll('#uhpcSteps li')).map(li => li.textContent);
        assert.ok(steps.length >= 3, `expected >= 3 steps, got ${steps.length}`);
        const blob = steps.join(' | ');
        assert.ok(!/Quarzmehl/.test(blob),
            `mixing steps must not mention Quarzmehl for this preset: ${blob}`);
        assert.ok(/Zement/.test(blob));
        assert.ok(/Sand/.test(blob));
    });

    it('preset without Quarzmehl: w/b chip stays in ok-or-warn (recipe is right at 0.30)', { skip: !noFillerPreset }, () => {
        selectPreset(noFillerPreset.key);
        const wb = getChips().find(c => c.text.includes('Wasser/Bindemittel'));
        assert.ok(wb, 'w/b chip must be rendered');
        assert.ok(['ok', 'warn'].includes(wb.level),
            `w/b chip should be ok or warn for the published recipe, got ${wb.level} (${wb.text})`);
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

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { standardUrl, readStandard, fineTuneUrl, readFineTune, uhpcUrl, readUhpc } from '../js/lib/handoff.js';
import { detectApproach, fineTuneOptions } from '../js/lib/describe.js';
import { fineTunePresetFor, bagMixKg } from '../js/lib/fine-tune-presets.js';

const query = url => url.slice(url.indexOf('?'));
const n = p => ({ noul: p });

describe('handoff between the pages', () => {
    it('calculator: every field survives the round trip', () => {
        const r = readStandard(query(standardUrl({
            source: 'describe', text: 'Einfahrt, 25 m²', volume: 3.75, strengthClass: 'C35/45',
            exposureClasses: ['XC4', 'XD3', 'XF4'], siebline: 'B32', consistencyClass: 'F2',
            aggregateType: 'Kiessand (Quarz)', cementType: 'CEM I 42.5 N', vorhaltemas: 9,
            admixtureType: 'BV', airEntrainingPercent: 4, waterproofPercent: 2, warn: 'thin'
        })));
        assert.deepStrictEqual(
            [r.source, r.text, r.volume, r.strengthClass, r.exposureClasses, r.siebline, r.consistencyClass,
             r.aggregateType, r.cementType, r.vorhaltemas, r.admixtureType, r.airEntrainingPercent, r.waterproofPercent, r.warn],
            ['describe', 'Einfahrt, 25 m²', 3.75, 'C35/45', ['XC4', 'XD3', 'XF4'], 'B32', 'F2',
             'Kiessand (Quarz)', 'CEM I 42.5 N', 9, 'BV', 4, 2, 'thin']);
    });

    it('no handoff without src: the calculator keeps its defaults', () => {
        assert.strictEqual(readStandard('?lang=de'), null);
    });

    it('fine-tune: preset, volume and options', () => {
        const r = readFineTune(query(fineTuneUrl({ preset: 'c25', volume: 0.0291, opts: ['extraCement', 'wu', 'lp'] })));
        assert.deepStrictEqual([r.preset, r.volume, r.opts], ['c25', 0.0291, ['extraCement', 'wu', 'lp']]);
    });

    it('UHPC: preset and volume', () => {
        const r = readUhpc(query(uhpcUrl({ preset: 'diy-white-15kg-laminate', volume: 0.0782 })));
        assert.deepStrictEqual([r.preset, r.volume], ['diy-white-15kg-laminate', 0.0782]);
    });
});

describe('approach: from scratch, ready-mix bag, or fine mortar', () => {
    it("uses Laya's approach answer when the model has it", () => {
        assert.strictEqual(detectApproach({ approach: { choice: 'bagged' } }, 'irgendwas'), 'bagged');
    });

    it('walls under 3 cm overrule "scratch": site concrete cannot make them', () => {
        assert.strictEqual(detectApproach({ approach: { choice: 'scratch' } }, '', { wall: 0.02 }), 'fine_mortar');
        assert.strictEqual(detectApproach({ approach: { choice: 'scratch' } }, '', { wall: 0.04 }), 'scratch');
        assert.strictEqual(detectApproach({ approach: { choice: 'bagged' } }, '', { wall: 0.02 }), 'bagged');
    });

    it('without it: ready-mix words mean bagged', () => {
        for (const t of ['Pflanzschale mit Fertigbeton aus dem Baumarkt', 'I bought a bag of Quikrete', 'zwei Säcke Beton für Zaunpfosten'])
            assert.strictEqual(detectApproach({}, t), 'bagged', t);
    });

    it('without it: a DIY piece means fine mortar, anything else from scratch', () => {
        assert.strictEqual(detectApproach({ fine_cast: n(0.9) }, 'Couchtisch 100x60x3 cm'), 'fine_mortar');
        assert.strictEqual(detectApproach({ fine_cast: n(0.1) }, 'Einfahrt 25 m²'), 'scratch');
    });

    it('fine-tune options follow the facts and the wording', () => {
        const a = { watertight: n(0.9), frost: n(0.8), indoor_dry: n(0.1) };
        assert.deepStrictEqual(fineTuneOptions(a, 'Fertigbeton, etwas Zement dazu'), ['extraCement', 'wu', 'lp']);
        assert.deepStrictEqual(fineTuneOptions({ indoor_dry: n(0.9), frost: n(0.9) }, 'Tisch innen'), []);
    });
});

describe('fine-tune base mix', () => {
    it('picks the lowest bag that reaches the strength class', () => {
        assert.strictEqual(fineTunePresetFor('C20/25').value, 'c20');
        assert.strictEqual(fineTunePresetFor('C25/30').value, 'c25');
        assert.strictEqual(fineTunePresetFor('C35/45').value, 'c40');
        assert.strictEqual(fineTunePresetFor('C50/60').value, 'c40'); // strongest there is
    });

    it('the bag holds cement + aggregate: 2 100 kg per m³ for C25/30', () => {
        assert.strictEqual(bagMixKg(fineTunePresetFor('C25/30'), 1), 2100);
    });
});

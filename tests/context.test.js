import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { loadContext, saveContext, optsFromFields } from '../js/lib/context.js';

// sessionStorage stand-in (the pages share one context per browser tab)
beforeEach(() => {
    const store = new Map();
    globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
});

describe('tab context shared by the four pages', () => {
    it('a page only overwrites the fields it writes; the rest travels through', () => {
        saveContext({ text: 'Einfahrt', exposureClasses: ['XC4', 'XF4'], volume: 3.75 }, 'describe');
        saveContext({ uhpcPreset: 'diy-white-bowl-4kg', volume: 5 }, 'uhpc');
        const ctx = loadContext();
        assert.deepStrictEqual(ctx.exposureClasses, ['XC4', 'XF4']);
        assert.strictEqual(ctx.text, 'Einfahrt');
        assert.strictEqual(ctx.volume, 5);
        assert.strictEqual(ctx.lastEditor, 'uhpc');
    });

    it('works without storage (blocked or missing)', () => {
        delete globalThis.sessionStorage;
        assert.deepStrictEqual(loadContext(), {});
        assert.doesNotThrow(() => saveContext({ volume: 1 }));
    });

    it('calculator fields map to fine-tune options; extra cement is kept', () => {
        assert.deepStrictEqual(
            optsFromFields({ airEntrainingPercent: 4, waterproofPercent: 2, admixtureType: 'BV' }, ['extraCement']),
            ['extraCement', 'lp', 'wu', 'bv']);
        assert.deepStrictEqual(optsFromFields({ flyAshPercent: 0, admixtureType: 'none' }), []);
    });
});

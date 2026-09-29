// context.js - One recipe context per browser tab, shared by all four pages
// Every page writes the fields you change and reads the whole context when it opens, so
// switching pages through the navigation keeps every value. A page only overwrites the
// fields it owns; the rest travels through untouched (e.g. exposure classes through the
// UHPC page). Links with URL parameters (js/lib/handoff.js) still take precedence.

const KEY = 'creteLab_ctx';

/**
 * Fields: text, lastResult (search page), volume (m³), strengthClass, exposureClasses,
 * siebline, consistencyClass, aggregateType, cementType, vorhaltemas, admixtureType,
 * airEntrainingPercent, flyAshPercent, silicaFumePercent, waterproofPercent, warn,
 * ftPreset, ftOpts (fine-tune), uhpcPreset, lastEditor.
 */
export function loadContext() {
    try {
        return JSON.parse(globalThis.sessionStorage?.getItem(KEY)) || {};
    } catch {
        return {};
    }
}

export function saveContext(patch, editor) {
    const ctx = { ...loadContext(), ...patch };
    if (editor) ctx.lastEditor = editor;
    try {
        globalThis.sessionStorage?.setItem(KEY, JSON.stringify(ctx));
    } catch { /* storage blocked: pages still work, just without carry-over */ }
    return ctx;
}

// Fine-tune options and the calculator fields they correspond to.
export const OPT_TO_FIELD = {
    lp: ['airEntrainingPercent', 4.5],
    flyAsh: ['flyAshPercent', 15],
    silica: ['silicaFumePercent', 8],
    wu: ['waterproofPercent', 2]
};

/** Fine-tune options implied by the calculator fields (extra cement is fine-tune only). */
export function optsFromFields(f, previous = []) {
    const opts = previous.includes('extraCement') ? ['extraCement'] : [];
    for (const [opt, [field]] of Object.entries(OPT_TO_FIELD)) if (f[field] > 0) opts.push(opt);
    if (f.admixtureType === 'BV') opts.push('bv');
    if (f.admixtureType === 'FM') opts.push('fm');
    return opts;
}

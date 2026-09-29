// handoff.js - Pass a recipe between the pages as URL parameters
// (shareable, reload-safe). The search box (describe.html) opens the calculator,
// fine-tune or UHPC page pre-filled; fine-tune can hand over to the calculator.

const keepLang = params => {
    const lang = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    if (lang) params.set('lang', lang);
    return params;
};

const num = v => {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

/**
 * Calculator (index.html).
 * @param {object} r - { volume, strengthClass, exposureClasses[], siebline, consistencyClass,
 *   aggregateType, cementType, vorhaltemas, admixtureType, airEntrainingPercent,
 *   flyAshPercent, silicaFumePercent, waterproofPercent, text, source, warn }
 */
export function standardUrl(r) {
    const p = new URLSearchParams();
    const set = (k, v) => { if (v !== undefined && v !== null && v !== '' && v !== 0 && v !== 'none') p.set(k, v); };
    set('src', r.source); set('q', r.text); set('warn', r.warn);
    set('vol', r.volume); set('strength', r.strengthClass);
    set('exp', (r.exposureClasses || []).join(','));
    set('sieb', r.siebline); set('cons', r.consistencyClass); set('agg', r.aggregateType);
    set('cem', r.cementType); set('v', r.vorhaltemas); set('adm', r.admixtureType);
    set('lp', r.airEntrainingPercent); set('fa', r.flyAshPercent); set('sf', r.silicaFumePercent); set('wu', r.waterproofPercent);
    return `index.html?${keepLang(p)}`;
}

/** @returns {object|null} the fields of standardUrl(), or null without a handoff */
export function readStandard(search) {
    const p = new URLSearchParams(search);
    if (!p.has('src')) return null;
    return {
        source: p.get('src'), text: p.get('q') || '', warn: p.get('warn') || '',
        volume: num(p.get('vol')), strengthClass: p.get('strength'),
        exposureClasses: (p.get('exp') || '').split(',').filter(Boolean),
        siebline: p.get('sieb'), consistencyClass: p.get('cons'), aggregateType: p.get('agg'),
        cementType: p.get('cem'), vorhaltemas: num(p.get('v')), admixtureType: p.get('adm') || 'none',
        airEntrainingPercent: num(p.get('lp')) || 0, flyAshPercent: num(p.get('fa')) || 0,
        silicaFumePercent: num(p.get('sf')) || 0, waterproofPercent: num(p.get('wu')) || 0
    };
}

/**
 * Fine-tune page. opts: extraCement, flyAsh, silica, bv, fm, lp, wu.
 * @param {object} r - { preset, volume, opts[], exposureClasses[], text, source, warn }
 */
export function fineTuneUrl(r) {
    const p = new URLSearchParams();
    p.set('src', r.source || 'describe');
    if (r.text) p.set('q', r.text);
    if (r.warn) p.set('warn', r.warn);
    if (r.preset) p.set('preset', r.preset);
    if (r.volume) p.set('vol', r.volume);
    if (r.opts?.length) p.set('opts', r.opts.join(','));
    if (r.exposureClasses?.length) p.set('exp', r.exposureClasses.join(','));
    return `fine-tune.html?${keepLang(p)}`;
}

export function readFineTune(search) {
    const p = new URLSearchParams(search);
    if (!p.has('src') || !p.has('preset')) return null;
    return {
        source: p.get('src'), text: p.get('q') || '', warn: p.get('warn') || '',
        preset: p.get('preset'), volume: num(p.get('vol')),
        opts: (p.get('opts') || '').split(',').filter(Boolean),
        exposureClasses: (p.get('exp') || '').split(',').filter(Boolean)
    };
}

/** UHPC / fine mortar page. @param {object} r - { preset, volume, text, source } */
export function uhpcUrl(r) {
    const p = new URLSearchParams();
    p.set('src', r.source || 'describe');
    if (r.text) p.set('q', r.text);
    if (r.preset) p.set('preset', r.preset);
    if (r.volume) p.set('vol', r.volume);
    return `uhpc.html?${keepLang(p)}`;
}

export function readUhpc(search) {
    const p = new URLSearchParams(search);
    if (!p.has('src') || !p.has('preset')) return null;
    return { source: p.get('src'), text: p.get('q') || '', preset: p.get('preset'), volume: num(p.get('vol')) };
}

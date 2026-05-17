// uhpc.js — DOM glue for the UHPC scaler page.
//
// Pure logic lives in js/lib/uhpc-engine.js and js/lib/uhpc-presets.js;
// this file only wires inputs to outputs and renders.

import {
    UHPC_PRESETS,
    getUhpcPreset,
} from './lib/uhpc-presets.js';
import {
    computeUhpcRecipe,
    evaluatePlausibility,
} from './lib/uhpc-engine.js';
import { fmt, fmtQty, parseDecimal } from './lib/format.js';
import { i18n } from './lib/i18n.js';

// ── DOM lookups ────────────────────────────────────────────────────────

const els = {
    presetSelect:  document.getElementById('uhpcPreset'),
    sourcePanel:   document.getElementById('uhpcSource'),
    sourceBody:    document.getElementById('uhpcSourceBody'),
    volumeInput:   document.getElementById('uhpcVolume'),
    resultBody:    document.getElementById('uhpcResultBody'),
    chips:         document.getElementById('uhpcChips'),
    steps:         document.getElementById('uhpcSteps'),
};

// ── Initial render ─────────────────────────────────────────────────────

// Sort the dropdown ascending by the realistic-DIY 28-d strength so users
// see "easy starter → extreme" rather than catalog/source order.
//
// Priority: airCuredFckMpa  (Kassel presets — derived from the source's
//                            water-cured value minus an air-curing penalty)
//        →  claimedFckMpa   (raw source value when no airCured is set)
//        →  estimatedFckMpa (DIY presets — Walzkurven-based)
function effective28dStrength(preset) {
    return preset.airCuredFckMpa
        ?? preset.claimedFckMpa
        ?? preset.estimatedFckMpa
        ?? 0;
}

// Engineering-derived values (airCured, estimated) get a "ca." prefix;
// raw source measurements without further derivation render bare.
function strengthPrefix(preset) {
    if (preset.airCuredFckMpa)  return `ca. ${fmt(preset.airCuredFckMpa, 0)} N/mm²`;
    if (preset.claimedFckMpa)   return `${fmt(preset.claimedFckMpa, 0)} N/mm²`;
    if (preset.estimatedFckMpa) return `ca. ${fmt(preset.estimatedFckMpa, 0)} N/mm²`;
    return '–';
}

function populatePresetDropdown() {
    const sorted = [...UHPC_PRESETS].sort(
        (a, b) => effective28dStrength(a) - effective28dStrength(b)
    );
    for (const p of sorted) {
        const option = document.createElement('option');
        option.value = p.key;
        option.textContent = `${strengthPrefix(p)} — ${p.label}`;
        els.presetSelect.appendChild(option);
    }
}

function readVolumeM3() {
    const v = parseDecimal(els.volumeInput.value);
    return isNaN(v) || v <= 0 ? 1 : v;  // default fallback matches the input placeholder
}

function currentPreset() {
    return getUhpcPreset(els.presetSelect.value) || UHPC_PRESETS[0];
}

// ── Renderers ──────────────────────────────────────────────────────────

function renderSource(preset) {
    const { source, batch, claimedFckMpa, airCuredFckMpa, estimatedFckMpa } = preset;
    // Display priority for the source panel:
    //   - both airCured + claimed: show both (DIY estimate first, then
    //     verbatim source value as the "+water curing" upgrade)
    //   - claimed only: source-stated value verbatim
    //   - estimated only: Walzkurven estimate flagged as "ca."
    let fckRow;
    if (airCuredFckMpa && claimedFckMpa) {
        const bonusPct = Math.round((claimedFckMpa - airCuredFckMpa) / airCuredFckMpa * 100);
        fckRow = `<dt>${i18n.t('uhpc.source.str')}</dt>` +
                 `<dd>ca. ${fmt(airCuredFckMpa, 0)} N/mm² <em>(${i18n.t('uhpc.source.strength.app')})</em>` +
                 `<br>${fmt(claimedFckMpa, 0)} N/mm² <em>(${i18n.t('uhpc.source.strength.meas')}, +${bonusPct} %)</em></dd>`;
    } else if (claimedFckMpa) {
        fckRow = `<dt>${i18n.t('uhpc.source.str')}</dt>` +
                 `<dd>${fmt(claimedFckMpa, 0)} N/mm² <em>(${i18n.t('uhpc.source.strength.meas')})</em></dd>`;
    } else if (estimatedFckMpa) {
        fckRow = `<dt>${i18n.t('uhpc.source.str')}</dt>` +
                 `<dd>ca. ${fmt(estimatedFckMpa, 0)} N/mm² <em>(${i18n.t('uhpc.source.strength.est')})</em></dd>`;
    } else {
        fckRow = `<dt>${i18n.t('uhpc.source.str')}</dt><dd>${i18n.t('uhpc.source.strength.none')}</dd>`;
    }
    // Build a verbatim summary of the source's batch — zero-mass components
    // are omitted so the line stays focused on what's actually in the recipe.
    const recipeParts = [
        [batch.cementKg,           'kg', i18n.t('mixdesign.zement')],
        [batch.sandKg,             'kg', i18n.t('mixdesign.sand')],
        [batch.microsilicaKg,      'kg', i18n.t('mixdesign.microsilica')],
        [batch.quartzPowderKg,     'kg', i18n.t('mixdesign.quartz')],
        [batch.finesKg,            'kg', i18n.t('mixdesign.fines')],
        [batch.waterL,             'l',  i18n.t('mixdesign.water')],
        [batch.superplasticizerMl, 'ml', i18n.t('mixdesign.pce')],
    ]
        .filter(([m]) => m > 0)
        .map(([m, unit, name]) => `${fmt(m, m < 10 ? 1 : 0)} ${unit} ${name}`)
        .join(', ');

    els.sourceBody.innerHTML = `
        <dl>
            <dt>${i18n.t('uhpc.source.title')}</dt>      <dd>${escapeHtml(source.title)}</dd>
            <dt>${i18n.t('uhpc.source.author')}</dt>   <dd>${escapeHtml(source.author || '–')}</dd>
            <dt>${i18n.t('uhpc.source.link')}</dt>       <dd><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a></dd>
            <dt>${i18n.t('uhpc.source.checked')}</dt> <dd>${escapeHtml(source.retrieved || '–')}</dd>
            ${fckRow}
        </dl>
        <p style="margin-top:10px;color:var(--text-secondary)">
            Originalrezept: ${recipeParts}.
        </p>
    `;
}

function renderRecipeTable(preset, recipe) {
    const cementKg = recipe.cementKg;
    const pctOfCement = (kg) => cementKg > 0
        ? `${fmt(kg / cementKg * 100, 0)} %`
        : '–';

    // Each row: [name, mass, unit, magnitudeForFiltering, pctMass, hint].
    // Rows whose magnitude is zero are filtered out so a recipe without
    // (e.g.) Quarzmehl does not render an empty "0,00 kg" row.
    const rows = [
        ['🧱 ' + i18n.t('uhpc.row.cement'),          recipe.cementKg,         'kg', recipe.cementKg,         recipe.cementKg,                                              i18n.t('uhpc.row.cement.note')],
        ['🏖️ ' + i18n.t('uhpc.row.sand'),            recipe.sandKg,           'kg', recipe.sandKg,           recipe.sandKg,                                                i18n.t('uhpc.row.sand.note')],
        ['🧪 ' + i18n.t('uhpc.row.microsilica'),     recipe.microsilicaKg,    'kg', recipe.microsilicaKg,    recipe.microsilicaKg,                                         i18n.t('uhpc.row.microsilica.note')],
        ['💎 ' + i18n.t('uhpc.row.quartz'),          recipe.quartzPowderKg,   'kg', recipe.quartzPowderKg,   recipe.quartzPowderKg,                                        i18n.t('uhpc.row.quartz.note')],
        ['🌫️ ' + i18n.t('uhpc.row.fines'),           recipe.finesKg,          'kg', recipe.finesKg,          recipe.finesKg,                                               i18n.t('uhpc.row.fines.note')],
        ['💧 ' + i18n.t('uhpc.row.water'),           recipe.waterL,           'l',  recipe.waterL,           recipe.waterL,                                                i18n.t('uhpc.row.water.note')],
        ['🌊 ' + i18n.t('uhpc.row.pce'),             recipe.superplasticizerL,'l',  recipe.superplasticizerL, recipe.superplasticizerL * preset.densities.superplasticizer, i18n.t('uhpc.row.pce.note')],
    ];

    els.resultBody.innerHTML = rows
        .filter(r => r[3] > 0)
        .map(([name, value, unit, , pctMass, hint]) =>
            `<tr><td>${name}</td><td>${fmtQty(value, unit)}</td><td>${pctOfCement(pctMass)}</td><td>${hint}</td></tr>`
        )
        .join('');
}

function renderChips(checks) {
    const chip = (c) => {
        const valueText = c.unit
            ? `${fmt(c.value, decimalsForChip(c.id))} ${c.unit}`
            : fmt(c.value, 2);
        return `
            <div class="plausibility-chip level-${c.level}" role="status">
                <span class="chip-head">
                    <span>${escapeHtml(c.label)}</span>
                    <span>${valueText}</span>
                </span>
                <span class="chip-msg">${escapeHtml(c.message)}</span>
            </div>
        `;
    };
    els.chips.innerHTML = checks.map(chip).join('');
}

function decimalsForChip(id) {
    if (id === 'wb')      return 2;   // 0.30
    if (id === 'pce')     return 1;   // 1.5 %
    if (id === 'density') return 0;   // 2400 kg/m³
    return 1;
}

function renderSteps(preset, recipe) {
    // Each preset carries its own mixing instructions in preset.mixingSteps
    // because the order varies between sources (e.g. one author dissolves
    // PCE in all the water, another in only part of it). We substitute
    // {placeholder} tokens with the user's scaled batch quantities so the
    // text always reflects the current target volume.
    const vars = {
        cementKg:          fmtQty(recipe.cementKg,          'kg'),
        sandKg:            fmtQty(recipe.sandKg,            'kg'),
        quartzPowderKg:    fmtQty(recipe.quartzPowderKg,    'kg'),
        finesKg:           fmtQty(recipe.finesKg,           'kg'),
        microsilicaKg:     fmtQty(recipe.microsilicaKg,     'kg'),
        waterL:            fmtQty(recipe.waterL,            'l'),
        superplasticizerL: fmtQty(recipe.superplasticizerL, 'l'),
    };
    const substitute = (template) =>
        template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');

    els.steps.innerHTML = preset.mixingSteps
        .map(step => `<li>${substitute(step)}</li>`)
        .join('');
}

// ── HTML escaping (defence in depth — preset data is trusted, but we
//    surface URLs and titles, so escape on output anyway) ──────────────

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
}

function escapeAttr(s) {
    return escapeHtml(s);
}

// ── Recompute on every input change ────────────────────────────────────

function update() {
    const preset = currentPreset();
    const volM3  = readVolumeM3();
    const recipe = computeUhpcRecipe(preset, volM3);
    const checks = evaluatePlausibility(recipe);

    renderSource(preset);
    renderRecipeTable(preset, recipe);
    renderChips(checks);
    renderSteps(preset, recipe);
}

// ── Wire-up ────────────────────────────────────────────────────────────

function rebuildDropdown() {
    const sorted = [...UHPC_PRESETS].sort(
        (a, b) => effective28dStrength(a) - effective28dStrength(b)
    );
    els.presetSelect.innerHTML = '';
    for (const p of sorted) {
        const option = document.createElement('option');
        option.value = p.key;
        option.textContent = `${strengthPrefix(p)} — ${p.label}`;
        els.presetSelect.appendChild(option);
    }
}

populatePresetDropdown();
els.presetSelect.value = UHPC_PRESETS[0].key;
els.presetSelect.addEventListener('change', update);
els.volumeInput.addEventListener('input', update);
els.volumeInput.addEventListener('change', update);
update();

i18n.patchDom();
document.addEventListener('languagechange', () => {
    i18n.patchDom();
    update();
});

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

function populatePresetDropdown() {
    for (const p of UHPC_PRESETS) {
        const option = document.createElement('option');
        option.value = p.key;
        option.textContent = p.label;
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
    const { source, batch, claimedFckMpa } = preset;
    const fckRow = claimedFckMpa
        ? `<dt>Festigkeit (Quelle)</dt><dd>${fmt(claimedFckMpa, 0)} N/mm²</dd>`
        : '<dt>Festigkeit (Quelle)</dt><dd>nicht angegeben</dd>';
    els.sourceBody.innerHTML = `
        <dl>
            <dt>Titel</dt>      <dd>${escapeHtml(source.title)}</dd>
            <dt>Autor/in</dt>   <dd>${escapeHtml(source.author || '–')}</dd>
            <dt>Link</dt>       <dd><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a></dd>
            <dt>Geprüft am</dt> <dd>${escapeHtml(source.retrieved || '–')}</dd>
            ${fckRow}
        </dl>
        <p style="margin-top:10px;color:var(--text-secondary)">
            Originalrezept (eine Charge):
            ${fmt(batch.cementKg, 0)} kg Zement,
            ${fmt(batch.sandKg, 0)} kg Sand 0/2,
            ${fmt(batch.quartzPowderKg, 0)} kg Quarzmehl,
            ${fmt(batch.finesKg, 1)} kg Feinzuschläge,
            ${fmt(batch.waterL, 1)} l Wasser,
            ${fmt(batch.superplasticizerMl, 0)} ml PCE-Fließmittel.
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
        ['🧱 Zement (CEM I)',          recipe.cementKg,        'kg', recipe.cementKg,        recipe.cementKg,                                              'Bindemittel; Portlandzement'],
        ['🏖️ Sand 0/2 mm',             recipe.sandKg,          'kg', recipe.sandKg,          recipe.sandKg,                                                'Hauptzuschlag, gewaschen'],
        ['💎 Quarzmehl 0,063–0,25 mm', recipe.quartzPowderKg,  'kg', recipe.quartzPowderKg,  recipe.quartzPowderKg,                                        'Microfiller — wirkt puzzolanisch'],
        ['🌫️ Feinzuschläge < 63 µm',   recipe.finesKg,         'kg', recipe.finesKg,         recipe.finesKg,                                               'Schließt Kornpackung dichter'],
        ['💧 Wasser',                  recipe.waterL,          'l',  recipe.waterL,          recipe.waterL,                                                'Möglichst kalt (verzögert Abbinden)'],
        ['🌊 PCE-Fließmittel',         recipe.superplasticizerL,'l', recipe.superplasticizerL, recipe.superplasticizerL * preset.densities.superplasticizer, 'Erst im Wasser auflösen'],
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

populatePresetDropdown();
els.presetSelect.value = UHPC_PRESETS[0].key;
els.presetSelect.addEventListener('change', update);
els.volumeInput.addEventListener('input', update);
els.volumeInput.addEventListener('change', update);
update();

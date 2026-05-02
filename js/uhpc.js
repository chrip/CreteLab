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
    return isNaN(v) || v <= 0 ? 0.03 : v;  // default fallback matches the input placeholder
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

    const rows = [
        ['🧱 Zement (CEM I)',                     fmtQty(recipe.cementKg,         'kg'), '100 %',                     'Bindemittel; Portlandzement'],
        ['🏖️ Sand 0/2 mm',                        fmtQty(recipe.sandKg,           'kg'), pctOfCement(recipe.sandKg),  'Hauptzuschlag, gewaschen'],
        ['💎 Quarzmehl 0,063–0,25 mm',            fmtQty(recipe.quartzPowderKg,   'kg'), pctOfCement(recipe.quartzPowderKg), 'Microfiller — wirkt puzzolanisch'],
        ['🌫️ Feinzuschläge < 63 µm',              fmtQty(recipe.finesKg,          'kg'), pctOfCement(recipe.finesKg), 'Schließt Kornpackung dichter'],
        ['💧 Wasser',                             fmtQty(recipe.waterL,           'l'),  pctOfCement(recipe.waterL),  'Möglichst kalt (verzögert Abbinden)'],
        ['🌊 PCE-Fließmittel',                    fmtQty(recipe.superplasticizerL,'l'),  pctOfCement(recipe.superplasticizerL * preset.densities.superplasticizer), 'Erst im Wasser auflösen'],
    ];

    els.resultBody.innerHTML = rows.map(r =>
        `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`
    ).join('');
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
    const sourceSteps = preset.notes;
    // Concrete-mass references in the steps adapt to the user's batch size.
    const items = [
        `<strong>Trockenmischung vormischen</strong> (${fmtQty(recipe.cementKg, 'kg')} Zement
          + ${fmtQty(recipe.sandKg, 'kg')} Sand
          + ${fmtQty(recipe.quartzPowderKg, 'kg')} Quarzmehl
          + ${fmtQty(recipe.finesKg, 'kg')} Feinzuschläge) — gut homogenisieren.`,
        `<strong>PCE-Fließmittel im Anmachwasser auflösen</strong>
          (${fmtQty(recipe.superplasticizerL, 'l')} PCE in ${fmtQty(recipe.waterL, 'l')} Wasser einrühren).`,
        `<strong>Wasser-PCE-Mischung langsam zur Trockenmischung geben</strong> und
          mindestens 5 Minuten kräftig mischen — Fließverhalten entwickelt sich verzögert.`,
        `<strong>In geölte Form gießen und vibrieren</strong> oder leicht klopfen,
          bis keine Luftblasen mehr aufsteigen.`,
        `<strong>Mindestens 24 h abdecken / feucht halten</strong>, vorsichtig
          ausschalen, mehrere Tage nachhärten lassen.`,
    ];

    els.steps.innerHTML = items.map(s => `<li>${s}</li>`).join('');

    // Source notes appear separately so the user can see the original
    // author's mixing remarks verbatim.
    if (sourceSteps && sourceSteps.length) {
        const sourceList = document.createElement('details');
        sourceList.className = 'source-panel';
        sourceList.innerHTML =
            `<summary>Hinweise des Original-Autors anzeigen</summary>` +
            `<ul style="padding-left:1.4em;margin-top:8px">` +
            sourceSteps.map(n => `<li>${escapeHtml(n)}</li>`).join('') +
            `</ul>`;
        els.steps.parentElement.appendChild(sourceList);
        // Replace any previously appended source-notes panel.
        const previous = els.steps.parentElement.querySelectorAll('.source-panel');
        for (let i = 0; i < previous.length - 1; i++) previous[i].remove();
    }
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

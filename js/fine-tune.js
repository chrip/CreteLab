// fine-tune.js — Additive helper for hobby DIY users
// Shows what to buy and add on top of a base concrete recipe.
// Input: URL params from main calculator (or built-in presets).
// Output: absolute quantities per selected option (total for their volume).

import {
    applyAdmixtureWaterReduction,
    calculateStrengthReduction,
    getAdmixtureDosage,
    SUPPLEMENTARY_MATERIALS,
} from './lib/additives.js';
import { calculateStrengthFromWalzkurven, STRENGTH_CLASSES } from './lib/strength.js';

const PRESETS = [
    { value: 'c20', label: 'Einfach – C20/25 (Fundamente, Pflasterbett)',     z: 280, w: 195, g: 1820, klasse: 'C20/25' },
    { value: 'c25', label: 'Standard – C25/30 (Wände, Bodenplatten)',         z: 300, w: 190, g: 1800, klasse: 'C25/30' },
    { value: 'c30', label: 'Stark – C30/37 (Außenbereiche, Stützen)',         z: 340, w: 185, g: 1740, klasse: 'C30/37' },
    { value: 'c40', label: 'Sehr stark – C40/50 (Industrieböden, Garagen)',   z: 400, w: 175, g: 1660, klasse: 'C40/50' },
];

// Try sessionStorage first (survives server-side URL rewriting),
// fall back to URL params for direct links / bookmarks.
const _stored = (() => {
    try { return JSON.parse(sessionStorage.getItem('creteLab_finetune')); } catch { return null; }
})();
const _params = new URLSearchParams(location.search);
const _urlRecipe = _params.has('z') ? {
    v:      parseFloat(_params.get('v'))  || 1,
    z:      parseFloat(_params.get('z'))  || 300,
    w:      parseFloat(_params.get('w'))  || 190,
    g:      parseFloat(_params.get('g'))  || 1800,
    klasse: _params.get('klasse') || '',
    zement: _params.get('zement') || '',
} : null;

const customRecipe = _stored || _urlRecipe;

let cementPerM3    = customRecipe ? customRecipe.z : PRESETS[1].z;
let waterPerM3     = customRecipe ? customRecipe.w : PRESETS[1].w;
let aggregatePerM3 = customRecipe ? customRecipe.g : PRESETS[1].g;

// --- Formatting helpers ---
function fmt(n, decimals = 0) {
    return n.toLocaleString('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function fmtQty(n, unit) {
    if (unit === 'kg' && n < 1)   return `${fmt(n * 1000)} g`;
    if (unit === 'l'  && n < 0.1) return `${fmt(n * 1000)} ml`;
    return `${fmt(n, n < 10 ? 1 : 0)} ${unit}`;
}

function getVolume() {
    const raw = document.getElementById('tuneVolume').value.replace(',', '.');
    const v = parseFloat(raw);
    return isNaN(v) || v <= 0 ? 1 : v;
}

// --- Build dropdown (always visible) ---
document.getElementById('mixSelector').style.display = 'block';

const sel = document.getElementById('mixPreset');
const infoBox = document.getElementById('baseRecipeInfo');

if (customRecipe) {
    // Custom entry at the top derived from recipe data
    const customLabel = customRecipe.klasse
        ? `Aus dem Betonrechner – ${customRecipe.klasse}`
        : 'Aus dem Betonrechner (individuelles Rezept)';
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = customLabel;
    sel.appendChild(customOpt);

    // Visual divider
    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '──── Standardmischungen ────';
    sel.appendChild(sep);

    // Pre-fill info box content (shown only when "custom" is selected)
    const parts = [
        `Zement: ${fmt(customRecipe.z)} kg/m³`,
        `Wasser: ${fmt(customRecipe.w)} l/m³`,
        `Körnung: ${fmt(customRecipe.g)} kg/m³`,
        customRecipe.zement || '',
    ].filter(Boolean);
    infoBox.innerHTML = parts.join(' &nbsp;·&nbsp; ');

    // Pre-fill volume
    const vol = customRecipe.v || 0;
    if (vol > 0) document.getElementById('tuneVolume').value = fmt(vol, vol % 1 !== 0 ? 2 : 0);
}

PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.value;
    opt.textContent = p.label;
    sel.appendChild(opt);
});

// Select the right entry and sync state
function applySelection() {
    const val = sel.value;
    if (val === 'custom' && customRecipe) {
        cementPerM3    = customRecipe.z;
        waterPerM3     = customRecipe.w;
        aggregatePerM3 = customRecipe.g;
        infoBox.style.display = 'block';
    } else {
        const preset = PRESETS.find(p => p.value === val);
        if (preset) {
            cementPerM3    = preset.z;
            waterPerM3     = preset.w;
            aggregatePerM3 = preset.g;
        }
        infoBox.style.display = 'none';
    }
    update();
}

// Pre-check additives that were already active in the main recipe.
// Must happen before applySelection() so the first update() sees the right state.
if (customRecipe) {
    if (customRecipe.useFlyAsh) document.getElementById('useFlyAsh').checked = true;
    if (customRecipe.useSilica) document.getElementById('useSilica').checked = true;
    if (customRecipe.useBV)     document.getElementById('useBV').checked     = true;
    if (customRecipe.useFM)     document.getElementById('useFM').checked     = true;
    if (customRecipe.useLP)     document.getElementById('useLP').checked     = true;
}

// Initial selection
sel.value = customRecipe ? 'custom' : PRESETS[1].value;
sel.addEventListener('change', applySelection);
applySelection();

// --- Strength estimation helpers ---
function getBaseKlasse() {
    if (sel.value === 'custom' && customRecipe) return customRecipe.klasse || '';
    return PRESETS.find(p => p.value === sel.value)?.klasse || '';
}

// Walzkurven for CEM I 42.5N via shared lib. SCM k-factors from SUPPLEMENTARY_MATERIALS.
// Returns estimated f_ck_cube after applying selected additions.
function computeTunedFck(useExtraCement, useFlyAsh, useSilica, useBV, useFM, useLP) {
    let z_eff = cementPerM3;
    let w_eff = waterPerM3;

    if (useExtraCement) z_eff += cementPerM3 * 0.10;
    if (useFlyAsh)      z_eff += cementPerM3 * 0.15 * SUPPLEMENTARY_MATERIALS.Flugasche.k_f;
    if (useSilica)      z_eff += cementPerM3 * 0.08 * SUPPLEMENTARY_MATERIALS.Silikastaub.k_s;
    if (useBV)          w_eff  = applyAdmixtureWaterReduction(w_eff, 'BV');
    if (useFM)          w_eff  = applyAdmixtureWaterReduction(w_eff, 'FM');

    const fCm = calculateStrengthFromWalzkurven(w_eff / z_eff, '42.5');
    const fCmFinal = useLP ? calculateStrengthReduction(fCm, 4) : fCm;
    return Math.max(8, Math.round(fCmFinal - 8));
}

function fckToClass(fck) {
    const sorted = Object.entries(STRENGTH_CLASSES)
        .sort((a, b) => b[1].f_ck_cube - a[1].f_ck_cube);
    return (sorted.find(([, v]) => fck >= v.f_ck_cube) ?? sorted[sorted.length - 1])[0];
}

// --- Core update: recompute quantities and refresh DOM ---
function update() {
    const vol = getVolume();
    const items = [];

    function setCard(cardId, checked) {
        document.getElementById(cardId).classList.toggle('selected', checked);
    }

    function setResult(resultId, checked, html) {
        const el = document.getElementById(resultId);
        el.style.display = checked ? 'block' : 'none';
        if (checked) el.innerHTML = html;
    }

    // Mixing order: dry additions first (cement, fly ash, silica), then wet (BV, LP in water).
    // Each item has only a mix instruction — no buy steps.

    // Extra cement – 10 % more (dry)
    const useExtraCement = document.getElementById('useExtraCement').checked;
    setCard('cardCement', useExtraCement);
    const extraCementTotal = Math.round(cementPerM3 * 0.10) * vol;
    setResult('resExtraCement', useExtraCement,
        `Hinzufügen: <strong>${fmtQty(extraCementTotal, 'kg')} Zement extra</strong>`);
    if (useExtraCement) items.push(
        `${fmtQty(extraCementTotal, 'kg')} Zement zusätzlich trocken zur Gesteinskörnung geben`
    );

    // Flugasche – 15 % of cement (dry)
    const useFlyAsh = document.getElementById('useFlyAsh').checked;
    setCard('cardFlyAsh', useFlyAsh);
    const flyAshTotal = Math.round(cementPerM3 * 0.15) * vol;
    setResult('resFlyAsh', useFlyAsh,
        `Hinzufügen: <strong>${fmtQty(flyAshTotal, 'kg')} Flugasche</strong>`);
    if (useFlyAsh) items.push(
        `${fmtQty(flyAshTotal, 'kg')} Flugasche trocken mit Zement und Gesteinskörnung mischen`
    );

    // Silikastaub – 8 % of cement (dry)
    const useSilica = document.getElementById('useSilica').checked;
    setCard('cardSilica', useSilica);
    const silicaTotal = Math.round(cementPerM3 * 0.08) * vol;
    setResult('resSilica', useSilica,
        `Hinzufügen: <strong>${fmtQty(silicaTotal, 'kg')} Silikastaub</strong>`);
    if (useSilica) items.push(
        `${fmtQty(silicaTotal, 'kg')} Silikastaub trocken in den Trockenmix einmischen`
    );

    // Betonverflüssiger (into water)
    const useBV = document.getElementById('useBV').checked;
    setCard('cardBV', useBV);
    const bvTotal = getAdmixtureDosage('BV') * vol;
    setResult('resBV', useBV,
        `Hinzufügen: <strong>${fmtQty(bvTotal, 'l')} Betonverflüssiger</strong>`);
    if (useBV) items.push(
        `${fmtQty(bvTotal, 'l')} Betonverflüssiger ins Anmachwasser einrühren, dann langsam zugeben`
    );

    // Fließmittel (into water)
    const useFM = document.getElementById('useFM').checked;
    setCard('cardFM', useFM);
    const fmTotal = getAdmixtureDosage('FM') * vol;
    setResult('resFM', useFM,
        `Hinzufügen: <strong>${fmtQty(fmTotal, 'l')} Fließmittel</strong> (Produktdosierung prüfen)`);
    if (useFM) items.push(
        `${fmtQty(fmTotal, 'l')} Fließmittel ins Anmachwasser einrühren, dann langsam zugeben`
    );

    // Luftporenbildner (into water)
    const useLP = document.getElementById('useLP').checked;
    setCard('cardLP', useLP);
    const lpTotal = getAdmixtureDosage('LP') * vol;
    setResult('resLP', useLP,
        `Hinzufügen: <strong>${fmtQty(lpTotal, 'l')} Luftporenbildner</strong>`);
    if (useLP) items.push(
        `${fmtQty(lpTotal, 'l')} Luftporenbildner ins Anmachwasser mischen, dann zugeben`
    );

    // Combination warning: BV and FM are mutually exclusive plasticizer types
    const plasticWarning = document.getElementById('plasticWarning');
    if (useBV && useFM) {
        plasticWarning.style.display = 'block';
        plasticWarning.textContent = '⚠️ Betonverflüssiger (BV) und Fließmittel (FM) nicht zusammen verwenden – bitte nur eines der beiden auswählen.';
    } else {
        plasticWarning.style.display = 'none';
    }

    // Combination warning: LP (frost) + Silikastaub not recommended together
    const combineWarning = document.getElementById('combineWarning');
    if (useLP && useSilica) {
        combineWarning.style.display = 'block';
        combineWarning.textContent = '⚠️ Silikastaub ist bei frostbeanspruchtem Beton (LP-Einsatz) nicht empfohlen. Bitte nur einen der beiden verwenden.';
    } else {
        combineWarning.style.display = 'none';
    }

    // Strength result — always visible, updates with each selection change
    const baseKlasse  = getBaseKlasse();
    const tunedFck    = computeTunedFck(useExtraCement, useFlyAsh, useSilica, useBV, useFM, useLP);
    const tunedKlasse = fckToClass(tunedFck);
    const anyChecked  = useExtraCement || useFlyAsh || useSilica || useBV || useFM || useLP;
    const resultEl    = document.getElementById('strengthResult');
    if (anyChecked) {
        const arrow = baseKlasse && baseKlasse !== tunedKlasse ? ` &nbsp;→&nbsp; <strong>${tunedKlasse}</strong>` : '';
        resultEl.innerHTML =
            `<strong>Ausgangsbeton:</strong> ${baseKlasse || '–'}${arrow}` +
            ` &nbsp;·&nbsp; <strong>Ergebnis: ca. ${tunedFck} N/mm²</strong>`;
    } else {
        resultEl.innerHTML = `<strong>Ausgangsbeton:</strong> ${baseKlasse || '–'}`;
    }

    // Step-by-step mixing instructions only
    const shoppingList  = document.getElementById('shoppingList');
    const shoppingItems = document.getElementById('shoppingItems');
    if (items.length > 0) {
        // Water is always the last step; note dissolved additives if present
        let waterTotal = Math.round(waterPerM3 * vol);
        if (useBV) waterTotal = applyAdmixtureWaterReduction(waterTotal, 'BV');
        if (useFM) waterTotal = applyAdmixtureWaterReduction(waterTotal, 'FM');
        const waterNote = (useBV || useFM || useLP) ? ' (mit eingerührten Zusatzmitteln)' : '';
        items.push(`${fmtQty(waterTotal, 'l')} Wasser${waterNote} zugeben und gründlich mischen`);

        shoppingList.style.display = 'block';
        shoppingItems.innerHTML = items.map(step => `<li>${step}</li>`).join('');
    } else {
        shoppingList.style.display = 'none';
    }
}

// Wire events — both input (keystrokes) and change (Enter / tab / paste)
['useExtraCement', 'useFlyAsh', 'useBV', 'useFM', 'useSilica', 'useLP'].forEach(id => {
    document.getElementById(id).addEventListener('change', update);
});
const volInput = document.getElementById('tuneVolume');
volInput.addEventListener('input', update);
volInput.addEventListener('change', update);

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
    if (unit === 'kg' && n < 1) return `${fmt(n * 1000)} g`;
    if (unit === 'l'  && n < 1) return `${fmt(n * 1000)} ml`;
    return `${fmt(n, 2)} ${unit}`;
}

function getVolume() {
    const raw = document.getElementById('tuneVolume').value.replace(',', '.');
    const v = parseFloat(raw);
    return isNaN(v) || v <= 0 ? 1 : v;
}

// --- Build dropdown (always visible) ---
document.getElementById('mixSelector').classList.remove('hidden');

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

// IDs that can be pre-applied (from the main recipe).  Extra cement has no equivalent.
const PRE_APPLIED_IDS = ['useFlyAsh', 'useSilica', 'useBV', 'useFM', 'useLP'];

// Returns true when this additive was already active in the main-form recipe AND
// the user is currently viewing the custom preset (not a standard one).
function isPreApplied(id) {
    return sel.value === 'custom' && !!(customRecipe?.[id]);
}

// Lock or unlock additives that were part of the original recipe.
// Called on every preset switch so switching to a standard preset frees all checkboxes.
function syncPreAppliedState() {
    const onCustom = sel.value === 'custom' && !!customRecipe;

    // Reset every potentially-locked checkbox so switching back to a standard
    // preset frees both pre-applied additives and any partner-locks below.
    PRE_APPLIED_IDS.forEach(id => { document.getElementById(id).disabled = false; });

    PRE_APPLIED_IDS.forEach(id => {
        if (!customRecipe?.[id]) return;
        const el = document.getElementById(id);
        el.checked  = onCustom;  // re-check when returning to custom preset
        el.disabled = onCustom;
    });

    // BV ⊕ FM: a pre-applied plasticizer also locks out its mutually-exclusive
    // partner so the user can't add the wrong one on top.
    if (onCustom && customRecipe?.useBV) {
        const fm = document.getElementById('useFM');
        fm.checked  = false;
        fm.disabled = true;
    }
    if (onCustom && customRecipe?.useFM) {
        const bv = document.getElementById('useBV');
        bv.checked  = false;
        bv.disabled = true;
    }
}

// Select the right entry and sync state
function applySelection() {
    const val = sel.value;
    if (val === 'custom' && customRecipe) {
        cementPerM3    = customRecipe.z;
        waterPerM3     = customRecipe.w;
        aggregatePerM3 = customRecipe.g;
        infoBox.classList.remove('hidden');
    } else {
        const preset = PRESETS.find(p => p.value === val);
        if (preset) {
            cementPerM3    = preset.z;
            waterPerM3     = preset.w;
            aggregatePerM3 = preset.g;
        }
        infoBox.classList.add('hidden');
    }
    syncPreAppliedState();
    update();
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

    const ALREADY_IN    = '<span class="already-in-note">✓ Bereits im Rezept enthalten – wird in der Festigkeitsschätzung berücksichtigt</span>';
    const LOCKED_BY_FM  = '<span class="locked-out-note">✕ Fließmittel ist bereits im Rezept enthalten – Betonverflüssiger nicht zusätzlich verwenden (gegenseitig ausschließend).</span>';
    const LOCKED_BY_BV  = '<span class="locked-out-note">✕ Betonverflüssiger ist bereits im Rezept enthalten – Fließmittel nicht zusätzlich verwenden (gegenseitig ausschließend).</span>';

    function setCard(cardId, checked, pre, lockedOut) {
        const card = document.getElementById(cardId);
        card.classList.toggle('selected',    checked && !pre && !lockedOut);
        card.classList.toggle('pre-applied', !!pre);
        card.classList.toggle('locked-out',  !!lockedOut);
    }

    function setResult(resultId, visible, html, pre, lockedOut) {
        const el = document.getElementById(resultId);
        let cls = 'option-result';
        if (pre)        cls += ' already-in';
        if (lockedOut)  cls += ' locked-out';
        if (!visible)   cls += ' hidden';
        el.className = cls;
        if (visible) el.innerHTML = html;
    }

    // Mixing order: dry additions first (cement, fly ash, silica), then wet (BV, FM, LP in water).
    // Each item has only a mix instruction — no buy steps.
    // Pre-applied additives (from the main recipe) are shown as locked; no step is generated.

    // Extra cement – 10 % more (dry)
    const useExtraCement = document.getElementById('useExtraCement').checked;
    setCard('cardCement', useExtraCement, false);
    const extraCementTotal = Math.round(cementPerM3 * 0.10) * vol;
    setResult('resExtraCement', useExtraCement,
        `Hinzufügen: <strong>${fmtQty(extraCementTotal, 'kg')} Zement extra</strong>`);
    if (useExtraCement) items.push(
        `${fmtQty(extraCementTotal, 'kg')} Zement zusätzlich trocken zur Gesteinskörnung geben`
    );

    // Flugasche – 15 % of cement (dry)
    const useFlyAsh  = document.getElementById('useFlyAsh').checked;
    const flyAshPre  = isPreApplied('useFlyAsh');
    setCard('cardFlyAsh', useFlyAsh, flyAshPre);
    const flyAshTotal = Math.round(cementPerM3 * 0.15) * vol;
    setResult('resFlyAsh', useFlyAsh,
        flyAshPre ? ALREADY_IN : `Hinzufügen: <strong>${fmtQty(flyAshTotal, 'kg')} Flugasche</strong>`,
        flyAshPre);
    if (useFlyAsh && !flyAshPre) items.push(
        `${fmtQty(flyAshTotal, 'kg')} Flugasche trocken mit Zement und Gesteinskörnung mischen`
    );

    // Silikastaub – 8 % of cement (dry)
    const useSilica  = document.getElementById('useSilica').checked;
    const silicaPre  = isPreApplied('useSilica');
    setCard('cardSilica', useSilica, silicaPre);
    const silicaTotal = Math.round(cementPerM3 * 0.08) * vol;
    setResult('resSilica', useSilica,
        silicaPre ? ALREADY_IN : `Hinzufügen: <strong>${fmtQty(silicaTotal, 'kg')} Silikastaub</strong>`,
        silicaPre);
    if (useSilica && !silicaPre) items.push(
        `${fmtQty(silicaTotal, 'kg')} Silikastaub trocken in den Trockenmix einmischen`
    );

    // BV ⊕ FM mutual exclusion: when one is pre-applied, the other is locked out.
    const bvPre = isPreApplied('useBV');
    const fmPre = isPreApplied('useFM');
    const bvLockedOut = !bvPre && fmPre;
    const fmLockedOut = !fmPre && bvPre;

    // Betonverflüssiger (into water)
    const useBV  = document.getElementById('useBV').checked;
    setCard('cardBV', useBV, bvPre, bvLockedOut);
    const bvTotal = getAdmixtureDosage('BV') * vol;
    const bvVisible = useBV || bvLockedOut;
    const bvHtml = bvLockedOut ? LOCKED_BY_FM
        : bvPre ? ALREADY_IN
        : `Hinzufügen: <strong>${fmtQty(bvTotal, 'l')} Betonverflüssiger</strong>`;
    setResult('resBV', bvVisible, bvHtml, bvPre, bvLockedOut);
    if (useBV && !bvPre) items.push(
        `${fmtQty(bvTotal, 'l')} Betonverflüssiger ins Anmachwasser einrühren, dann langsam zugeben`
    );

    // Fließmittel (into water)
    const useFM  = document.getElementById('useFM').checked;
    setCard('cardFM', useFM, fmPre, fmLockedOut);
    const fmTotal = getAdmixtureDosage('FM') * vol;
    const fmVisible = useFM || fmLockedOut;
    const fmHtml = fmLockedOut ? LOCKED_BY_BV
        : fmPre ? ALREADY_IN
        : `Hinzufügen: <strong>${fmtQty(fmTotal, 'l')} Fließmittel</strong> (Produktdosierung prüfen)`;
    setResult('resFM', fmVisible, fmHtml, fmPre, fmLockedOut);
    if (useFM && !fmPre) items.push(
        `${fmtQty(fmTotal, 'l')} Fließmittel ins Anmachwasser einrühren, dann langsam zugeben`
    );

    // Luftporenbildner (into water)
    const useLP  = document.getElementById('useLP').checked;
    const lpPre  = isPreApplied('useLP');
    setCard('cardLP', useLP, lpPre);
    const lpTotal = getAdmixtureDosage('LP') * vol;
    setResult('resLP', useLP,
        lpPre ? ALREADY_IN : `Hinzufügen: <strong>${fmtQty(lpTotal, 'l')} Luftporenbildner</strong>`,
        lpPre);
    if (useLP && !lpPre) items.push(
        `${fmtQty(lpTotal, 'l')} Luftporenbildner ins Anmachwasser mischen, dann zugeben`
    );

    // Combination warning: LP (frost) + Silikastaub not recommended together
    const combineWarning = document.getElementById('combineWarning');
    if (useLP && useSilica) {
        combineWarning.classList.remove('hidden');
        combineWarning.textContent = '⚠️ Silikastaub ist bei frostbeanspruchtem Beton (LP-Einsatz) nicht empfohlen. Bitte nur einen der beiden verwenden.';
    } else {
        combineWarning.classList.add('hidden');
    }

    // Strength result — always visible, updates with each selection change
    // Pre-applied additives are already baked into the base klasse (the main form
    // designed the recipe with them in mind, including safety margins).  Only show
    // a recomputed strength when the user actively *adds* something on top —
    // otherwise the blunt Walzkurven inversion would downgrade the chosen class.
    const baseKlasse      = getBaseKlasse();
    const anyUserChecked  =
        useExtraCement ||
        (useFlyAsh && !flyAshPre) ||
        (useSilica  && !silicaPre) ||
        (useBV      && !bvPre) ||
        (useFM      && !fmPre) ||
        (useLP      && !lpPre);
    const resultEl = document.getElementById('strengthResult');
    if (anyUserChecked) {
        const tunedFck    = computeTunedFck(useExtraCement, useFlyAsh, useSilica, useBV, useFM, useLP);
        const tunedKlasse = fckToClass(tunedFck);
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
        // Water is always the last step; note dissolved additives if present.
        // Apply BV/FM reduction at per-m³ scale (where rounding is safe) and
        // multiply by volume last — otherwise small batches (e.g. 0.001 m³)
        // round to zero before fmtQty can pick the ml unit.
        let waterPerM3Adj = waterPerM3;
        if (useBV) waterPerM3Adj = applyAdmixtureWaterReduction(waterPerM3Adj, 'BV');
        if (useFM) waterPerM3Adj = applyAdmixtureWaterReduction(waterPerM3Adj, 'FM');
        const waterTotal = waterPerM3Adj * vol;
        const hasUserWetAdditives = (useBV && !bvPre) || (useFM && !fmPre) || (useLP && !lpPre);
        const waterNote = hasUserWetAdditives ? ' (mit eingerührten Zusatzmitteln)' : '';
        items.push(`${fmtQty(waterTotal, 'l')} Wasser${waterNote} zugeben und gründlich mischen`);

        shoppingList.classList.remove('hidden');
        shoppingItems.innerHTML = items.map(step => `<li>${step}</li>`).join('');
    } else {
        shoppingList.classList.add('hidden');
    }
}

// BV and FM are mutually exclusive plasticizer types — selecting one auto-clears the other.
function enforceBvFmXor(justChanged) {
    const other = justChanged === 'useBV' ? 'useFM' : 'useBV';
    const justEl = document.getElementById(justChanged);
    const otherEl = document.getElementById(other);
    if (justEl.checked && otherEl.checked && !otherEl.disabled) {
        otherEl.checked = false;
    }
}

// Wire events — both input (keystrokes) and change (Enter / tab / paste)
['useExtraCement', 'useFlyAsh', 'useBV', 'useFM', 'useSilica', 'useLP'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        if (id === 'useBV' || id === 'useFM') enforceBvFmXor(id);
        update();
    });
});
const volInput = document.getElementById('tuneVolume');
volInput.addEventListener('input', update);
volInput.addEventListener('change', update);

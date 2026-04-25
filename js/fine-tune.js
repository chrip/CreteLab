// fine-tune.js — Additive helper for hobby DIY users
// Shows what to buy and add on top of a base concrete recipe.
// Input: URL params from main calculator (or built-in presets).
// Output: absolute quantities per selected option (total for their volume).

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

// Initial selection
sel.value = customRecipe ? 'custom' : PRESETS[1].value;
sel.addEventListener('change', applySelection);
applySelection();

// --- Strength estimation helpers ---
function getBaseKlasse() {
    if (sel.value === 'custom' && customRecipe) return customRecipe.klasse || '';
    return PRESETS.find(p => p.value === sel.value)?.klasse || '';
}

// Simplified Walzkurven for CEM I 42.5N: f_cm ≈ 31 / sqrt(w/z), A=31 matches main app.
// Returns estimated f_ck_cube after applying selected additions.
function computeTunedFck(useExtraCement, useFlyAsh, useSilica, useBV, useLP) {
    let z_eff = cementPerM3;
    let w_eff = waterPerM3;

    if (useExtraCement) z_eff += cementPerM3 * 0.10;        // 10% more cement
    if (useFlyAsh)      z_eff += cementPerM3 * 0.15 * 0.4;  // k=0.4
    if (useSilica)      z_eff += cementPerM3 * 0.08 * 1.0;  // k=1.0
    if (useBV)          w_eff *= 0.93;                       // BV saves 7% water

    const fCm = 31 / Math.sqrt(w_eff / z_eff);
    let fCk = fCm - 8;        // subtract combined margin (vorhaltemas + sigma)
    if (useLP) fCk -= 14;     // 4% air × 3.5 N/mm² per %
    return Math.max(8, Math.round(fCk));
}

function fckToClass(fck) {
    if (fck >= 50) return 'C40/50';
    if (fck >= 45) return 'C35/45';
    if (fck >= 37) return 'C30/37';
    if (fck >= 30) return 'C25/30';
    if (fck >= 25) return 'C20/25';
    if (fck >= 20) return 'C16/20';
    if (fck >= 15) return 'C12/15';
    return 'C8/10';
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

    // Betonverflüssiger – 0.5 l/m³ (into water)
    const useBV = document.getElementById('useBV').checked;
    setCard('cardBV', useBV);
    const bvTotal = 0.5 * vol;
    setResult('resBV', useBV,
        `Hinzufügen: <strong>${fmtQty(bvTotal, 'l')} Betonverflüssiger</strong>`);
    if (useBV) items.push(
        `${fmtQty(bvTotal, 'l')} Betonverflüssiger ins Anmachwasser einrühren, dann langsam zugeben`
    );

    // Luftporenbildner – 0.2 l/m³ (into water)
    const useLP = document.getElementById('useLP').checked;
    setCard('cardLP', useLP);
    const lpTotal = 0.2 * vol;
    setResult('resLP', useLP,
        `Hinzufügen: <strong>${fmtQty(lpTotal, 'l')} Luftporenbildner</strong>`);
    if (useLP) items.push(
        `${fmtQty(lpTotal, 'l')} Luftporenbildner ins Anmachwasser mischen, dann zugeben`
    );

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
    const tunedFck    = computeTunedFck(useExtraCement, useFlyAsh, useSilica, useBV, useLP);
    const tunedKlasse = fckToClass(tunedFck);
    const anyChecked  = useExtraCement || useFlyAsh || useSilica || useBV || useLP;
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
        const waterTotal = Math.round(waterPerM3 * vol);
        const waterNote  = (useBV || useLP) ? ' (mit eingerührten Zusatzmitteln)' : '';
        items.push(`${fmtQty(waterTotal, 'l')} Wasser${waterNote} zugeben und gründlich mischen`);

        shoppingList.style.display = 'block';
        shoppingItems.innerHTML = items.map(step => `<li>${step}</li>`).join('');
    } else {
        shoppingList.style.display = 'none';
    }
}

// Wire events — both input (keystrokes) and change (Enter / tab / paste)
['useExtraCement', 'useFlyAsh', 'useBV', 'useSilica', 'useLP'].forEach(id => {
    document.getElementById(id).addEventListener('change', update);
});
const volInput = document.getElementById('tuneVolume');
volInput.addEventListener('input', update);
volInput.addEventListener('change', update);

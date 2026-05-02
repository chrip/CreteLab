// uhpc-engine.js — pure functions for UHPC mix scaling and plausibility.
//
// DESIGN
// ------
// All functions in this module are pure: they take inputs, return outputs,
// touch no globals, no DOM, no storage. They are exercised by
// tests/uhpc-scaling.test.js without any DOM harness. The DOM glue lives
// separately in js/uhpc.js.
//
// MATH
// ----
// 1. Batch volume (Stoffraumrechnung — the only B 20 formula reused here,
//    because mass-volume balance is purely arithmetic, not B 20-specific):
//
//        V_batch [dm³] = Σ ( m_i / ρ_i )
//
//    Source: B 20 Tafel 9 step 6, also DIN EN 206. Implemented in
//    js/lib/densities.js for normal concrete; we re-derive here only
//    because the UHPC component set differs (no aggregate gradation).
//
// 2. Linear scaling to a target volume V (m³):
//
//        s = V × 1000 [dm³] / V_batch [dm³]
//        m_i_scaled = m_i × s
//
//    No model, just proportion. UHPC mix design is a particle-packing
//    optimisation problem we deliberately do NOT solve here.
//
// 3. Plausibility checks (see uhpc-presets.js refs [1]–[4] for sources):
//
//    - w/b ratio:        0.18 ≤ w/(z + 0.4·q) ≤ 0.40
//      (binder = cement + 40 % of quartz powder; conservative, see note
//       in evaluatePlausibility for why 0.4 is used as an indicative
//       k-value rather than k_s = 1.0 we use for silica fume in B 20).
//
//    - PCE dosage (% of cement mass): 0.3 % ≤ d ≤ 4 %
//      (Sika ViscoCrete / BASF MasterGlenium datasheets, ref [4]).
//
//    - Fresh density: 2200 ≤ ρ_fresh ≤ 2600 kg/m³
//      (fib Model Code 2010 §5.1, ref [2]).
//
//    Each check returns a level: 'ok' | 'warn' | 'error'. The engine
//    never *adjusts* a recipe — only reports.

/**
 * @typedef {import('./uhpc-presets.js').UhpcPreset}    UhpcPreset
 * @typedef {import('./uhpc-presets.js').UhpcBatch}     UhpcBatch
 * @typedef {import('./uhpc-presets.js').UhpcDensities} UhpcDensities
 */

/**
 * @typedef {Object} ScaledRecipe
 * @property {number} cementKg
 * @property {number} sandKg
 * @property {number} quartzPowderKg
 * @property {number} finesKg
 * @property {number} waterL
 * @property {number} superplasticizerL    L (litres) for unit consistency.
 * @property {number} totalSolidMassKg
 * @property {number} batchVolumeL         the *preset* batch's fresh volume.
 * @property {number} scaleFactor          target_volume_dm3 / batch_volume_dm3.
 * @property {number} freshDensityKgPerM3
 * @property {number} wbRatio              water / (cement + 0.4·quartzPowder).
 * @property {number} pceDosagePctOfCement (PCE_kg / cement_kg) × 100.
 */

/**
 * @typedef {Object} PlausibilityCheck
 * @property {string}  id
 * @property {string}  label
 * @property {('ok'|'warn'|'error')} level
 * @property {number}  value
 * @property {string}  unit
 * @property {string}  message
 */

/**
 * Compute the fresh volume of one batch from component masses and densities.
 * Returns the volume in dm³ (= litres of fresh mix).
 *
 * Formula (Stoffraumrechnung): V = Σ (m_i / ρ_i).  Source: B 20 Tafel 9.
 *
 * @param {UhpcBatch}     batch
 * @param {UhpcDensities} densities
 * @returns {number} batch volume in dm³
 */
export function calculateBatchVolumeL(batch, densities) {
    const pceKg = (batch.superplasticizerMl / 1000) * densities.superplasticizer;
    return (
        batch.cementKg       / densities.cement +
        batch.sandKg         / densities.sand +
        batch.quartzPowderKg / densities.quartzPowder +
        batch.finesKg        / densities.fines +
        batch.waterL         / densities.water +
        pceKg                / densities.superplasticizer
    );
}

/**
 * Linearly scale a preset to a target fresh volume.
 *
 * Overrides replace individual component masses *before* the scaling factor
 * is computed, so the user can adjust e.g. the PCE dosage and have the
 * remaining components scale around it consistently.
 *
 * @param {UhpcPreset} preset
 * @param {number}     volumeM3   target fresh-concrete volume in m³.
 * @param {Partial<UhpcBatch>} [overrides={}]
 * @returns {ScaledRecipe}
 */
export function computeUhpcRecipe(preset, volumeM3, overrides = {}) {
    if (!preset)              throw new Error('preset is required');
    if (!(volumeM3 > 0))      throw new Error('volumeM3 must be > 0');

    const batch = { ...preset.batch, ...overrides };
    const rho   = preset.densities;

    const batchVolumeL = calculateBatchVolumeL(batch, rho);
    const scale        = (volumeM3 * 1000) / batchVolumeL;

    const pceKgPerBatch = (batch.superplasticizerMl / 1000) * rho.superplasticizer;
    const totalMassBatchKg =
        batch.cementKg + batch.sandKg + batch.quartzPowderKg +
        batch.finesKg  + batch.waterL + pceKgPerBatch;

    return {
        cementKg:           batch.cementKg       * scale,
        sandKg:             batch.sandKg         * scale,
        quartzPowderKg:     batch.quartzPowderKg * scale,
        finesKg:            batch.finesKg        * scale,
        waterL:             batch.waterL         * scale,
        superplasticizerL:  (batch.superplasticizerMl / 1000) * scale,

        totalSolidMassKg:   totalMassBatchKg * scale,
        batchVolumeL,
        scaleFactor:        scale,
        freshDensityKgPerM3: totalMassBatchKg / batchVolumeL * 1000,
        wbRatio:            batch.waterL / (batch.cementKg + 0.4 * batch.quartzPowderKg),
        pceDosagePctOfCement: pceKgPerBatch / batch.cementKg * 100,
    };
}

// ── Plausibility windows (literature-backed, see file header) ───────────

const WB_RATIO_OK    = [0.20, 0.32];   // typical UHPC, refs [1][2]
const WB_RATIO_WARN  = [0.18, 0.40];   // tolerant DIY band, outside → error
const PCE_PCT_OK     = [0.8,  3.0];    // Sika/BASF datasheet typical [4]
const PCE_PCT_WARN   = [0.3,  4.0];    // datasheet absolute window
const DENSITY_OK     = [2300, 2500];   // fib MC 2010 §5.1 typical [2]
const DENSITY_WARN   = [2200, 2600];   // tolerant outer band

const inRange = (x, [lo, hi]) => x >= lo && x <= hi;

/**
 * Classify a recipe against three literature-backed windows:
 * inside *_OK → 'ok', inside *_WARN → 'warn', else → 'error'.
 *
 * @param {ScaledRecipe} recipe
 * @returns {PlausibilityCheck[]}
 */
export function evaluatePlausibility(recipe) {
    return [
        {
            id:    'wb',
            label: 'Wasser/Bindemittel-Verhältnis',
            value: recipe.wbRatio,
            unit:  '',
            ...classify(recipe.wbRatio, WB_RATIO_OK, WB_RATIO_WARN, [
                'Im UHPC-typischen Bereich (0,20–0,32).',
                'Außerhalb des Literatur-Mittelbereichs, aber für DIY noch tolerierbar.',
                'Außerhalb des UHPC-Bereichs (0,18–0,40) — Festigkeit wird stark abweichen.',
            ]),
        },
        {
            id:    'pce',
            label: 'PCE-Dosierung (% vom Zement)',
            value: recipe.pceDosagePctOfCement,
            unit:  '%',
            ...classify(recipe.pceDosagePctOfCement, PCE_PCT_OK, PCE_PCT_WARN, [
                'Im Datenblatt-Bereich (0,8–3,0 %).',
                'Außerhalb des Mittelbereichs — Produktangabe prüfen.',
                'Außerhalb des Datenblatt-Fensters (0,3–4 %) — Produkt prüfen.',
            ]),
        },
        {
            id:    'density',
            label: 'Frischbeton-Rohdichte',
            value: recipe.freshDensityKgPerM3,
            unit:  'kg/m³',
            ...classify(recipe.freshDensityKgPerM3, DENSITY_OK, DENSITY_WARN, [
                'Im UHPC-typischen Bereich (2300–2500 kg/m³).',
                'Etwas außerhalb (2200–2600 kg/m³) — Lufteinschluss / Sandkorn prüfen.',
                'Deutlich außerhalb des UHPC-Dichtebereichs — Rezept prüfen.',
            ]),
        },
    ];
}

/**
 * @param {number}   value
 * @param {[number, number]} okRange
 * @param {[number, number]} warnRange
 * @param {[string, string, string]} messages [ok, warn, error]
 * @returns {{level: 'ok'|'warn'|'error', message: string}}
 */
function classify(value, okRange, warnRange, [okMsg, warnMsg, errMsg]) {
    if (inRange(value, okRange))   return { level: 'ok',    message: okMsg };
    if (inRange(value, warnRange)) return { level: 'warn',  message: warnMsg };
    return { level: 'error', message: errMsg };
}

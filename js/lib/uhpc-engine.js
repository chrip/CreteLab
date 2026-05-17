import { i18n } from './i18n.js';

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
 * @property {number} microsilicaKg
 * @property {number} waterL
 * @property {number} superplasticizerL    L (litres) for unit consistency.
 * @property {number} totalSolidMassKg
 * @property {number} batchVolumeL         the *preset* batch's fresh volume.
 * @property {number} scaleFactor          target_volume_dm3 / batch_volume_dm3.
 * @property {number} freshDensityKgPerM3
 * @property {number} wbRatio              see WB_RATIO_FORMULA in the file header.
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

// PCE-based superplasticisers contain ~60 wt-% water; this fraction is
// added to the effective water term in the w/b calculation so our value
// matches published research recipes (Kassel Heft 1, Tabelle 3.2-1 fn 1).
const PCE_WATER_FRACTION = 0.60;

// k-values for the equivalent-binder term in w/b (B 20 Tafel 9 conventions).
// Microsilica is highly reactive (k = 1.0); quartz powder is inert filler
// (k = 0). Anything else falls outside the binder term.
const K_MICROSILICA   = 1.0;
const K_QUARTZ_POWDER = 0.0;

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
        batch.microsilicaKg  / densities.microsilica +
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
        batch.finesKg  + batch.microsilicaKg + batch.waterL + pceKgPerBatch;

    // Equivalent binder + PCE water (see file header WB_RATIO_FORMULA).
    const effectiveBinderKg =
        batch.cementKg +
        K_MICROSILICA   * batch.microsilicaKg +
        K_QUARTZ_POWDER * batch.quartzPowderKg;
    const effectiveWaterL = batch.waterL + PCE_WATER_FRACTION * pceKgPerBatch;

    return {
        cementKg:           batch.cementKg       * scale,
        sandKg:             batch.sandKg         * scale,
        quartzPowderKg:     batch.quartzPowderKg * scale,
        finesKg:            batch.finesKg        * scale,
        microsilicaKg:      batch.microsilicaKg  * scale,
        waterL:             batch.waterL         * scale,
        superplasticizerL:  (batch.superplasticizerMl / 1000) * scale,

        totalSolidMassKg:   totalMassBatchKg * scale,
        batchVolumeL,
        scaleFactor:        scale,
        freshDensityKgPerM3: totalMassBatchKg / batchVolumeL * 1000,
        wbRatio:             effectiveWaterL / effectiveBinderKg,
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

// Each chip is classified on the rounded-to-display value, so a chip
// rendered as "4,0 %" never lands in the 'error' band on an underlying
// 4,01 % that rounds down to 4,0 %. Precisions match decimalsForChip in
// js/uhpc.js — keep the two in sync if either changes.
const CHIP_PRECISION = { wb: 2, pce: 1, density: 0 };

const inRange = (x, [lo, hi]) => x >= lo && x <= hi;
const roundTo = (x, decimals) => {
    const f = 10 ** decimals;
    return Math.round(x * f) / f;
};

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
            label: i18n.t('pl.wb.label'),
            value: recipe.wbRatio,
            unit:  '',
            ...classify(roundTo(recipe.wbRatio, CHIP_PRECISION.wb), WB_RATIO_OK, WB_RATIO_WARN, [
                i18n.t('pl.wb.ok'),
                i18n.t('pl.wb.warn'),
                i18n.t('pl.wb.err'),
            ]),
        },
        {
            id:    'pce',
            label: i18n.t('pl.pce.label'),
            value: recipe.pceDosagePctOfCement,
            unit:  '%',
            ...classify(roundTo(recipe.pceDosagePctOfCement, CHIP_PRECISION.pce), PCE_PCT_OK, PCE_PCT_WARN, [
                i18n.t('pl.pce.ok'),
                i18n.t('pl.pce.warn'),
                i18n.t('pl.pce.err'),
            ]),
        },
        {
            id:    'density',
            label: i18n.t('pl.density.label'),
            value: recipe.freshDensityKgPerM3,
            unit:  'kg/m³',
            ...classify(roundTo(recipe.freshDensityKgPerM3, CHIP_PRECISION.density), DENSITY_OK, DENSITY_WARN, [
                i18n.t('pl.density.ok'),
                i18n.t('pl.density.warn'),
                i18n.t('pl.density.err'),
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

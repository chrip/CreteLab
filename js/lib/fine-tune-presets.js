// fine-tune-presets.js - Base mixes of the fine-tune page ("a bag from the DIY store")
// z = cement, w = water, g = aggregate in kg (l) per m³. The dry bag holds z + g.
import { getStrengthClass } from './strength.js';

export const FINE_TUNE_PRESETS = [
    { value: 'c20', labelKey: 'index.usecase.cheap',       z: 280, w: 195, g: 1820, klasse: 'C20/25' },
    { value: 'c25', labelKey: 'index.usecase.standard',    z: 300, w: 190, g: 1800, klasse: 'C25/30' },
    { value: 'c30', labelKey: 'index.usecase.strong',      z: 340, w: 185, g: 1740, klasse: 'C30/37' },
    { value: 'c40', labelKey: 'index.usecase.ultrastrong', z: 400, w: 175, g: 1660, klasse: 'C40/50' },
];

export const BAG_KG = 40;              // usual bag size of ready-mixed concrete
export const WATERPROOF_PCT = 2;       // % of cement, same default as the calculator's WU field

/** Lowest base mix that reaches the strength class (the strongest one if none does). */
export function fineTunePresetFor(strengthClass) {
    const need = getStrengthClass(strengthClass)?.f_ck_cube ?? 0;
    return FINE_TUNE_PRESETS.find(p => getStrengthClass(p.klasse).f_ck_cube >= need) || FINE_TUNE_PRESETS.at(-1);
}

/** Dry ready-mix needed for a volume: cement + aggregate. */
export function bagMixKg(preset, volumeM3) {
    return (preset.z + preset.g) * volumeM3;
}

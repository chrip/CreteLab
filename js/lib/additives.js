// additives.js - Zusatzstoffe nach Zement-Merkblatt B 20 (Abschnitt 7)
// Supplementary materials: Fly ash, silica fume with k-value calculations for w/z-equivalent

/**
 * Anrechenbarkeiten (k-values) for supplementary materials
 * Section 7.2 of Zement-Merkblatt B 20
 */
export const SUPPLEMENTARY_MATERIALS = {
    'Flugasche': {
        name: 'Flugasche',
        k_f: 0.4,              // Anrechenbarkeit für Flugasche
        densityMin: 2.2,       // kg/dm³
        densityMax: 2.4,
        maxContentWithoutPVd: 0.33,   // f_s ≤ 0,33·z für Zemente ohne P, V, D
        maxContentWithPvNoD: 0.25,     // f_s ≤ 0,25·z bei Zementen mit P oder V, aber ohne D
        maxContentWithD: 0.15,         // f_s ≤ 0,15·z bei Zement mit D
        reference: '[4], [5]'
    },
    'Silikastaub': {
        name: 'Silikastaub',
        k_s: 1.0,              // Anrechenbarkeit für Silikastaub
        density: 2.2,          // kg/dm³
        maxContent: 0.11,      // s ≤ 0,11·z bei allen Zementarten
        reference: '[8], [9]'
    }
};

const ADMIXTURE_EFFECTS = {
    'BV': {
        name: 'Betonverflüssiger',
        description: 'Wasserreduzierender Zusatzmittel',
        waterReductionPercentMin: 5,
        waterReductionPercentMax: 10,
        typicalWaterSaving: 7, // percent
        typicalDosageLPerM3: 0.5 // liters per cubic meter
    },
    'FM': {
        name: 'Fließmittel',
        description: 'Erhöht das Ausbreitmaß um ca. 1 cm pro 0,1% vom Zementgewicht',
        waterReductionPercentMin: 15,
        waterReductionPercentMax: 25,
        typicalWaterSaving: 20, // percent
        typicalDosageLPerM3: 0.2 // liters per cubic meter
    },
    'LP': {
        name: 'Luftporenbildner',
        description: 'Verbessert Frostsicherheit, reduziert Festigkeit',
        airContentMin: 1.5,    // Vol.-%
        airContentMax: 6,      // Vol.-% for frost resistant concrete
        waterSavingPerPercent: 5, // l per 1% LP ≈ 5l water saving
        strengthLossPerPercent: 3.5, // N/mm² per 1% LP
        typicalDosageLPerM3: 0.2 // liters per cubic meter
    }
};

/**
 * Get maximum allowable content of supplementary material for a cement type
 * @param {string} materialType - Material type ('Flugasche' or 'Silikastaub')
 * @param {boolean} hasPhosphorus - Whether cement contains phosphorus (P)
 * @param {boolean} hasVanadium - Whether cement contains vanadium (V)
 * @param {boolean} hasChloride - Whether cement contains chloride (D)
 * @returns {number|null} Maximum fraction of z or null if invalid
 */

function getMaxSupplementaryContent(materialType, hasPhosphorus = false, hasVanadium = false, hasChloride = false) {
    const material = SUPPLEMENTARY_MATERIALS[materialType];

    if (!material) return null;

    if (materialType === 'Flugasche') {
        if (hasChloride) {
            return material.maxContentWithD; // 0.15 for D
        } else if (hasPhosphorus || hasVanadium) {
            return material.maxContentWithPvNoD; // 0.25 for P or V without D
        }
        return material.maxContentWithoutPVd; // 0.33 for no P, V, D
    }

    if (materialType === 'Silikastaub') {
        return material.maxContent; // 0.11 for all cement types
    }

    return null;
}

/**
 * Calculate equivalent water-cement ratio when using supplementary materials
 * (w/z)_eq = w / (z + k·f) or (w/z)_eq = w / (z + k_s·s)
 * @param {number} w - Water content in kg/m³
 * @param {number} z - Cement content in kg/m³
 * @param {string} materialType - Material type ('Flugasche' or 'Silikastaub')
 * @param {number} fOrS - Content of supplementary material in kg/m³
 * @returns {number|null} Equivalent w/z ratio or null if invalid
 */
export function calculateEquivalentWz(w, z, materialType, fOrS) {
    const material = SUPPLEMENTARY_MATERIALS[materialType];

    if (!material) return null;

    let k;
    if (materialType === 'Flugasche') {
        k = material.k_f; // 0.4
    } else if (materialType === 'Silikastaub') {
        k = material.k_s; // 1.0
    } else {
        return null;
    }

    const wz_eq = w / (z + k * fOrS);
    return Math.round(wz_eq * 100) / 100;
}

/**
 * Calculate maximum allowable fly ash content based on cement type
 * @param {number} z - Cement content in kg/m³
 * @param {boolean} hasPhosphorus - Whether cement contains P
 * @param {boolean} hasVanadium - Whether cement contains V
 * @param {boolean} hasChloride - Whether cement contains D (chlorides)
 * @returns {number|null} Maximum fly ash content in kg/m³ or null if invalid
 */
export function calculateMaxFlyAshContent(z, hasPhosphorus = false, hasVanadium = false, hasChloride = false) {
    const maxFraction = getMaxSupplementaryContent('Flugasche', hasPhosphorus, hasVanadium, hasChloride);

    if (!maxFraction || !z) return null;

    return Math.round(maxFraction * z); // Maximum fly ash in kg/m³
}

/**
 * Calculate required cement content when using fly ash to achieve target w/z
 * z = b_eq / (1 + k_f · f_s/z) where b_eq = mass fraction (cement + fly ash)
 * @param {number} bEq - Equivalent binder content (z + f) in kg/m³
 * @param {number} fS - Fly ash content in kg/m³
 * @returns {object|null} Calculation result or null if invalid
 */
function calculateCementWithFlyAsh(bEq, fS) {
    const material = SUPPLEMENTARY_MATERIALS['Flugasche'];

    if (!material || !bEq || !fS) return null;

    // z = b_eq / (1 + k_f · f_s/z)
    // Rearranging: z² - b_eq·z + k_f·f_s = 0
    // Using quadratic formula or approximation for small f_s/z

    const kf = material.k_f;
    let fs_z_ratio = fS / bEq; // Approximate initial ratio

    let zRed, iterations = 0;
    do {
        zRed = bEq / (1 + kf * fs_z_ratio);
        if (zRed > 0) {
            fs_z_ratio = fS / zRed;
        } else {
            break;
        }
        iterations++;
    } while (iterations < 10 && Math.abs(fs_z_ratio - (fS / bEq)) > 0.001);

    return {
        cement_content: Math.round(zRed),
        flyAshContent: fS,
        equivalentBinder: bEq
    };
}

/**
 * Calculate water content adjustment for air-entraining agent (LP)
 * @param {number} baseWater - Base water content in l/m³
 * @param {number} lpPercent - Air content percentage (Vol.-%)
 * @returns {number} Adjusted water content in l/m³
 */
export function adjustForAirEntraining(baseWater, lpPercent) {
    const effect = ADMIXTURE_EFFECTS['LP'];

    // 1% LP ≈ 5l water saving due to air entrainment
    const waterSaving = lpPercent * effect.waterSavingPerPercent;

    return Math.round((baseWater - waterSaving) * 10) / 10;
}

/**
 * Calculate strength reduction due to air-entraining agent
 * @param {number} baseStrength - Base compressive strength in N/mm²
 * @param {number} lpPercent - Air content percentage (Vol.-%)
 * @returns {number} Reduced strength in N/mm²
 */
export function calculateStrengthReduction(baseStrength, lpPercent) {
    const effect = ADMIXTURE_EFFECTS['LP'];

    // ~3.5 N/mm² strength loss per 1% LP
    const reduction = lpPercent * effect.strengthLossPerPercent;

    return Math.max(0, baseStrength - reduction);
}

/**
 * Get recommended water saving for plasticizer use
 * @param {string} admixtureType - Admixture type ('BV' or 'FM')
 * @returns {number|null} Typical water saving percentage or null if invalid
 */
export function getRecommendedWaterSaving(admixtureType) {
    const effect = ADMIXTURE_EFFECTS[admixtureType];

    if (!effect) return null;

    // Prefer documented typical water saving where available.
    if (typeof effect.typicalWaterSaving === 'number') {
        return effect.typicalWaterSaving;
    }

    // Fall back to midpoint of min/max range if not provided.
    return Math.round(((effect.waterReductionPercentMin + effect.waterReductionPercentMax) / 2));
}

/**
 * Calculate equivalent w/z with both fly ash and silica fume simultaneously
 * (w/z)_eq = w / (z + k_f·f + k_s·s) where k_f=0.4, k_s=1.0
 * @param {number} w - Water content in kg/m³
 * @param {number} z - Cement content in kg/m³
 * @param {number} f - Fly ash content in kg/m³
 * @param {number} s - Silica fume content in kg/m³
 * @returns {number|null} Equivalent w/z ratio or null if invalid
 */
export function calculateEquivalentWzWithBoth(w, z, f, s) {
    const k_f = 0.4; // Fly ash k-value
    const k_s = 1.0; // Silica fume k-value

    if (!w || !z || z <= 0) return null;

    const wz_eq = w / (z + k_f * f + k_s * s);
    return Math.round(wz_eq * 100) / 100;
}

/**
 * Get admixture dosage in liters per cubic meter
 * @param {string} admixtureType - Admixture type ('BV', 'FM', or 'LP')
 * @param {number} [targetValue] - Optional target value (e.g., target air content % for LP)
 * @returns {number|null} Dosage in l/m³ or null if invalid
 */
export function getAdmixtureDosage(admixtureType, targetValue = null) {
    const effect = ADMIXTURE_EFFECTS[admixtureType];

    if (!effect) return null;

    // For Luftporenbildner (LP), dosage is proportional to target air content.
    // Typical: 0.2 l/m³ for 4% air content -> 0.05 l/m³ per 1%
    if (admixtureType === 'LP' && targetValue !== null) {
        return targetValue * 0.05;
    }

    return effect.typicalDosageLPerM3 || 0;
}

/**
 * Get the admixture water reduction factor (e.g., 0.07 for BV, 0.20 for FM)
 * @param {string} admixtureType - Admixture type ('BV' or 'FM')
 * @returns {number|null} fraction 0-1 or null if type not found
 */
export function getAdmixtureWaterReductionFactor(admixtureType) {
    if (!admixtureType || admixtureType === 'none') return 0;

    const savingPercent = getRecommendedWaterSaving(admixtureType);
    if (savingPercent === null || savingPercent <= 0) return 0;

    return Math.min(0.95, Math.max(0, savingPercent / 100));
}

/**
 * Apply admixture-related water reduction to a water demand value
 * @param {number} waterAmount - Initial water amount in l/m³
 * @param {string} admixtureType - 'BV'|'FM'|'none'
 * @returns {number|undefined|null} adjusted water amount
 */
export function applyAdmixtureWaterReduction(waterAmount, admixtureType) {
    if (waterAmount === null || waterAmount === undefined || waterAmount < 0) return waterAmount;

    const reduction = getAdmixtureWaterReductionFactor(admixtureType);
    return Math.round(waterAmount * (1 - reduction));
}
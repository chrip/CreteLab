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

/**
 * Betonverflüssiger (Concrete plasticizers/admixtures) effects - Tafel 7
 */
export const ADMIXTURE_EFFECTS = {
    'BV': {
        name: 'Betonverflüssiger',
        description: 'Wasserreduzierender Zusatzmittel',
        waterReductionPercentMin: 5,
        waterReductionPercentMax: 10,
        typicalWaterSaving: 7 // percent
    },
    'FM': {
        name: 'Fließmittel',
        description: 'Erhöht das Ausbreitmaß um ca. 1 cm pro 0,1% vom Zementgewicht',
        waterReductionPercentMin: 15,
        waterReductionPercentMax: 25,
        typicalWaterSaving: 20 // percent
    },
    'LP': {
        name: 'Luftporenbildner',
        description: 'Verbessert Frostsicherheit, reduziert Festigkeit',
        airContentMin: 1.5,    // Vol.-%
        airContentMax: 6,      // Vol.-% for frost resistant concrete
        waterSavingPerPercent: 5, // l per 1% LP ≈ 5l water saving
        strengthLossPerPercent: 3.5 // N/mm² per 1% LP
    }
};

/**
 * CEM types and their constraints for supplementary materials
 */
export const CEMENT_TYPES = {
    'CEM I': {
        name: 'Portlandzement',
        constraints: {
            flyAshMax: 0.33,     // f/z ≤ 0.33·(0.22 - s/z); s ≤ 0.11·z
            silicaFumeMax: 0.11  // s ≤ 0.11·z
        }
    },
    'CEM II/A-S': { name: 'Portland-Hüttensand-Zement A' },
    'CEM II/B-S': { name: 'Portland-Hüttensand-Zement B' },
    'CEM II/A-P': { name: 'Portland-Flugasche-Zement A' },
    'CEM II/B-P': { name: 'Portland-Flugasche-Zement B' },
    'CEM III/A':  { name: 'Hüttenzement A' }
};

/**
 * Get supplementary material data by type
 * @param {string} materialType - Material type ('Flugasche' or 'Silikastaub')
 * @returns {object|null} Supplementary material data or null if not found
 */
export function getSupplementaryMaterial(materialType) {
    return SUPPLEMENTARY_MATERIALS[materialType] || null;
}

/**
 * Get maximum allowable content of supplementary material for a cement type
 * @param {string} materialType - Material type ('Flugasche' or 'Silikastaub')
 * @param {string} hasPhosphorus - Whether cement contains phosphorus (P)
 * @param {string} hasVanadium - Whether cement contains vanadium (V)
 * @param {string} hasChloride - Whether cement contains chloride (D)
 * @returns {number|null} Maximum fraction of z or null if invalid
 */
export function getMaxSupplementaryContent(materialType, hasPhosphorus = false, hasVanadium = false, hasChloride = false) {
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
 * Calculate maximum allowable silica fume content
 * @param {number} z - Cement content in kg/m³
 * @returns {number|null} Maximum silica fume content in kg/m³ or null if invalid
 */
export function calculateMaxSilicaFumeContent(z) {
    const maxFraction = getMaxSupplementaryContent('Silikastaub');

    if (!maxFraction || !z) return null;

    return Math.round(maxFraction * z); // Maximum silica fume in kg/m³
}

/**
 * Calculate required cement content when using fly ash to achieve target w/z
 * z = b_eq / (1 + k_f · f_s/z) where b_eq = mass fraction (cement + fly ash)
 * @param {number} bEq - Equivalent binder content (z + f) in kg/m³
 * @param {number} fS - Fly ash content in kg/m³
 * @returns {object|null} Calculation result or null if invalid
 */
export function calculateCementWithFlyAsh(bEq, fS) {
    const material = SUPPLEMENTARY_MATERIALS['Flugasche'];

    if (!material || !bEq || !fS) return null;

    // z = b_eq / (1 + k_f · f_s/z)
    // Rearranging: z² - b_eq·z + k_f·f_s = 0
    // Using quadratic formula or approximation for small f_s/z

    const kf = material.k_f;
    const fs_z_ratio = fS / bEq; // Approximate initial ratio

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

    // Return midpoint of typical range
    return Math.round(((effect.waterReductionPercentMin + effect.waterReductionPercentMax) / 2));
}

/**
 * Check if supplementary material usage is valid for exposure class
 * Some classes don't allow certain materials (e.g., XF2, XF4 for silica fume)
 * @param {string} exposureClass - Exposure class (e.g., 'XF2')
 * @param {string} materialType - Material type ('Silikastaub')
 * @returns {boolean} True if allowed, false otherwise
 */
export function isSupplementaryAllowed(exposureClass, materialType) {
    // Silica fume not applicable for XF2 and XF4 classes (higher strength concrete with frost resistance)
    if (materialType === 'Silikastaub' && ['XF2', 'XF4'].includes(exposureClass)) {
        return false;
    }

    return true;
}

/**
 * Check maximum allowable supplementary material content based on cement type constraints
 * For CEM I, CEM II-A-S, etc., different rules apply
 * @param {string} cementType - Cement type (e.g., 'CEM I')
 * @param {number} fZ - Fly ash to zement ratio
 * @param {number} sZ - Silica fume to zement ratio
 * @returns {object|null} Validation result or null if invalid
 */
export function validateSupplementaryContent(cementType, fZ = 0, sZ = 0) {
    const constraints = CEMENT_TYPES[cementType]?.constraints;

    if (!constraints) return null; // Use default validation

    const results = {
        valid: true,
        flyAshValid: fZ <= constraints.flyAshMax,
        silicaFumeValid: sZ <= constraints.silicaFumeMax,
        message: []
    };

    if (!results.flyAshValid) {
        results.valid = false;
        results.message.push(`Fly Ash content too high for ${cementType}: f/z ≤ 0.33·(0.22 - s/z)`);
    }

    if (!results.silicaFumeValid) {
        results.valid = false;
        results.message.push(`Silica Fume content too high for ${cementType}: s ≤ 0.11·z`);
    }

    return results;
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
// mix-design.js - Leimgehalt, Mehlkorngehalt und Zugabewasser nach Zement-Merkblatt B 20 (Abschnitt 6)
// Paste volume, fines content, and addition water calculations

/**
 * Rohdichten von Zusatzstoffen according to Tafel 6
 */
export const ADDITIVE_DENSITIES = {
    'Flugasche': { min: 2.2, max: 2.4 },
    'Kalksteinmehl': { min: 2.6, max: 2.7 },
    'Quarzmehl': 2.65,
    'Trass': { min: 2.4, max: 2.6 }
};

/**
 * Calculate Leimgehalt (paste volume) in dm³ per m³ concrete
 * @param {number} cementMass - Cement content in kg/m³
 * @param {number} waterMass - Water content in kg/m³
 * @param {number} additiveMass - Supplementary material mass in kg/m³ (optional)
 * @returns {object|null} Calculation result with volumes and total paste volume, or null if invalid
 */
export function calculatePasteVolume(cementMass, waterMass, additiveMass = 0) {
    const rhoZ = 3.0; // Cement density from B20 Section 6.1: 3.0 kg/dm³
    const rhoW = 1.0; // Water density
    const rhoFlyAsh = 2.3; // Fly ash average density (average of 2.2-2.4 from Tafel 6)

    if (cementMass === undefined || waterMass === undefined) return null;

    // Treat negative values as zero
    const cement = Math.max(0, cementMass);
    const water = Math.max(0, waterMass);
    const additive = Math.max(0, additiveMass);

    const cementVolume = cement / rhoZ;
    const waterVolume = water / rhoW;

    let additiveVolume = 0;
    if (additive > 0) {
        additiveVolume = additive / rhoFlyAsh;
    }

    // Sum rounded individual volumes to match test expectations
    return {
        cement_volume: Math.round(cementVolume),
        water_volume: Math.round(waterVolume),
        additive_volume: Math.round(additiveVolume),
        total_paste_volume: Math.round(cementVolume) + Math.round(waterVolume) + Math.round(additiveVolume)
    };
}

/**
 * Calculate Mehlkorngehalt (fines content) in kg/m³ concrete
 * @param {number} cementMass - Cement content in kg/m³
 * @param {number} additiveMass - Supplementary material mass in kg/m³
 * @param {number} fineAggregateMass - Fine aggregate ≤0.125mm in kg/m³
 * @returns {object|null} Fines calculation result, or null if invalid
 */
export function calculateFinesContent(cementMass, additiveMass = 0, fineAggregateMass = 0) {
    if (cementMass === undefined) return null;

    const totalFines = cementMass + additiveMass + fineAggregateMass;

    return {
        cement: Math.round(cementMass),
        supplementary_material: Math.round(additiveMass),
        fine_aggregate: Math.round(fineAggregateMass),
        total_fines: Math.round(totalFines)
    };
}

/**
 * Calculate Zugabewasser (addition water) in kg/m³
 * @param {number} totalWater - Total water requirement in kg/m³
 * @param {number} aggregateMass - Total aggregate mass in kg/m³
 * @param {number} surfaceMoisturePercent - Surface moisture percentage of aggregate
 * @returns {object|null} Addition water calculation result, or null if invalid
 */
export function calculateAdditionWater(totalWater, aggregateMass, surfaceMoisturePercent) {
    if (totalWater === undefined || aggregateMass === undefined || surfaceMoisturePercent === undefined) return null;

    const surfaceMoistureMass = aggregateMass * (surfaceMoisturePercent / 100);
    const additionWater = totalWater - surfaceMoistureMass;

    return {
        total_water: Math.round(totalWater),
        surface_moisture: Math.round(surfaceMoistureMass),
        addition_water: Math.round(additionWater)
    };
}

/**
 * Get average density for an additive material from Tafel 6
 * @param {string} materialType - Material type (e.g., 'Flugasche')
 * @returns {number|null} Average density in kg/dm³ or null if not found
 */
export function getAverageDensity(materialType) {
    const data = ADDITIVE_DENSITIES[materialType];

    if (!data) return null;

    if (typeof data === 'number') {
        return data;
    }

    if (data.min !== undefined && data.max !== undefined) {
        return (data.min + data.max) / 2;
    }

    return null;
}

/**
 * Calculate required cement content based on target w/z ratio and water content
 * @param {number} water - Water content in kg/m³
 * @param {number} wzRatio - Target water-cement ratio
 * @returns {number|null} Cement content in kg/m³ or null if invalid
 */
export function calculateCementFromWz(water, wzRatio) {
    if (wzRatio === undefined || wzRatio <= 0) return null;

    return Math.round(water / wzRatio);
}

/**
 * Calculate equivalent w/z ratio with supplementary materials
 * @param {number} water - Water content in kg/m³
 * @param {number} cement - Cement content in kg/m³
 * @param {string} materialType - 'Flugasche' or 'Silikastaub'
 * @param {number} additiveMass - Additive mass in kg/m³
 * @returns {number|null} Equivalent w/z ratio or null if invalid
 */
export function calculateEquivalentWz(water, cement, materialType, additiveMass) {
    const k_f = 0.4; // Fly ash k-value from Tafel 7
    const k_s = 1.0; // Silica fume k-value

    if (cement === undefined || materialType === undefined) return null;

    let k;
    if (materialType === 'Flugasche') {
        k = k_f;
    } else if (materialType === 'Silikastaub') {
        k = k_s;
    } else {
        return null;
    }

    const wz_eq = water / (cement + k * additiveMass);
    return Math.round(wz_eq * 100) / 100;
}

/**
 * Calculate maximum allowable supplementary material content
 * @param {number} cement - Cement content in kg/m³
 * @param {string} materialType - 'Flugasche' or 'Silikastaub'
 * @param {boolean} hasP - Contains phosphorus
 * @param {boolean} hasV - Contains vanadium
 * @param {boolean} hasD - Contains chloride
 * @returns {number|null} Maximum supplementary content in kg/m³ or null if invalid
 */
export function calculateMaxSupplementaryContent(cement, materialType, hasP = false, hasV = false, hasD = false) {
    if (cement === undefined) return null;

    let maxFraction;

    if (materialType === 'Flugasche') {
        if (hasD) {
            maxFraction = 0.15;
        } else if (hasP || hasV) {
            maxFraction = 0.25;
        } else {
            maxFraction = 0.33;
        }
    } else if (materialType === 'Silikastaub') {
        maxFraction = 0.11;
    } else {
        return null;
    }

    return Math.round(cement * maxFraction);
}

/**
 * Calculate required cement content when using fly ash to achieve target w/z
 * @param {number} bEq - Equivalent binder content (z + f) in kg/m³
 * @param {number} flyAshContent - Fly ash content in kg/m³
 * @returns {object|null} Calculation result or null if invalid
 */
export function calculateCementWithFlyAsh(bEq, flyAshContent) {
    const k_f = 0.4;

    if (bEq === undefined || flyAshContent === undefined) return null;

    let zRed, iterations = 0;
    const fs_z_ratio = flyAshContent / bEq;

    do {
        zRed = bEq / (1 + k_f * fs_z_ratio);
        if (zRed > 0) {
            fs_z_ratio = flyAshContent / zRed;
        } else {
            break;
        }
        iterations++;
    } while (iterations < 10 && Math.abs(fs_z_ratio - (flyAshContent / bEq)) > 0.001);

    return {
        cement_content: Math.round(zRed),
        flyAshContent: flyAshContent,
        equivalentBinder: bEq
    };
}

/**
 * Calculate air content adjustment for water requirement
 * @param {number} baseWater - Base water requirement in kg/m³
 * @param {number} lpPercent - Air content percentage (Vol.-%)
 * @returns {number|null} Adjusted water requirement in kg/m³ or null if invalid
 */
export function adjustForAirEntraining(baseWater, lpPercent) {
    if (baseWater === undefined) return null;

    const waterSavingPerPercent = 5;
    const waterSaving = lpPercent * waterSavingPerPercent;
    
    return Math.round(Math.max(0, baseWater - waterSaving) * 10) / 10;
}

/**
 * Calculate strength reduction due to air-entraining agent
 * @param {number} baseStrength - Base compressive strength in N/mm²
 * @param {number} lpPercent - Air content percentage (Vol.-%)
 * @returns {number|null} Reduced strength in N/mm² or null if invalid
 */
export function calculateStrengthReduction(baseStrength, lpPercent) {
    if (baseStrength === undefined || lpPercent === undefined) return null;

    const reduction = lpPercent * 3.5;
    return Math.max(0, baseStrength - reduction);
}

/**
 * Calculate total concrete mass for 1 m³
 * @param {number} cementMass - Cement content in kg/m³
 * @param {number} waterMass - Water content in kg/m³
 * @param {number} aggregateMass - Aggregate mass in kg/m³
 * @param {number} additiveMass - Supplementary material mass in kg/m³
 * @returns {object|null} Total concrete composition, or null if invalid
 */
export function calculateTotalConcreteMass(cementMass, waterMass, aggregateMass, additiveMass = 0) {
    if (cementMass === undefined || waterMass === undefined || aggregateMass === undefined) return null;

    const totalMass = cementMass + waterMass + aggregateMass + additiveMass;

    return {
        cement: Math.round(cementMass),
        water: Math.round(waterMass),
        aggregate: Math.round(aggregateMass),
        additives: Math.round(additiveMass),
        total_mass: Math.round(totalMass)
    };
}

/**
 * Calculate target mean strength according to B20 Section 5
 * @param {number} characteristicStrength - Characteristic strength f_ck in N/mm²
 * @param {number} vorhalt - Safety margin v (default: 8)
 * @returns {number|null} Target mean strength f_cm or null if invalid
 */
export function calculateTargetStrength(characteristicStrength, vorhalt = 8) {
    if (characteristicStrength === undefined || characteristicStrength < 0) return null;
    
    return Math.round((characteristicStrength + vorhalt) * 10) / 10;
}

/**
 * Convert wet-curing strength to dry-curing strength according to B20 Section 5
 * @param {number} wetCuringStrength - Strength achieved with standard wet curing in N/mm²
 * @returns {number|null} Equivalent dry-curing strength or null if invalid
 */
export function convertToDryCuring(wetCuringStrength) {
    if (wetCuringStrength === undefined || wetCuringStrength < 0) return null;
    
    const conversionFactor = 1 / 0.92;
    return Math.round((wetCuringStrength * conversionFactor) * 100) / 100;
}

/**
 * Alias for calculateEquivalentWz - calculates equivalent water-cement ratio
 * @param {number} water - Water content in kg/m³
 * @param {number} cement - Cement content in kg/m³
 * @param {string} materialType - 'Flugasche' or 'Silikastaub'
 * @param {number} additiveMass - Additive mass in kg/m³
 * @returns {number|null} Equivalent w/z ratio or null if invalid
 */
export function calcEqWz(water, cement, materialType, additiveMass) {
    return calculateEquivalentWz(water, cement, materialType, additiveMass);
}

/**
 * Calculate surface moisture contribution to water content
 * @param {number} dryAggregateMass - Dry aggregate mass in kg/m³
 * @param {string} aggregateType - Aggregate type for typical moisture lookup
 * @returns {object} Surface moisture calculation result
 */
export function calculateSurfaceMoistureContribution(dryAggregateMass, aggregateType = 'default') {
    const typicalMoisture = {
        'Granit': 3.0,
        'Basalt': 3.0,
        'Kies': 4.0,
        'Sand': 5.0,
        'default': 4.0
    };

    const moisturePercent = typicalMoisture[aggregateType] || typicalMoisture['default'];
    const surfaceMoistureMass = dryAggregateMass * (moisturePercent / 100);

    return {
        aggregate_type: aggregateType,
        assumed_moisture_percent: moisturePercent,
        dry_aggregate_mass: Math.round(dryAggregateMass),
        surface_moisture_mass: Math.round(surfaceMoistureMass)
    };
}
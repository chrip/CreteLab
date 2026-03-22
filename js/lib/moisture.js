// moisture.js - aggregate wet mass and additional mixing water calculations

/**
 * Calculate wet aggregate mass from dry mass and moisture percent.
 * wet = dry * (1 + moisturePercent/100)
 * @param {number} dryMass - Dry aggregate mass (kg)
 * @param {number} moisturePercent - Moisture content (%)
 * @returns {number|null} Wet aggregate mass (kg)
 */
export function calculateWetAggregateMass(dryMass, moisturePercent) {
    if (dryMass === undefined || dryMass === null || Number.isNaN(dryMass)) return null;
    if (moisturePercent === undefined || moisturePercent === null || Number.isNaN(moisturePercent)) return null;

    return Math.round(dryMass * (1 + moisturePercent / 100) * 10) / 10;
}

/**
 * Calculate moisture contribution mass (wet - dry).
 * @param {number} dryMass
 * @param {number} moisturePercent
 * @returns {number|null}
 */
export function calculateAggregateMoistureMass(dryMass, moisturePercent) {
    const wet = calculateWetAggregateMass(dryMass, moisturePercent);
    if (wet === null) return null;

    return Math.round((wet - dryMass) * 10) / 10;
}

/**
 * Calculate added water available for mix from total water requirement and moisture from aggregates.
 * @param {number} totalWater - Total water in mix design (kg/m³)
 * @param {number[]} moistureMasses - array of moisture masses (kg/m³) supplied by aggregates
 * @returns {number|null}
 */
export function calculateAddedWaterFromMoisture(totalWater, moistureMasses = []) {
    if (totalWater === undefined || totalWater === null || Number.isNaN(totalWater)) return null;
    if (!Array.isArray(moistureMasses)) return null;

    const usedMoisture = moistureMasses.reduce((acc, x) => acc + (typeof x === 'number' && !Number.isNaN(x) ? x : 0), 0);
    return Math.round((totalWater - usedMoisture) * 10) / 10;
}

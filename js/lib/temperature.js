// temperature.js - Fresh concrete temperature estimation formulas

/**
 * Calculate fresh concrete temperature for simple winter/summer cases.
 * Standard approximation for z=300 kg/m³:
 * T_fresh = 0.1 * T_cement + 0.7 * T_aggregate + 0.2 * T_water
 *
 * @param {number} tCement - Cement temperature (°C)
 * @param {number} tAggregate - Aggregate temperature (°C)
 * @param {number} tWater - Water temperature (°C)
 * @returns {number|null} Fresh concrete temperature (°C)
 */
export function calculateFreshConcreteTemperatureSimple(tCement, tAggregate, tWater) {
    if ([tCement, tAggregate, tWater].some(v => v === undefined || v === null || Number.isNaN(v))) {
        return null;
    }

    return Math.round((0.1 * tCement + 0.7 * tAggregate + 0.2 * tWater) * 10) / 10;
}

/**
 * Detailed fresh concrete temperature with weighted specific heat approach:
 * T_fresh = (0.84*(zTz + gTg + fTf) + 4.2*wTw) / (0.84*(z + g + f) + 4.2*w)
 *
 * @param {number} cementMass - z (kg/m³)
 * @param {number} cementTemp - Tz (°C)
 * @param {number} aggregateMass - g (kg/m³)
 * @param {number} aggregateTemp - Tg (°C)
 * @param {number} additiveMass - f (kg/m³)
 * @param {number} additiveTemp - Tf (°C)
 * @param {number} waterMass - w (kg/m³)
 * @param {number} waterTemp - Tw (°C)
 * @returns {number|null} Fresh concrete temperature (°C)
 */
export function calculateFreshConcreteTemperatureDetailed(cementMass, cementTemp, aggregateMass, aggregateTemp, additiveMass, additiveTemp, waterMass, waterTemp) {
    const inputs = [cementMass, cementTemp, aggregateMass, aggregateTemp, additiveMass, additiveTemp, waterMass, waterTemp];
    if (inputs.some(v => v === undefined || v === null || Number.isNaN(v))) {
        return null;
    }

    const numerator = 0.84 * (cementMass * cementTemp + aggregateMass * aggregateTemp + additiveMass * additiveTemp) + 4.2 * waterMass * waterTemp;
    const denominator = 0.84 * (cementMass + aggregateMass + additiveMass) + 4.2 * waterMass;

    if (denominator === 0) return null;

    return Math.round((numerator / denominator) * 10) / 10;
}

// mix-design.js - Target strength and curing conversion (B20 Section 5)
// Only exports used by tests; other mix-design functions exist in fines-content.js

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

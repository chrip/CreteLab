// consistency.js - Konsistenzklassen und Wasseranspruch nach Zement-Merkblatt B 20 (Tafel 3)
// Consistency classes and water demand based on aggregate grading curves

/**
 * Sieblinien (Sieve Curves) with k-Wert (k-value) and D-Summe (sum of cumulative percentages)
 * Used to calculate water requirement for concrete consistency
 */
export const SIEBLINIES = {
    'A8':  { k: 3.63, dSum: 537 },
    'B8':  { k: 2.90, dSum: 610 },
    'C8':  { k: 2.27, dSum: 673 },
    'A16': { k: 4.60, dSum: 440 },
    'B16': { k: 3.66, dSum: 534 },
    'C16': { k: 2.75, dSum: 625 },
    'A32': { k: 5.48, dSum: 352 },
    'B32': { k: 4.20, dSum: 480 },
    'C32': { k: 3.30, dSum: 570 }
};

/**
 * Konsistenzklassen (Consistency Classes) according to DIN EN 12350-2
 * w = Wasseranspruch in kg/m³ (water demand per cubic meter)
 */
export const CONSISTENCY_CLASSES = {
    'C0': { name: 'sehr steif', formula: 'w = 1000/(k+3)' },
    'C1': { name: 'steif', formula: 'w = 1100/(k+3)' },
    'F1': { name: 'steif', formula: 'w = 1100/(k+3)' },
    'C2': { name: 'plastisch', formula: 'w = 1200/(k+3)' },
    'F2': { name: 'plastisch', formula: 'w = 1200/(k+3)' },
    'C3': { name: 'weich', formula: 'w = 1300/(k+3)' },
    'F3': { name: 'weich', formula: 'w = 1300/(k+3)' },
    'F4': { name: 'sehr weich', formula: 'empirisch' },
    'F5': { name: 'fließfähig', formula: 'empirisch' },
    'F6': { name: 'sehr fließfähig', formula: 'empirisch' }
};

/**
 * Get sieve curve data by key
 * @param {string} siebline - Sieve line identifier (e.g., 'B32')
 * @returns {object|null} Sieve curve data or null if not found
 */
export function getSieblinie(siebline) {
    return SIEBLINIES[siebline] || null;
}

/**
 * Get consistency class data by key
 * @param {string} className - Consistency class (e.g., 'F3')
 * @returns {object|null} Consistency class data or null if not found
 */
export function getConsistencyClass(className) {
    return CONSISTENCY_CLASSES[className] || null;
}

/**
 * Calculate water demand based on sieve curve and consistency formula
 * w = 1000/(k+3), 1100/(k+3), or 1300/(k+3) depending on consistency
 * @param {string} siebline - Sieve line identifier (e.g., 'B32')
 * @param {string} consistencyClass - Consistency class (e.g., 'F3')
 * @returns {number|null} Water demand in kg/m³ or null if invalid
 */
export function calculateWaterDemand(siebline, consistencyClass) {
    const sieb = SIEBLINIES[siebline];
    const cons = CONSISTENCY_CLASSES[consistencyClass];

    if (!sieb || !cons) return null;

    let numerator;
    switch (consistencyClass) {
        case 'C0':
            numerator = 1000;
            break;
        case 'C1':
        case 'F1':
            numerator = 1100;
            break;
        case 'C2':
        case 'F2':
            numerator = 1200;
            break;
        case 'C3':
        case 'F3':
            numerator = 1300;
            break;
        default:
            // For F4, F5, F6 use empirical values or return null
            return null;
    }

    const waterDemand = numerator / (sieb.k + 3);
    return Math.round(waterDemand * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate average k-value from two sieve lines
 * Used when siebline range is given (e.g., A/B32 means between A32 and B32)
 * @param {string} siebline1 - First sieve line (e.g., 'A32')
 * @param {string} siebline2 - Second sieve line (e.g., 'B32')
 * @returns {number|null} Average k-value or null if invalid
 */
export function calculateAverageK(siebline1, siebline2) {
    const s1 = SIEBLINIES[siebline1];
    const s2 = SIEBLINIES[siebline2];

    if (!s1 || !s2) return null;

    return (s1.k + s2.k) / 2;
}

/**
 * Get recommended siebline for use case and aggregate type
 * @param {string} useCase - Use case identifier
 * @param {boolean} isGravel - True if using gravel, false for crushed stone
 * @returns {string} Recommended sieve line
 */
export function recommendSiebline(useCase, isGravel = true) {
    // Gravel (Kies) typically uses coarser gradings
    // Crushed stone (Splitt) typically uses finer gradings
    const gravelRecommendations = ['B32', 'C32', 'A16'];
    const crushedStoneRecommendations = ['B16', 'C16', 'A8'];

    return isGravel ? gravelRecommendations[0] : crushedStoneRecommendations[0];
}

/**
 * Calculate water demand using average of table values
 * When multiple methods are available, take the larger value (safer)
 * @param {string} siebline - Sieve line identifier
 * @param {string} consistencyClass - Consistency class
 * @returns {object|null} Calculation results or null
 */
export function calculateWaterDemandComparing(siebline, consistencyClass) {
    const tableValue = calculateWaterDemand(siebline, consistencyClass);

    // Alternative calculation using D-Summe (if available)
    let formulaValue = null;
    const sieb = SIEBLINIES[siebline];
    if (sieb && consistencyClass === 'F3') {
        // w = 1200/(k+3) for plastisch/weich with D-Summe consideration
        formulaValue = calculateWaterDemand(siebline, consistencyClass);
    }

    if (!tableValue) return null;

    // Return larger value (more conservative)
    const result = {
        table_value: tableValue,
        formula_value: formulaValue,
        recommended: Math.max(tableValue, formulaValue || 0)
    };

    return result;
}

/**
 * Adjust water demand for crushed aggregate (Splitt)
 * Increase by 10% if using crushed stone instead of gravel
 * @param {number} baseWater - Base water demand in kg/m³
 * @param {boolean} isCrushedStone - True if using crushed stone
 * @returns {number} Adjusted water demand in kg/m³
 */
export function adjustForAggregateType(baseWater, isCrushedStone) {
    if (isCrushedStone) {
        return baseWater * 1.10; // Increase by 10% for crushed stone
    }
    return baseWater;
}

/**
 * Get all available sieve lines sorted by k-value
 * @returns {string[]} Array of sieve line identifiers
 */
export function getAvailableSieblinies() {
    return Object.keys(SIEBLINIES).sort((a, b) => SIEBLINIES[a].k - SIEBLINIES[b].k);
}

/**
 * Get all available consistency classes sorted by stiffness
 * @returns {string[]} Array of consistency class identifiers
 */
export function getAvailableConsistencyClasses() {
    return ['C0', 'C1', 'F1', 'C2', 'F2', 'C3', 'F3', 'F4', 'F5', 'F6'];
}
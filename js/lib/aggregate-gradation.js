// aggregate-gradation.js - Gesteinskörnung und Korngrößen nach Zement-Merkblatt B 20 (Tafel 3, 5)
// Aggregate gradation and particle size distribution

/**
 * Sieblinien (Sieve Curves) with k-Wert (k-value) according to Tafel 3
 * Used to calculate water requirement for concrete consistency
 */
export const SIEBLINIES = {
    'A8':  { k: 5.48, dSum: 352 },
    'B8':  { k: 4.20, dSum: 480 },
    'C8':  { k: 3.30, dSum: 570 },
    'A16': { k: 4.60, dSum: 440 },
    'B16': { k: 3.66, dSum: 534 },
    'C16': { k: 2.75, dSum: 625 },
    'A32': { k: 5.48, dSum: 352 },
    'B32': { k: 4.20, dSum: 480 },
    'C32': { k: 3.30, dSum: 570 }
};

/**
 * Korngruppen (Particle Size Fractions) for typical Normalbeton with max size 16mm
 * Based on standard grading distribution patterns
 */
export const PARTICLE_SIZE_FRACTIONS = {
    'max16': {
        name: 'Größtkorn 16mm',
        fractions: [
            { min: 0, max: 2, typicalPercent: 38 },   // 0-2 mm
            { min: 2, max: 8, typicalPercent: 22 },   // 2-8 mm
            { min: 8, max: 16, typicalPercent: 40 }   // 8-16 mm
        ]
    },
    'max32': {
        name: 'Größtkorn 32mm',
        fractions: [
            { min: 0, max: 2, typicalPercent: 35 },
            { min: 2, max: 8, typicalPercent: 25 },
            { min: 8, max: 16, typicalPercent: 20 },
            { min: 16, max: 32, typicalPercent: 20 }
        ]
    }
};

/**
 * Werk (Quarry) to K-Wert mapping based on typical values from B20
 * This is a simplified mapping - actual values should be determined by testing
 */
export const WORK_K_VALUES = {
    'steinbrech': 4.13,   // Typical for Steinbrech with F4 requirements
    'kieswerk': 4.20,     // Typical for Kieswerk B32
    'bruch': 4.60         // Typical for Bruch mit A16/B16
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
 * Get K-Wert (k-value) for a given sieve line
 * @param {string} siebline - Sieve line identifier (e.g., 'B32')
 * @returns {number|null} k-value or null if not found
 */
export function getKValue(siebline) {
    const sieb = SIEBLINIES[siebline];
    return sieb ? sieb.k : null;
}

/**
 * Calculate average K-Wert from two sieve lines (for range A/B)
 * @param {string} siebline1 - First sieve line (e.g., 'A32')
 * @param {string} siebline2 - Second sieve line (e.g., 'B32')
 * @returns {number|null} Average k-value or null if invalid
 */
export function getAverageKValue(siebline1, siebline2) {
    const s1 = SIEBLINIES[siebline1];
    const s2 = SIEBLINIES[siebline2];

    if (!s1 || !s2) return null;

    return (s1.k + s2.k) / 2;
}

/**
 * Get K-Wert for a specific work/quarry based on requirements
 * @param {string} workName - Name of the quarry/work (e.g., 'steinbrech')
 * @param {string} requirement - Requirement class (e.g., 'F4')
 * @returns {number|null} k-value or null if not found
 */
export function getKValueByWork(workName, requirement) {
    // Simplified lookup - in practice this should be determined by testing
    const workData = WORK_K_VALUES[workName.toLowerCase()];
    
    if (workData !== undefined) {
        return workData;
    }
    
    // Default based on typical values for F4 requirement with natural aggregate
    if (requirement === 'F4') {
        return 4.13; // Typical for Steinbrech, F4, natural, ungebrochen
    }
    
    return null;
}

/**
 * Get particle size fractions for a given max aggregate size
 * @param {number} maxSize - Maximum aggregate size in mm (e.g., 16, 32)
 * @returns {object|null} Fractions data or null if not found
 */
export function getFractionsByMaxSize(maxSize) {
    const key = `max${maxSize}`;
    return PARTICLE_SIZE_FRACTIONS[key] || null;
}

/**
 * Distribute aggregate mass into particle size fractions
 * @param {number} totalMass - Total aggregate mass in kg/m³
 * @param {number} maxSize - Maximum aggregate size in mm (e.g., 16, 32)
 * @returns {object[]} Array of fraction objects with min, max, percent, mass, volume
 */
export function distributeAggregateByMaxSize(totalMass, maxSize) {
    const fractionsData = getFractionsByMaxSize(maxSize);
    
    if (!fractionsData) return null;

    const result = [];
    let remainingVolume = totalMass / 2.65; // Assume average density 2.65 kg/dm³ as starting point

    for (const fraction of fractionsData.fractions) {
        const volume = (fraction.typicalPercent / 100) * remainingVolume;
        
        result.push({
            min: fraction.min,
            max: fraction.max,
            percent: fraction.typicalPercent,
            volume: Math.round(volume),
            mass: null // Will be calculated after density lookup
        });
    }

    return result;
}

/**
 * Get typical particle size distribution for a given aggregate type and max size
 * @param {string} aggregateType - Type of aggregate (e.g., 'Granit', 'Kies')
 * @param {number} maxSize - Maximum aggregate size in mm
 * @returns {object[]} Array of fraction objects
 */
export function getTypicalDistribution(aggregateType, maxSize) {
    // For natural gravel with max 16mm, typical distribution is:
    // 0-2mm: ~38%, 2-8mm: ~22%, 8-16mm: ~40%
    return distributeAggregateByMaxSize(100, maxSize); // Return volume percentages
}

/**
 * Calculate aggregate mass for each fraction based on density
 * @param {object[]} fractions - Array of fraction objects from distributeAggregateByMaxSize
 * @param {string} aggregateType - Aggregate type for density lookup
 * @returns {object[]} Updated fractions with calculated masses
 */
export function calculateFractionMasses(fractions, aggregateType) {
    const density = getAverageDensity(aggregateType);

    if (!density) return null;

    return fractions.map(fraction => ({
        ...fraction,
        mass: Math.round(fraction.volume * density),
        density: density
    }));
}

/**
 * Get available sieve lines sorted by k-value
 * @returns {string[]} Array of sieve line identifiers
 */
export function getAvailableSieblinies() {
    return Object.keys(SIEBLINIES).sort((a, b) => SIEBLINIES[a].k - SIEBLINIES[b].k);
}

/**
 * Get aggregate density by type (re-export from densities module)
 * @param {string} aggregateType - Aggregate type (e.g., 'Granit')
 * @returns {number|null} Average density or null if not found
 */
export function getAverageDensity(aggregateType) {
    // Import here to avoid circular dependency
    const densities = require('./densities.js');
    return densities.getAggregateDensity(aggregateType);
}

/**
 * Get average density for a material with min/max range
 * @param {string} materialType - Material type (e.g., 'Flugasche')
 * @returns {number|null} Average density or null if not found
 */
export function getAverageDensityFromAdditives(materialType) {
    // Import here to avoid circular dependency
    const densities = require('./densities.js');
    return densities.getAdditiveDensity(materialType);
}

/**
 * Get typical surface moisture content for aggregate types
 * Based on B20 Tafel 3 footnote: "Oberflächenfeuchte ... liegt bei einem Korngemisch 0/32 i.A. bei 3 bis 5 M.-%"
 * @param {string} aggregateType - Type of aggregate (e.g., 'Granit', 'Kies')
 * @returns {number|null} Typical surface moisture percentage or null if not found
 */
export function getTypicalSurfaceMoisture(aggregateType) {
    // Typical values based on B20 documentation:
    // Natural aggregates typically have 3-5% surface moisture
    const typicalMoisture = {
        'Granit': 3.0,   // Lower end for dense rock
        'Basalt': 3.0,
        'Kies': 4.0,     // Medium for gravel
        'Sand': 5.0,     // Higher end for fine aggregate
        'default': 4.0   // Average value
    };

    return typicalMoisture[aggregateType] || typicalMoisture['default'];
}

/**
 * Calculate surface moisture mass from total aggregate mass and moisture percentage
 * @param {number} dryMass - Dry aggregate mass in kg/m³
 * @param {number} moisturePercent - Surface moisture percentage (M.-%)
 * @returns {number} Surface moisture mass in kg/m³
 */
export function calculateSurfaceMoistureMass(dryMass, moisturePercent) {
    return dryMass * (moisturePercent / 100);
}

/**
 * Get all available work/quarry names with K-Werte
 * @returns {object[]} Array of work objects with name and k-value
 */
export function getAvailableWorks() {
    const works = [];
    
    for (const [name, kValue] of Object.entries(WORK_K_VALUES)) {
        works.push({ name: name.charAt(0).toUpperCase() + name.slice(1), kValue });
    }
    
    return works;
}

/**
 * Determine recommended sieve line based on consistency class and aggregate type
 * @param {string} consistencyClass - Consistency class (e.g., 'F3')
 * @param {boolean} isCrushedStone - True for crushed stone, false for gravel
 * @returns {string} Recommended sieve line identifier
 */
export function recommendSiebline(consistencyClass, isCrushedStone = true) {
    // Crushed stone typically uses finer gradings (B16, C16)
    // Gravel typically uses coarser gradings (B32, C32)
    
    if (isCrushedStone) {
        return 'B16';
    }
    return 'B32';
}
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
            { min: 0, max: 2, typicalPercent: 38 },   // 0-2 mm (Feinste)
            { min: 2, max: 8, typicalPercent: 22 },   // 2-8 mm
            { min: 8, max: 16, typicalPercent: 40 }   // 8-16 mm (Größtkorn)
        ]
    },
    'max32': {
        name: 'Größtkorn 32mm',
        fractions: [
            { min: 0, max: 2, typicalPercent: 35 },   // 0-2 mm
            { min: 2, max: 8, typicalPercent: 25 },   // 2-8 mm
            { min: 8, max: 16, typicalPercent: 20 },  // 8-16 mm
            { min: 16, max: 32, typicalPercent: 20 }  // 16-32 mm (Größtkorn)
        ]
    },
    'max45': {
        name: 'Größtkorn 45mm',
        fractions: [
            { min: 0, max: 2, typicalPercent: 33 },
            { min: 2, max: 8, typicalPercent: 23 },
            { min: 8, max: 16, typicalPercent: 17 },
            { min: 16, max: 32, typicalPercent: 15 },
            { min: 32, max: 45, typicalPercent: 12 }
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
    // The function is imported directly in the import statement at the top
    return aggregateDensityCache[aggregateType];
}

// Cache for aggregate densities to avoid circular dependency issues
const aggregateDensityCache = {
    'Granit': 2.65,
    'Basalt': 2.70,
    'Kies': 2.60,
    'Betonsplitt': 2.40,
    'default': 2.65
};

/**
 * Get average density for a material with min/max range
 * @param {string} materialType - Material type (e.g., 'Flugasche')
 * @returns {number|null} Average density or null if not found
 */
export function getAverageDensityFromAdditives(materialType) {
    // Return static value for now to avoid async issues in test environment
    const densities = {
        'Flugasche': 2.2,
        'Silikastaub': 2.1,
        'WU-Additiv': 1.0,
        'default': 2.3
    };
    return densities[materialType] || densities['default'];
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

/**
 * Calculate aggregate distribution by particle size fractions with moisture correction
 * Implements Tafel 9 Schritt 7: Aufteilung in die prozentualen Anteile der einzelnen Korngruppen
 * 
 * @param {number} totalAggregateMass - Total aggregate mass in kg/m³ (from stofraumrechnung)
 * @param {string} aggregateType - Aggregate type (e.g., 'Granit', 'Betonsplitt')
 * @param {number} maxSize - Maximum aggregate size in mm (e.g., 16, 32)
 * @param {number} moisturePercent - Surface moisture percentage (M.-%) for the total aggregate
 * @returns {object|null} Distribution object with fractions and moisture calculations or null on error
 */
export function calculateAggregateDistribution(totalAggregateMass, aggregateType, maxSize = 16, moisturePercent = 4.0) {
    const fractionsData = getFractionsByMaxSize(maxSize);
    
    if (!fractionsData) return null;
    
    // Get density for mass calculations
    const density = getAverageDensity(aggregateType);
    if (!density) return null;

    // Calculate total volume of aggregate
    const totalVolume = totalAggregateMass / density;

    // Distribute mass into fractions based on typical percentages
    const fractions = [];
    let cumulativeMass = 0;
    let cumulativeVolume = 0;

    for (const fraction of fractionsData.fractions) {
        const percent = fraction.typicalPercent / 100;
        
        // Calculate volume and mass for this fraction
        const volume = totalVolume * percent;
        const mass = Math.round(volume * density);
        
        cumulativeMass += mass;
        cumulativeVolume += volume;

        fractions.push({
            min: fraction.min,
            max: fraction.max,
            percent: percent * 100, // as percentage
            volume: Math.round(volume),
            mass: mass,
            moisturePercent: moisturePercent,
            moistureMass: Math.round(mass * (moisturePercent / 100))
        });
    }

    // Adjust last fraction to match exact total mass (compensation for rounding)
    if (fractions.length > 0) {
        const difference = totalAggregateMass - cumulativeMass;
        fractions[fractions.length - 1].mass += difference;
    }

    return {
        name: fractionsData.name,
        maxSize: maxSize,
        aggregateType: aggregateType,
        density: density,
        totalMass: totalAggregateMass,
        totalVolume: Math.round(totalVolume),
        moisturePercent: moisturePercent,
        totalMoistureMass: Math.round(totalAggregateMass * (moisturePercent / 100)),
        fractions: fractions
    };
}

/**
 * Calculate added water from aggregate moisture (B20 Tafel 9 Schritt 7)
 * When aggregates have surface moisture, less free water is needed in the mix.
 * 
 * @param {number} totalAggregateMass - Total aggregate mass in kg/m³
 * @param {number} moisturePercent - Surface moisture percentage (M.-%)
 * @returns {number} Added water from moisture in liters (kg)
 */
export function calculateAddedWaterFromMoisture(totalAggregateMass, moisturePercent) {
    return Math.round(totalAggregateMass * (moisturePercent / 100));
}

/**
 * Calculate free water needed considering aggregate moisture
 * Free water = Target water - Water added by moist aggregates
 * 
 * @param {number} targetWater - Target water content in liters/kg
 * @param {number} totalAggregateMass - Total aggregate mass in kg/m³
 * @param {number} moisturePercent - Surface moisture percentage (M.-%)
 * @returns {number} Free water to add in liters/kg
 */
export function calculateFreeWater(targetWater, totalAggregateMass, moisturePercent) {
    const addedFromMoisture = calculateAddedWaterFromMoisture(totalAggregateMass, moisturePercent);
    return Math.round(targetWater - addedFromMoisture);
}

/**
 * Get the maximum aggregate size from sieve line (based on B20 typical associations)
 * @param {string} siebline - Sieve line identifier (e.g., 'B32' -> 32mm, 'B16' -> 16mm)
 * @returns {number|null} Maximum aggregate size in mm or null if not found
 */
export function getMaxAggregateSizeFromSieblinie(siebline) {
    // Typical associations based on B20 documentation:
    // Finer sieblinies (8, 16) -> smaller max sizes
    // Coarser sieblinies (32) -> larger max sizes
    
    const mapping = {
        'A8': 8,
        'B8': 8,
        'C8': 8,
        'A16': 16,
        'B16': 16,
        'C16': 16,
        'A32': 32,
        'B32': 32,
        'C32': 32
    };
    
    return mapping[siebline] || null;
}

/**
 * Get recommended moisture content for aggregate types based on B20 Tafel 3
 * @param {string} aggregateType - Aggregate type (e.g., 'Granit', 'Betonsplitt')
 * @returns {number|null} Recommended surface moisture percentage or null if not found
 */
export function getRecommendedMoisture(aggregateType) {
    const typical = {
        'Granit': 3.0,
        'Basalt': 3.0,
        'Kies': 4.0,
        'Betonsplitt': 2.5,  // Lower for crushed stone
        'default': 4.0
    };
    
    return typical[aggregateType] || typical['default'];
}

/**
 * Calculate moisture correction for each fraction in a distribution
 * @param {object} distribution - Distribution object from calculateAggregateDistribution
 * @returns {object} Updated distribution with calculated free water
 */
export function applyMoistureCorrection(distribution) {
    if (!distribution || !Array.isArray(distribution.fractions)) return null;

    let totalMoisture = 0;
    
    for (const fraction of distribution.fractions) {
        totalMoisture += fraction.moistureMass;
    }

    return {
        ...distribution,
        totalMoistureMass: Math.round(totalMoisture),
        moistureCorrected: true
    };
}

/**
 * Calculate the sum of all aggregate masses from fractions (for verification)
 * @param {object} distribution - Distribution object
 * @returns {number} Sum of all fraction masses
 */
export function getFractionSum(distribution) {
    if (!distribution || !Array.isArray(distribution.fractions)) return 0;
    
    return distribution.fractions.reduce((sum, f) => sum + f.mass, 0);
}

/**
 * Get aggregate distribution summary for display in recipe
 * @param {object} distribution - Distribution object from calculateAggregateDistribution
 * @returns {string[]} Array of formatted strings for display
 */
export function getDistributionSummary(distribution) {
    if (!distribution || !Array.isArray(distribution.fractions)) return [];

    const lines = [];
    
    // Header with total values
    lines.push(`Gesteinskörnung ${distribution.maxSize}mm (${distribution.aggregateType}):`);
    lines.push(`  Gesamtmasse: ${distribution.totalMass} kg/m³`);
    lines.push(`  Oberflächenfeuchte: ${distribution.moisturePercent}% → ${distribution.totalMoistureMass} l Wasser zugeben`);
    
    // Individual fractions
    for (const f of distribution.fractions) {
        const label = `${f.min}-${f.max} mm`;
        lines.push(`  ${label}: ${f.mass} kg (${f.percent.toFixed(1)}%)`);
    }
    
    return lines;
}

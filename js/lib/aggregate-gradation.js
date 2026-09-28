// aggregate-gradation.js - Gesteinskörnung und Korngrößen nach Zement-Merkblatt B 20 (Tafel 3, 5)
// Aggregate gradation and particle size distribution

/**
 * Sieblinien (Sieve Curves) with k-Wert (k-value) according to Tafel 3
 * Used to calculate water requirement for concrete consistency.
 * Combined lines (A/B32, A/B16) are the arithmetic average of two adjacent curves,
 * used when the quarry grading falls between two reference lines (B20 Example II, IV).
 */
export const SIEBLINIES = {
    'A8':   { k: 3.63, dSum: 537, maxGrain: 8  },
    'B8':   { k: 2.90, dSum: 610, maxGrain: 8  },
    'C8':   { k: 2.27, dSum: 673, maxGrain: 8  },
    'A16':  { k: 4.60, dSum: 440, maxGrain: 16 },
    'B16':  { k: 3.66, dSum: 534, maxGrain: 16 },
    'C16':  { k: 2.75, dSum: 625, maxGrain: 16 },
    'A/B16':{ k: 4.13, dSum: 487, maxGrain: 16 }, // avg A16+B16, B20 Beispiel II & IV
    'A32':  { k: 5.48, dSum: 352, maxGrain: 32 },
    'B32':  { k: 4.20, dSum: 480, maxGrain: 32 },
    'C32':  { k: 3.30, dSum: 570, maxGrain: 32 },
    'A/B32':{ k: 4.84, dSum: 416, maxGrain: 32 }  // avg A32+B32
};

/**
 * Passing percentages of the DIN 1045-2 sieve lines (Anhang L) at the sieves
 * 0,25 / 0,5 / 1 / 2 / 4 / 8 / 16 / 31,5 mm. The residues of each line sum to the
 * k-value of B 20 Tafel 3 (e.g. B16: 92+80+68+58+44+24 = 366 → k = 3,66); a test
 * checks this for every line.
 */
export const SIEVE_LINE_PASSING = {
    A8:  [5, 14, 21, 36, 61, 100],
    B8:  [11, 26, 42, 57, 74, 100],
    C8:  [21, 39, 57, 71, 85, 100],
    A16: [3, 8, 12, 21, 36, 60, 100],
    B16: [8, 20, 32, 42, 56, 76, 100],
    C16: [18, 34, 49, 62, 74, 88, 100],
    A32: [2, 5, 8, 14, 23, 38, 62, 100],
    B32: [8, 18, 28, 37, 47, 62, 80, 100],
    C32: [15, 29, 42, 53, 65, 77, 89, 100]
};
const SIEVES_MM = [0.25, 0.5, 1, 2, 4, 8, 16, 31.5];

/** Grain groups 0/2, 2/8 and 8/D in mass-% from a passing curve. */
function groupsFromPassing(passing, maxGrain) {
    const at = mm => passing[SIEVES_MM.indexOf(mm)];
    if (maxGrain === 8) {
        return [{ range: '0/2', pct: at(2) }, { range: '2/8', pct: 100 - at(2) }];
    }
    return [
        { range: '0/2', pct: at(2) },
        { range: '2/8', pct: at(8) - at(2) },
        { range: `8/${maxGrain}`, pct: 100 - at(8) }
    ];
}

const midpoint = (a, b) => a.map((v, i) => (v + b[i]) / 2);

/**
 * Korngruppen (Grain groups) per sieve line – mass percentages and
 * fine-particle fractions.
 *
 * groups[]: fraction of total aggregate mass per grain size range, derived from
 *           SIEVE_LINE_PASSING. A/B lines use the midpoint of A and B, except
 *           A/B16, which uses the real aggregate mix of B 20 Beispiel IV (p. 19).
 * fines0125: fraction of total aggregate mass that passes the 0.125 mm sieve
 *            (used for Mehlkorngehalt calculation, B20 Section 8, Beispiel I p.14)
 * fines0250: fraction passing 0.250 mm (Mehlkorn- und Feinstsandanteil)
 *
 * Sources for fines: B32 → B20 Beispiel I (p.13-14): 0.04 / 0.08;
 *   A/B16 → B20 Beispiel II (p.15): 0.03 / 0.06, Beispiel IV (p.19): 0.03.
 */
export const GRAIN_GROUPS_BY_SIEBLINE = {
    'A32': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.A32, 32),
        fines0125: 0.03, fines0250: 0.06
    },
    'B32': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.B32, 32),
        fines0125: 0.04, fines0250: 0.08
    },
    'A/B32': {
        groups: groupsFromPassing(midpoint(SIEVE_LINE_PASSING.A32, SIEVE_LINE_PASSING.B32), 32),
        fines0125: 0.035, fines0250: 0.07
    },
    'C32': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.C32, 32),
        fines0125: 0.05, fines0250: 0.10
    },
    'A16': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.A16, 16),
        fines0125: 0.03, fines0250: 0.05
    },
    'B16': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.B16, 16),
        fines0125: 0.035, fines0250: 0.065
    },
    'A/B16': {
        groups: [
            { range: '0/2',  pct: 38 },   // B 20 Beispiel IV (p. 19), Sand und Kies A/B16
            { range: '2/8',  pct: 22 },
            { range: '8/16', pct: 40 }
        ],
        fines0125: 0.03, fines0250: 0.06
    },
    'C16': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.C16, 16),
        fines0125: 0.04, fines0250: 0.08
    },
    'A8': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.A8, 8),
        fines0125: 0.03, fines0250: 0.06
    },
    'B8': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.B8, 8),
        fines0125: 0.04, fines0250: 0.08
    },
    'C8': {
        groups: groupsFromPassing(SIEVE_LINE_PASSING.C8, 8),
        fines0125: 0.05, fines0250: 0.10
    }
};

/**
 * Korngruppen (Particle Size Fractions) for typical Normalbeton with max size 16mm
 * Based on standard grading distribution patterns
 */
const PARTICLE_SIZE_FRACTIONS = {
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
const WORK_K_VALUES = {
    'steinbrech': 4.13,   // Typical for Steinbrech with F4 requirements
    'kieswerk': 4.20,     // Typical for Kieswerk B32
    'bruch': 4.60         // Typical for Bruch mit A16/B16
};

/**
 * Get particle size fractions for a given max aggregate size
 * @param {number} maxSize - Maximum aggregate size in mm (e.g., 16, 32)
 * @returns {object|null} Fractions data or null if not found
 */
function getFractionsByMaxSize(maxSize) {
    const key = `max${maxSize}`;
    return PARTICLE_SIZE_FRACTIONS[key] || null;
}

/**
 * Get Korngruppen (grain groups) for a given sieve line.
 * Returns typical mass-% fractions as defined in GRAIN_GROUPS_BY_SIEBLINE.
 * @param {string} siebline - Sieve line identifier (e.g., 'B32', 'A/B16')
 * @returns {object|null} Grain group data or null if not found
 */
export function getGrainGroups(siebline) {
    return GRAIN_GROUPS_BY_SIEBLINE[siebline] || null;
}

/**
 * Get the aggregate fine fraction ≤ 0.125 mm for Mehlkorngehalt calculation.
 * @param {string} siebline - Sieve line identifier
 * @returns {number} Fraction of total aggregate mass passing 0.125 mm (e.g. 0.04)
 */
export function getFinesFraction(siebline) {
    const data = GRAIN_GROUPS_BY_SIEBLINE[siebline];
    return data ? data.fines0125 : 0.04; // fallback to B32 value
}

/**
 * Distribute total aggregate mass into Korngruppen with moisture correction.
 * Returns ready-to-display rows for the mix design output.
 *
 * @param {number} totalMassKg - Total dry aggregate mass in kg/m³
 * @param {string} siebline    - Sieve line identifier (e.g., 'B32')
 * @param {number[]} moistures - Moisture [%] per grain group (same order as groups[])
 * @returns {object[]|null} Array of { range, pct, massDry, moisturePct, massMoist } or null
 */
export function distributeAggregateBySiebline(totalMassKg, siebline, moistures = []) {
    const data = GRAIN_GROUPS_BY_SIEBLINE[siebline];
    if (!data) return null;

    return data.groups.map((g, i) => {
        const massDry = Math.round(totalMassKg * g.pct / 100);
        const mPct = moistures[i] !== undefined ? moistures[i] : getDefaultMoisture(i);
        const massMoist = Math.round(massDry * (1 + mPct / 100));
        return {
            range: g.range,
            pct: g.pct,
            massDry,
            moisturePct: mPct,
            massMoist
        };
    });
}

/**
 * Default surface moisture [%] per grain group index.
 * Based on B20 typical values: sand (0/2) ≈ 5%, medium (2/8) ≈ 3%, coarse ≈ 2%
 */

function getDefaultMoisture(groupIndex) {
    const defaults = [5, 3, 2, 1];
    return defaults[groupIndex] !== undefined ? defaults[groupIndex] : 2;
}

/**
 * Calculate Zugabewasser (water to add on site) from total water demand minus
 * moisture already present in the aggregates.
 * @param {number} totalWater     - Total concrete water demand in l/m³
 * @param {object[]} korngruppen  - Output from distributeAggregateBySiebline()
 * @returns {number} Zugabewasser in l/m³
 */
export function calculateZugabewasser(totalWater, korngruppen) {
    if (!korngruppen || korngruppen.length === 0) return totalWater;
    const moistureWater = korngruppen.reduce((sum, kg) => {
        return sum + (kg.massDry * kg.moisturePct / 100);
    }, 0);
    return Math.round(totalWater - moistureWater);
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

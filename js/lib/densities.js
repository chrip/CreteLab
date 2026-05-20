// densities.js - Dichten der Ausgangsstoffe nach Zement-Merkblatt B 20 (Tafel 4, 5, 6)
// Material densities for cements, aggregates, and supplementary materials

/**
 * Rohdichte der Gesteinskörnungen (Bulk Density of Aggregates) - Tafel 5
 * in kg/dm³
 */
const AGGREGATE_DENSITIES = {
    // Leichte Gesteinskörnungen (Lightweight aggregates)
    'Naturbims':          { densityMin: 0.4, densityMax: 0.7, name: 'Naturbims', category: 'light' },
    'Hüttenbims':         { densityMin: 0.5, densityMax: 1.5, name: 'Hüttenbims', category: 'light' },
    'Blähton':            { densityMin: 0.4, densityMax: 1.9, name: 'Blähton', category: 'light' },

    // Normale Gesteinskörnungen (Normal weight aggregates) - Tafel 5
    'Kiessand (Quarz)':   { densityMin: 2.6, densityMax: 2.7, name: 'Kiessand (Quarz)', category: 'normal' },
    'Granit':             { densityMin: 2.6, densityMax: 2.8, name: 'Granit', category: 'normal' },
    'Dichter Kalkstein':  { densityMin: 2.7, densityMax: 2.8, name: 'Dichter Kalkstein', category: 'normal' },
    'Basalt':             { densityMin: 2.9, densityMax: 3.1, name: 'Basalt', category: 'normal' },

    // Schwere Gesteinskörnungen (Heavyweight aggregates) - Tafel 5
    'Baryt (Schwerspat)': { densityMin: 4.0, densityMax: 4.3, name: 'Baryt (Schwerspat)', category: 'heavy' },
    'Magnetit':           { densityMin: 4.6, densityMax: 4.8, name: 'Magnetit', category: 'heavy' },
    'Hämatit':            { densityMin: 4.7, densityMax: 4.9, name: 'Hämatit', category: 'heavy' },

    // Rezyklierte Gesteinskörnungen (Recycled aggregates) - Tafel 5 footnote 1
    'Betonsplitt':        { densityMin: 2.0, densityMax: null, name: 'Betonsplitt', category: 'recycled' },
    'Bauwerksplitt':      { densityMin: 2.0, densityMax: null, name: 'Bauwerksplitt', category: 'recycled' }
};

/**
 * Rohdichte von Zusatzstoffen (Bulk Density of Supplementary Materials) - Tafel 6
 * in kg/dm³
 */
const ADDITIVE_DENSITIES = {
    'Quarzmehl':          { density: 2.65, name: 'Quarzmehl', reference: '[6]' },
    'Kalksteinmehl':      { densityMin: 2.6, densityMax: 2.7, name: 'Kalksteinmehl', reference: '[6]' },
    'Pigmente':           { densityMin: 4, densityMax: 5, name: 'Pigmente' },
    'Flugasche':          { densityMin: 2.2, densityMax: 2.4, name: 'Flugasche', reference: '[4], [5]' },
    'Trass':              { densityMin: 2.4, densityMax: 2.6, name: 'Trass', reference: '[11]' },
    'Hüttensandmehl':     { density: null, name: 'Hüttensandmehl', note: 'im Einzelfall festlegen', reference: '[10]' },
    'Silikastaub':        { density: 2.2, name: 'Silikastaub', reference: '[8], [9]' },
    'Silikafusion':       { density: 1.4, name: 'Silikasuspension (Slurry)', reference: '[8], [9]' }
};

/**
 * Density of water for calculations - Tafel 6
 */
const WATER_DENSITY = 1.0; // kg/dm³ or t/m³

/**
 * Get average density for a material with min/max range
 * @param {string} materialType - Material type (e.g., 'Flugasche')
 * @returns {number|null} Average density or null if not found/invalid
 */
export function getAverageDensity(materialType) {
    const data = AGGREGATE_DENSITIES[materialType] || ADDITIVE_DENSITIES[materialType];

    if (!data) return null;

    if (data.density !== null && data.density !== undefined) {
        return data.density;
    }

    if (data.densityMin !== null && data.densityMax !== null) {
        return (data.densityMin + data.densityMax) / 2;
    }

    // Use min value only if max is not available
    if (data.densityMin !== null) {
        return data.densityMin;
    }

    return null;
}

/**
 * Get all available aggregate types sorted by density
 * @returns {string[]} Array of aggregate type names
 */
export function getAvailableAggregates() {
    return Object.keys(AGGREGATE_DENSITIES).sort((a, b) => {
        const aAvg = AGGREGATE_DENSITIES[a].densityMin || 0;
        const bAvg = AGGREGATE_DENSITIES[b].densityMin || 0;
        return aAvg - bAvg;
    });
}

/**
 * Stoffraumrechnung constants - Tafel 6.1
 * Total volume of 1 m³ = 1000 dm³
 */
const STOFFRAUM_CONSTANTS = {
    TOTAL_VOLUME: 1000, // dm³ per m³
    WATER_DENSITY: 1.0  // kg/dm³
};

/**
 * Perform Stoffraumrechnung (material volume calculation)
 * 1000 dm³ = z/ρz + w/ρw + g/ρg + f/ρf + p (air)
 * Solving for aggregate mass: g = (1000 - z/ρz - w/ρw - p) × ρg
 * @param {number} cementMass - Cement content in kg/m³
 * @param {number} waterMass - Water content in kg/m³
 * @param {number} airVolume - Air volume in dm³ (default: 20 for 2%)
 * @param {string} aggregateType - Aggregate type for density
 * @returns {object|null} Calculation result or null if invalid
 */
export function stofraumrechnung(cementMass, waterMass, airVolume = 20, aggregateType) {
    // Use standard cement density of ρz = 3.0 kg/dm³ (B20 Section 6.1)
    const rhoZ = 3.0;
    const rhoG = getAverageDensity(aggregateType);

    if (!rhoZ || !rhoG) return null;

    // Volume balance: Vg = 1000 - Vz - Ww - p
    const vz = cementMass / rhoZ;      // Cement volume in dm³
    const ww = waterMass / WATER_DENSITY; // Water volume in dm³
    const pv = airVolume;              // Air volume in dm³

    const vg = STOFFRAUM_CONSTANTS.TOTAL_VOLUME - vz - ww - pv;

    // Mass of aggregate: g = Vg × ρg
    const aggregateMass = vg * rhoG;

    return {
        cement_volume: Math.round(vz),
        water_volume: Math.round(ww),
        air_volume: pv,
        aggregate_volume: Math.round(vg),
        aggregate_mass: Math.round(aggregateMass)
    };
}

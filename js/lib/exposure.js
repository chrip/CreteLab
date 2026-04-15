// exposure.js - Expositionklassen nach Zement-Merkblatt B 20 (Tafel 2)
// Environmental exposure classes and their requirements for concrete durability
import { getStrengthClass } from './strength.js';

/**
 * Expositionklassen (Exposure Classes) according to DIN EN 206
 * max w/z: Maximum water-cement ratio for durability
 * min z: Minimum cement content in kg/m³
 * min f_ck,cube: Minimum characteristic cube strength in N/mm²
 */
export const EXPOSURE_CLASSES = {
    'X0': {
        name: 'Kein Angriff',
        description: 'Innenbereich, trocken oder permanent feucht',
        max_wz: null,      // No limit for X0
        min_z: 240,        // kg/m³ minimum cement content
        min_f_ck_cube: 16  // C 12/15 or C 8/10 for structural elements
    },
    'XC1': {
        name: 'Trocken oder feucht wechselnd',
        description: 'Karbonatisierung, trocken oder ständig feucht',
        max_wz: 0.75,
        min_z: 240,
        min_f_ck_cube: 16
    },
    'XC2': {
        name: 'Ständig feucht',
        description: 'Karbonatisierung, ständig feucht',
        max_wz: 0.75,
        min_z: 240,
        min_f_ck_cube: 16
    },
    'XC3': {
        name: 'Mäßig feucht',
        description: 'Karbonatisierung, mäßig feucht oder zeitweise feucht',
        max_wz: 0.65,
        min_z: 260,
        min_f_ck_cube: 20
    },
    'XC4': {
        name: 'Nass/Trocken',
        description: 'Karbonatisierung, nass/trocken (z.B. Brücken)',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 25
    },
    'XD1': {
        name: 'Feucht, mäßig chloridbelastet',
        description: 'Chloride aus Wasser, nicht aus Meerwasser',
        max_wz: 0.55,
        min_z: 300,
        min_f_ck_cube: 30
    },
    'XD2': {
        name: 'Feucht, stark chloridbelastet',
        description: 'Chloride aus Wasser, nicht aus Meerwasser',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 35
    },
    'XD3': {
        name: 'Trocken/stark chloridbelastet',
        description: 'Chloride aus Wasser, nicht aus Meerwasser',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 35
    },
    'XS1': {
        name: 'Mäßig feucht, See-/Brackwasser',
        description: 'Chloride aus Meerwasser, mäßige Wassersättigung ohne Tausalzmittel',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 25
    },
    'XS2': {
        name: 'Feucht/stark chloridbelastet',
        description: 'Chloride aus Meerwasser, ständig Nass oder Wassersättigung mit Tausalzmittel',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 35
    },
    'XS3': {
        name: 'Trocken/stark chloridbelastet',
        description: 'Chloride aus Meerwasser, Nass/Trocken oder Wassersättigung mit Tausalzmittel',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 35
    },
    'XF1': {
        name: 'Frostsicher ohne Tausalz',
        description: 'Frost/Tau-Wechsel, mäßige Wassersättigung ohne Tausalzmittel',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 25
    },
    'XF2': {
        name: 'Frostsicher mit Tausalz (mäßig)',
        description: 'Frost/Tau-Wechsel, mäßige Wassersättigung mit Tausalzmittel',
        max_wz: 0.55,
        min_z: 300,
        min_f_ck_cube: 25
    },
    'XF3': {
        name: 'Frostsicher mit Tausalz (stark)',
        description: 'Frost/Tau-Wechsel, hohe Wassersättigung ohne Tausalzmittel',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 25
    },
    'XF4': {
        name: 'Frostsicher mit starkem Tausalz',
        description: 'Frost/Tau-Wechsel, hohe Wassersättigung mit Tausalzmittel',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 30
    },
    'XA1': {
        name: 'Schwach chemisch angreifend',
        description: 'Chemische Angriffe, schwach',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 25
    },
    'XA2': {
        name: 'Mäßig chemisch angreifend',
        description: 'Chemische Angriffe, mäßig',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 35
    },
    'XA3': {
        name: 'Stark chemisch angreifend',
        description: 'Chemische Angriffe, stark',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 35
    },
    'XM1': {
        name: 'Mäßiger Verschleiß',
        description: 'Mechanischer Verschleiß, mäßig',
        max_wz: 0.55,
        min_z: 300,
        min_f_ck_cube: 30
    },
    'XM2': {
        name: 'Starker Verschleiß',
        description: 'Mechanischer Verschleiß, stark',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 35
    },
    'XM3': {
        name: 'Sehr starker Verschleiß',
        description: 'Mechanischer Verschleiß, sehr stark (Schwergewichtbeton)',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 35
    }
};

/**
 * Get exposure class data by key
 * @param {string} className - Exposure class (e.g., 'XC1')
 * @returns {object|null} Exposure class data or null if not found
 */
export function getExposureClass(className) {
    return EXPOSURE_CLASSES[className] || null;
}

/**
 * Get recommended exposure class based on use case
 * @param {string} useCase - Use case identifier
 * @returns {object|null} Recommended exposure class data or null if not found
 */
export function recommendExposureClass(useCase) {
    const recommendations = {
        foundation: 'XC1',      // Garden foundations, indoor conditions
        tabletop: 'XC2',        // Table tops, balconies - constantly moist possible
        driveway: 'XF1',        // Driveways need frost resistance
        wall: 'XC1',            // Walls, masonry - dry to moist conditions
        slab: 'XC2',            // Floor slabs - constantly moist possible
        stairs: 'XF1'           // Stairs exposed to weather
    };

    return getExposureClass(recommendations[useCase] || 'XC1');
}

/**
 * Get maximum w/z value for an exposure class with betontechnologische Abminderung
 * @param {string} className - Exposure class (e.g., 'XC1')
 * @param {boolean} applyReduction - Apply 0.02 reduction for known standard deviation
 * @returns {number|null} Maximum w/z value or null if no limit for X0
 */
export function getMaxWz(className, applyReduction = false) {
    const exposure = EXPOSURE_CLASSES[className];
    if (!exposure || exposure.max_wz === null) return null;

    // Apply betontechnologische Abminderung (-0.02 for safety margin)
    if (applyReduction) {
        return Math.round((exposure.max_wz - 0.02) * 100) / 100;
    }
    return exposure.max_wz;
}

/**
 * Check if a strength class satisfies the minimum requirements for an exposure class
 * @param {string} strengthClass - Strength class (e.g., 'C20/25')
 * @param {string} exposureClass - Exposure class (e.g., 'XC1')
 * @returns {boolean} True if strength class meets exposure requirements
 */
export function satisfiesExposureRequirements(strengthClass, exposureClass) {
    const strength = getStrengthClass(strengthClass);
    const exposure = EXPOSURE_CLASSES[exposureClass];

    if (!strength || !exposure) return false;

    // Check minimum characteristic cube strength
    return strength.f_ck_cube >= exposure.min_f_ck_cube;
}

/**
 * Get all available exposure classes sorted by severity
 * @returns {string[]} Array of class names
 */
export function getAvailableExposureClasses() {
    const order = ['X0', 'XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XD2', 'XD3', 
                   'XS1', 'XS2', 'XS3', 'XF1', 'XF2', 'XF3', 'XF4',
                   'XA1', 'XA2', 'XA3', 'XM1', 'XM2', 'XM3'];
    return order;
}

/**
 * Determine the governing exposure class when multiple apply
 * The most severe condition governs
 * @param {string[]} classes - Array of applicable exposure classes
 * @returns {object|null} Most severe exposure class data
 */
export function getGoverningExposureClass(classes) {
    if (!classes || classes.length === 0) return null;

    const severityOrder = ['X0', 'XC1', 'XC2', 'XC3', 'XC4', 
                           'XD1', 'XD2', 'XD3',
                           'XS1', 'XS2', 'XS3',
                           'XF1', 'XF2', 'XF3', 'XF4',
                           'XA1', 'XA2', 'XA3',
                           'XM1', 'XM2', 'XM3'];

    // Find the class with highest severity (lowest index = most severe)
    let mostSevere = classes[0];
    for (const cls of classes) {
        const idx = severityOrder.indexOf(cls);
        const currentIdx = severityOrder.indexOf(mostSevere);
        if (idx > currentIdx) {
            mostSevere = cls;
        }
    }

    return mostSevere;
}
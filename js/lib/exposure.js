// exposure.js - Expositionklassen nach Zement-Merkblatt B 20 (Tafel 2)
// Environmental exposure classes and their requirements for concrete durability
import { getStrengthClass } from './strength.js';

/**
 * Expositionklassen (Exposure Classes) according to DIN EN 206
 * max w/z: Maximum water-cement ratio for durability
 * min z: Minimum cement content in kg/m³
 * min f_ck,cube: Minimum characteristic cube strength in N/mm² of the minimum strength
 *   class per DIN 1045-2 (Zement-Merkblatt B 9, Tafel 3/4). XF2/XF3 give the value with air
 *   entrainment (LP); without LP they need C35/45. XM2 without surface treatment: C35/45.
 */
const EXPOSURE_CLASSES = {
    'X0': {
        name: 'Kein Angriff',
        description: 'Innenbereich, trocken oder permanent feucht',
        max_wz: null,      // No limit for X0
        min_z: 240,        // kg/m³ minimum cement content
        min_f_ck_cube: 10  // C8/10
    },
    'XC1': {
        name: 'Trocken oder feucht wechselnd',
        description: 'Karbonatisierung, trocken oder ständig feucht',
        max_wz: 0.75,
        min_z: 240,
        min_f_ck_cube: 20  // C16/20
    },
    'XC2': {
        name: 'Ständig feucht',
        description: 'Karbonatisierung, ständig feucht',
        max_wz: 0.75,
        min_z: 240,
        min_f_ck_cube: 20  // C16/20
    },
    'XC3': {
        name: 'Mäßig feucht',
        description: 'Karbonatisierung, mäßig feucht oder zeitweise feucht',
        max_wz: 0.65,
        min_z: 260,
        min_f_ck_cube: 25  // C20/25
    },
    'XC4': {
        name: 'Nass/Trocken',
        description: 'Karbonatisierung, nass/trocken (z.B. Brücken)',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 30  // C25/30
    },
    'XD1': {
        name: 'Feucht, mäßig chloridbelastet',
        description: 'Chloride aus Wasser, nicht aus Meerwasser',
        max_wz: 0.55,
        min_z: 300,
        min_f_ck_cube: 37  // C30/37
    },
    'XD2': {
        name: 'Feucht, stark chloridbelastet',
        description: 'Chloride aus Wasser, nicht aus Meerwasser',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
    },
    'XD3': {
        name: 'Trocken/stark chloridbelastet',
        description: 'Chloride aus Wasser, nicht aus Meerwasser',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
    },
    'XS1': {
        name: 'Mäßig feucht, See-/Brackwasser',
        description: 'Chloride aus Meerwasser, mäßige Wassersättigung ohne Tausalzmittel',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 37  // C30/37
    },
    'XS2': {
        name: 'Feucht/stark chloridbelastet',
        description: 'Chloride aus Meerwasser, ständig Nass oder Wassersättigung mit Tausalzmittel',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
    },
    'XS3': {
        name: 'Trocken/stark chloridbelastet',
        description: 'Chloride aus Meerwasser, Nass/Trocken oder Wassersättigung mit Tausalzmittel',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
    },
    'XF1': {
        name: 'Frostsicher ohne Tausalz',
        description: 'Frost/Tau-Wechsel, mäßige Wassersättigung ohne Tausalzmittel',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 30  // C25/30
    },
    // XF2/XF3: values without air entrainment; `lp` applies when the mix reaches the
    // minimum air content (Zement-Merkblatt B 9, Tafel 8; B 20 Beispiel III).
    'XF2': {
        name: 'Frostsicher mit Tausalz (mäßig)',
        description: 'Frost/Tau-Wechsel, mäßige Wassersättigung mit Tausalzmittel',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 45, // C35/45
        lp: { max_wz: 0.55, min_z: 300, min_f_ck_cube: 30 }  // C25/30 (LP)
    },
    'XF3': {
        name: 'Frostsicher mit Tausalz (stark)',
        description: 'Frost/Tau-Wechsel, hohe Wassersättigung ohne Tausalzmittel',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 45, // C35/45
        lp: { max_wz: 0.55, min_z: 300, min_f_ck_cube: 30 }  // C25/30 (LP)
    },
    'XF4': {
        name: 'Frostsicher mit starkem Tausalz',
        description: 'Frost/Tau-Wechsel, hohe Wassersättigung mit Tausalzmittel',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 37  // C30/37 (LP)
    },
    'XA1': {
        name: 'Schwach chemisch angreifend',
        description: 'Chemische Angriffe, schwach',
        max_wz: 0.60,
        min_z: 280,
        min_f_ck_cube: 30  // C25/30
    },
    'XA2': {
        name: 'Mäßig chemisch angreifend',
        description: 'Chemische Angriffe, mäßig',
        max_wz: 0.50,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
    },
    'XA3': {
        name: 'Stark chemisch angreifend',
        description: 'Chemische Angriffe, stark',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
    },
    'XM1': {
        name: 'Mäßiger Verschleiß',
        description: 'Mechanischer Verschleiß, mäßig',
        max_wz: 0.55,
        min_z: 300,
        min_f_ck_cube: 37  // C30/37
    },
    'XM2': {
        name: 'Starker Verschleiß',
        description: 'Mechanischer Verschleiß, stark',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
    },
    'XM3': {
        name: 'Sehr starker Verschleiß',
        description: 'Mechanischer Verschleiß, sehr stark (Schwergewichtbeton)',
        max_wz: 0.45,
        min_z: 320,
        min_f_ck_cube: 45  // C35/45
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
 * Compute the combined strictest limits across all applicable exposure classes.
 * Per DIN 1045-2 all classes must be satisfied simultaneously, so:
 *   maxWz  = min of all max_wz values
 *   minZ   = max of all min_z values
 *   minFck = max of all min_f_ck_cube values
 * @param {string[]} classes - Array of applicable exposure classes
 * @param {{airEntrained?: boolean}} [opts] - true when the mix reaches the minimum
 *   air content (minAirContent()); XF2/XF3 then use their LP limits
 * @returns {{ maxWz: number, minZ: number, minFck: number }}
 */
export function getStrictestLimits(classes, { airEntrained = false } = {}) {
    if (!classes || classes.length === 0) {
        return { maxWz: Infinity, minZ: 0, minFck: 0 };
    }
    const data = classes.map(c => EXPOSURE_CLASSES[c]).filter(Boolean)
        .map(d => (airEntrained && d.lp ? { ...d, ...d.lp } : d));
    return {
        maxWz:  Math.min(...data.map(d => d.max_wz ?? Infinity)),
        minZ:   Math.max(...data.map(d => d.min_z)),
        minFck: Math.max(...data.map(d => d.min_f_ck_cube)),
    };
}

/**
 * Mean minimum air content of air-entrained concrete in Vol.-% (Heidelberg Materials,
 * Betontechnische Daten 2022, Tabelle 6.3.5.a): by maximum grain, one point more for
 * flowable concrete (≥ F4).
 * @param {number} maxGrain - 8, 16, 32 or 63 mm
 * @param {string} consistencyClass
 * @returns {number}
 */
export function minAirContent(maxGrain, consistencyClass) {
    const base = maxGrain <= 8 ? 5.5 : maxGrain <= 16 ? 4.5 : maxGrain <= 32 ? 4.0 : 3.5;
    return ['F4', 'F5', 'F6'].includes(consistencyClass) ? base + 1 : base;
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
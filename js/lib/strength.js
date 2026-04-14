// strength.js - Druckfestigkeitsklassen und Walzkurven nach Zement-Merkblatt B 20
// Characteristic compressive strength classes and Roll curves for concrete

/**
 * Cement strength classes according to DIN EN 197-1
 * Used for Walzkurven (Roll curves) calculations
 * f_cm = A * (z/w)^n  (Bild 1, B20)
 */
// A and n calibrated to the LOWER BOUNDARY of B20 Bild 1 (design/conservative reading).
// Calibration points from B20 worked examples (Anhang):
//   CEM I 42.5 N: f_cm,dry,cube=34.6 → w/z=0.68  (Beispiel I, p.3-4)
//     → A=34.6/(1/0.68)^0.67 = 34.6/1.296 ≈ 27
//   CEM I 52.5 R: f_cm,dry,cube=59 → w/z=0.52     (Beispiel III, p.15-17)
//     → A=59/(1/0.52)^0.67 = 59/1.551 ≈ 38
export const CEMENT_CLASSES = {
    '32.5':  { name: 'CEM I 32.5 N', A: 19, n: 0.67 },
    '42.5':  { name: 'CEM I 42.5 N', A: 27, n: 0.67 },
    '42.5R': { name: 'CEM I 42.5 R', A: 31, n: 0.67 },
    '52.5':  { name: 'CEM I 52.5 N', A: 35, n: 0.67 },
    '52.5R': { name: 'CEM I 52.5 R', A: 38, n: 0.67 }
};

/**
 * Cement types used in practice (Zementarten) – B20 Section 7.2
 * Combines DIN designation, Walzkurven key, density, and fly ash limit factor.
 *
 * faMaxFactor: max fly ash that may be credited on w/z-Wert
 *   0.33 → Zemente ohne P, V und D  (CEM I, CEM II/A-S, CEM II/A-LL, …)
 *   0.25 → Zemente mit P oder V, aber ohne D
 *   0.15 → Zemente mit D
 */
export const CEMENT_TYPES = {
    'CEM I 32.5 N':    { walzkurveKey: '32.5',  density: 3.1, faMaxFactor: 0.33 },
    'CEM I 42.5 N':    { walzkurveKey: '42.5',  density: 3.1, faMaxFactor: 0.33 },
    'CEM I 42.5 R':    { walzkurveKey: '42.5R', density: 3.1, faMaxFactor: 0.33 },
    'CEM I 52.5 N':    { walzkurveKey: '52.5',  density: 3.1, faMaxFactor: 0.33 },
    'CEM I 52.5 R':    { walzkurveKey: '52.5R', density: 3.1, faMaxFactor: 0.33 },
    'CEM II/A-S 42.5 N': { walzkurveKey: '42.5', density: 3.0, faMaxFactor: 0.25 },
    'CEM II/B-S 42.5 N': { walzkurveKey: '42.5', density: 3.0, faMaxFactor: 0.25 },
    'CEM II/A-LL 42.5 N':{ walzkurveKey: '42.5', density: 3.0, faMaxFactor: 0.33 },
    'CEM III/A 42.5 N':  { walzkurveKey: '42.5', density: 3.0, faMaxFactor: 0.25 },
    'CEM III/B 42.5 N':  { walzkurveKey: '42.5', density: 2.9, faMaxFactor: 0.25 }
};

/**
 * Druckfestigkeitsklassen (Pressure Strength Classes)
 * f_ck,cyl: charakteristische Festigkeit von Zylindern (150mm x 300mm)
 * f_ck,cube: charakteristische Festigkeit von Würfeln (150mm)
 * Alter: 28 Tage, Lagerung nach DIN EN 12390-2
 */
export const STRENGTH_CLASSES = {
    'C8/10':   { f_ck_cyl: 8,   f_ck_cube: 10,   min_f_cm: 16  },
    'C12/15':  { f_ck_cyl: 12,  f_ck_cube: 15,   min_f_cm: 20  },
    'C16/20':  { f_ck_cyl: 16,  f_ck_cube: 20,   min_f_cm: 24  },
    'C20/25':  { f_ck_cyl: 20,  f_ck_cube: 25,   min_f_cm: 28  },
    'C25/30':  { f_ck_cyl: 25,  f_ck_cube: 30,   min_f_cm: 33  },
    'C30/37':  { f_ck_cyl: 30,  f_ck_cube: 37,   min_f_cm: 38  },
    'C35/45':  { f_ck_cyl: 35,  f_ck_cube: 45,   min_f_cm: 43  },
    'C40/50':  { f_ck_cyl: 40,  f_ck_cube: 50,   min_f_cm: 48  },
    'C45/55':  { f_ck_cyl: 45,  f_ck_cube: 55,   min_f_cm: 53  },
    'C50/60':  { f_ck_cyl: 50,  f_ck_cube: 60,   min_f_cm: 58  },
    'C55/67':  { f_ck_cyl: 55,  f_ck_cube: 67,   min_f_cm: 63  },
    'C60/75':  { f_ck_cyl: 60,  f_ck_cube: 75,   min_f_cm: 68  },
    'C70/85':  { f_ck_cyl: 70,  f_ck_cube: 85,   min_f_cm: 78  },
    'C80/95':  { f_ck_cyl: 80,  f_ck_cube: 95,   min_f_cm: 88  },
    'C90/105': { f_ck_cyl: 90,  f_ck_cube: 105,  min_f_cm: 98  },
    'C100/115':{ f_ck_cyl: 100, f_ck_cube: 115,  min_f_cm: 108 }
};

/**
 * Get strength class data by key
 * @param {string} className - Concrete strength class (e.g., 'C20/25')
 * @returns {object|null} Strength class data or null if not found
 */
export function getStrengthClass(className) {
    return STRENGTH_CLASSES[className] || null;
}

/**
 * Calculate target mean compressive strength (Zielfestigkeit)
 * f_cm = f_ck + 8 N/mm² (standard approximation)
 * @param {number} f_ck - Characteristic strength in N/mm²
 * @returns {number} Target mean strength in N/mm²
 */
export function calculateTargetStrength(f_ck) {
    return f_ck + 8;
}

/**
 * Calculate target strength with statistical consideration
 * f_cm,cube,dry ≥ (f_ck / 0.92) + 1.48·σ + Vorhaltemaß
 * @param {number} f_ck - Characteristic strength in N/mm²
 * @param {number} sigma - Standard deviation (default: 3 N/mm² for good conditions)
 * @param {number} margin - Safety margin (Vorhaltemaß, default: 3-12 N/mm²)
 * @returns {number} Target dry-cube strength in N/mm²
 */
export function calculateTargetStrengthWithMargin(f_ck, sigma = 3, margin = 3) {
    const f_cm_cube = (f_ck / 0.92) + (1.48 * sigma) + margin;
    return Math.round(f_cm_cube * 10) / 10; // Round to 1 decimal
}

/**
 * Convert wet-curing strength to dry-curing strength
 * f_c,dry,cube = f_c,cube / 0.92
 * For German conditions: 7 days moist + 21 days air curing
 * @param {number} f_cm_cube - Target strength from standard curing
 * @returns {number} Dry-cured target strength in N/mm²
 */
export function convertToDryCuring(f_cm_cube) {
    return f_cm_cube / 0.92;
}

/**
 * Get all available strength classes sorted by strength
 * @returns {string[]} Array of class names
 */
export function getAvailableClasses() {
    return Object.keys(STRENGTH_CLASSES).sort((a, b) => {
        const aNum = parseInt(a.split('/')[0]);
        const bNum = parseInt(b.split('/')[0]);
        return aNum - bNum;
    });
}

/**
 * Recommend strength class based on use case and exposure
 * @param {string} useCase - Use case identifier
 * @param {string} exposureClass - Exposure class (e.g., 'XC1')
 * @returns {string} Recommended strength class
 */
export function recommendStrengthClass(useCase, exposureClass = null) {
    const recommendations = {
        foundation: 'C20/25',
        tabletop: 'C25/30',
        driveway: 'C25/30',
        wall: 'C20/25',
        slab: 'C20/25',
        stairs: 'C25/30'
    };

    // For higher exposure classes, recommend stronger concrete
    if (exposureClass) {
        const highExposure = ['XC4', 'XD1', 'XS1', 'XF2', 'XF3', 'XA1', 'XA2', 'XM1'];
        if (highExposure.includes(exposureClass)) {
            return 'C30/37';
        }
    }

    return recommendations[useCase] || 'C20/25';
}

/**
 * Get cement strength class data by key
 * @param {string} classKey - Cement class key (e.g., '42.5', '52.5R')
 * @returns {object|null} Cement class data with A and n parameters, or null if not found
 */
export function getCementClass(classKey) {
    return CEMENT_CLASSES[classKey] || null;
}

/**
 * Calculate w/z ratio from a target compressive strength using Walzkurven (inverse)
 * w/z = (A / f_cm_target)^(1/n)
 * @param {number} f_cm_target - Target dry-cube mean strength in N/mm²
 * @param {string} cementClassKey - Cement class key (e.g., '42.5')
 * @returns {number|null} Required w/z ratio or null if invalid
 */
export function calculateWzFromTargetStrength(f_cm_target, cementClassKey) {
    if (!f_cm_target || f_cm_target <= 0) return null;
    const cementClass = CEMENT_CLASSES[cementClassKey];
    if (!cementClass) return null;
    // w/z = (A / f_cm)^(1/n)
    const wz = Math.pow(cementClass.A / f_cm_target, 1 / cementClass.n);
    return Math.round(wz * 1000) / 1000; // 3 decimal places
}

/**
 * Get all available cement types with their metadata
 * @returns {string[]} Array of cement type names
 */
export function getAvailableCementTypes() {
    return Object.keys(CEMENT_TYPES);
}

/**
 * Get cement type metadata
 * @param {string} typeName - Cement type name (e.g., 'CEM I 42.5 N')
 * @returns {object|null} Cement type data or null
 */
export function getCementType(typeName) {
    return CEMENT_TYPES[typeName] || null;
}

/**
 * Calculate concrete compressive strength using Walzkurven (Roll curves)
 * f_cm = A * (z/w)^n
 * 
 * Based on Zement-Merkblatt B 20 relationship between:
 * - Concrete compressive strength (f_cm)
 * - Cement strength class (CEM I 42.5 N, CEM I 52.5 N, etc.)
 * - Water-cement ratio (w/z)
 * 
 * @param {number} waterCementRatio - Water-cement ratio (w/z), must be > 0
 * @param {string} cementClassKey - Cement class key (e.g., '42.5', '52.5R')
 * @returns {number|null} Concrete compressive strength in N/mm² or null if invalid
 */
export function calculateStrengthFromWalzkurven(waterCementRatio, cementClassKey) {
    if (waterCementRatio === undefined || waterCementRatio <= 0) return null;
    
    const cementClass = CEMENT_CLASSES[cementClassKey];
    if (!cementClass) return null;
    
    // f_cm = A * (z/w)^n where z/w = 1/(w/z)
    const zWRatio = 1 / waterCementRatio;
    const strength = cementClass.A * Math.pow(zWRatio, cementClass.n);
    
    return Math.round(strength * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate equivalent concrete strength when using supplementary materials
 * Adjusts for fly ash and silica fume effects on strength development
 * 
 * @param {number} waterCementRatio - Water-cement ratio (w/z)
 * @param {string} cementClassKey - Cement class key (e.g., '42.5')
 * @param {number} flyAshFraction - Fraction of cement replaced by fly ash (0-1, optional)
 * @param {number} silicaFumeFraction - Fraction of cement replaced by silica fume (0-1, optional)
 * @returns {number|null} Equivalent concrete strength in N/mm² or null if invalid
 */
export function calculateStrengthWithSupplementaryMaterials(waterCementRatio, cementClassKey, flyAshFraction = 0, silicaFumeFraction = 0) {
    if (waterCementRatio === undefined || waterCementRatio <= 0) return null;
    
    const cementClass = CEMENT_CLASSES[cementClassKey];
    if (!cementClass) return null;
    
    // Effective binder ratio considering supplementary materials
    // Fly ash reduces strength development, silica fume can increase it
    const flyAshEffect = 1 - (flyAshFraction * 0.2); // ~20% reduction per 10% FA
    const silicaFumeEffect = 1 + (silicaFumeFraction * 0.15); // ~15% increase per 5% SF
    
    const effectiveA = cementClass.A * flyAshEffect * silicaFumeEffect;
    
    const zWRatio = 1 / waterCementRatio;
    const strength = effectiveA * Math.pow(zWRatio, cementClass.n);
    
    return Math.round(strength * 10) / 10; // Round to 1 decimal
}

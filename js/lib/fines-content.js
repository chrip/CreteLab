// fines-content.js - Mehlkorn- und Feinstsandanteil nach Zement-Merkblatt B 20 (Tafel 8, 23)
// Fines content calculations for concrete mix verification

/**
 * Mehlkorngehalt (Fines Content) limits according to B20 Tafel 23
 * Maximum permissible fines content in kg/m³ depending on cement content and exposure class
 */
export const MAX_FINES_LIMITS = {
    // Expositionsklassen X0, XC, XD, XS, XA
    'non-exposed': {
        cementMax300: { limit: 450 },
        cementMin350: { limit: 550 }
    },
    // Expositionsklassen XF, XM ( frost/schleiß )
    'frost-wear': {
        cementMax300: { limit: 400 },
        cementMin350: { limit: 450 }
    }
};

/**
 * Calculate total fines content in kg/m³
 * Mehlkorngehalt = Zement + pulverförmige Zusatzstoffe + Gesteinskörnung bis 0,125 mm
 * Mehlkorn- und Feinstsandanteil = Zement + pulverförmige Zusatzstoffe + Gesteinskörnung bis 0,25 mm
 * 
 * @param {number} cement - Cement content in kg/m³
 * @param {number} flyAsh - Fly ash content in kg/m³ (optional)
 * @param {number} silicaFume - Silica fume content in kg/m³ (optional)
 * @param {number} limestoneFiller - Limestone filler content in kg/m³ (optional)
 * @param {number} trass - Trass content in kg/m³ (optional)
 * @param {number} fineAggregate0125 - Fine aggregate ≤0.125mm in kg/m³ (optional)
 * @param {number} fineAggregate025 - Fine aggregate ≤0.25mm in kg/m³ (optional)
 * @returns {object|null} Fines content calculation result or null if invalid
 */
export function calculateFinesContent({
    cement,
    flyAsh = 0,
    silicaFume = 0,
    limestoneFiller = 0,
    trass = 0,
    fineAggregate0125 = 0,
    fineAggregate025 = 0
}) {
    if (cement === undefined || cement < 0) return null;

    const totalPulverförmig = cement + flyAsh + silicaFume + limestoneFiller + trass;
    
    // Mehlkorngehalt: Zement + pulverförmige Zusatzstoffe + Gesteinskörnung bis 0,125 mm
    const finesContent0125 = totalPulverförmig + fineAggregate0125;
    
    // Mehlkorn- und Feinstsandanteil: Zement + pulverförmige Zusatzstoffe + Gesteinskörnung bis 0,25 mm
    const finesContent025 = totalPulverförmig + fineAggregate025;

    return {
        cement: Math.round(cement),
        flyAsh: Math.round(flyAsh || 0),
        silicaFume: Math.round(silicaFume || 0),
        limestoneFiller: Math.round(limestoneFiller || 0),
        trass: Math.round(trass || 0),
        totalPulverförmig: Math.round(totalPulverförmig),
        fineAggregate0125: Math.round(fineAggregate0125 || 0),
        finesContent0125: Math.round(finesContent0125),
        fineAggregate025: Math.round(fineAggregate025 || 0),
        finesContent025: Math.round(finesContent025)
    };
}

/**
 * Check if fines content exceeds maximum limits
 * @param {object} fines - Fines content data from calculateFinesContent()
 * @param {string} exposureClass - Exposure class (e.g., 'XC1', 'XF2')
 * @returns {object|null} Validation result or null if invalid
 */
export function checkFinesLimits(fines, exposureClass) {
    if (!fines || fines.cement === undefined) return null;

    const cement = fines.cement;
    
    // Determine if frost/wear class
    const isFrostWear = ['XF1', 'XF2', 'XF3', 'XF4', 'XM1', 'XM2', 'XM3'].includes(exposureClass);
    
    let maxLimit;
    
    if (isFrostWear) {
        // Frost/wear classes
        maxLimit = cement <= 300 ? MAX_FINES_LIMITS['frost-wear'].cementMax300.limit 
                                  : MAX_FINES_LIMITS['frost-wear'].cementMin350.limit;
    } else {
        // Non-exposed classes (X0, XC, XD, XS, XA)
        maxLimit = cement <= 300 ? MAX_FINES_LIMITS['non-exposed'].cementMax300.limit 
                                  : MAX_FINES_LIMITS['non-exposed'].cementMin350.limit;
    }

    // For C50/60 and higher, the limits can be increased by 50 kg/m³
    if (fines.finesContent0125 > 400) {
        maxLimit += 50;
    }

    return {
        finesContent: fines.finesContent0125,
        maxAllowed: maxLimit,
        exceedsLimit: fines.finesContent0125 > maxLimit,
        limitType: isFrostWear ? 'frost-wear' : 'non-exposed',
        cementThreshold: cement <= 300 ? 300 : 350
    };
}

/**
 * Calculate paste volume (Zementleimgehalt) in kg/m³
 * Paste volume = Zement + Zusatzstoffe (Flugasche, Silikastaub)
 * Recommended minimum: ≥ 320 kg/m³ for XC4/XF2/XF4, ≥ 350 kg/m³ for underwater concrete
 * 
 * @param {number} cement - Cement content in kg/m³
 * @param {number} flyAsh - Fly ash content in kg/m³ (optional)
 * @param {number} silicaFume - Silica fume content in kg/m³ (optional)
 * @param {number} limestoneFiller - Limestone filler content in kg/m³ (optional)
 * @returns {object|null} Paste volume calculation result or null if invalid
 */
export function calculatePasteVolume(cement, flyAsh = 0, silicaFume = 0, limestoneFiller = 0) {
    if (cement === undefined || cement < 0) return null;

    const pasteVolume = cement + flyAsh + silicaFume + limestoneFiller;

    return {
        cement: Math.round(cement),
        flyAsh: Math.round(flyAsh || 0),
        silicaFume: Math.round(silicaFume || 0),
        limestoneFiller: Math.round(limestoneFiller || 0),
        pasteVolume: Math.round(pasteVolume)
    };
}

/**
 * Check if paste volume meets minimum requirements
 * @param {object} paste - Paste volume data from calculatePasteVolume()
 * @param {string} exposureClass - Exposure class (e.g., 'XC4', 'XF2')
 * @returns {object|null} Validation result or null if invalid
 */
export function checkPasteRequirements(paste, exposureClass) {
    if (!paste || paste.cement === undefined) return null;

    const pasteVolume = paste.pasteVolume;
    
    // Minimum requirements from B20 Tafel 9 and examples
    let minRequirement;
    
    switch (exposureClass) {
        case 'XC4': 
            minRequirement = 320; 
            break;
        case 'XD1':
        case 'XD2': 
        case 'XD3':
            minRequirement = 300;
            break;
        case 'XF1': 
            minRequirement = 280; 
            break;
        case 'XF2': 
        case 'XF3': 
        case 'XF4':
            minRequirement = 320; // With LP, may need higher
            break;
        case 'XA1':
        case 'XA2':
        case 'XA3':
            minRequirement = 280;
            break;
        case 'XM1':
            minRequirement = 300;
            break;
        case 'XM2':
        case 'XM3':
            minRequirement = 320;
            break;
        default: // XC1, XC2, XC3, X0
            minRequirement = 240;
    }

    return {
        pasteVolume: pasteVolume,
        minRequired: minRequirement,
        meetsRequirement: pasteVolume >= minRequirement,
        exposureClass: exposureClass
    };
}

/**
 * Check CEM I specific rules for combined fly ash and silica fume
 * According to B20: f/z ≤ 3·(0.22 - s/z) for CEM I
 * 
 * @param {number} cement - Cement content in kg/m³
 * @param {number} flyAsh - Fly ash content in kg/m³
 * @param {number} silicaFume - Silica fume content in kg/m³
 * @returns {object|null} Validation result or null if invalid
 */
export function checkCemIFlyAshSilicaFume(cement, flyAsh, silicaFume) {
    if (cement === undefined || cement <= 0) return null;
    
    const fZ = flyAsh / cement; // Fly ash to cement ratio
    const sZ = silicaFume / cement; // Silica fume to cement ratio
    
    // CEM I specific limit: f/z ≤ 3·(0.22 - s/z)
    const maxFLimit = 3 * (0.22 - sZ);
    
    return {
        cement: Math.round(cement),
        flyAsh: Math.round(flyAsh || 0),
        silicaFume: Math.round(silicaFume || 0),
        fZRatio: parseFloat(fZ.toFixed(4)),
        sZRatio: parseFloat(sZ.toFixed(4)),
        maxFLimit: parseFloat(maxFLimit.toFixed(4)),
        meetsLimit: fZ <= maxFLimit,
        limitType: 'CEM I'
    };
}

/**
 * Get recommended paste volume for exposure class
 * @param {string} exposureClass - Exposure class
 * @returns {number|null} Recommended minimum paste volume or null if not found
 */
export function getRecommendedPasteVolume(exposureClass) {
    const recommendations = {
        'X0': 240,
        'XC1': 260,
        'XC2': 260,
        'XC3': 280,
        'XC4': 320,
        'XD1': 300,
        'XD2': 320,
        'XD3': 320,
        'XS1': 280,
        'XS2': 320,
        'XS3': 320,
        'XF1': 280,
        'XF2': 320,
        'XF3': 320,
        'XF4': 320,
        'XA1': 280,
        'XA2': 320,
        'XA3': 320,
        'XM1': 300,
        'XM2': 320,
        'XM3': 320
    };
    
    return recommendations[exposureClass] || null;
}
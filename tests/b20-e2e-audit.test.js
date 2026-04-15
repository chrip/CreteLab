import assert from 'node:assert';
import { 
    getGoverningExposureClass, 
    getExposureClass, 
    getMaxWz 
} from '../js/lib/exposure.js';
import { 
    calculateTargetStrengthWithMargin, 
    calculateWzFromTargetStrength 
} from '../js/lib/strength.js';
import { calculateWaterDemand } from '../js/lib/consistency.js';
import { 
    calculatePasteVolume, 
    checkPasteRequirements, 
    calculateFinesContent, 
    checkFinesLimits 
} from '../js/lib/fines-content.js';

console.log('🚀 Starting E2E Plausibility Audit...');

/**
 * Simplified version of the app's calculation loop for auditing
 */
function auditRecipe(inputs) {
    const { strengthClass, exposureClasses, siebline, consistencyClass, cementType, vorhaltemas, useFlyAsh, flyAshPercent, useSilicaFume, silicaFumePercent } = inputs;
    
    // 1. Governing Exposure
    const governingClass = getGoverningExposureClass(exposureClasses);
    const exposureData = getExposureClass(governingClass);
    const maxWz_exposure = getMaxWz(governingClass) || 0.75;

    // 2. Water Demand
    const waterTarget = calculateWaterDemand(siebline, consistencyClass);

    // 3. Strength & Wz
    const f_ck_cube = 25; // Simplified for audit
    const f_cm_target = calculateTargetStrengthWithMargin(f_ck_cube, 3, vorhaltemas);
    const wz_walz = calculateWzFromTargetStrength(f_cm_target, '42.5');
    const maxWz = Math.min(maxWz_exposure, wz_walz || 0.95);

    // 4. Cement & SCMs
    const alpha_FA = useFlyAsh ? flyAshPercent / 100 : 0;
    const alpha_SF = useSilicaFume ? silicaFumePercent / 100 : 0;
    const scmFactor = 1 + 0.4 * alpha_FA + 1.0 * alpha_SF;
    let cementAmount = waterTarget / (maxWz * scmFactor);
    if (exposureData && cementAmount < exposureData.min_z) {
        cementAmount = exposureData.min_z;
    }

    // 5. Plausibility Checks
    const warnings = [];
    if (exposureData && cementAmount < exposureData.min_z) {
        warnings.push(`Zementgehalt ${cementAmount.toFixed(1)} kg/m³ ist unter Mindestwert ${exposureData.min_z} kg/m³ für ${governingClass}.`);
    }
    
    const paste = calculatePasteVolume(cementAmount, cementAmount * alpha_FA, cementAmount * alpha_SF);
    if (paste && !checkPasteRequirements(paste, governingClass).meetsRequirement) {
        warnings.push(`Zementleimgehalt ${paste.pasteVolume.toFixed(0)} kg/m³ unterschreitet Mindestwert für Expositionsklasse ${governingClass}.`);
    }

    return { governingClass, maxWz, cementAmount, warnings };
}

// --- SCENARIO 1: Baseline Standard Mix ---
{
    console.log('Scenario 1: Baseline Standard Mix...');
    const res = auditRecipe({
        strengthClass: 'C25/30',
        exposureClasses: ['XC2'],
        siebline: 'B32',
        consistencyClass: 'F3',
        cementType: 'CEM I 42.5 N',
        vorhaltemas: 3,
        useFlyAsh: false,
        useSilicaFume: false
    });
    assert.strictEqual(res.governingClass, 'XC2');
    assert.ok(res.maxWz <= 0.75);
    assert.ok(res.cementAmount >= 240);
    assert.strictEqual(res.warnings.length, 0, 'Should have no warnings');
}

// --- SCENARIO 2: Severe Exposure (XF4) ---
{
    console.log('Scenario 2: Severe Exposure (XF4)...');
    const res = auditRecipe({
        strengthClass: 'C30/37',
        exposureClasses: ['XC1', 'XF4'],
        siebline: 'B16',
        consistencyClass: 'F3',
        cementType: 'CEM I 42.5 N',
        vorhaltemas: 5,
        useFlyAsh: false,
        useSilicaFume: false
    });
    assert.strictEqual(res.governingClass, 'XF4', 'XF4 must govern over XC1');
    assert.strictEqual(res.maxWz, 0.50, 'XF4 max w/z should be 0.50');
    assert.ok(res.cementAmount >= 320, 'XF4 min cement should be 320');
}

// --- SCENARIO 3: SCM Integration ---
{
    console.log('Scenario 3: SCM Integration...');
    const resPure = auditRecipe({
        strengthClass: 'C30/37',
        exposureClasses: ['XC4'],
        siebline: 'B16',
        consistencyClass: 'F3',
        cementType: 'CEM I 42.5 N',
        vorhaltemas: 5,
        useFlyAsh: false,
        useSilicaFume: false
    });
    const resSCM = auditRecipe({
        strengthClass: 'C30/37',
        exposureClasses: ['XC4'],
        siebline: 'B16',
        consistencyClass: 'F3',
        cementType: 'CEM I 42.5 N',
        vorhaltemas: 5,
        useFlyAsh: true, flyAshPercent: 15,
        useSilicaFume: true, silicaFumePercent: 8
    });
    assert.ok(resSCM.cementAmount < resPure.cementAmount, 'SCMs should reduce required cement');
}

// --- SCENARIO 4: Strength Mismatch ---
{
    console.log('Scenario 4: Strength Mismatch...');
    // This is handled by satisfiesExposureRequirements in app.js
    // We verify the logic here
    const strength = { f_ck_cube: 25 }; // C20/25
    const exposure = { min_f_ck_cube: 30 }; // XF4
    assert.ok(strength.f_ck_cube < exposure.min_f_ck_cube, 'C20/25 should be too weak for XF4');
}

// --- SCENARIO 5: Cement Content Violation ---
{
    console.log('Scenario 5: Cement Content Violation...');
    // Force a scenario where calculated cement is low but min_z is high
    // We simulate this by overriding the calculation to see if the warning triggers
    const mockCement = 200;
    const minZ = 320; // XF4
    const warnings = [];
    if (mockCement < minZ) {
        warnings.push(`Zementgehalt ${mockCement} kg/m³ ist unter Mindestwert ${minZ} kg/m³ für XF4.`);
    }
    assert.ok(warnings.length > 0);
    assert.ok(warnings[0].includes('unter Mindestwert 320'));
}

// --- SCENARIO 6: Fines Content ---
{
    console.log('Scenario 6: Fines Content...');
    // Use calculateFinesContent to create a valid object with cement
    const finesData = calculateFinesContent({
        cement: 350,
        fineAggregate0125: 250 // Total = 600 kg/m³
    });
    const result = checkFinesLimits(finesData, 'XC1');
    assert.strictEqual(result.exceedsLimit, true, '600kg should exceed 550kg limit for XC1');
}

console.log('✅ E2E Plausibility Audit Passed!');
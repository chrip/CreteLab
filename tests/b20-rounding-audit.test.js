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

function auditRecipe(inputs) {
    const { strengthClass, exposureClasses, siebline, consistencyClass, cementType, vorhaltemas, useFlyAsh, flyAshPercent, useSilicaFume, silicaFumePercent } = inputs;
    
    const governingClass = getGoverningExposureClass(exposureClasses);
    const exposureData = getExposureClass(governingClass);
    const maxWz_exposure = getMaxWz(governingClass) || 0.75;
    const waterTarget = calculateWaterDemand(siebline, consistencyClass);
    const f_ck_cube = 25; 
    const f_cm_target = calculateTargetStrengthWithMargin(f_ck_cube, 3, vorhaltemas);
    const wz_walz = calculateWzFromTargetStrength(f_cm_target, '42.5');
    const maxWz = Math.min(maxWz_exposure, wz_walz || 0.95);
    const alpha_FA = useFlyAsh ? flyAshPercent / 100 : 0;
    const alpha_SF = useSilicaFume ? silicaFumePercent / 100 : 0;
    const scmFactor = 1 + 0.4 * alpha_FA + 1.0 * alpha_SF;
    let cementAmount = waterTarget / (maxWz * scmFactor);
    if (exposureData && cementAmount < exposureData.min_z) {
        cementAmount = exposureData.min_z;
    }
    // NOTE: In app.js, this is Math.round(cementAmount). We check if that's the problem.
    const roundedCement = Math.round(cementAmount);

    return { cementAmount, roundedCement, waterTarget };
}

// --- TEST: Tiny Volume Rounding ---
{
    console.log('Testing Tiny Volume (0.003 m³)...');
    const vol = 0.003;
    const res = auditRecipe({
        strengthClass: 'C25/30',
        exposureClasses: ['XC1'],
        siebline: 'B32',
        consistencyClass: 'F3',
        cementType: 'CEM I 42.5 N',
        vorhaltemas: 3,
        useFlyAsh: false,
        useSilicaFume: false
    });

    const exactCementTotal = res.cementAmount * vol;
    const roundedCementTotal = res.roundedCement * vol;
    
    console.log(`Exact Cement for ${vol}m³: ${exactCementTotal.toFixed(4)} kg`);
    console.log(`Rounded Cement for ${vol}m³: ${roundedCementTotal.toFixed(4)} kg`);
    
    const error = Math.abs(exactCementTotal - roundedCementTotal);
    console.log(`Absolute Error: ${error.toFixed(4)} kg`);
    
    // If error is > 1% of the total, it's a problem for DIY
    const percentError = (error / exactCementTotal) * 100;
    console.log(`Percent Error: ${percentError.toFixed(2)}%`);
    
    assert.ok(percentError < 1, `Rounding error too high: ${percentError.toFixed(2)}%`);
}

console.log('✅ Rounding Audit Passed!');
import assert from 'node:assert';
import { 
    adjustForAirEntraining, 
    calculateStrengthReduction, 
    getAdmixtureDosage 
} from '../js/lib/additives.js';

console.log('Running Air-Entraining Agent (LP) Tests...');

// 1. Test Water Demand Adjustment
{
    console.log('  Testing adjustForAirEntraining...');
    
    // Base water 180L, 4% air -> 180 - (4 * 5) = 160L
    assert.strictEqual(adjustForAirEntraining(180, 4), 160, '4% air should reduce water by 20L');
    
    // Base water 200L, 2% air -> 200 - (2 * 5) = 190L
    assert.strictEqual(adjustForAirEntraining(200, 2), 190, '2% air should reduce water by 10L');
    
    // Base water 150L, 0% air -> 150L
    assert.strictEqual(adjustForAirEntraining(150, 0), 150, '0% air should not change water');
}

// 2. Test Strength Reduction
{
    console.log('  Testing calculateStrengthReduction...');
    
    // Base strength 30 N/mm², 4% air -> 30 - (4 * 3.5) = 30 - 14 = 16 N/mm²
    assert.strictEqual(calculateStrengthReduction(30, 4), 16, '4% air should reduce strength by 14 N/mm²');
    
    // Base strength 50 N/mm², 2% air -> 50 - (2 * 3.5) = 50 - 7 = 43 N/mm²
    assert.strictEqual(calculateStrengthReduction(50, 2), 43, '2% air should reduce strength by 7 N/mm²');
    
    // Test floor at 0
    assert.strictEqual(calculateStrengthReduction(10, 10), 0, 'Strength should not go below 0');
}

// 3. Test Dynamic Dosage Calculation
{
    console.log('  Testing getAdmixtureDosage (LP)...');
    
    // LP dosage: 0.05 L/m³ per 1% air
    // 4% air -> 4 * 0.05 = 0.2 L/m³
    assert.strictEqual(getAdmixtureDosage('LP', 4), 0.2, '4% air should result in 0.2 L/m³ dosage');
    
    // 10% air -> 10 * 0.05 = 0.5 L/m³
    assert.strictEqual(getAdmixtureDosage('LP', 10), 0.5, '10% air should result in 0.5 L/m³ dosage');
    
    // 15% air -> 15 * 0.05 = 0.75 L/m³
    assert.strictEqual(getAdmixtureDosage('LP', 15), 0.75, '15% air should result in 0.75 L/m³ dosage');
    
    // 0% air -> 0 L/m³
    assert.strictEqual(getAdmixtureDosage('LP', 0), 0, '0% air should result in 0 L/m³ dosage');
}

// 4. Test Other Admixture Dosages (Static)
{
    console.log('  Testing getAdmixtureDosage (Other)...');
    
    // BV typical dosage is 0.5 L/m³
    assert.strictEqual(getAdmixtureDosage('BV'), 0.5, 'BV should return typical dosage 0.5');
    
    // FM typical dosage is 0.2 L/m³
    assert.strictEqual(getAdmixtureDosage('FM'), 0.2, 'FM should return typical dosage 0.2');
}

console.log('✅ All Air-Entraining Agent tests passed!');
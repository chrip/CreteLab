import assert from 'node:assert';
import { 
    getGoverningExposureClass, 
    getExposureClass, 
    getMaxWz, 
    satisfiesExposureRequirements,
    getAvailableExposureClasses 
} from '../js/lib/exposure.js';
import { getStrengthClass } from '../js/lib/strength.js';

// Mocking getStrengthClass since it's used by satisfiesExposureRequirements
// In a real environment, we'd import the actual strength.js, but for this test 
// we want to ensure the exposure logic is isolated.
// Note: Since we are using ES modules in node --test, we can just import the real one.

console.log('Running Exposure Class Tests...');

// 1. Test Governing Class Logic
{
    console.log('  Testing getGoverningExposureClass...');
    
    // Case: Single class
    assert.strictEqual(getGoverningExposureClass(['XC1']), 'XC1', 'Single class should be governing');
    
    // Case: Mild vs Severe (XC1 vs XF4)
    // XF4 is much more severe than XC1
    assert.strictEqual(getGoverningExposureClass(['XC1', 'XF4']), 'XF4', 'XF4 should govern over XC1');
    assert.strictEqual(getGoverningExposureClass(['XF4', 'XC1']), 'XF4', 'XF4 should govern regardless of order');
    
    // Case: Multiple severe classes (XD3 vs XS3)
    // Both are severe, but XS3 is later in the severityOrder list
    assert.strictEqual(getGoverningExposureClass(['XD3', 'XS3']), 'XS3', 'XS3 should govern over XD3');
    
    // Case: Extreme range (X0 vs XM3)
    assert.strictEqual(getGoverningExposureClass(['X0', 'XM3']), 'XM3', 'XM3 should govern over X0');
    
    // Case: Empty or null
    assert.strictEqual(getGoverningExposureClass([]), null, 'Empty array should return null');
    assert.strictEqual(getGoverningExposureClass(null), null, 'Null should return null');
}

// 2. Test Max W/Z values
{
    console.log('  Testing getMaxWz...');
    
    // X0 has no limit
    assert.strictEqual(getMaxWz('X0'), null, 'X0 should have no w/z limit');
    
    // XC1 has 0.75
    assert.strictEqual(getMaxWz('XC1'), 0.75, 'XC1 should have max w/z 0.75');
    
    // XF4 has 0.50
    assert.strictEqual(getMaxWz('XF4'), 0.50, 'XF4 should have max w/z 0.50');
    
    // Test reduction (betontechnologische Abminderung)
    // 0.75 - 0.02 = 0.73
    assert.strictEqual(getMaxWz('XC1', true), 0.73, 'Reduction should subtract 0.02');
}

// 3. Test Strength Requirements
{
    console.log('  Testing satisfiesExposureRequirements...');
    
    // C20/25 (f_ck_cube = 25) vs XC1 (min_f_ck_cube = 16) -> OK
    assert.strictEqual(satisfiesExposureRequirements('C20/25', 'XC1'), true, 'C20/25 should satisfy XC1');
    
    // C12/15 (f_ck_cube = 15) vs XC4 (min_f_ck_cube = 25) -> FAIL
    assert.strictEqual(satisfiesExposureRequirements('C12/15', 'XC4'), false, 'C12/15 should NOT satisfy XC4');
}

console.log('✅ All Exposure Class tests passed!');
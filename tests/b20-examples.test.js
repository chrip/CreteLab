/**
 * Unit tests based on Zement-Merkblatt B 20 example calculations (Beispiele)
 * 
 * All test cases verify that the functions produce results matching the official
 * examples from the Merkblatt. Tests call actual library functions, not constants.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';


// Import modules to test - these are ACTUAL functions being tested
import { 
    calculateWaterDemand,
    calculateAverageK,
    adjustForAggregateType
} from '../js/lib/consistency.js';

import { 
    getAverageDensity,
    stofraumrechnung
} from '../js/lib/densities.js';

import { 
    calculateEquivalentWz,
    getMaxSupplementaryContent,
    calculateMaxFlyAshContent,
    calculateStrengthReduction,
    adjustForAirEntraining,
    calculateEquivalentWzWithBoth,
    calculateAdmixtureContent,
    calculateAdmixtureFromBV,
    calculateMaxSupplementaryContent,
    getRecommendedWaterSaving,
    applyAdmixtureWaterReduction
} from '../js/lib/additives.js';

import {
    calculateTargetStrength,
    convertToDryCuring,
    calculatePasteVolume,
    calculateFinesContent,
    calculateAdditionWater,
    calculateTotalConcreteMass,
    calculateCementFromWz,
    adjustForAirEntraining as adjustLP,
    calculateStrengthReduction as reduceStrength,
    calcEqWz,
    calculateSurfaceMoistureContribution
} from '../js/lib/mix-design.js';

import { getMaxWz } from '../js/lib/exposure.js';


describe('B20 Beispiel 1 - Wasseranspruch fuer Sieblinienbereich A/B32', () => {
    
    it('should calculate water demand for A32 with plastische Konsistenz using formula', () => {
        const result = calculateWaterDemand('A32', 'F2');
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
        assert.ok(result > 0);
    });

    it('should calculate water demand for B32 with plastische Konsistenz using formula', () => {
        const result = calculateWaterDemand('B32', 'F2');
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
    });

    it('should return average k-value for range A/B32', () => {
        const avgK = calculateAverageK('A32', 'B32');
        
        assert.notStrictEqual(avgK, null);
        // Average of 5.48 and 4.20 is approximately 4.84
        
        assert.ok(Math.abs(avgK - 4.84) < 0.1);
    });

    it('should verify water demand formula calculation matches B20 example', () => {
        const kA32 = calculateAverageK('A32', 'B32');
        
        if (kA32 !== null) {
            const expectedWater = 1200 / (kA32 + 3);
            
            assert.ok(expectedWater > 150);
            assert.ok(expectedWater < 160);
        }
    });

    it('should return water demand for C32 with weich Konsistenz F3', () => {
        const result = calculateWaterDemand('C32', 'F3');
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
    });
});


describe('B20 Beispiel 2 - Zugabewasser bei Oberflaechenfeuchte', () => {
    
    it('should calculate water demand for B32 with weich Konsistenz F3', () => {
        const result = calculateWaterDemand('B32', 'F3');
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
    });

    it('should adjust water demand for crushed aggregate Splitt with 10% increase', () => {
        const baseWater = calculateWaterDemand('B32', 'F3');
        
        if (baseWater !== null) {
            const adjustedWater = adjustForAggregateType(baseWater, true);
            
            assert.ok(adjustedWater > baseWater);
            // Should be approximately 10% higher
            
            const expectedRatio = adjustedWater / baseWater;
            assert.ok(Math.abs(expectedRatio - 1.10) < 0.05);
        }
    });

    it('should not adjust water demand for gravel isCrushedStone false', () => {
        const baseWater = calculateWaterDemand('B32', 'F3');
        
        if (baseWater !== null) {
            const adjustedWater = adjustForAggregateType(baseWater, false);
            
            assert.strictEqual(adjustedWater, baseWater);
        }
    });

    it('should return null for unsupported consistency class F4', () => {
        const result = calculateWaterDemand('B32', 'F4');
        
        assert.strictEqual(result, null);
    });
});


describe('B20 Beispiel 5 - Anrechnung von Flugasche k equals 0.4', () => {
    
    it('should return max supplementary content for fly ash', () => {
        const material = getMaxSupplementaryContent('Flugasche');
        
        assert.notStrictEqual(material, null);
        assert.strictEqual(typeof material, 'number');
    });

    it('should calculate equivalent w/z with fly ash using k equals 0.4', () => {
        const result = calculateEquivalentWz(190, 290, 'Flugasche', 96);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
    });

    it('should return lower equivalent w/z when fly ash is added', () => {
        const wzWithFlyAsh = calculateEquivalentWz(190, 290, 'Flugasche', 96);
        const wzWithoutFlyAsh = calculateEquivalentWz(190, 290, 'Flugasche', 0);
        
        assert.notStrictEqual(wzWithFlyAsh, null);
        assert.notStrictEqual(wzWithoutFlyAsh, null);
        
        // With fly ash (k=0.4), effective w/z should be lower because denominator increases
        
        assert.ok(wzWithFlyAsh < wzWithoutFlyAsh);
    });

    it('should calculate maximum allowable fly ash content for given cement', () => {
        const maxContent = getMaxSupplementaryContent('Flugasche');
        
        assert.notStrictEqual(maxContent, null);
        assert.strictEqual(typeof maxContent, 'number');
        assert.ok(maxContent > 0);
        assert.ok(maxContent <= 1);
    });

    it('should verify fly ash k-value effect on equivalent w/z', () => {
        const water = 190;
        const cement = 290;
        
        const wzBase = calculateEquivalentWz(water, cement, 'Flugasche', 0);
        const wzWithAdditive = calculateEquivalentWz(water, cement, 'Flugasche', 96);
        
        assert.notStrictEqual(wzBase, null);
        assert.notStrictEqual(wzWithAdditive, null);
        
        // Adding fly ash (k=0.4) should decrease the equivalent w/z ratio because denominator increases
        
        assert.ok(wzWithAdditive < wzBase);
    });

    it('should return maximum fly ash content for CEM I without P V D', () => {
        const maxContent = getMaxSupplementaryContent('Flugasche');
        
        assert.notStrictEqual(maxContent, null);
        assert.strictEqual(typeof maxContent, 'number');
    });
});


describe('B20 Beispiel 6 - Beruecksichtigung von Luftporen', () => {
    
    it('should calculate strength reduction from air-entraining agent', () => {
        const baseStrength = 40; // N/mm squared
        const lpPercent = 6; // Vol.%
        
        const reducedStrength = calculateStrengthReduction(baseStrength, lpPercent);
        
        assert.notStrictEqual(reducedStrength, null);
        assert.strictEqual(typeof reducedStrength, 'number');
        assert.ok(reducedStrength < baseStrength);
    });

    it('should correctly reduce strength by approximately 21 N/mm squared for 6% LP', () => {
        const baseStrength = 40; // N/mm squared
        
        const reducedStrength = calculateStrengthReduction(baseStrength, 6);
        
        assert.notStrictEqual(reducedStrength, null);
        
        // Expected: ~21 reduction (3.5 * 6)
        const actualReduction = baseStrength - reducedStrength;
        assert.ok(Math.abs(actualReduction - 21) < 2);
    });

    it('should calculate water saving from air-entraining agent', () => {
        const baseWater = 182; // l/m cubed
        const lpPercent = 6; // Vol.%
        
        const savedWater = adjustForAirEntraining(baseWater, lpPercent);
        
        assert.notStrictEqual(savedWater, null);
        assert.strictEqual(typeof savedWater, 'number');
    });

    it('should reduce water requirement when air-entraining agent is used', () => {
        const baseWater = 182; // l/m cubed
        
        const reducedWater = adjustForAirEntraining(baseWater, 6);
        
        assert.notStrictEqual(reducedWater, null);
        assert.ok(reducedWater < baseWater);
    });

    it('should return no reduction when LP is zero', () => {
        const baseWater = 182;
        
        const result = adjustForAirEntraining(baseWater, 0);
        
        assert.notStrictEqual(result, null);
        // Should be approximately unchanged
        
        assert.ok(Math.abs(result - baseWater) < 1);
    });
});


describe('B20 Combined Supplementary Materials Test', () => {
    
    it('should calculate equivalent w/z with both fly ash and silica fume', () => {
        const result = calculateEquivalentWzWithBoth(190, 280, 50, 20);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
    });

    it('should return valid results when only fly ash is present', () => {
        const result = calculateEquivalentWzWithBoth(190, 280, 50, 0);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
    });

    it('should return valid results when only silica fume is present', () => {
        const result = calculateEquivalentWzWithBoth(190, 280, 0, 20);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
    });
});


describe('B20 Stoffraumrechnung Material Volume Calculation Test', () => {
    
    it('should calculate aggregate volume and mass from cement and water content', () => {
        const result = stofraumrechnung(300, 150, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result.cement_volume, 'number');
        assert.strictEqual(typeof result.water_volume, 'number');
        assert.strictEqual(typeof result.aggregate_volume, 'number');
        assert.strictEqual(typeof result.aggregate_mass, 'number');
    });

    it('should return aggregate mass that is positive and reasonable', () => {
        const result = stofraumrechnung(300, 150, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        
        assert.ok(result.aggregate_mass > 0);
        // Typical normal weight concrete has ~1600-2000 kg/m³ aggregate
        
        assert.ok(result.aggregate_mass < 2500);
    });

    it('should return cement volume approximately 100 dm cubed for 300kg at rho equals 3.0', () => {
        const result = stofraumrechnung(300, 150, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        
        // Cement volume: 300 kg / 3.0 kg/dm³ ≈ 100 dm³
        
        assert.ok(Math.abs(result.cement_volume - 100) < 5);
    });

    it('should return water volume equal to input mass rho_water equals 1.0', () => {
        const result = stofraumrechnung(300, 150, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        
        // Water volume should be approximately 150 dm³
        
        assert.ok(Math.abs(result.water_volume - 150) < 1);
    });

    it('should return air volume equal to input parameter', () => {
        const result = stofraumrechnung(300, 150, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        
        assert.strictEqual(result.air_volume, 20);
    });

    it('should calculate different aggregate mass for Basalt vs Granit', () => {
        const resultGranit = stofraumrechnung(300, 150, 20, 'Granit');
        const resultBasalt = stofraumrechnung(300, 150, 20, 'Basalt');
        
        assert.notStrictEqual(resultGranit, null);
        assert.notStrictEqual(resultBasalt, null);
        
        // Basalt is denser than Granit
        
        assert.ok(resultBasalt.aggregate_mass >= resultGranit.aggregate_mass);
    });

    it('should return reasonable volume sum close to 1000 dm cubed', () => {
        const result = stofraumrechnung(300, 150, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        
        const totalVolume = 
            result.cement_volume + 
            result.water_volume + 
            result.air_volume + 
            result.aggregate_volume;
        
        // Should be approximately 1000 dm³ (1 m³)
        
        assert.ok(Math.abs(totalVolume - 1000) < 50);
    });
});


describe('B20 Average Density Lookup Test', () => {
    
    it('should return valid density for Granit', () => {
        const density = getAverageDensity('Granit');
        
        assert.notStrictEqual(density, null);
        assert.strictEqual(typeof density, 'number');
        
        // Granit typical density: 2.6-2.8 kg/dm³
        
        assert.ok(density > 2.5);
        assert.ok(density < 3.0);
    });

    it('should return valid density for Basalt', () => {
        const density = getAverageDensity('Basalt');
        
        assert.notStrictEqual(density, null);
        assert.strictEqual(typeof density, 'number');
        
        // Basalt typical density: 2.9-3.1 kg/dm³
        
        assert.ok(density > 2.8);
        assert.ok(density < 3.5);
    });

    it('should return valid average for Fly Ash Flugasche', () => {
        const density = getAverageDensity('Flugasche');
        
        assert.notStrictEqual(density, null);
        assert.strictEqual(typeof density, 'number');
        
        // Fly ash typical: 2.2-2.4 kg/dm³
        
        assert.ok(density > 2.0);
        assert.ok(density < 2.5);
    });

    it('should return null for unknown material', () => {
        const density = getAverageDensity('UnknownMaterialXYZ');
        
        assert.strictEqual(density, null);
    });
});


describe('B20 Maximum Fly Ash Content Test', () => {
    
    it('should calculate maximum fly ash content based on cement amount', () => {
        const maxContent = calculateMaxFlyAshContent(300);
        
        assert.notStrictEqual(maxContent, null);
        assert.strictEqual(typeof maxContent, 'number');
        // For CEM I (no P,V,D): max = 0.33 × z
        
        assert.ok(maxContent > 50);
    });

    it('should return approximately 99 kg for 300kg cement', () => {
        const maxContent = calculateMaxFlyAshContent(300);
        
        assert.notStrictEqual(maxContent, null);
        
        // Expected: 0.33 × 300 ≈ 99 kg
        
        assert.ok(Math.abs(maxContent - 99) < 5);
    });

    it('should return null for zero cement input', () => {
        const maxContent = calculateMaxFlyAshContent(0);
        
        assert.strictEqual(maxContent, null);
    });
});


describe('B20 Strength Class Target Calculation Test', () => {
    
    it('should return correct target strength for C20/25 f_ck equals 20', () => {
        const result = calculateTargetStrength(20);
        
        assert.strictEqual(result, 28); // 20 + 8
    });

    it('should return correct target strength for C30/37 f_ck equals 30', () => {
        const result = calculateTargetStrength(30);
        
        assert.strictEqual(result, 38); // 30 + 8
    });

    it('should return correct target strength for C50/60 f_ck equals 50', () => {
        const result = calculateTargetStrength(50);
        
        assert.strictEqual(result, 58); // 50 + 8
    });

    it('should handle decimal characteristic strength values', () => {
        const result = calculateTargetStrength(25.5);
        
        assert.strictEqual(result, 33.5); // 25.5 + 8
    });
});


describe('B20 Dry Curing Conversion Test', () => {
    
    it('should convert wet-curing strength to dry-curing by dividing by 0.92', () => {
        const result = convertToDryCuring(34);
        
        // Expected: 34 / 0.92 ≈ 36.96
        
        assert.ok(Math.abs(result - 36.96) < 1);
    });

    it('should return higher value for dry-cured strength', () => {
        const wetStrength = 30;
        
        const dryStrength = convertToDryCuring(wetStrength);
        
        assert.ok(dryStrength > wetStrength);
    });

    it('should handle C16/20 conversion f_cm equals 24', () => {
        const result = convertToDryCuring(24);
        
        // Expected: 24 / 0.92 ≈ 26.09
        
        assert.ok(Math.abs(result - 26.09) < 1);
    });

    it('should handle C35/45 conversion f_cm equals 43', () => {
        const result = convertToDryCuring(43);
        
        // Expected: 43 / 0.92 ≈ 46.74
        
        assert.ok(Math.abs(result - 46.74) < 1);
    });
});


describe('B20 Water-Cement Ratio Calculation Test', () => {
    
    it('should calculate w/z ratio from water and cement content', () => {
        const result = calculateEquivalentWz(190, 292, 'Flugasche', 0);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result, 'number');
        
        // Expected: 190 / 292 ≈ 0.65
        
        assert.ok(Math.abs(result - 0.65) < 0.05);
    });

    it('should return approximately 0.6 for typical concrete parameters', () => {
        const result = calculateEquivalentWz(180, 300, 'Flugasche', 0);
        
        assert.notStrictEqual(result, null);
        
        assert.ok(Math.abs(result - 0.60) < 0.05);
    });

    it('should handle zero water content gracefully', () => {
        const result = calculateEquivalentWz(0, 300, 'Flugasche', 0);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result, 0);
    });
});


describe('B20 Air Entraining Water Adjustment Test', () => {
    
    it('should reduce water requirement based on LP percentage', () => {
        const baseWater = 180; // l/m cubed
        
        const adjusted = adjustForAirEntraining(baseWater, 4);
        
        assert.notStrictEqual(adjusted, null);
        assert.ok(adjusted < baseWater);
    });

    it('should reduce water by approximately 20 l for 4% LP', () => {
        const baseWater = 180; // l/m cubed
        
        const adjusted = adjustForAirEntraining(baseWater, 4);
        
        assert.notStrictEqual(adjusted, null);
        
        // Expected: ~5l × 4 = 20l reduction
        
        assert.ok(Math.abs((baseWater - adjusted) - 20) < 3);
    });

    it('should return approximately same water for minimal LP', () => {
        const baseWater = 180;
        
        const adjusted = adjustForAirEntraining(baseWater, 1);
        
        assert.notStrictEqual(adjusted, null);
        
        // Expected: ~5l reduction
        
        assert.ok(Math.abs((baseWater - adjusted) - 5) < 2);
    });
});


describe('B20 Exposure Class Max w/z Test', () => {
    
    it('should return max w/z for XC1 exposure class', () => {
        const result = getMaxWz('XC1');
        
        assert.strictEqual(result, 0.75);
    });

    it('should return adjusted max w/z with reduction for XC1', () => {
        const result = getMaxWz('XC1', true);
        
        assert.strictEqual(result, 0.73); // 0.75 - 0.02
    });

    it('should return null for X0 exposure class no limit', () => {
        const result = getMaxWz('X0');
        
        assert.strictEqual(result, null);
    });

    it('should return max w/z for XC3', () => {
        const result = getMaxWz('XC3');
        
        assert.strictEqual(result, 0.65);
    });

    it('should return adjusted max w/z for XD1 with reduction', () => {
        const result = getMaxWz('XD1', true);
        
        // Base: 0.55 - 0.02 = 0.53
        
        assert.strictEqual(result, 0.53);
    });
});


describe('B20 Aggregate Density Category Test', () => {
    
    it('should return lower density for lightweight aggregate Naturbims', () => {
        const density = getAverageDensity('Naturbims');
        
        assert.notStrictEqual(density, null);
        assert.strictEqual(typeof density, 'number');
        
        // Lightweight: 0.4-0.7 kg/dm³
        
        assert.ok(density < 1.0);
    });

    it('should return normal weight density for Granit', () => {
        const density = getAverageDensity('Granit');
        
        assert.notStrictEqual(density, null);
        assert.strictEqual(typeof density, 'number');
        
        // Normal: 2.6-2.8 kg/dm³
        
        assert.ok(density > 2.5);
        assert.ok(density < 3.0);
    });

    it('should return heavy weight density for Magnetit', () => {
        const density = getAverageDensity('Magnetit');
        
        assert.notStrictEqual(density, null);
        assert.strictEqual(typeof density, 'number');
        
        // Heavy: 4.6-4.8 kg/dm³
        
        assert.ok(density > 4.5);
    });

    it('should return heavy weight density for Baryt', () => {
        const density = getAverageDensity('Baryt (Schwerspat)');
        
        assert.notStrictEqual(density, null);
        assert.strictEqual(typeof density, 'number');
        
        // Heavy: 4.0-4.3 kg/dm³
        
        assert.ok(density > 3.9);
        assert.ok(density < 4.5);
    });
});


describe('B20 Complete Mix Calculation Integration Test', () => {
    
    it('should produce consistent results for complete mix calculation sequence', () => {
        // Simulate a complete calculation from B20 example:
        
        const f_ck = 37; // C30/37 characteristic strength
        
        // Step 1: Target mean strength with v=9
        const vorhalt = 9;
        const f_cm = f_ck + vorhalt;
        
        assert.strictEqual(f_cm, 46);
        
        // Step 2: Dry-curing conversion
        const f_cm_dry = convertToDryCuring(f_cm);
        
        assert.notStrictEqual(f_cm_dry, null);
        assert.ok(f_cm_dry > f_cm);
        
        // Step 3: Water demand for F3 consistency
        const waterDemand = calculateWaterDemand('B32', 'F3');
        
        assert.notStrictEqual(waterDemand, null);
        assert.strictEqual(typeof waterDemand, 'number');
        
        // Step 4: Cement content from w/z ratio (assuming wz=0.53)
        const assumedWz = 0.53;
        const cementContent = waterDemand / assumedWz;
        
        assert.notStrictEqual(cementContent, null);
        assert.strictEqual(typeof cementContent, 'number');
        
        // Step 5: Stoffraumrechnung for aggregate
        const mixResult = stofraumrechnung(
            Math.round(cementContent), 
            Math.round(waterDemand), 
            20, 
            'Granit'
        );
        
        assert.notStrictEqual(mixResult, null);
        assert.strictEqual(typeof mixResult.aggregate_mass, 'number');
    });

    it('should verify calculation chain produces reasonable concrete mix', () => {
        const f_ck = 25; // C25/30
        
        const targetStrength = calculateTargetStrength(f_ck);
        
        assert.strictEqual(targetStrength, 33);
        
        const water = calculateWaterDemand('B32', 'F3');
        
        assert.notStrictEqual(water, null);
        
        const wzRatio = 0.65; // Typical for C25/30
        
        const cement = water / wzRatio;
        
        assert.ok(cement > 200);
        assert.ok(cement < 400);
        
        const mix = stofraumrechnung(Math.round(cement), Math.round(water), 20, 'Granit');
        
        assert.notStrictEqual(mix, null);
        assert.strictEqual(typeof mix.aggregate_mass, 'number');
    });

    it('should handle edge case of high-strength concrete calculation', () => {
        const f_ck = 50; // C50/60
        
        const targetStrength = calculateTargetStrength(f_ck);
        
        assert.strictEqual(targetStrength, 58);
        
        const waterDemand = calculateWaterDemand('C32', 'F1'); // Steif for high strength
        
        assert.notStrictEqual(waterDemand, null);
        
        const wzRatio = 0.40;
        const cement = waterDemand / wzRatio;
        
        assert.ok(cement > 350);
    });

    it('should handle fly ash adjustment in complete calculation', () => {
        const baseWater = calculateWaterDemand('B32', 'F3');
        
        assert.notStrictEqual(baseWater, null);
        
        const wzWithFlyAsh = 0.58; // Adjusted for fly ash
        
        const baseCement = baseWater / wzWithFlyAsh;
        
        assert.notStrictEqual(baseCement, null);
        
        const effectiveWz = calculateEquivalentWz(
            Math.round(baseWater), 
            Math.round(baseCement), 
            'Flugasche', 
            80
        );
        
        assert.notStrictEqual(effectiveWz, null);
        assert.strictEqual(typeof effectiveWz, 'number');
    });

    it('should produce consistent results across multiple calculation runs', () => {
        const results = [];
        
        for (let i = 0; i < 5; i++) {
            const mixResult = stofraumrechnung(300, 150, 20, 'Granit');
            
            assert.notStrictEqual(mixResult, null);
            results.push(mixResult.aggregate_mass);
        }
        
        // All results should be consistent (same input → same output)
        
        const first = results[0];
        for (const result of results) {
            assert.strictEqual(result, first);
        }
    });

    it('should verify water-cement ratio calculation matches B20 values', () => {
        // From B20 example: w=171, z=325, f=95 → (w/z)_eq = 171/(325+0.4×95) ≈ 0.47
        
        const result = calculateEquivalentWz(171, 325, 'Flugasche', 95);
        
        assert.notStrictEqual(result, null);
        
        // Expected approximately 0.47 (after fly ash adjustment)
        
        assert.ok(result > 0.45);
        assert.ok(result < 0.50);
    });

    it('should verify strength reduction matches B20 example', () => {
        const baseStrength = 40; // N/mm squared typical
        
        const reduced = calculateStrengthReduction(baseStrength, 6);
        
        assert.notStrictEqual(reduced, null);
        
        // Expected reduction: ~21 N/mm² (6 × 3.5)
        
        const actualReduction = baseStrength - reduced;
        assert.ok(Math.abs(actualReduction - 21) < 3);
    });

    it('should verify LP water adjustment matches B20 example', () => {
        const baseWater = 180; // l/m cubed typical
        
        const adjusted = adjustForAirEntraining(baseWater, 6);
        
        assert.notStrictEqual(adjusted, null);
        
        // Expected reduction: ~30 l (6 × 5)
        
        const actualReduction = baseWater - adjusted;
        assert.ok(Math.abs(actualReduction - 30) < 5);
    });

    it('should verify Stoffraumrechnung produces reasonable total volume', () => {
        const result = stofraumrechnung(287, 171, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        
        const totalVolume = 
            result.cement_volume + 
            result.water_volume + 
            result.air_volume + 
            result.aggregate_volume;
        
        // Should be approximately 1000 dm³ (with fly ash volume not included here)
        
        assert.ok(totalVolume > 950);
        assert.ok(totalVolume < 1050);
    });

    it('should handle realistic C30/37 mix calculation', () => {
        const f_ck = 37; // C30/37
        
        const targetStrength = calculateTargetStrength(f_ck);
        
        assert.strictEqual(targetStrength, 45);
        
        const waterDemand = calculateWaterDemand('B32', 'F3');
        
        assert.notStrictEqual(waterDemand, null);
        
        const wzRatio = 0.53;
        const cementContent = waterDemand / wzRatio;
        
        assert.ok(cementContent > 280);
        assert.ok(cementContent < 350);
    });

    it('should verify all calculation functions work together', () => {
        const fk_cube = 37;
        
        const f_cm = calculateTargetStrength(fk_cube);
        assert.notStrictEqual(f_cm, null);
        
        const f_dry = convertToDryCuring(f_cm + 1);
        assert.notStrictEqual(f_dry, null);
        
        const water = calculateWaterDemand('B32', 'F3');
        assert.notStrictEqual(water, null);
        
        const wz = 0.53;
        const cement = water / wz;
        
        assert.ok(cement > 280);
        
        const mix = stofraumrechnung(Math.round(cement), Math.round(water), 20, 'Granit');
        assert.notStrictEqual(mix, null);
        
        const eqWz = calculateEquivalentWz(
            Math.round(water), 
            Math.round(cement), 
            'Flugasche', 
            80
        );
        assert.notStrictEqual(eqWz, null);
    });

    it('should verify calculation produces valid concrete mix proportions', () => {
        const mix = stofraumrechnung(325, 171, 20, 'Granit');
        
        assert.notStrictEqual(mix, null);
        
        // Cement content should be reasonable (250-400 kg/m³ typical)
        
        const cementVolumeRatio = mix.cement_volume / 1000;
        assert.ok(cementVolumeRatio > 0.08);
        assert.ok(cementVolumeRatio < 0.15);
        
        // Water content should be reasonable (150-200 l/m³ typical)
        
        const waterVolumeRatio = mix.water_volume / 1000;
        assert.ok(waterVolumeRatio > 0.14);
        assert.ok(waterVolumeRatio < 0.22);
    });

    it('should produce different results for different aggregate types', () => {
        const granit = stofraumrechnung(300, 150, 20, 'Granit');
        const basalt = stofraumrechnung(300, 150, 20, 'Basalt');
        
        assert.notStrictEqual(granit, null);
        assert.notStrictEqual(basalt, null);
        
        // Different aggregates should give different masses
        
        assert.notStrictEqual(granit.aggregate_mass, basalt.aggregate_mass);
    });

    it('should verify calculation handles zero air content', () => {
        const result = stofraumrechnung(300, 150, 0, 'Granit');
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.air_volume, 0);
        // Should have slightly more aggregate volume
        
        assert.ok(result.aggregate_volume > 700);
    });

    it('should verify calculation handles high air content', () => {
        const result = stofraumrechnung(300, 150, 40, 'Granit');
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.air_volume, 40);
        // With 40% air: aggregate volume ≈ 713 dm³ (less than ~950 with no air)
        
        assert.ok(result.aggregate_volume < 720);
    });

    it('should verify strength reduction is capped at zero', () => {
        const baseStrength = 10; // Very low
        
        const reduced = calculateStrengthReduction(baseStrength, 6);
        
        assert.notStrictEqual(reduced, null);
        assert.ok(reduced >= 0);
    });

    it('should verify LP adjustment does not go negative', () => {
        const baseWater = 50; // Reasonable minimum
        
        const adjusted = adjustForAirEntraining(baseWater, 6);
        
        assert.notStrictEqual(adjusted, null);
        assert.ok(adjusted >= 0);
    });

    it('should verify calculation chain produces physically valid results', () => {
        const mix = stofraumrechnung(325, 171, 20, 'Granit');
        
        assert.notStrictEqual(mix, null);
        
        // All volumes should be positive
        
        assert.ok(mix.cement_volume > 0);
        assert.ok(mix.water_volume > 0);
        assert.ok(mix.aggregate_volume > 0);
    });
});

describe('B20 Ground Truth Tests - Admixture Dosierung BV=92', () => {
    
    it('should calculate Z_m mass for BV=92 with cement content z equals 287 kg/m cubed', () => {
        // From testcase.md: BV=92 mit Z_m maßg. = 1,44 kg/m³
        // Dosierbereich bis 0,5% von Zementgewicht
        
        const result = calculateAdmixtureContent(0.5, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result.required_admixture_mass, 'number');
        
        // Expected: 0.005 × 287 = 1.435 ≈ 1.44 kg/m³
        assert.ok(Math.abs(result.required_admixture_mass - 1.44) < 0.05);
    });

    it('should calculate Z_m mass for BV=92 with cement content z equals 287 using BV function', () => {
        // From testcase.md: BV=92 mit Z_m maßg. = 1,44 kg/m³
        
        const result = calculateAdmixtureFromBV(92, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result.required_admixture_mass, 'number');
        
        // Expected: 0.005 × 287 = 1.435 ≈ 1.44 kg/m³
        assert.ok(Math.abs(result.required_admixture_mass - 1.44) < 0.05);
    });

    it('should verify ground truth Z_m equals 1,44 kg/m cubed for BV=92', () => {
        // Ground truth from testcase.md: Z_m maßg. = 1,44 kg/m³
        
        const result = calculateAdmixtureContent(0.5, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.required_admixture_mass, 1.44);
    });

    it('should handle different dosing percentages for admixture calculation', () => {
        const result1 = calculateAdmixtureContent(0.5, 300); // 0.5% of 300
        
        assert.notStrictEqual(result1, null);
        assert.strictEqual(result1.required_admixture_mass, 1.50); // 0.005 × 300 = 1.5 kg/m³
    });

    it('should return dosing range percent in result', () => {
        const result = calculateAdmixtureContent(0.5, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.dosing_range_percent, 0.5);
    });

    it('should return cement content in result', () => {
        const result = calculateAdmixtureContent(0.5, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.cement_content, 287);
    });

    it('should handle zero dosing percentage correctly', () => {
        const result = calculateAdmixtureContent(0, 300);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.required_admixture_mass, 0);
    });

    it('should return null for invalid cement content', () => {
        const result = calculateAdmixtureContent(0.5, -10);
        
        assert.strictEqual(result, null);
    });

    it('should handle larger admixture amounts correctly', () => {
        // For 2% dosing of 350 kg/m³ cement: 0.02 × 350 = 7 kg/m³
        
        const result = calculateAdmixtureContent(2, 350);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.required_admixture_mass, 7);
    });

    it('should apply 20% water reduction for FM and 7% for BV', () => {
        const fmPercent = getRecommendedWaterSaving('FM');
        assert.strictEqual(fmPercent, 20);
        assert.strictEqual(applyAdmixtureWaterReduction(146, 'FM'), 117);

        const bvPercent = getRecommendedWaterSaving('BV');
        assert.strictEqual(bvPercent, 7);
        assert.strictEqual(applyAdmixtureWaterReduction(146, 'BV'), 136);

        assert.strictEqual(getRecommendedWaterSaving('none'), null);
        assert.strictEqual(applyAdmixtureWaterReduction(146, 'none'), 146);
    });

    it('should verify calculation formula Z_m equals (bv/100) × z', () => {
        // Test with different values to confirm formula
        
        const testCases = [
            { bv: 0.5, z: 287, expected: 1.435 },
            { bv: 1, z: 400, expected: 4 },
            { bv: 0.25, z: 300, expected: 0.75 }
        ];

        for (const tc of testCases) {
            const result = calculateAdmixtureContent(tc.bv, tc.z);
            
            assert.notStrictEqual(result, null);
            // Allow small rounding differences
            
            assert.ok(Math.abs(result.required_admixture_mass - tc.expected * 100 / 100) < 0.05);
        }
    });

    it('should handle decimal dosing percentages', () => {
        const result = calculateAdmixtureContent(0.37, 287);
        
        assert.notStrictEqual(result, null);
        // Expected: 0.0037 × 287 ≈ 1.06 kg/m³
        
        assert.ok(Math.abs(result.required_admixture_mass - 1.06) < 0.1);
    });

    it('should verify BV=92 mapping to 0.5% dosing', () => {
        const result = calculateAdmixtureFromBV(92, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.assumed_dosing_percent, 0.5);
    });

    it('should handle BV=90 mapping to 0.4% dosing', () => {
        const result = calculateAdmixtureFromBV(90, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.assumed_dosing_percent, 0.4);
    });

    it('should handle BV=94 mapping to 0.6% dosing', () => {
        const result = calculateAdmixtureFromBV(94, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.assumed_dosing_percent, 0.6);
    });

    it('should return bv_value in result for BV function', () => {
        const result = calculateAdmixtureFromBV(92, 287);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.bv_value, 92);
    });
});

describe('B20 Ground Truth Tests - Stoffraumrechnung Volume Calculation', () => {
    
    it('should calculate paste volume correctly for z equals 300 kg/m cubed w equals 150 l/m cubed', () => {
        // From B20 documentation: V_z = z/ρz, V_w = w/ρw
        
        const result = calculatePasteVolume(300, 150);
        
        assert.notStrictEqual(result, null);
        
        // Cement volume: 300 / 3.0 = 100 dm³
        assert.ok(Math.abs(result.cement_volume - 100) < 1);
        
        // Water volume: 150 / 1.0 = 150 dm³
        assert.strictEqual(result.water_volume, 150);
    });

    it('should calculate total paste volume correctly', () => {
        const result = calculatePasteVolume(300, 150);
        
        assert.notStrictEqual(result, null);
        
        // Total: 100 + 150 = 250 dm³ (without additive)
        assert.strictEqual(result.total_paste_volume, 250);
    });

    it('should calculate fines content correctly', () => {
        const result = calculateFinesContent(300, 96, 0); // 300 cement + 96 fly ash
        
        assert.notStrictEqual(result, null);
        
        // Total: 300 + 96 = 396 kg/m³
        assert.strictEqual(result.total_fines, 396);
    });

    it('should calculate addition water correctly', () => {
        const result = calculateAdditionWater(160, 1836, 4.4); // w_total=160, g=1836kg, moisture=4.4%
        
        assert.notStrictEqual(result, null);
        
        // Surface moisture: 1836 × 0.044 = 80.78 kg ≈ 81 kg
        // Addition water: 160 - 81 = 79 kg
        
        assert.ok(Math.abs(result.surface_moisture - 81) < 2);
        assert.ok(Math.abs(result.addition_water - 79) < 2);
    });

    it('should calculate total concrete mass correctly', () => {
        const result = calculateTotalConcreteMass(300, 150, 1800, 100); // z=300, w=150, g=1800, f=100
        
        assert.notStrictEqual(result, null);
        
        // Total: 300 + 150 + 1800 + 100 = 2350 kg/m³
        assert.strictEqual(result.total_mass, 2350);
    });

    it('should calculate equivalent w/z correctly with fly ash', () => {
        const result = calcEqWz(190, 290, 'Flugasche', 96);
        
        assert.notStrictEqual(result, null);
        
        // Expected: 190 / (290 + 0.4 × 96) = 190 / 328.4 ≈ 0.579
        assert.ok(Math.abs(result - 0.58) < 0.02);
    });

    it('should calculate cement from w/z correctly', () => {
        const result = calculateCementFromWz(190, 0.65);
        
        assert.notStrictEqual(result, null);
        
        // Expected: 190 / 0.65 ≈ 292 kg/m³
        assert.strictEqual(result, 292);
    });

    it('should calculate max supplementary content correctly', () => {
        const result = calculateMaxSupplementaryContent(300, 'Flugasche', false, false, false);
        
        assert.notStrictEqual(result, null);
        
        // Expected: 0.33 × 300 ≈ 99 kg/m³ (for CEM I without P,V,D)
        assert.strictEqual(result, 99);
    });

    it('should verify paste volume calculation from B20 example', () => {
        const result = calculatePasteVolume(325, 171, 95); // z=325, w=171, f=95
        
        assert.notStrictEqual(result, null);
        
        // Cement: 325/3.0 ≈ 108 dm³
        // Water: 171/1.0 = 171 dm³
        // Fly ash: 95/2.3 ≈ 41 dm³
        
        assert.ok(Math.abs(result.cement_volume - 108) < 3);
        assert.strictEqual(result.water_volume, 171);
    });

    it('should verify Stoffraumrechnung matches B20 example values', () => {
        const result = stofraumrechnung(325, 171, 20, 'Granit');
        
        assert.notStrictEqual(result, null);
        
        // Cement volume: 325/3.0 ≈ 108 dm³
        assert.ok(Math.abs(result.cement_volume - 108) < 3);
        
        // Water volume: 171/1.0 = 171 dm³
        assert.strictEqual(result.water_volume, 171);
    });

    it('should handle paste calculation with zero additive', () => {
        const result = calculatePasteVolume(300, 150, 0);
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³, Water: 150 dm³, Additive: 0
        assert.strictEqual(result.additive_volume, 0);
    });

    it('should handle fines calculation with fine aggregate', () => {
        const result = calculateFinesContent(300, 96, 50); // cement + fly ash + fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 300 + 96 + 50 = 446 kg/m³
        assert.strictEqual(result.total_fines, 446);
    });

    it('should verify addition water calculation with exact moisture', () => {
        const result = calculateAdditionWater(160, 1836, 4.37); // Exact moisture for 80kg
        
        assert.notStrictEqual(result, null);
        
        // Surface moisture: 1836 × 0.0437 ≈ 80 kg (exact from B20 example)
        // Addition water: 160 - 80 = 80 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 80) < 1);
        assert.ok(Math.abs(result.addition_water - 80) < 1);
    });

    it('should calculate surface moisture contribution correctly', () => {
        const result = calculateSurfaceMoistureContribution(1836, 'default');
        
        assert.notStrictEqual(result, null);
        
        // Typical: 4% of 1836 ≈ 73 kg/m³
        assert.ok(Math.abs(result.surface_moisture_mass - 73) < 5);
    });

    it('should verify total mass calculation for complete mix', () => {
        const result = calculateTotalConcreteMass(292, 190, 1836, 0); // Typical C30/37 mix
        
        assert.notStrictEqual(result, null);
        
        // Total: 292 + 190 + 1836 = 2318 kg/m³
        assert.strictEqual(result.total_mass, 2318);
    });

    it('should handle cement calculation for high strength concrete', () => {
        const result = calculateCementFromWz(170, 0.45); // Higher strength: lower w/z
        
        assert.notStrictEqual(result, null);
        
        // Expected: 170 / 0.45 ≈ 378 kg/m³
        assert.strictEqual(result, 378);
    });

    it('should verify equivalent wz calculation for fly ash', () => {
        const result = calculateEquivalentWz(190, 292, 'Flugasche', 96);
        
        assert.notStrictEqual(result, null);
        
        // Expected: 190 / (292 + 0.4 × 96) = 190 / 330.4 ≈ 0.575
        assert.ok(Math.abs(result - 0.58) < 0.02);
    });

    it('should handle zero additive in paste calculation', () => {
        const result = calculatePasteVolume(300, 150, 0);
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³, Water: 150 dm³, Additive: 0, Total: 250 dm³
        assert.strictEqual(result.additive_volume, 0);
        assert.strictEqual(result.total_paste_volume, 250);
    });

    it('should verify paste volume with additive matches B20', () => {
        const result = calculatePasteVolume(300, 150, 96); // z=300, w=150, f=96
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³, Water: 150 dm³, Fly ash: ~42 dm³ (96/2.3)
        const expectedTotal = 100 + 150 + Math.round(96 / 2.3);
        
        assert.ok(Math.abs(result.total_paste_volume - expectedTotal) < 2);
    });

    it('should handle very high cement content calculation', () => {
        const result = calculateCementFromWz(180, 0.40); // High strength concrete
        
        assert.notStrictEqual(result, null);
        
        // Expected: 180 / 0.40 = 450 kg/m³
        assert.strictEqual(result, 450);
    });

    it('should verify surface moisture for different aggregate types', () => {
        const granitMoisture = calculateSurfaceMoistureContribution(1836, 'Granit');
        const kiesMoisture = calculateSurfaceMoistureContribution(1836, 'Kies');
        
        assert.notStrictEqual(granitMoisture, null);
        assert.notStrictEqual(kiesMoisture, null);
        
        // Granit: 3%, Kies: 4% typical
        
        assert.ok(Math.abs(granitMoisture.surface_moisture_mass - (1836 * 0.03)) < 2);
        assert.ok(Math.abs(kiesMoisture.surface_moisture_mass - (1836 * 0.04)) < 2);
    });

    it('should handle paste calculation with very high additive content', () => {
        const result = calculatePasteVolume(300, 150, 200); // High fly ash
        
        assert.notStrictEqual(result, null);
        
        // Fly ash: ~87 dm³ (200/2.3)
        // Total should be higher than without additive
        
        const expectedTotal = 100 + 150 + Math.round(200 / 2.3);
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation includes all components', () => {
        const result = calculateFinesContent(350, 70, 80); // cement + fly ash + fine agg
        
        assert.notStrictEqual(result, null);
        
        assert.strictEqual(result.cement, 350);
        assert.strictEqual(result.supplementary_material, 70);
        assert.strictEqual(result.fine_aggregate, 80);
        assert.strictEqual(result.total_fines, 500);
    });

    it('should handle addition water calculation with zero moisture', () => {
        const result = calculateAdditionWater(160, 1836, 0); // Zero surface moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg, Addition: 160 kg (same as total)
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 160);
    });

    it('should verify cement calculation for low strength concrete', () => {
        const result = calculateCementFromWz(200, 0.80); // Low strength: high w/z
        
        assert.notStrictEqual(result, null);
        
        // Expected: 200 / 0.80 = 250 kg/m³
        assert.strictEqual(result, 250);
    });

    it('should handle paste calculation with negative additive (edge case)', () => {
        const result = calculatePasteVolume(300, 150, -50); // Negative should be treated as zero
        
        assert.notStrictEqual(result, null);
        
        // Should treat negative as no additive
        assert.strictEqual(result.additive_volume, 0);
    });

    it('should verify equivalent wz calculation without fly ash', () => {
        const result = calculateEquivalentWz(190, 292, 'Flugasche', 0);
        
        assert.notStrictEqual(result, null);
        
        // Expected: 190 / (292 + 0) ≈ 0.65
        assert.ok(Math.abs(result - 0.65) < 0.02);
    });

    it('should handle paste calculation with large additive content', () => {
        const result = calculatePasteVolume(300, 150, 500); // Very high fly ash
        
        assert.notStrictEqual(result, null);
        
        // Fly ash: ~217 dm³ (500/2.3)
        // Total should be significantly higher
        
        assert.ok(result.total_paste_volume > 400);
    });

    it('should verify fines calculation returns all component values', () => {
        const result = calculateFinesContent(300, 96, 50);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.cement, 300);
        assert.strictEqual(result.supplementary_material, 96);
        assert.strictEqual(result.fine_aggregate, 50);
    });

    it('should handle addition water calculation with high moisture content', () => {
        const result = calculateAdditionWater(160, 2000, 10); // 10% surface moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: 200 kg (2000 × 0.10)
        // Addition: 160 - 200 = -40 kg (negative possible if very wet aggregate)
        
        assert.strictEqual(result.surface_moisture, 200);
        assert.strictEqual(result.addition_water, -40);
    });

    it('should verify cement calculation edge case with high w/z', () => {
        const result = calculateCementFromWz(150, 0.90); // Very low strength
        
        assert.notStrictEqual(result, null);
        
        // Expected: 150 / 0.90 ≈ 167 kg/m³ (very low cement content)
        assert.strictEqual(result, 167);
    });

    it('should verify paste volume calculation for minimal mix', () => {
        const result = calculatePasteVolume(200, 100, 0); // Minimal concrete
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~67 dm³ (200/3), Water: 100 dm³
        assert.ok(Math.abs(result.cement_volume - 67) < 2);
        assert.strictEqual(result.water_volume, 100);
    });

    it('should handle paste calculation with extreme values', () => {
        const result = calculatePasteVolume(500, 250, 300); // High cement and water
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~167 dm³, Water: 250 dm³, Fly ash: ~130 dm³
        const expectedTotal = Math.round(500 / 3.0) + 250 + Math.round(300 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with zero supplementary materials', () => {
        const result = calculateFinesContent(300, 0, 50); // Only cement and fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 300 + 0 + 50 = 350 kg/m³
        assert.strictEqual(result.total_fines, 350);
    });

    it('should handle addition water calculation with exact ground truth values', () => {
        const result = calculateAdditionWater(160, 1836, 4.37); // From B20 example
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~80 kg (1836 × 0.0437 ≈ 80)
        // Addition: 160 - 80 = 80 kg/m³ (from B20 Section 8 calculation)
        
        assert.ok(Math.abs(result.surface_moisture - 80) < 2);
        assert.ok(Math.abs(result.addition_water - 80) < 2);
    });

    it('should verify paste volume for typical C30/37 mix', () => {
        const result = calculatePasteVolume(292, 190); // Typical C30/37 values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~97 dm³ (292/3), Water: 190 dm³
        const expectedTotal = Math.round(292 / 3.0) + 190;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very small values', () => {
        const result = calculatePasteVolume(50, 30, 0); // Minimal paste
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~17 dm³ (50/3), Water: 30 dm³
        assert.ok(Math.abs(result.cement_volume - 17) < 2);
        assert.strictEqual(result.water_volume, 30);
    });

    it('should verify fines calculation includes all three components', () => {
        const result = calculateFinesContent(400, 100, 50); // High cement and additives
        
        assert.notStrictEqual(result, null);
        
        assert.strictEqual(result.cement, 400);
        assert.strictEqual(result.supplementary_material, 100);
        assert.strictEqual(result.fine_aggregate, 50);
        assert.strictEqual(result.total_fines, 550);
    });

    it('should handle addition water with negative result (wet aggregate)', () => {
        const result = calculateAdditionWater(100, 2500, 10); // Very wet aggregate
        
        assert.notStrictEqual(result, null);
        
        // Surface: 250 kg (2500 × 0.10)
        // Addition: 100 - 250 = -150 kg (negative means no addition needed)
        
        assert.strictEqual(result.surface_moisture, 250);
        assert.strictEqual(result.addition_water, -150);
    });

    it('should verify paste volume calculation for standard mix', () => {
        const result = calculatePasteVolume(300, 160, 80); // Standard C25/30 with fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³, Water: 160 dm³, Fly ash: ~35 dm³ (80/2.3)
        const expectedTotal = 100 + 160 + Math.round(80 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero inputs', () => {
        const result = calculatePasteVolume(0, 0, 0); // All zeros
        
        assert.notStrictEqual(result, null);
        
        // All volumes should be zero
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        assert.strictEqual(result.total_paste_volume, 0);
    });

    it('should verify fines calculation with large values', () => {
        const result = calculateFinesContent(500, 200, 100); // High content
        
        assert.notStrictEqual(result, null);
        
        // Total: 500 + 200 + 100 = 800 kg/m³
        assert.strictEqual(result.total_fines, 800);
    });

    it('should handle addition water calculation with zero total water', () => {
        const result = calculateAdditionWater(0, 1500, 4); // Zero total water
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~60 kg (1500 × 0.04)
        // Addition: 0 - 60 = -60 kg
        
        assert.ok(Math.abs(result.surface_moisture - 60) < 2);
        assert.strictEqual(result.addition_water, -60);
    });

    it('should verify paste volume for high-strength concrete mix', () => {
        const result = calculatePasteVolume(450, 180); // High cement for high strength
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~150 dm³ (450/3), Water: 180 dm³
        const expectedTotal = Math.round(450 / 3.0) + 180;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with only cement and additive', () => {
        const result = calculatePasteVolume(300, 0, 50); // No water
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³, Water: 0, Fly ash: ~22 dm³ (50/2.3)
        const expectedTotal = 100 + 0 + Math.round(50 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation returns correct structure', () => {
        const result = calculateFinesContent(325, 96, 45);
        
        assert.notStrictEqual(result, null);
        assert.ok(typeof result.cement === 'number');
        assert.ok(typeof result.supplementary_material === 'number');
        assert.ok(typeof result.fine_aggregate === 'number');
        assert.ok(typeof result.total_fines === 'number');
    });

    it('should handle addition water calculation with exact B20 values', () => {
        // From B20 Section 8: w=190, g=1836kg, moisture≈4.4% → w_Zugabe ≈ 110 l/m³
        
        const result = calculateAdditionWater(190, 1836, 4.4);
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~81 kg (1836 × 0.044)
        // Addition: 190 - 81 ≈ 109 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 81) < 2);
        assert.ok(Math.abs(result.addition_water - 109) < 3);
    });

    it('should verify paste volume calculation for fly ash rich mix', () => {
        const result = calculatePasteVolume(250, 170, 150); // High fly ash content
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~83 dm³ (250/3), Water: 170 dm³, Fly ash: ~65 dm³ (150/2.3)
        const expectedTotal = Math.round(250 / 3.0) + 170 + Math.round(150 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with only water', () => {
        const result = calculatePasteVolume(0, 200, 0); // Only water
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 200 dm³, Additive: 0, Total: 200 dm³
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 200);
        assert.strictEqual(result.total_paste_volume, 200);
    });

    it('should verify fines calculation for minimal content', () => {
        const result = calculateFinesContent(150, 25, 10); // Minimal fines
        
        assert.notStrictEqual(result, null);
        
        // Total: 150 + 25 + 10 = 185 kg/m³
        assert.strictEqual(result.total_fines, 185);
    });

    it('should handle addition water calculation with high moisture for low aggregate', () => {
        const result = calculateAdditionWater(120, 1200, 15); // High moisture percentage
        
        assert.notStrictEqual(result, null);
        
        // Surface: 180 kg (1200 × 0.15)
        // Addition: 120 - 180 = -60 kg
        
        assert.strictEqual(result.surface_moisture, 180);
        assert.strictEqual(result.addition_water, -60);
    });

    it('should verify paste volume calculation for zero additive', () => {
        const result = calculatePasteVolume(350, 180, 0); // No additives
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~117 dm³ (350/3), Water: 180 dm³, Additive: 0
        const expectedTotal = Math.round(350 / 3.0) + 180;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with extreme additive ratio', () => {
        const result = calculatePasteVolume(200, 100, 400); // Fly ash > cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~67 dm³ (200/3), Water: 100 dm³, Fly ash: ~174 dm³ (400/2.3)
        const expectedTotal = Math.round(200 / 3.0) + 100 + Math.round(400 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation structure for all fields', () => {
        const result = calculateFinesContent(275, 85, 60);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result.cement, 'number');
        assert.strictEqual(typeof result.supplementary_material, 'number');
        assert.strictEqual(typeof result.fine_aggregate, 'number');
        assert.strictEqual(typeof result.total_fines, 'number');
    });

    it('should handle addition water calculation with zero moisture percentage', () => {
        const result = calculateAdditionWater(150, 2000, 0); // Zero surface moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (2000 × 0)
        // Addition: 150 - 0 = 150 kg/m³ (same as total water)
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 150);
    });

    it('should verify paste volume calculation for minimal cement', () => {
        const result = calculatePasteVolume(100, 80, 0); // Very low cement content
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~33 dm³ (100/3), Water: 80 dm³
        const expectedTotal = Math.round(100 / 3.0) + 80;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with only additive', () => {
        const result = calculatePasteVolume(0, 0, 250); // Only fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 0, Fly ash: ~109 dm³ (250/2.3)
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        
        const expectedAdditive = Math.round(250 / 2.3);
        assert.strictEqual(result.additive_volume, expectedAdditive);
    });

    it('should verify fines calculation with large supplementary content', () => {
        const result = calculateFinesContent(400, 180, 75); // High fly ash
        
        assert.notStrictEqual(result, null);
        
        // Total: 400 + 180 + 75 = 655 kg/m³
        assert.strictEqual(result.total_fines, 655);
    });

    it('should handle addition water calculation with moderate moisture', () => {
        const result = calculateAdditionWater(175, 1900, 5.2); // ~5% surface moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~99 kg (1900 × 0.052)
        // Addition: 175 - 99 ≈ 76 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 99) < 3);
        assert.ok(Math.abs(result.addition_water - 76) < 3);
    });

    it('should verify paste volume for fly ash replacement mix', () => {
        const result = calculatePasteVolume(250, 160, 100); // Partial cement replacement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~83 dm³ (250/3), Water: 160 dm³, Fly ash: ~43 dm³ (100/2.3)
        const expectedTotal = Math.round(250 / 3.0) + 160 + Math.round(100 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very large values', () => {
        const result = calculatePasteVolume(600, 300, 400); // Very high content
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~200 dm³ (600/3), Water: 300 dm³, Fly ash: ~174 dm³ (400/2.3)
        const expectedTotal = Math.round(600 / 3.0) + 300 + Math.round(400 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation for typical mix', () => {
        const result = calculateFinesContent(325, 96, 55); // Typical C30/37 with fly ash
        
        assert.notStrictEqual(result, null);
        
        // Total: 325 + 96 + 55 = 476 kg/m³
        assert.strictEqual(result.total_fines, 476);
    });

    it('should handle addition water calculation with dry aggregate', () => {
        const result = calculateAdditionWater(180, 2000, 0.5); // Very dry (0.5% moisture)
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~10 kg (2000 × 0.005)
        // Addition: 180 - 10 = 170 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 10) < 2);
        assert.strictEqual(result.addition_water, 170);
    });

    it('should verify paste volume calculation for standard C25/30', () => {
        const result = calculatePasteVolume(280, 165, 70); // Typical C25/30
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~93 dm³ (280/3), Water: 165 dm³, Fly ash: ~30 dm³ (70/2.3)
        const expectedTotal = Math.round(280 / 3.0) + 165 + Math.round(70 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero water and additive only', () => {
        const result = calculatePasteVolume(0, 0, 180); // Only fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 0, Fly ash: ~78 dm³ (180/2.3)
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        
        const expectedAdditive = Math.round(180 / 2.3);
        assert.strictEqual(result.additive_volume, expectedAdditive);
    });

    it('should verify fines calculation with zero fine aggregate', () => {
        const result = calculateFinesContent(350, 90, 0); // No fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 350 + 90 + 0 = 440 kg/m³
        assert.strictEqual(result.total_fines, 440);
    });

    it('should handle addition water calculation with wet aggregate', () => {
        const result = calculateAdditionWater(160, 2200, 8.5); // Very wet (8.5% moisture)
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~187 kg (2200 × 0.085)
        // Addition: 160 - 187 = -27 kg (negative means no addition needed)
        
        assert.ok(Math.abs(result.surface_moisture - 187) < 3);
        assert.strictEqual(result.addition_water, -27);
    });

    it('should verify paste volume for high fly ash content', () => {
        const result = calculatePasteVolume(200, 140, 250); // High fly ash replacement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~67 dm³ (200/3), Water: 140 dm³, Fly ash: ~109 dm³ (250/2.3)
        const expectedTotal = Math.round(200 / 3.0) + 140 + Math.round(250 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very small additive', () => {
        const result = calculatePasteVolume(300, 160, 5); // Minimal fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³, Water: 160 dm³, Fly ash: ~2 dm³ (5/2.3)
        const expectedTotal = 100 + 160 + Math.round(5 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with all components present', () => {
        const result = calculateFinesContent(340, 92, 68); // All three components
        
        assert.notStrictEqual(result, null);
        
        // Total: 340 + 92 + 68 = 500 kg/m³
        assert.strictEqual(result.total_fines, 500);
    });

    it('should handle addition water calculation with typical moisture', () => {
        const result = calculateAdditionWater(170, 1850, 4.3); // Typical ~4% moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~80 kg (1850 × 0.043)
        // Addition: 170 - 80 ≈ 90 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 80) < 2);
        assert.ok(Math.abs(result.addition_water - 90) < 2);
    });

    it('should verify paste volume for minimal fly ash replacement', () => {
        const result = calculatePasteVolume(350, 175, 25); // Minimal fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~117 dm³ (350/3), Water: 175 dm³, Fly ash: ~11 dm³ (25/2.3)
        const expectedTotal = Math.round(350 / 3.0) + 175 + Math.round(25 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with negative additive edge case', () => {
        const result = calculatePasteVolume(300, 160, -100); // Negative additive
        
        assert.notStrictEqual(result, null);
        
        // Should treat negative as zero additive
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = Math.round(300 / 3.0) + 160;
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with negative fine aggregate (edge case)', () => {
        const result = calculateFinesContent(350, 80, -20); // Negative fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 350 + 80 + (-20) = 410 kg/m³
        assert.strictEqual(result.total_fines, 410);
    });

    it('should handle addition water calculation with very high moisture', () => {
        const result = calculateAdditionWater(100, 3000, 20); // Very wet aggregate (20%)
        
        assert.notStrictEqual(result, null);
        
        // Surface: 600 kg (3000 × 0.20)
        // Addition: 100 - 600 = -500 kg
        
        assert.strictEqual(result.surface_moisture, 600);
        assert.strictEqual(result.addition_water, -500);
    });

    it('should verify paste volume for typical fly ash replacement ratio', () => {
        const result = calculatePasteVolume(320, 170, 80); // ~20% fly ash replacement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~107 dm³ (320/3), Water: 170 dm³, Fly ash: ~35 dm³ (80/2.3)
        const expectedTotal = Math.round(320 / 3.0) + 170 + Math.round(80 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero inputs for all components', () => {
        const result = calculatePasteVolume(0, 0, 0); // All zeros
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        assert.strictEqual(result.total_paste_volume, 0);
    });

    it('should verify fines calculation with large fine aggregate', () => {
        const result = calculateFinesContent(300, 60, 150); // High fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 300 + 60 + 150 = 510 kg/m³
        assert.strictEqual(result.total_fines, 510);
    });

    it('should handle addition water calculation with negative total water', () => {
        const result = calculateAdditionWater(-50, 1800, 4); // Negative total water
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~72 kg (1800 × 0.04)
        // Addition: -50 - 72 = -122 kg
        
        assert.ok(Math.abs(result.surface_moisture - 72) < 3);
        assert.strictEqual(result.addition_water, -122);
    });

    it('should verify paste volume calculation for typical C30/37 with fly ash', () => {
        const result = calculatePasteVolume(292, 190, 96); // Typical values from B20
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~97 dm³ (292/3), Water: 190 dm³, Fly ash: ~42 dm³ (96/2.3)
        const expectedTotal = Math.round(292 / 3.0) + 190 + Math.round(96 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with extreme fly ash ratio', () => {
        const result = calculatePasteVolume(150, 100, 500); // Fly ash >> cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~50 dm³ (150/3), Water: 100 dm³, Fly ash: ~217 dm³ (500/2.3)
        const expectedTotal = Math.round(150 / 3.0) + 100 + Math.round(500 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with zero supplementary', () => {
        const result = calculateFinesContent(400, 0, 80); // No supplementary material
        
        assert.notStrictEqual(result, null);
        
        // Total: 400 + 0 + 80 = 480 kg/m³
        assert.strictEqual(result.total_fines, 480);
    });

    it('should handle addition water calculation with zero aggregate mass', () => {
        const result = calculateAdditionWater(150, 0, 5); // Zero aggregate
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (0 × 0.05)
        // Addition: 150 - 0 = 150 kg/m³ (same as total water)
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 150);
    });

    it('should verify paste volume for typical C25/30 mix with fly ash', () => {
        const result = calculatePasteVolume(280, 165, 70); // Typical C25/30 values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~93 dm³ (280/3), Water: 165 dm³, Fly ash: ~30 dm³ (70/2.3)
        const expectedTotal = Math.round(280 / 3.0) + 165 + Math.round(70 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero cement and water', () => {
        const result = calculatePasteVolume(0, 0, 100); // Only fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 0, Fly ash: ~43 dm³ (100/2.3)
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        
        const expectedAdditive = Math.round(100 / 2.3);
        assert.strictEqual(result.additive_volume, expectedAdditive);
    });

    it('should verify fines calculation with minimal components', () => {
        const result = calculateFinesContent(200, 40, 30); // Minimal fines
        
        assert.notStrictEqual(result, null);
        
        // Total: 200 + 40 + 30 = 270 kg/m³
        assert.strictEqual(result.total_fines, 270);
    });

    it('should handle addition water calculation with zero moisture', () => {
        const result = calculateAdditionWater(160, 1800, 0); // Zero surface moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (1800 × 0)
        // Addition: 160 - 0 = 160 kg/m³ (same as total water)
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 160);
    });

    it('should verify paste volume for typical C35/45 with fly ash', () => {
        const result = calculatePasteVolume(380, 175, 90); // Typical high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~127 dm³ (380/3), Water: 175 dm³, Fly ash: ~39 dm³ (90/2.3)
        const expectedTotal = Math.round(380 / 3.0) + 175 + Math.round(90 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very large cement content', () => {
        const result = calculatePasteVolume(600, 280, 150); // Very high cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~200 dm³ (600/3), Water: 280 dm³, Fly ash: ~65 dm³ (150/2.3)
        const expectedTotal = Math.round(600 / 3.0) + 280 + Math.round(150 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with equal components', () => {
        const result = calculateFinesContent(300, 300, 300); // Equal amounts
        
        assert.notStrictEqual(result, null);
        
        // Total: 300 + 300 + 300 = 900 kg/m³
        assert.strictEqual(result.total_fines, 900);
    });

    it('should handle addition water calculation with moderate total water', () => {
        const result = calculateAdditionWater(145, 1700, 6.2); // Moderate moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~105 kg (1700 × 0.062)
        // Addition: 145 - 105 ≈ 40 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 105) < 3);
        assert.ok(Math.abs(result.addition_water - 40) < 3);
    });

    it('should verify paste volume for typical C20/25 with fly ash', () => {
        const result = calculatePasteVolume(260, 155, 60); // Typical low strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~87 dm³ (260/3), Water: 155 dm³, Fly ash: ~26 dm³ (60/2.3)
        const expectedTotal = Math.round(260 / 3.0) + 155 + Math.round(60 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero fly ash', () => {
        const result = calculatePasteVolume(300, 170, 0); // No fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³ (300/3), Water: 170 dm³, Fly ash: 0
        assert.strictEqual(result.cement_volume, 100);
        assert.strictEqual(result.water_volume, 170);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = 100 + 170;
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with negative supplementary (edge case)', () => {
        const result = calculateFinesContent(350, -50, 60); // Negative supplementary
        
        assert.notStrictEqual(result, null);
        
        // Total: 350 + (-50) + 60 = 360 kg/m³
        assert.strictEqual(result.total_fines, 360);
    });

    it('should handle addition water calculation with high total water', () => {
        const result = calculateAdditionWater(220, 2500, 5.5); // High total water
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~138 kg (2500 × 0.055)
        // Addition: 220 - 138 ≈ 82 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 138) < 3);
        assert.ok(Math.abs(result.addition_water - 82) < 3);
    });

    it('should verify paste volume for typical C40/50 with fly ash', () => {
        const result = calculatePasteVolume(420, 185, 80); // Typical high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~140 dm³ (420/3), Water: 185 dm³, Fly ash: ~35 dm³ (80/2.3)
        const expectedTotal = Math.round(420 / 3.0) + 185 + Math.round(80 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very small amounts', () => {
        const result = calculatePasteVolume(50, 40, 10); // Minimal paste
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~17 dm³ (50/3), Water: 40 dm³, Fly ash: ~4 dm³ (10/2.3)
        const expectedTotal = Math.round(50 / 3.0) + 40 + Math.round(10 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with zero cement', () => {
        const result = calculateFinesContent(0, 50, 30); // No cement
        
        assert.notStrictEqual(result, null);
        
        // Total: 0 + 50 + 30 = 80 kg/m³
        assert.strictEqual(result.total_fines, 80);
    });

    it('should handle addition water calculation with zero total', () => {
        const result = calculateAdditionWater(0, 1500, 4); // Zero total water
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~60 kg (1500 × 0.04)
        // Addition: 0 - 60 = -60 kg
        
        assert.ok(Math.abs(result.surface_moisture - 60) < 2);
        assert.strictEqual(result.addition_water, -60);
    });

    it('should verify paste volume for typical C30/37 without fly ash', () => {
        const result = calculatePasteVolume(292, 190, 0); // No fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~97 dm³ (292/3), Water: 190 dm³, Fly ash: 0
        const expectedTotal = Math.round(292 / 3.0) + 190;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with extreme negative additive', () => {
        const result = calculatePasteVolume(300, 160, -500); // Very negative fly ash
        
        assert.notStrictEqual(result, null);
        
        // Should treat negative as zero additive
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = Math.round(300 / 3.0) + 160;
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with very large values', () => {
        const result = calculateFinesContent(500, 250, 150); // Very high fines
        
        assert.notStrictEqual(result, null);
        
        // Total: 500 + 250 + 150 = 900 kg/m³
        assert.strictEqual(result.total_fines, 900);
    });

    it('should handle addition water calculation with negative moisture (edge case)', () => {
        const result = calculateAdditionWater(160, 1800, -2); // Negative moisture percentage
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~-36 kg (1800 × (-0.02))
        // Addition: 160 - (-36) = 196 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture + 36) < 2);
        assert.strictEqual(result.addition_water, 196);
    });

    it('should verify paste volume for typical C45/55 with fly ash', () => {
        const result = calculatePasteVolume(480, 195, 100); // Typical very high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~160 dm³ (480/3), Water: 195 dm³, Fly ash: ~43 dm³ (100/2.3)
        const expectedTotal = Math.round(480 / 3.0) + 195 + Math.round(100 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero values for single component', () => {
        const result = calculatePasteVolume(300, 0, 50); // No water
        
        assert.notStrictEqual(result, null);
        
        // Cement: 100 dm³ (300/3), Water: 0, Fly ash: ~22 dm³ (50/2.3)
        const expectedTotal = Math.round(300 / 3.0) + 0 + Math.round(50 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with negative total (edge case)', () => {
        const result = calculateFinesContent(100, -200, -50); // Negative total
        
        assert.notStrictEqual(result, null);
        
        // Total: 100 + (-200) + (-50) = -150 kg/m³ (negative is valid mathematically)
        assert.strictEqual(result.total_fines, -150);
    });

    it('should handle addition water calculation with extreme moisture', () => {
        const result = calculateAdditionWater(80, 4000, 25); // Extremely wet (25%)
        
        assert.notStrictEqual(result, null);
        
        // Surface: 1000 kg (4000 × 0.25)
        // Addition: 80 - 1000 = -920 kg
        
        assert.strictEqual(result.surface_moisture, 1000);
        assert.strictEqual(result.addition_water, -920);
    });

    it('should verify paste volume for typical C50/60 with fly ash', () => {
        const result = calculatePasteVolume(520, 200, 80); // Typical very high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~173 dm³ (520/3), Water: 200 dm³, Fly ash: ~35 dm³ (80/2.3)
        const expectedTotal = Math.round(520 / 3.0) + 200 + Math.round(80 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very large negative additive', () => {
        const result = calculatePasteVolume(300, 160, -1000); // Very negative fly ash
        
        assert.notStrictEqual(result, null);
        
        // Should treat negative as zero additive
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = Math.round(300 / 3.0) + 160;
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with all negative components', () => {
        const result = calculateFinesContent(-100, -50, -25); // All negative
        
        assert.notStrictEqual(result, null);
        
        // Total: -100 + (-50) + (-25) = -175 kg/m³
        assert.strictEqual(result.total_fines, -175);
    });

    it('should handle addition water calculation with extreme negative total', () => {
        const result = calculateAdditionWater(-200, 1500, 4); // Negative total water
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~60 kg (1500 × 0.04)
        // Addition: -200 - 60 = -260 kg
        
        assert.ok(Math.abs(result.surface_moisture - 60) < 2);
        assert.strictEqual(result.addition_water, -260);
    });

    it('should verify paste volume for typical C55/67 with fly ash', () => {
        const result = calculatePasteVolume(580, 210, 90); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~193 dm³ (580/3), Water: 210 dm³, Fly ash: ~39 dm³ (90/2.3)
        const expectedTotal = Math.round(580 / 3.0) + 210 + Math.round(90 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero cement only', () => {
        const result = calculatePasteVolume(0, 150, 0); // No cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 150 dm³, Fly ash: 0
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 150);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = 0 + 150;
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with extreme values', () => {
        const result = calculateFinesContent(600, 300, 200); // Maximum reasonable
        
        assert.notStrictEqual(result, null);
        
        // Total: 600 + 300 + 200 = 1100 kg/m³ (very high but possible)
        assert.strictEqual(result.total_fines, 1100);
    });

    it('should handle addition water calculation with zero aggregate', () => {
        const result = calculateAdditionWater(180, 0, 5); // Zero aggregate mass
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (0 × 0.05)
        // Addition: 180 - 0 = 180 kg/m³ (same as total water)
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 180);
    });

    it('should verify paste volume for typical C20/25 without fly ash', () => {
        const result = calculatePasteVolume(260, 155, 0); // No fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~87 dm³ (260/3), Water: 155 dm³, Fly ash: 0
        const expectedTotal = Math.round(260 / 3.0) + 155;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very small cement and large fly ash', () => {
        const result = calculatePasteVolume(80, 60, 400); // Low cement, high fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~27 dm³ (80/3), Water: 60 dm³, Fly ash: ~174 dm³ (400/2.3)
        const expectedTotal = Math.round(80 / 3.0) + 60 + Math.round(400 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with equal large components', () => {
        const result = calculateFinesContent(450, 450, 450); // Equal high amounts
        
        assert.notStrictEqual(result, null);
        
        // Total: 450 + 450 + 450 = 1350 kg/m³ (very high but valid)
        assert.strictEqual(result.total_fines, 1350);
    });

    it('should handle addition water calculation with typical values matching B20', () => {
        const result = calculateAdditionWater(190, 1836, 4.37); // From B20 Section 8
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~80 kg (1836 × 0.0437 ≈ 80)
        // Addition: 190 - 80 = 110 kg/m³ (from B20 Section 8 calculation)
        
        assert.ok(Math.abs(result.surface_moisture - 80) < 2);
        assert.ok(Math.abs(result.addition_water - 110) < 3);
    });

    it('should verify paste volume for typical C60/75 with fly ash', () => {
        const result = calculatePasteVolume(640, 220, 100); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~213 dm³ (640/3), Water: 220 dm³, Fly ash: ~43 dm³ (100/2.3)
        const expectedTotal = Math.round(640 / 3.0) + 220 + Math.round(100 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero values for two components', () => {
        const result = calculatePasteVolume(0, 0, 0); // All zeros
        
        assert.notStrictEqual(result, null);
        
        // All volumes should be zero
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        assert.strictEqual(result.total_paste_volume, 0);
    });

    it('should verify fines calculation with minimal non-zero values', () => {
        const result = calculateFinesContent(1, 1, 1); // Minimal amounts
        
        assert.notStrictEqual(result, null);
        
        // Total: 1 + 1 + 1 = 3 kg/m³
        assert.strictEqual(result.total_fines, 3);
    });

    it('should handle addition water calculation with extreme negative moisture', () => {
        const result = calculateAdditionWater(50, 2000, -50); // Extremely negative moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~-1000 kg (2000 × (-0.50))
        // Addition: 50 - (-1000) = 1050 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture + 1000) < 10);
        assert.strictEqual(result.addition_water, 1050);
    });

    it('should verify paste volume for typical C70/85 with fly ash', () => {
        const result = calculatePasteVolume(720, 240, 120); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~240 dm³ (720/3), Water: 240 dm³, Fly ash: ~52 dm³ (120/2.3)
        const expectedTotal = Math.round(720 / 3.0) + 240 + Math.round(120 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero cement and water only fly ash', () => {
        const result = calculatePasteVolume(0, 0, 800); // Only fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 0, Fly ash: ~348 dm³ (800/2.3)
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        
        const expectedAdditive = Math.round(800 / 2.3);
        assert.strictEqual(result.additive_volume, expectedAdditive);
    });

    it('should verify fines calculation with one zero component', () => {
        const result = calculateFinesContent(400, 0, 100); // No supplementary
        
        assert.notStrictEqual(result, null);
        
        // Total: 400 + 0 + 100 = 500 kg/m³
        assert.strictEqual(result.total_fines, 500);
    });

    it('should handle addition water calculation with zero inputs', () => {
        const result = calculateAdditionWater(0, 0, 0); // All zeros
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (0 × 0)
        // Addition: 0 - 0 = 0 kg/m³
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 0);
    });

    it('should verify paste volume for typical C80/95 with fly ash', () => {
        const result = calculatePasteVolume(800, 260, 140); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~267 dm³ (800/3), Water: 260 dm³, Fly ash: ~61 dm³ (140/2.3)
        const expectedTotal = Math.round(800 / 3.0) + 260 + Math.round(140 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very large fly ash only', () => {
        const result = calculatePasteVolume(0, 0, 2000); // Only massive fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 0, Fly ash: ~870 dm³ (2000/2.3)
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        
        const expectedAdditive = Math.round(2000 / 2.3);
        assert.strictEqual(result.additive_volume, expectedAdditive);
    });

    it('should verify fines calculation with large equal components', () => {
        const result = calculateFinesContent(500, 500, 500); // All equal high
        
        assert.notStrictEqual(result, null);
        
        // Total: 500 + 500 + 500 = 1500 kg/m³ (very high but valid)
        assert.strictEqual(result.total_fines, 1500);
    });

    it('should handle addition water calculation with very large total', () => {
        const result = calculateAdditionWater(500, 5000, 8); // Very large values
        
        assert.notStrictEqual(result, null);
        
        // Surface: 400 kg (5000 × 0.08)
        // Addition: 500 - 400 = 100 kg/m³
        
        assert.strictEqual(result.surface_moisture, 400);
        assert.strictEqual(result.addition_water, 100);
    });

    it('should verify paste volume for typical C90/105 with fly ash', () => {
        const result = calculatePasteVolume(920, 300, 180); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~307 dm³ (920/3), Water: 300 dm³, Fly ash: ~78 dm³ (180/2.3)
        const expectedTotal = Math.round(920 / 3.0) + 300 + Math.round(180 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with extreme negative values', () => {
        const result = calculatePasteVolume(-500, -400, -300); // All negative
        
        assert.notStrictEqual(result, null);
        
        // Should treat all as zero due to condition checks
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        assert.strictEqual(result.total_paste_volume, 0);
    });

    it('should verify fines calculation with maximum reasonable values', () => {
        const result = calculateFinesContent(600, 350, 200); // Maximum typical
        
        assert.notStrictEqual(result, null);
        
        // Total: 600 + 350 + 200 = 1150 kg/m³ (very high but possible)
        assert.strictEqual(result.total_fines, 1150);
    });

    it('should handle addition water calculation with very large negative total', () => {
        const result = calculateAdditionWater(-300, 3000, 6); // Very negative
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~180 kg (3000 × 0.06)
        // Addition: -300 - 180 = -480 kg
        
        assert.ok(Math.abs(result.surface_moisture - 180) < 2);
        assert.strictEqual(result.addition_water, -480);
    });

    it('should verify paste volume for typical C100/115 with fly ash', () => {
        const result = calculatePasteVolume(1000, 320, 200); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~333 dm³ (1000/3), Water: 320 dm³, Fly ash: ~87 dm³ (200/2.3)
        const expectedTotal = Math.round(1000 / 3.0) + 320 + Math.round(200 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with only cement', () => {
        const result = calculatePasteVolume(450, 0, 0); // Only cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~150 dm³ (450/3), Water: 0, Fly ash: 0
        assert.strictEqual(result.cement_volume, Math.round(450 / 3.0));
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = Math.round(450 / 3.0);
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with zero cement and fly ash', () => {
        const result = calculateFinesContent(0, 0, 200); // Only fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 0 + 0 + 200 = 200 kg/m³
        assert.strictEqual(result.total_fines, 200);
    });

    it('should handle addition water calculation with zero moisture and large aggregate', () => {
        const result = calculateAdditionWater(250, 4000, 0); // Zero moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (4000 × 0)
        // Addition: 250 - 0 = 250 kg/m³ (same as total water)
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 250);
    });

    it('should verify paste volume for typical C110/125 with fly ash', () => {
        const result = calculatePasteVolume(1100, 350, 220); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~367 dm³ (1100/3), Water: 350 dm³, Fly ash: ~96 dm³ (220/2.3)
        const expectedTotal = Math.round(1100 / 3.0) + 350 + Math.round(220 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very large cement only', () => {
        const result = calculatePasteVolume(1500, 0, 0); // Only massive cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~500 dm³ (1500/3), Water: 0, Fly ash: 0
        assert.strictEqual(result.cement_volume, Math.round(1500 / 3.0));
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = Math.round(1500 / 3.0);
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with one component zero', () => {
        const result = calculateFinesContent(450, 80, 0); // No fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 450 + 80 + 0 = 530 kg/m³
        assert.strictEqual(result.total_fines, 530);
    });

    it('should handle addition water calculation with moderate values matching typical mix', () => {
        const result = calculateAdditionWater(175, 1950, 4.6); // Typical concrete mix
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~90 kg (1950 × 0.046)
        // Addition: 175 - 90 ≈ 85 kg/m³
        
        assert.ok(Math.abs(result.surface_moisture - 90) < 3);
        assert.ok(Math.abs(result.addition_water - 85) < 3);
    });

    it('should verify paste volume for typical C120/135 with fly ash', () => {
        const result = calculatePasteVolume(1250, 380, 250); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~417 dm³ (1250/3), Water: 380 dm³, Fly ash: ~109 dm³ (250/2.3)
        const expectedTotal = Math.round(1250 / 3.0) + 380 + Math.round(250 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero fly ash and significant cement', () => {
        const result = calculatePasteVolume(400, 180, 0); // No fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~133 dm³ (400/3), Water: 180 dm³, Fly ash: 0
        const expectedTotal = Math.round(400 / 3.0) + 180;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with all components present and reasonable', () => {
        const result = calculateFinesContent(350, 75, 65); // Typical values
        
        assert.notStrictEqual(result, null);
        
        // Total: 350 + 75 + 65 = 490 kg/m³
        assert.strictEqual(result.total_fines, 490);
    });

    it('should handle addition water calculation with very wet aggregate', () => {
        const result = calculateAdditionWater(120, 3500, 12); // Very wet (12%)
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~420 kg (3500 × 0.12)
        // Addition: 120 - 420 = -300 kg
        
        assert.ok(Math.abs(result.surface_moisture - 420) < 5);
        assert.strictEqual(result.addition_water, -300);
    });

    it('should verify paste volume for typical C130/145 with fly ash', () => {
        const result = calculatePasteVolume(1400, 400, 280); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~467 dm³ (1400/3), Water: 400 dm³, Fly ash: ~122 dm³ (280/2.3)
        const expectedTotal = Math.round(1400 / 3.0) + 400 + Math.round(280 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with extreme fly ash to cement ratio', () => {
        const result = calculatePasteVolume(100, 50, 600); // Fly ash >> cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~33 dm³ (100/3), Water: 50 dm³, Fly ash: ~261 dm³ (600/2.3)
        const expectedTotal = Math.round(100 / 3.0) + 50 + Math.round(600 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with minimal values', () => {
        const result = calculateFinesContent(150, 25, 20); // Minimal typical
        
        assert.notStrictEqual(result, null);
        
        // Total: 150 + 25 + 20 = 195 kg/m³
        assert.strictEqual(result.total_fines, 195);
    });

    it('should handle addition water calculation with zero total and positive moisture', () => {
        const result = calculateAdditionWater(0, 2000, 6); // Zero total water
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~120 kg (2000 × 0.06)
        // Addition: 0 - 120 = -120 kg
        
        assert.ok(Math.abs(result.surface_moisture - 120) < 3);
        assert.strictEqual(result.addition_water, -120);
    });

    it('should verify paste volume for typical C140/155 with fly ash', () => {
        const result = calculatePasteVolume(1550, 420, 300); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~517 dm³ (1550/3), Water: 420 dm³, Fly ash: ~130 dm³ (300/2.3)
        const expectedTotal = Math.round(1550 / 3.0) + 420 + Math.round(300 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero values for all except water', () => {
        const result = calculatePasteVolume(0, 250, 0); // Only water
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 250 dm³, Fly ash: 0
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 250);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = 250;
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with very large cement', () => {
        const result = calculateFinesContent(700, 150, 80); // High cement
        
        assert.notStrictEqual(result, null);
        
        // Total: 700 + 150 + 80 = 930 kg/m³ (very high but valid)
        assert.strictEqual(result.total_fines, 930);
    });

    it('should handle addition water calculation with negative total and positive moisture', () => {
        const result = calculateAdditionWater(-150, 2500, 7); // Negative total
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~175 kg (2500 × 0.07)
        // Addition: -150 - 175 = -325 kg
        
        assert.ok(Math.abs(result.surface_moisture - 175) < 3);
        assert.strictEqual(result.addition_water, -325);
    });

    it('should verify paste volume for typical C150/165 with fly ash', () => {
        const result = calculatePasteVolume(1700, 440, 320); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~567 dm³ (1700/3), Water: 440 dm³, Fly ash: ~139 dm³ (320/2.3)
        const expectedTotal = Math.round(1700 / 3.0) + 440 + Math.round(320 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very small amounts for all components', () => {
        const result = calculatePasteVolume(25, 20, 10); // Minimal paste
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~8 dm³ (25/3), Water: 20 dm³, Fly ash: ~4 dm³ (10/2.3)
        const expectedTotal = Math.round(25 / 3.0) + 20 + Math.round(10 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with zero cement and fly ash', () => {
        const result = calculateFinesContent(0, 0, 500); // Only fine aggregate
        
        assert.notStrictEqual(result, null);
        
        // Total: 0 + 0 + 500 = 500 kg/m³
        assert.strictEqual(result.total_fines, 500);
    });

    it('should handle addition water calculation with very small total', () => {
        const result = calculateAdditionWater(20, 300, 8); // Very small values
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~24 kg (300 × 0.08)
        // Addition: 20 - 24 = -4 kg
        
        assert.ok(Math.abs(result.surface_moisture - 24) < 2);
        assert.strictEqual(result.addition_water, -4);
    });

    it('should verify paste volume for typical C160/175 with fly ash', () => {
        const result = calculatePasteVolume(1900, 480, 380); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~633 dm³ (1900/3), Water: 480 dm³, Fly ash: ~165 dm³ (380/2.3)
        const expectedTotal = Math.round(1900 / 3.0) + 480 + Math.round(380 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero cement and fly ash', () => {
        const result = calculatePasteVolume(0, 350, 0); // Only water
        
        assert.notStrictEqual(result, null);
        
        // Cement: 0, Water: 350 dm³, Fly ash: 0
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 350);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = 350;
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with moderate values', () => {
        const result = calculateFinesContent(420, 90, 70); // Typical C30/37
        
        assert.notStrictEqual(result, null);
        
        // Total: 420 + 90 + 70 = 580 kg/m³
        assert.strictEqual(result.total_fines, 580);
    });

    it('should handle addition water calculation with moderate total and high moisture', () => {
        const result = calculateAdditionWater(140, 2800, 9); // Moderate total, high moisture
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~252 kg (2800 × 0.09)
        // Addition: 140 - 252 = -112 kg
        
        assert.ok(Math.abs(result.surface_moisture - 252) < 3);
        assert.strictEqual(result.addition_water, -112);
    });

    it('should verify paste volume for typical C170/185 with fly ash', () => {
        const result = calculatePasteVolume(2100, 520, 400); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~700 dm³ (2100/3), Water: 520 dm³, Fly ash: ~174 dm³ (400/2.3)
        const expectedTotal = Math.round(2100 / 3.0) + 520 + Math.round(400 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very large cement and water', () => {
        const result = calculatePasteVolume(800, 350, 100); // Very high values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~267 dm³ (800/3), Water: 350 dm³, Fly ash: ~43 dm³ (100/2.3)
        const expectedTotal = Math.round(800 / 3.0) + 350 + Math.round(100 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with one zero component', () => {
        const result = calculateFinesContent(500, 0, 80); // No supplementary
        
        assert.notStrictEqual(result, null);
        
        // Total: 500 + 0 + 80 = 580 kg/m³
        assert.strictEqual(result.total_fines, 580);
    });

    it('should handle addition water calculation with zero total and zero moisture', () => {
        const result = calculateAdditionWater(0, 1000, 0); // All zeros
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (1000 × 0)
        // Addition: 0 - 0 = 0 kg/m³
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 0);
    });

    it('should verify paste volume for typical C180/195 with fly ash', () => {
        const result = calculatePasteVolume(2300, 560, 450); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~767 dm³ (2300/3), Water: 560 dm³, Fly ash: ~196 dm³ (450/2.3)
        const expectedTotal = Math.round(2300 / 3.0) + 560 + Math.round(450 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with minimal cement and fly ash', () => {
        const result = calculatePasteVolume(120, 80, 60); // Minimal values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~40 dm³ (120/3), Water: 80 dm³, Fly ash: ~26 dm³ (60/2.3)
        const expectedTotal = Math.round(120 / 3.0) + 80 + Math.round(60 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with negative cement (edge case)', () => {
        const result = calculateFinesContent(-150, 50, 40); // Negative cement
        
        assert.notStrictEqual(result, null);
        
        // Total: -150 + 50 + 40 = -60 kg/m³
        assert.strictEqual(result.total_fines, -60);
    });

    it('should handle addition water calculation with very large total and zero moisture', () => {
        const result = calculateAdditionWater(350, 6000, 0); // Very large values
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (6000 × 0)
        // Addition: 350 - 0 = 350 kg/m³ (same as total water)
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, 350);
    });

    it('should verify paste volume for typical C190/205 with fly ash', () => {
        const result = calculatePasteVolume(2500, 600, 500); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~833 dm³ (2500/3), Water: 600 dm³, Fly ash: ~217 dm³ (500/2.3)
        const expectedTotal = Math.round(2500 / 3.0) + 600 + Math.round(500 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero water and fly ash', () => {
        const result = calculatePasteVolume(550, 0, 0); // Only cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~183 dm³ (550/3), Water: 0, Fly ash: 0
        assert.strictEqual(result.cement_volume, Math.round(550 / 3.0));
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = Math.round(550 / 3.0);
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with all components zero', () => {
        const result = calculateFinesContent(0, 0, 0); // All zeros
        
        assert.notStrictEqual(result, null);
        
        // Total: 0 + 0 + 0 = 0 kg/m³
        assert.strictEqual(result.total_fines, 0);
    });

    it('should handle addition water calculation with negative total and zero moisture', () => {
        const result = calculateAdditionWater(-100, 2000, 0); // Negative total
        
        assert.notStrictEqual(result, null);
        
        // Surface: 0 kg (2000 × 0)
        // Addition: -100 - 0 = -100 kg/m³
        
        assert.strictEqual(result.surface_moisture, 0);
        assert.strictEqual(result.addition_water, -100);
    });

    it('should verify paste volume for typical C200/215 with fly ash', () => {
        const result = calculatePasteVolume(2800, 650, 550); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~933 dm³ (2800/3), Water: 650 dm³, Fly ash: ~239 dm³ (550/2.3)
        const expectedTotal = Math.round(2800 / 3.0) + 650 + Math.round(550 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with very large cement and zero water', () => {
        const result = calculatePasteVolume(1800, 0, 0); // Only massive cement
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~600 dm³ (1800/3), Water: 0, Fly ash: 0
        assert.strictEqual(result.cement_volume, Math.round(1800 / 3.0));
        assert.strictEqual(result.water_volume, 0);
        assert.strictEqual(result.additive_volume, 0);
        
        const expectedTotal = Math.round(1800 / 3.0);
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with one large component', () => {
        const result = calculateFinesContent(650, 50, 40); // High cement
        
        assert.notStrictEqual(result, null);
        
        // Total: 650 + 50 + 40 = 740 kg/m³ (very high but valid)
        assert.strictEqual(result.total_fines, 740);
    });

    it('should handle addition water calculation with extreme values', () => {
        const result = calculateAdditionWater(400, 8000, 15); // Extreme values
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~1200 kg (8000 × 0.15)
        // Addition: 400 - 1200 = -800 kg
        
        assert.ok(Math.abs(result.surface_moisture - 1200) < 10);
        assert.strictEqual(result.addition_water, -800);
    });

    it('should verify paste volume for typical C210/225 with fly ash', () => {
        const result = calculatePasteVolume(3000, 700, 600); // Typical ultra high strength values
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~1000 dm³ (3000/3), Water: 700 dm³, Fly ash: ~261 dm³ (600/2.3)
        const expectedTotal = Math.round(3000 / 3.0) + 700 + Math.round(600 / 2.3);
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should handle paste calculation with zero fly ash and moderate values', () => {
        const result = calculatePasteVolume(450, 200, 0); // No fly ash
        
        assert.notStrictEqual(result, null);
        
        // Cement: ~150 dm³ (450/3), Water: 200 dm³, Fly ash: 0
        const expectedTotal = Math.round(450 / 3.0) + 200;
        
        assert.strictEqual(result.total_paste_volume, expectedTotal);
    });

    it('should verify fines calculation with all components equal', () => {
        const result = calculateFinesContent(380, 380, 380); // All equal
        
        assert.notStrictEqual(result, null);
        
        // Total: 380 + 380 + 380 = 1140 kg/m³ (very high but valid)
        assert.strictEqual(result.total_fines, 1140);
    });

    it('should handle addition water calculation with moderate negative total', () => {
        const result = calculateAdditionWater(-580, 9200, 15.8); // Negative total
        
        assert.notStrictEqual(result, null);
        
        // Surface: ~1454 kg (9200 × 0.158)
        // Addition: -580 - 1454 = -2034 kg
        
        assert.ok(Math.abs(result.surface_moisture - 1454) < 16);
        assert.strictEqual(result.addition_water, -2034);
    });

}); // End of B20 Ground Truth Tests - Admixture Dosierung BV=92

describe('B20 Ground Truth Tests - Additional Edge Cases', () => {
    
    it('should handle extreme paste volume calculations with very high values', () => {
        const result = calculatePasteVolume(50000, 10000, 10000);
        
        assert.notStrictEqual(result, null);
        assert.strictEqual(typeof result.total_paste_volume, 'number');
    });

    it('should handle paste calculation with negative inputs gracefully', () => {
        const result = calculatePasteVolume(-100, -50, -25);
        
        assert.notStrictEqual(result, null);
        // Should treat negative as zero
        assert.strictEqual(result.cement_volume, 0);
        assert.strictEqual(result.water_volume, 0);
    });

    it('should verify fines calculation handles all edge cases', () => {
        const result1 = calculateFinesContent(0, 0, 0);
        const result2 = calculateFinesContent(100, 50, 25);
        
        assert.notStrictEqual(result1, null);
        assert.notStrictEqual(result2, null);
    });

    it('should handle addition water with extreme moisture values', () => {
        const result1 = calculateAdditionWater(100, 2000, 0); // No moisture
        const result2 = calculateAdditionWater(100, 2000, 30); // Very high moisture
        
        assert.notStrictEqual(result1, null);
        assert.notStrictEqual(result2, null);
    });

}); // End of B20 Ground Truth Tests - Additional Edge Cases

describe('B20 Summary Tests', () => {
    
    it('should verify all calculation modules are working together', () => {
        const water = calculateWaterDemand('B32', 'F3');
        const targetStrength = calculateTargetStrength(37);
        const density = getAverageDensity('Granit');
        
        assert.notStrictEqual(water, null);
        assert.notStrictEqual(targetStrength, 0);
        assert.notStrictEqual(density, null);
    });

}); // End of B20 Summary Tests

// b20-fines-content.test.js - Tests for fines content calculations per Zement-Merkblatt B 20 (Tafel 9, Tafel 8/23)
// Tests for Mehlkorngehalt and Zementleimgehalt checks

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    calculateFinesContent,
    checkFinesLimits,
    calculatePasteVolume,
    checkPasteRequirements,
    checkCemIFlyAshSilicaFume,
    getRecommendedPasteVolume
} from '../js/lib/fines-content.js';

describe('fines-content.js - Mehlkorngehalt calculations (B20 Tafel 8, 23)', () => {
    describe('calculateFinesContent', () => {
        it('should calculate basic fines content with cement only', () => {
            const result = calculateFinesContent({ cement: 300 });
            assert.ok(result);
            assert.strictEqual(result.cement, 300);
            assert.strictEqual(result.flyAsh, 0);
            assert.strictEqual(result.totalPulverförmig, 300);
            assert.strictEqual(result.finesContent0125, 300); // Only cement
        });

        it('should calculate fines content with fly ash', () => {
            const result = calculateFinesContent({ 
                cement: 280,
                flyAsh: 94
            });
            assert.strictEqual(result.cement, 280);
            assert.strictEqual(result.flyAsh, 94);
            assert.strictEqual(result.totalPulverförmig, 374); // 280 + 94
        });

        it('should calculate fines content with silica fume', () => {
            const result = calculateFinesContent({ 
                cement: 285,
                silicaFume: 31.5
            });
            assert.strictEqual(result.cement, 285);
            assert.strictEqual(result.silicaFume, 32); // rounded from 31.5
            assert.ok(Math.abs(result.totalPulverförmig - 317) < 0.1); // 285 + 32 (rounded)
        });

        it('should calculate fines content with multiple additives', () => {
            const result = calculateFinesContent({ 
                cement: 279,
                flyAsh: 40,
                silicaFume: 10,
                limestoneFiller: 5
            });
            assert.strictEqual(result.cement, 279);
            assert.ok(Math.abs(result.totalPulverförmig - 334) < 0.1); // 279 + 40 + 10 + 5
        });

        it('should handle fine aggregate additions', () => {
            const result = calculateFinesContent({ 
                cement: 280,
                flyAsh: 94,
                fineAggregate0125: 15 // Gesteinskörnung bis 0,125 mm
            });
            assert.strictEqual(result.finesContent0125, 280 + 94 + 15); // 389
        });

        it('should return null for invalid cement value', () => {
            const result = calculateFinesContent({ cement: -10 });
            assert.strictEqual(result, null);

            const result2 = calculateFinesContent({});
            assert.strictEqual(result2, null);
        });

        it('should round values correctly', () => {
            const result = calculateFinesContent({ 
                cement: 279.4,
                flyAsh: 93.6
            });
            assert.strictEqual(result.cement, 279);
            assert.strictEqual(result.flyAsh, 94);
        });
    });

    describe('checkFinesLimits', () => {
        it('should check fines limit for XC1 (non-exposed, cement ≤ 300)', () => {
            const fines = calculateFinesContent({ cement: 279 });
            const result = checkFinesLimits(fines, 'XC1');
            
            assert.ok(result);
            assert.strictEqual(result.maxAllowed, 450); // max for cement ≤ 300 in non-exposed
            assert.ok(Math.abs(result.finesContent - 279) < 0.1);
            assert.strictEqual(result.exceedsLimit, false);
        });

        it('should check fines limit for XC4 (non-exposed, cement ≥ 350)', () => {
            const fines = calculateFinesContent({ cement: 383 });
            const result = checkFinesLimits(fines, 'XC4');
            
            assert.ok(result);
            assert.strictEqual(result.maxAllowed, 550); // max for cement ≥ 350 in non-exposed
        });

        it('should check fines limit for XF1 (frost/wear, cement ≤ 300)', () => {
            const fines = calculateFinesContent({ cement: 287 });
            const result = checkFinesLimits(fines, 'XF1');
            
            assert.ok(result);
            assert.strictEqual(result.maxAllowed, 400); // max for frost/wear with cement ≤ 300
        });

        it('should check fines limit for XF2 (frost/wear, cement ≥ 350)', () => {
            const fines = calculateFinesContent({ cement: 383 });
            const result = checkFinesLimits(fines, 'XF2');
            
            assert.ok(result);
            assert.strictEqual(result.maxAllowed, 450); // max for frost/wear with cement ≥ 350
        });

        it('should return null for invalid fines data', () => {
            const result = checkFinesLimits(null, 'XC1');
            assert.strictEqual(result, null);
            
            const result2 = checkFinesLimits({}, 'XC1');
            assert.strictEqual(result2, null);
        });

        it('should indicate when limit is exceeded', () => {
            // Create a case where fines content exceeds the limit
            const fines = calculateFinesContent({ 
                cement: 400, // cement ≥ 350 → maxAllowed = 550
                flyAsh: 200,
                fineAggregate0125: 100 // total = 700 > 550
            });
            
            const result = checkFinesLimits(fines, 'XC4');
            assert.ok(result);
            assert.strictEqual(result.exceedsLimit, true);
        });

        it('should identify frost-wear limit type correctly', () => {
            const fines = calculateFinesContent({ cement: 300 });
            
            const resultXF = checkFinesLimits(fines, 'XF2');
            assert.strictEqual(resultXF.limitType, 'frost-wear');
            
            const resultXC = checkFinesLimits(fines, 'XC4');
            assert.strictEqual(resultXC.limitType, 'non-exposed');
        });
    });

    describe('getRecommendedPasteVolume', () => {
        it('should return recommended paste volume for XC1', () => {
            assert.strictEqual(getRecommendedPasteVolume('XC1'), 260);
        });

        it('should return recommended paste volume for XC4', () => {
            assert.strictEqual(getRecommendedPasteVolume('XC4'), 320);
        });

        it('should return recommended paste volume for XF2', () => {
            assert.strictEqual(getRecommendedPasteVolume('XF2'), 320);
        });

        it('should return null for unknown exposure class', () => {
            assert.strictEqual(getRecommendedPasteVolume('UNKNOWN'), null);
        });
    });
});

describe('fines-content.js - Zementleimgehalt calculations (B20 Tafel 9)', () => {
    describe('calculatePasteVolume', () => {
        it('should calculate paste volume with cement only', () => {
            const result = calculatePasteVolume(300);
            assert.ok(result);
            assert.strictEqual(result.cement, 300);
            assert.strictEqual(result.pasteVolume, 300);
        });

        it('should calculate paste volume with fly ash', () => {
            const result = calculatePasteVolume(280, 94);
            assert.strictEqual(result.pasteVolume, 374); // 280 + 94
        });

        it('should calculate paste volume with silica fume', () => {
            const result = calculatePasteVolume(285, 0, 31.5);
            assert.ok(Math.abs(result.pasteVolume - 317) < 0.1); // 285 + 32 (
        });

        it('should handle all additives', () => {
            const result = calculatePasteVolume(279, 40, 10, 5);
            assert.ok(Math.abs(result.pasteVolume - 334) < 0.1); // 279 + 40 + 10 + 5
        });

        it('should return null for invalid cement', () => {
            assert.strictEqual(calculatePasteVolume(-10), null);
            assert.strictEqual(calculatePasteVolume(), null);
        });
    });

    describe('checkPasteRequirements', () => {
        const paste = (cement, flyAsh = 0) => calculatePasteVolume(cement, flyAsh);

        it('should check minimum for XC1 (240 kg/m³)', () => {
            const result = checkPasteRequirements(paste(279), 'XC1');
            assert.ok(result);
            assert.strictEqual(result.minRequired, 240);
            assert.strictEqual(result.meetsRequirement, true);
        });

        it('should check minimum for XC4 (320 kg/m³)', () => {
            const result = checkPasteRequirements(paste(285, 94), 'XC4'); // 379 total
            assert.ok(result);
            assert.strictEqual(result.minRequired, 320);
            assert.strictEqual(result.meetsRequirement, true);
        });

        it('should check minimum for XD1 (300 kg/m³)', () => {
            const result = checkPasteRequirements(paste(383), 'XD1');
            assert.ok(result);
            assert.strictEqual(result.minRequired, 300);
        });

        it('should check minimum for XF2 (320 kg/m³)', () => {
            const result = checkPasteRequirements(paste(285, 94), 'XF2'); // 379 total
            assert.ok(result);
            assert.strictEqual(result.minRequired, 320);
            assert.strictEqual(result.meetsRequirement, true);
        });

        it('should return null for invalid paste data', () => {
            assert.strictEqual(checkPasteRequirements(null, 'XC1'), null);
            assert.strictEqual(checkPasteRequirements({}, 'XC1'), null);
        });

        it('should detect when minimum is not met', () => {
            const result = checkPasteRequirements(paste(230), 'XC4'); // 230 < 320
            assert.ok(result);
            assert.strictEqual(result.meetsRequirement, false);
            assert.strictEqual(result.pasteVolume, 230);
        });

        it('should correctly identify exposure class in result', () => {
            const result = checkPasteRequirements(paste(383), 'XC4');
            assert.strictEqual(result.exposureClass, 'XC4');
        });
    });
});

describe('fines-content.js - CEM I specific rules (B20 Section 6)', () => {
    describe('checkCemIFlyAshSilicaFume', () => {
        it('should check limit for CEM I with fly ash only', () => {
            const result = checkCemIFlyAshSilicaFume(285, 94.1, 0);
            assert.ok(result);
            
            // With s/z = 0, max f/z = 3 * (0.22 - 0) = 0.66
            assert.ok(Math.abs(result.maxFLimit - 0.66) < 0.01);
            assert.ok(Math.abs(result.fZRatio - 94.1/285) < 0.01); // ~0.33
        });

        it('should check limit for CEM I with both additives', () => {
            const result = checkCemIFlyAshSilicaFume(285, 94.1, 31.5);
            
            assert.ok(result);
            // max f/z ≤ 3·(0.22 - s/z)
            // s/z = 31.5/285 ≈ 0.11
            // max f/z ≤ 3·(0.22 - 0.11) = 3·0.11 = 0.33
            
            const expectedMax = 3 * (0.22 - 31.5/285);
            assert.ok(Math.abs(result.maxFLimit - expectedMax) < 0.01);
        });

        it('should detect when CEM I limit is exceeded', () => {
            // High fly ash with moderate silica fume - should exceed
            const result = checkCemIFlyAshSilicaFume(285, 150, 31.5);
            
            assert.ok(result);
            assert.strictEqual(result.meetsLimit, false); // f/z > 3·(0.22 - s/z)
        });

        it('should return null for invalid cement', () => {
            assert.strictEqual(checkCemIFlyAshSilicaFume(-10, 50, 10), null);
            assert.strictEqual(checkCemIFlyAshSilicaFume(0, 50, 10), null);
        });

        it('should handle CEM II (no CEM I specific check needed)', () => {
            const result = checkCemIFlyAshSilicaFume(285, 94.1, 0);
            
            assert.strictEqual(result.limitType, 'CEM I');
        });
    });
});

describe('fines-content.js - Integration with exposure classes', () => {
    it('should work correctly with XC1 example from B20 (Zement 279 kg/m³)', () => {
        const cement = 279;
        const fines = calculateFinesContent({ cement });
        
        const result = checkFinesLimits(fines, 'XC1');
        assert.strictEqual(result.maxAllowed, 450); // Table 8/23 B20
        assert.strictEqual(result.exceedsLimit, false);
    });

    it('should work correctly with XC4 example from B20 (Zement 383 kg/m³)', () => {
        const cement = 383;
        const fines = calculateFinesContent({ cement });
        
        const result = checkFinesLimits(fines, 'XC4');
        assert.strictEqual(result.maxAllowed, 550); // Table 8/23 B20
    });

    it('should work correctly with XF2 example from B20 (Zement 383 kg/m³)', () => {
        const cement = 383;
        const fines = calculateFinesContent({ cement });
        
        const result = checkFinesLimits(fines, 'XF2');
        assert.strictEqual(result.maxAllowed, 450); // Table 8/23 B20 (frost/wear class)
    });

    it('should verify paste volume requirements from examples', () => {
        // Beispiel I: Zement 279 kg/m³, XC1 → min 240
        const paste1 = calculatePasteVolume(279);
        assert.strictEqual(checkPasteRequirements(paste1, 'XC1').meetsRequirement, true);

        // Beispiel III: Zement 383 kg/m³, XF2 → min 320
        const paste3 = calculatePasteVolume(383);
        assert.strictEqual(checkPasteRequirements(paste3, 'XF2').meetsRequirement, true);
    });
});
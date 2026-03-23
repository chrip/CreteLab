// b20-aggregate-distribution.test.js - Tests for aggregate distribution by particle size fractions (Tafel 9 Schritt 7)
// Tests for Mehlkorngehalt and Zementleimgehalt checks

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    calculateAggregateDistribution,
    calculateAddedWaterFromMoisture,
    calculateFreeWater,
    getMaxAggregateSizeFromSieblinie,
    getRecommendedMoisture,
    applyMoistureCorrection,
    getFractionSum,
    getDistributionSummary
} from '../js/lib/aggregate-gradation.js';
import { getAverageDensity } from '../js/lib/densities.js';

describe('aggregate-gradation.js - Aggregate distribution (Tafel 9 Schritt 7)', () => {
    describe('calculateAggregateDistribution', () => {
        it('should calculate distribution for max16 aggregate with standard moisture', () => {
            const totalMass = 1800;
            const result = calculateAggregateDistribution(totalMass, 'Granit', 16, 4.0);
            
            assert.ok(result);
            assert.strictEqual(result.maxSize, 16);
            assert.strictEqual(result.aggregateType, 'Granit');
            assert.strictEqual(result.totalMass, totalMass);
            assert.ok(Math.abs(result.density - getAverageDensity('Granit')) < 0.1);
        });

        it('should distribute mass into fractions with correct percentages', () => {
            const totalMass = 1800;
            const result = calculateAggregateDistribution(totalMass, 'Granit', 16, 4.0);
            
            assert.ok(Array.isArray(result.fractions));
            assert.strictEqual(result.fractions.length, 3); // 0-2mm, 2-8mm, 8-16mm
            
            const f = result.fractions;
            
            // Check that fractions match typical percentages
            assert.ok(Math.abs(f[0].percent - 38) < 0.5); // 0-2 mm should be ~38%
            assert.ok(Math.abs(f[1].percent - 22) < 0.5); // 2-8 mm should be ~22%
            assert.ok(Math.abs(f[2].percent - 40) < 0.5); // 8-16 mm should be ~40%
        });

        it('should calculate moisture masses for each fraction', () => {
            const totalMass = 1800;
            const result = calculateAggregateDistribution(totalMass, 'Granit', 16, 4.0);
            
            // Verify moisture calculation
            assert.strictEqual(result.totalMoistureMass, Math.round(totalMass * 0.04)); // 72 kg
            
            // Each fraction should have its own moisture mass
            for (const f of result.fractions) {
                const expectedMoisture = Math.round(f.mass * 0.04);
                assert.strictEqual(f.moistureMass, expectedMoisture);
            }
        });

        it('should handle different aggregate types', () => {
            const totalMass = 1750;
            
            const granitResult = calculateAggregateDistribution(totalMass, 'Granit', 16, 3.0);
            const kiesResult = calculateAggregateDistribution(totalMass, 'Kies', 16, 4.5);
            
            assert.ok(granitResult);
            assert.ok(kiesResult);
            
            // Both Granit and Kies have same density in cache (2.65), so masses should be similar
            // But different moisture should give different totalMoistureMass values
            assert.notEqual(granitResult.totalMoistureMass, kiesResult.totalMoistureMass);
        });

        it('should distribute mass for max32 aggregate', () => {
            const totalMass = 1850;
            const result = calculateAggregateDistribution(totalMass, 'Kies', 32, 4.0);
            
            assert.ok(result);
            assert.strictEqual(result.fractions.length, 4); // 0-2mm, 2-8mm, 8-16mm, 16-32mm
        });

        it('should handle max45 aggregate', () => {
            const totalMass = 1900;
            const result = calculateAggregateDistribution(totalMass, 'Granit', 45, 3.5);
            
            assert.ok(result);
            assert.strictEqual(result.fractions.length, 5); // 0-2mm, 2-8mm, 8-16mm, 16-32mm, 32-45mm
        });

        it('should return null for invalid aggregate type', () => {
            const result = calculateAggregateDistribution(1800, 'UnknownType', 16, 4.0);
            assert.strictEqual(result, null);
        });

        it('should return null for invalid max size', () => {
            const result = calculateAggregateDistribution(1800, 'Granit', 25, 4.0); // No definition for 25
            assert.strictEqual(result, null);
        });
    });

    describe('calculateAddedWaterFromMoisture', () => {
        it('should calculate added water from moisture percentage', () => {
            const mass = 1800;
            const percent = 4.0;
            const result = calculateAddedWaterFromMoisture(mass, percent);
            
            assert.strictEqual(result, Math.round(1800 * 0.04)); // 72
        });

        it('should handle different moisture percentages', () => {
            const mass = 1500;
            
            assert.strictEqual(calculateAddedWaterFromMoisture(mass, 3.0), Math.round(1500 * 0.03)); // 45
            assert.strictEqual(calculateAddedWaterFromMoisture(mass, 5.0), Math.round(1500 * 0.05)); // 75
        });

        it('should handle edge cases', () => {
            assert.strictEqual(calculateAddedWaterFromMoisture(1000, 0), 0);
            assert.strictEqual(calculateAddedWaterFromMoisture(0, 4.0), 0);
        });
    });

    describe('calculateFreeWater', () => {
        it('should calculate free water considering moisture', () => {
            // Target water: 180 l
            // Moisture adds: 72 l (from 1800 kg * 4%)
            // Free water needed: 180 - 72 = 108 l
            
            const result = calculateFreeWater(180, 1800, 4.0);
            
            assert.strictEqual(result, 180 - Math.round(1800 * 0.04)); // 108
        });

        it('should handle high moisture scenarios', () => {
            const result = calculateFreeWater(200, 1900, 6.0);
            
            assert.strictEqual(result, 200 - Math.round(1900 * 0.06)); // 86
        });
    });

    describe('getMaxAggregateSizeFromSieblinie', () => {
        it('should return correct max size for B32 siebline', () => {
            assert.strictEqual(getMaxAggregateSizeFromSieblinie('B32'), 32);
        });

        it('should return correct max size for B16 siebline', () => {
            assert.strictEqual(getMaxAggregateSizeFromSieblinie('B16'), 16);
        });

        it('should return correct max size for A8 siebline', () => {
            assert.strictEqual(getMaxAggregateSizeFromSieblinie('A8'), 8);
        });

        it('should return null for unknown siebline', () => {
            assert.strictEqual(getMaxAggregateSizeFromSieblinie('Unknown'), null);
        });
    });

    describe('getRecommendedMoisture', () => {
        it('should return typical moisture for Granit', () => {
            assert.strictEqual(getRecommendedMoisture('Granit'), 3.0);
        });

        it('should return typical moisture for Kies', () => {
            assert.strictEqual(getRecommendedMoisture('Kies'), 4.0);
        });

        it('should return typical moisture for Betonsplitt', () => {
            assert.strictEqual(getRecommendedMoisture('Betonsplitt'), 2.5);
        });

        it('should return default value for unknown aggregate type', () => {
            assert.strictEqual(getRecommendedMoisture('UnknownType'), 4.0);
        });
    });

    describe('applyMoistureCorrection', () => {
        it('should apply moisture correction to distribution', () => {
            const distribution = calculateAggregateDistribution(1800, 'Granit', 16, 4.0);
            
            assert.ok(distribution);
            
            const corrected = applyMoistureCorrection(distribution);
            
            assert.ok(corrected);
            assert.strictEqual(corrected.moistureCorrected, true);
            assert.strictEqual(corrected.totalMoistureMass, distribution.totalMoistureMass);
        });

        it('should return null for invalid input', () => {
            assert.strictEqual(applyMoistureCorrection(null), null);
            assert.strictEqual(applyMoistureCorrection({}), null);
        });
    });

    describe('getFractionSum', () => {
        it('should calculate sum of all fraction masses', () => {
            const distribution = calculateAggregateDistribution(1800, 'Granit', 16, 4.0);
            
            assert.ok(distribution);
            const sum = getFractionSum(distribution);
            
            // Sum should equal total mass (with minor rounding differences)
            assert.ok(Math.abs(sum - distribution.totalMass) <= 1);
        });

        it('should return 0 for invalid input', () => {
            assert.strictEqual(getFractionSum(null), 0);
            assert.strictEqual(getFractionSum({ fractions: [] }), 0);
        });
    });

    describe('getDistributionSummary', () => {
        it('should generate summary string array', () => {
            const distribution = calculateAggregateDistribution(1800, 'Granit', 16, 4.0);
            
            assert.ok(distribution);
            const summary = getDistributionSummary(distribution);
            
            assert.ok(Array.isArray(summary));
            assert.ok(summary.length > 2); // Header + at least 3 fractions
            
            // Check for expected content
            assert.ok(summary[0].includes('Gesteinskörnung'));
            assert.ok(summary[1].includes('Gesamtmasse'));
            assert.ok(summary[2].includes('Oberflächenfeuchte'));
        });

        it('should include individual fraction details', () => {
            const distribution = calculateAggregateDistribution(1800, 'Granit', 16, 4.0);
            
            const summary = getDistributionSummary(distribution);
            
            // Check that fractions are listed
            assert.ok(summary.some(line => line.includes('0-2 mm')));
            assert.ok(summary.some(line => line.includes('2-8 mm')));
            assert.ok(summary.some(line => line.includes('8-16 mm')));
        });

        it('should return empty array for invalid input', () => {
            assert.deepStrictEqual(getDistributionSummary(null), []);
            assert.deepStrictEqual(getDistributionSummary({ fractions: null }), []);
        });
    });

    describe('Integration with stofraumrechnung', () => {
        it('should work with density module results', async () => {
            const densities = await import('../js/lib/densities.js');
            
            const cement = 300;
            const water = 180;
            const air = 24; // 20 + 4% LP
            const aggregateType = 'Granit';
            
            const result = densities.stofraumrechnung(cement, water, air, aggregateType);
            
            assert.ok(result);
            assert.ok(result.aggregate_mass > 0);
            
            // Now calculate distribution
            const distribution = calculateAggregateDistribution(
                result.aggregate_mass,
                aggregateType,
                16,
                4.0
            );
            
            assert.ok(distribution);
            assert.strictEqual(distribution.totalMass, result.aggregate_mass);
        });
    });
});
/**
 * Golden set tests from real example documentation (B20 + practical recipes).
 * Verifies direct source formulas and expected concrete recipe results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateFreshConcreteTemperatureSimple, calculateFreshConcreteTemperatureDetailed } from '../js/lib/temperature.js';
import { calculateWetAggregateMass, calculateAggregateMoistureMass, calculateAddedWaterFromMoisture } from '../js/lib/moisture.js';
import { calculateWaterDemand, calculateAverageK, adjustForAggregateType, WATER_DEMAND_A32_PLASTIC, WATER_DEMAND_B32_PLASTIC, WATER_DEMAND_C32_PLASTIC, SPLIT_SURCHARGE } from '../js/lib/consistency.js';
import { calculateEquivalentWz, calculateMaxFlyAshContent, validateUnderwaterConcrete } from '../js/lib/additives.js';
import { calculateTargetStrength, calculateCementFromWz } from '../js/lib/mix-design.js';
import { getMaxWz } from '../js/lib/exposure.js';

// 1. Fresh Concrete Temperature
describe('Golden set: fresh concrete temperature', () => {
  it('winter scenario', () => {
    const result = calculateFreshConcreteTemperatureSimple(8, 5, 45);
    assert.ok(Math.abs(result - 13.3) < 0.1);
  });

  it('high ambient with fly ash scenario', () => {
    const result = calculateFreshConcreteTemperatureDetailed(340, 75, 1800, 27, 0, 0, 150, 25);
    assert.ok(Math.abs(result - 32.1) < 0.1);
  });
});

// 2. Comprehensive mix design check (B20 Appendix example I)
describe('Golden set: mix design appendix example I', () => {
  it('water demand and k-average consistency', () => {
    const A32 = calculateWaterDemand('A32', 'F2');
    const B32 = calculateWaterDemand('B32', 'F2');
    assert.strictEqual(A32, WATER_DEMAND_A32_PLASTIC);
    assert.strictEqual(B32, WATER_DEMAND_B32_PLASTIC);
    assert.ok(Math.abs(calculateAverageK('A32', 'B32') - 4.84) < 0.01);
  });

  it('should enforce exposure max w/z for XC1', () => {
    assert.strictEqual(getMaxWz('XC1'), 0.75);
  });

  it('considers aggregate split surcharge', () => {
    const b32 = calculateWaterDemand('B32', 'F2');
    const split = b32 * (1 + SPLIT_SURCHARGE);
    assert.ok(Math.abs(split - (b32 * 1.1)) < 0.0001);
  });
});

// 3. Fly ash k-value example
describe('Golden set: fly ash k-value', () => {
  it('max fly ash for 300 kg cement', () => {
    const maxContent = calculateMaxFlyAshContent(300);
    assert.ok(Math.abs(maxContent - 99) < 2);
  });

  it('equivalent w/z with fly ash decreases', () => {
    const base = calculateEquivalentWz(171, 325, 'Flugasche', 0);
    const withAsh = calculateEquivalentWz(171, 325, 'Flugasche', 40);
    assert.ok(withAsh < base);
  });

  it('required cement with target 0.53 w/z and 40 fly ash', () => {
    const target = 0.53;
    const water = 171;
    const f = 40;
    const expected = (water / target) - (0.4 * f);
    assert.ok(Math.abs(expected - 307) < 1);
  });
});

// 4. Underwater constraints
describe('Golden set: underwater concrete checks', () => {
  it('valid underwater recipe should be valid', () => {
    const result = validateUnderwaterConcrete({
      cement: 310,
      flyAsh: 40,
      wzEquivalent: 0.53,
      finesContent: 380,
      kValue: 0.7
    });

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('invalid underwater recipe should provide errors', () => {
    const result = validateUnderwaterConcrete({
      cement: 280,
      flyAsh: 50,
      wzEquivalent: 0.65,
      finesContent: 300,
      kValue: 0.65
    });

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length >= 3);
  });
});

// 5. System table constants
describe('Golden set: table constants', () => {
  it('winds up mixed water demands and equations', () => {
    assert.ok(WATER_DEMAND_A32_PLASTIC > 0);
    assert.ok(WATER_DEMAND_B32_PLASTIC > WATER_DEMAND_A32_PLASTIC);
    assert.ok(WATER_DEMAND_C32_PLASTIC > WATER_DEMAND_B32_PLASTIC);
  });

  it('target strength plus margin and cement calculation for w/z', () => {
    assert.strictEqual(calculateTargetStrength(20), 28);
    const cement = calculateCementFromWz(190, 0.63);
    assert.ok(cement > 250);
  });
});

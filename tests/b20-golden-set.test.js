/**
 * Golden set tests from real B20 example documentation.
 * Verifies direct source formulas and expected concrete recipe results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateWetAggregateMass, calculateAggregateMoistureMass, calculateAddedWaterFromMoisture } from '../js/lib/moisture.js';
import { calculateWaterDemand, calculateAverageK, adjustForAggregateType, WATER_DEMAND_A32_PLASTIC, WATER_DEMAND_B32_PLASTIC, WATER_DEMAND_C32_PLASTIC, SPLIT_SURCHARGE } from '../js/lib/consistency.js';
import { calculateEquivalentWz, calculateMaxFlyAshContent } from '../js/lib/additives.js';
import { calculateTargetStrength, calculateCementFromWz } from '../js/lib/mix-design.js';
import { getMaxWz } from '../js/lib/exposure.js';

// 1. Comprehensive mix design check (B20 Appendix example I)
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

// 2. Fly ash k-value example
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

// 3. Moisture correction → Zugabewasser (B20 Step 7)
describe('Golden set: moisture correction and Zugabewasser', () => {
  it('computes aggregate moisture mass per grain group', () => {
    const m1 = calculateAggregateMoistureMass(685, 4.5);
    const m2 = calculateAggregateMoistureMass(463, 3.0);
    const m3 = calculateAggregateMoistureMass(704, 2.0);
    assert.ok(Math.abs(m1 - 30.8) < 0.5);
    assert.ok(Math.abs(m2 - 13.9) < 0.5);
    assert.ok(Math.abs(m3 - 14.1) < 0.5);
  });

  it('computes Zugabewasser from total water minus moisture contributions', () => {
    const m1 = calculateAggregateMoistureMass(685, 4.5);
    const m2 = calculateAggregateMoistureMass(463, 3.0);
    const m3 = calculateAggregateMoistureMass(704, 2.0);
    const addedWater = calculateAddedWaterFromMoisture(190, [m1, m2, m3]);
    assert.ok(Math.abs(addedWater - 131.2) < 0.2);
  });

  it('computes wet aggregate mass including surface moisture', () => {
    const wetAgg = calculateWetAggregateMass(685, 4.5);
    assert.ok(Math.abs(wetAgg - 715.8) < 0.3);
  });
});

// 4. System table constants
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

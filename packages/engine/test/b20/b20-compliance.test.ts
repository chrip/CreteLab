/**
 * DIN 1045-2 / B 20 compliance: five typical German building elements.
 *
 * Question answered: "Can I enter a real building scenario and get a recipe that
 * satisfies the normative requirements of DIN 1045-2?"
 *
 * When several exposure classes apply, ALL their limits must be met at once, so the
 * strictest value across the classes counts:
 *
 *   maxWz      = min(maxWz of each class)
 *   minCement  = max(minCement of each class)
 *   minFckCube = max(minFckCube of each class)
 *
 * Each scenario is checked twice: step by step with the library functions (as the old
 * app did) and through computeRecipe. Three assertions each:
 *   1. z ≥ minCement
 *   2. w/z (or the equivalent w/z with additions) ≤ maxWz
 *   3. fck,cube ≥ minFckCube
 */
import { describe, it, expect } from 'vitest';
import {
  STRENGTH_CLASSES, strictestLimits, targetStrength, waterDemand, wzFromStrength,
  type CementStrengthKey, type CementTypeName, type ConsistencyClass, type ExposureClass,
  type Recipe, type SieveLine, type StrengthClass, type StrictestLimits,
} from '../../src/index';
import { recipeFor } from './helpers';

interface Scenario {
  strengthClass: StrengthClass;
  exposureClasses: ExposureClass[];
  margin: number;
  sieveLine: SieveLine;
  consistency: ConsistencyClass;
  curve: CementStrengthKey;
  cementType: CementTypeName;
  flyAshFrac?: number;
}

interface StepResult {
  water: number;
  wzWalz: number;
  wz: number;
  z: number;
  actualWz: number;
  limits: StrictestLimits;
}

/** The mix design steps with the library functions only. */
function calcMix(s: Scenario): StepResult {
  const limits = strictestLimits(s.exposureClasses);
  const water = waterDemand(s.sieveLine, s.consistency);
  const target = targetStrength(STRENGTH_CLASSES[s.strengthClass].fckCube, s.margin);
  const wzWalz = wzFromStrength(target, s.curve) ?? Infinity;
  // The exposure limit gets the usual allowance of −0,02 when the Walz curve does not govern.
  const wz = wzWalz <= limits.maxWz ? wzWalz : limits.maxWz - 0.02;
  const credit = 1 + 0.4 * (s.flyAshFrac ?? 0);
  const z = Math.max(water / (wz * credit), limits.minCement); // enforce the normative floor
  return { water, wzWalz, wz, z, actualWz: water / z, limits };
}

function expectStepsComply(r: StepResult, s: Scenario) {
  expect(r.z).toBeGreaterThanOrEqual(r.limits.minCement);
  expect(r.actualWz).toBeLessThanOrEqual(r.limits.maxWz + 0.001);
  expect(STRENGTH_CLASSES[s.strengthClass].fckCube).toBeGreaterThanOrEqual(r.limits.minFckCube);
}

function recipeOf(s: Scenario): Recipe {
  return recipeFor({
    strengthClass: s.strengthClass, exposureClasses: s.exposureClasses, margin: s.margin,
    sieveLine: s.sieveLine, consistency: s.consistency, cementType: s.cementType,
    flyAshPct: (s.flyAshFrac ?? 0) * 100, aggregate: 'quartz-gravel', plasticizer: 'none', airPct: 0,
  });
}

function expectRecipeComplies(r: Recipe, s: Scenario) {
  const m = r.materials;
  expect(m.cement).toBeGreaterThanOrEqual(r.limits.minCement);
  expect(r.equivalentWz ?? m.water / m.cement).toBeLessThanOrEqual(r.limits.maxWz + 0.005);
  expect(STRENGTH_CLASSES[s.strengthClass].fckCube).toBeGreaterThanOrEqual(r.limits.minFckCube);
  expect(r.warnings.map((w) => w.code)).not.toContain('wz-exceeded');
  expect(r.warnings.map((w) => w.code)).not.toContain('strength-below-exposure');
}

// Scenario 1: basement floor slab of a residential building, permanently moist.
// XC2: max w/z 0,75, min z 240 kg/m³, min C16/20.
describe('Scenario 1: basement floor slab (Kellerbodenplatte) C20/25, XC2', () => {
  const s: Scenario = {
    strengthClass: 'C20/25', exposureClasses: ['XC2'], margin: 3, sieveLine: 'B32', consistency: 'F3',
    curve: '42.5', cementType: 'CEM I 42.5 N',
  };

  it('steps give a compliant recipe with a moderate cement content (240–350 kg/m³)', () => {
    const r = calcMix(s);
    expectStepsComply(r, s);
    expect(r.z).toBeGreaterThanOrEqual(240);
    expect(r.z).toBeLessThanOrEqual(350);
  });

  it('computeRecipe complies', () => expectRecipeComplies(recipeOf(s), s));
});

// Scenario 2: underground car park ceiling, de-icing salt carried in by cars.
// XC4 (0,60 / 280) + XD1 (0,55 / 300) → 0,55 / 300.
describe('Scenario 2: underground car park ceiling (Tiefgaragendecke) C30/37, XC4 + XD1', () => {
  const s: Scenario = {
    strengthClass: 'C30/37', exposureClasses: ['XC4', 'XD1'], margin: 3, sieveLine: 'B32', consistency: 'F3',
    curve: '42.5', cementType: 'CEM I 42.5 N',
  };

  it('steps comply; XD1 governs w/z (0,55) and cement (300)', () => {
    const r = calcMix(s);
    expectStepsComply(r, s);
    expect(r.limits.maxWz).toBe(0.55);
    expect(r.z).toBeGreaterThanOrEqual(300);
  });

  it('computeRecipe complies', () => expectRecipeComplies(recipeOf(s), s));
});

// Scenario 3: road bridge abutment, de-icing salt and frost.
// XD2 (0,50 / 320) + XF2 (0,50 / 320 without air) → 0,50 / 320.
describe('Scenario 3: road bridge abutment (Widerlager) C35/45, XD2 + XF2', () => {
  const s: Scenario = {
    strengthClass: 'C35/45', exposureClasses: ['XD2', 'XF2'], margin: 5, sieveLine: 'B16', consistency: 'F3',
    curve: '52.5R', cementType: 'CEM I 52.5 R',
  };

  it('steps comply; w/z ≤ 0,50 and z ≥ 320', () => {
    const r = calcMix(s);
    expectStepsComply(r, s);
    expect(r.limits.maxWz).toBe(0.5);
    expect(r.z).toBeGreaterThanOrEqual(320);
  });

  it('computeRecipe complies', () => expectRecipeComplies(recipeOf(s), s));
});

// Scenario 4: exterior column in architectural concrete, mild frost.
// XC4 + XF1, both 0,60 / 280. CEM III/A 42,5 N with 20 % fly ash (≤ 0,33 · z, B 20 p. 5).
describe('Scenario 4: exterior column C25/30, XC4 + XF1, CEM III/A 42,5 N, 20 % fly ash', () => {
  const s: Scenario = {
    strengthClass: 'C25/30', exposureClasses: ['XC4', 'XF1'], margin: 3, sieveLine: 'B32', consistency: 'F2',
    curve: '42.5', cementType: 'CEM III/A 42.5 N', flyAshFrac: 0.2,
  };

  it('steps comply; fly ash lowers the cement but the 280 kg floor holds', () => {
    const r = calcMix(s);
    expectStepsComply(r, s);
    expect(r.z).toBeGreaterThanOrEqual(280);
    expect(r.actualWz).toBeLessThanOrEqual(0.6 + 0.001);
  });

  it('computeRecipe complies', () => {
    const r = recipeOf(s);
    expectRecipeComplies(r, s);
    expect(r.materials.cement).toBeGreaterThanOrEqual(280);
  });
});

// Scenario 5: industrial hall floor, frost with high water saturation and wear.
// XF3 (0,50 / 320 without air) + XM1 (0,55 / 300) → 0,50 / 320.
describe('Scenario 5: industrial hall floor C35/45, XF3 + XM1', () => {
  const s: Scenario = {
    strengthClass: 'C35/45', exposureClasses: ['XF3', 'XM1'], margin: 5, sieveLine: 'B32', consistency: 'F3',
    curve: '52.5R', cementType: 'CEM I 52.5 R',
  };

  it('steps comply; XF3 sets the tighter w/z (0,50) and z ≥ 320', () => {
    const r = calcMix(s);
    expectStepsComply(r, s);
    expect(r.limits.maxWz).toBe(0.5);
    expect(r.z).toBeGreaterThanOrEqual(320);
  });

  it('computeRecipe complies', () => expectRecipeComplies(recipeOf(s), s));
});

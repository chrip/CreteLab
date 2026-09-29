// Aggregate split into grain groups and the water carried by their surface moisture
// (Zement-Merkblatt B 20, Tafel 9 step 7).
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOISTURE, GRADINGS, SIEVE_LINES, SIEVE_LINE_NAMES, addedWater, distributeAggregate,
} from '../../src/index';
import { recipeFor } from './helpers';

describe('Grain groups per sieve line (B 20 Tafel 9 step 7)', () => {
  it('A/B16 splits into 0/2, 2/8 and 8/16 with 38/22/40 % (B 20 Beispiel IV, p. 19)', () => {
    const groups = distributeAggregate(1800, 'A/B16');
    expect(groups.map((g) => g.range)).toEqual(['0/2', '2/8', '8/16']);
    expect(groups.map((g) => g.pct)).toEqual([38, 22, 40]);
  });

  it('8 mm lines have two groups, 16 and 32 mm lines three', () => {
    expect(distributeAggregate(1800, 'B8').map((g) => g.range)).toEqual(['0/2', '2/8']);
    expect(distributeAggregate(1850, 'B32').map((g) => g.range)).toEqual(['0/2', '2/8', '8/32']);
  });

  for (const line of SIEVE_LINE_NAMES) {
    it(`${line}: shares add up to 100 % and the masses to the total (± rounding)`, () => {
      expect(GRADINGS[line].groups.reduce((s, g) => s + g.pct, 0)).toBeCloseTo(100, 10);
      const groups = distributeAggregate(1850, line);
      expect(Math.abs(groups.reduce((s, g) => s + g.massDry, 0) - 1850)).toBeLessThanOrEqual(1);
    });
  }

  it('each group carries its own moisture: massMoist = massDry · (1 + moisture)', () => {
    const groups = distributeAggregate(1800, 'A/B16', [4, 4, 4]);
    for (const g of groups) {
      expect(g.moisturePct).toBe(4);
      expect(g.massMoist).toBe(Math.round(g.massDry * 1.04));
    }
  });

  it('without moisture the weighed mass equals the dry mass', () => {
    for (const g of distributeAggregate(1800, 'B16')) expect(g.massMoist).toBe(g.massDry);
  });

  it('the typical surface moisture of sand, fine and coarse gravel is 5/3/2 %', () => {
    expect(DEFAULT_MOISTURE).toEqual([5, 3, 2]);
  });
});

describe('Water still to add once the aggregate moisture is counted (Zugabewasser)', () => {
  it('180 l target, 1 800 kg aggregate at 4 %: 180 − 72 = 108 l', () => {
    expect(addedWater(180, distributeAggregate(1800, 'A/B16', [4, 4, 4]))).toBe(108);
  });

  it('200 l target, 1 900 kg aggregate at 6 %: 200 − 114 = 86 l', () => {
    expect(addedWater(200, distributeAggregate(1900, 'A/B16', [6, 6, 6]))).toBe(86);
  });

  it('dry aggregate adds no water', () => {
    expect(addedWater(180, distributeAggregate(1800, 'B32'))).toBe(180);
  });

  it('different moisture per group gives a different added water', () => {
    const wet = addedWater(180, distributeAggregate(1750, 'B16', [4.5, 4.5, 4.5]));
    const dryer = addedWater(180, distributeAggregate(1750, 'B16', [3, 3, 3]));
    expect(wet).toBeLessThan(dryer);
  });
});

describe('Maximum grain per sieve line', () => {
  it('B32 → 32, B16 → 16, A8 → 8 mm', () => {
    expect(SIEVE_LINES.B32.maxGrain).toBe(32);
    expect(SIEVE_LINES.B16.maxGrain).toBe(16);
    expect(SIEVE_LINES.A8.maxGrain).toBe(8);
  });
});

describe('Grain groups inside a computed recipe', () => {
  it('the recipe splits its own aggregate mass and counts the moisture in the added water', () => {
    const recipe = recipeFor({ aggregate: 'granite', sieveLine: 'B16', moisture: [5, 3, 2] });
    const { aggregate, water, addedWater: added } = recipe.materials;
    expect(Math.abs(recipe.grainGroups.reduce((s, g) => s + g.massDry, 0) - aggregate)).toBeLessThanOrEqual(1);
    expect(recipe.grainGroups.map((g) => g.moisturePct)).toEqual([5, 3, 2]);
    expect(added).toBe(addedWater(water, recipe.grainGroups));
    expect(added).toBeLessThan(water);
  });

  it('moisture null means dry aggregate: all the water is added', () => {
    const recipe = recipeFor({ moisture: null });
    expect(recipe.materials.addedWater).toBe(Math.round(recipe.materials.water));
  });
});

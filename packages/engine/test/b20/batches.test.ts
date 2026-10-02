import { describe, expect, it } from 'vitest';
import { BAGS_PER_BATCH, CEMENT_BAG_KG, BUCKET_KG, MIXERS, SHOVEL_KG, batchPlan, shovelRatio, type Mixer } from '../../src/b20/batches';
import { recipeFor } from './helpers';

describe('batches on site', () => {
  const recipe = recipeFor({});
  const c = recipe.materials.cement;

  it('a batch takes one bag of cement when the drum holds what it makes', () => {
    const plan = batchPlan(recipe, 3, 'drum140');
    expect(CEMENT_BAG_KG / c).toBeLessThan(MIXERS.drum140 / 1000);
    expect(plan.batch.bags).toBe(1);
    expect(plan.batch.cementKg).toBeCloseTo(CEMENT_BAG_KG, 6);
    expect(plan.litresPerBatch).toBe(Math.round((CEMENT_BAG_KG / c) * 1000));
    expect(plan.totalBags).toBe(plan.batches);
  });

  it('the batches make at least the volume, at most one batch more', () => {
    for (const mixer of Object.keys(MIXERS) as Mixer[]) {
      for (const volume of [0.3, 1, 3, 7.5]) {
        const p = batchPlan(recipe, volume, mixer);
        const perBatch = ((p.batch.bags ?? 0) * CEMENT_BAG_KG) / c;
        const made = p.batches * perBatch;
        expect(made).toBeGreaterThan(volume * 0.99);
        expect(made - volume).toBeLessThan(perBatch + 1e-9);
      }
    }
  });

  it('a batch takes as many half bags as the mixer holds, so a bigger drum needs fewer batches', () => {
    for (const mixer of Object.keys(MIXERS) as Mixer[]) {
      const { batch } = batchPlan(recipe, 3, mixer);
      const most = BAGS_PER_BATCH.find((b) => (b * CEMENT_BAG_KG) / c <= MIXERS[mixer] / 1000);
      expect(batch.bags).toBe(most);
    }
  });

  it('Ringanker C25/30, 3 m³: 41 batches of 1 bag in a 140 l drum, 27 of 1½ bags in a 180 l drum', () => {
    const ring = recipeFor({ strengthClass: 'C25/30', exposureClasses: ['XC4', 'XF1'], sieveLine: 'B16' });
    const small = batchPlan(ring, 3, 'drum140');
    const big = batchPlan(ring, 3, 'drum180');
    expect(ring.materials.cement).toBeGreaterThan(CEMENT_BAG_KG * 1.5 / 0.12); // 1½ bags fit 120 l
    expect(small.batch.bags).toBe(1);
    expect(big.batch.bags).toBe(1.5);
    expect(big.batches).toBeLessThan(small.batches);
    expect(big.totalBags).toBe(small.totalBags);
  });

  it('by hand in a mortar tub a batch takes half a bag', () => {
    const plan = batchPlan(recipe, 3, 'tub');
    expect(plan.batch.bags).toBe(0.5);
    expect(plan.litresPerBatch).toBeLessThanOrEqual(MIXERS.tub);
    expect(plan.totalBags).toBe(Math.ceil(plan.batches / 2));
  });

  it('counts the moist aggregate in buckets (to the half) and shovels', () => {
    const { batch } = batchPlan(recipe, 3, 'drum140');
    const moist = recipe.grainGroups.reduce((s, g) => s + g.massMoist, 0) * (CEMENT_BAG_KG / c);
    expect(batch.aggregateKg).toBeCloseTo(moist, 6);
    expect(batch.buckets * 2).toBe(Math.round((moist / BUCKET_KG) * 2));
    expect(batch.shovels).toBe(Math.round(moist / SHOVEL_KG));
  });

  it('water per batch is what is added after the aggregate moisture', () => {
    const wet = recipeFor({ moisture: [4, 3, 2] });
    const { batch } = batchPlan(wet, 2, 'drum140');
    expect(batch.waterL).toBeCloseTo((wet.materials.addedWater * CEMENT_BAG_KG) / wet.materials.cement, 6);
    expect(batch.waterL).toBeLessThan((wet.materials.water * CEMENT_BAG_KG) / wet.materials.cement);
  });

  it('between half a bag and a bag, the job is mixed in half bags', () => {
    const plan = batchPlan(recipe, 18 / c, 'drum140'); // 18 kg cement
    expect(plan.batch.bags).toBe(0.5);
    expect(plan.batches).toBe(2);
    expect(plan.totalBags).toBe(1);
  });

  it('a small job is one batch with exactly its amounts, no bag count', () => {
    const plan = batchPlan(recipe, 0.02, 'drum140');
    expect(plan.batches).toBe(1);
    expect(plan.batch.bags).toBeNull();
    expect(plan.batch.cementKg).toBeCloseTo(c * 0.02, 6);
    expect(plan.litresPerBatch).toBe(20);
  });

  it('shovels of cement to shovels of gravel, by loose volume in small whole numbers', () => {
    // 300 kg cement = 250 l loose, 2000 kg moist gravel = 1250 l: 1 : 5.
    expect(shovelRatio(300, 2000)).toEqual({ cement: 1, aggregate: 5 });
    // 1 : 4.5 is said as 2 : 9.
    expect(shovelRatio(320, 1920)).toEqual({ cement: 2, aggregate: 9 });
    const ring = recipeFor({ strengthClass: 'C25/30', exposureClasses: ['XC4', 'XF1'], sieveLine: 'B16' });
    const weak = recipeFor({ strengthClass: 'C16/20', exposureClasses: ['X0'] });
    const r = batchPlan(ring, 3, 'drum140').ratio;
    const w = batchPlan(weak, 3, 'drum140').ratio;
    // More cement, less gravel per shovel of cement.
    expect(r).toEqual({ cement: 1, aggregate: 4 });
    expect(w).toEqual({ cement: 1, aggregate: 6 });
  });
});


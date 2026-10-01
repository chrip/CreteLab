import { describe, expect, it } from 'vitest';
import { CEMENT_BAG_KG, BUCKET_KG, MIXERS, SHOVEL_KG, batchPlan, type Mixer } from '../../src/b20/batches';
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
});

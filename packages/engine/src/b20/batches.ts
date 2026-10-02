// Mixing on site: nobody weighs gravel next to a drum mixer. A batch is sized to whole or
// half bags of cement, the aggregate is counted in buckets and shovels, the water in litres.
import type { Recipe } from './recipe';

/** Cement bag in Germany (a bag of ready-mix is 40 kg, see bagged/tuning.ts). */
export const CEMENT_BAG_KG = 25;
/** Builder's bucket (Maurereimer), level full. */
export const BUCKET_L = 10;
/** A level 10 l bucket of moist sand and gravel 0/16 (loose, about 1,6 kg/l). */
export const BUCKET_KG = 16;
/** A shovel of sand and gravel, roughly. */
export const SHOVEL_KG = 5;
/** Loose cement shovelled from the bag, kg/l (packed in the bag it is closer to 1,5). */
export const CEMENT_LOOSE_KG_L = 1.2;

/** Fresh concrete one batch can hold (litres): a drum fills to about two thirds. */
export const MIXERS = { drum140: 90, drum180: 120, tub: 50 } as const;
export type Mixer = keyof typeof MIXERS;

/** Bags of cement per batch: as many half bags as the mixer holds, up to two. */
export const BAGS_PER_BATCH = [2, 1.5, 1, 0.5] as const;
export type BagsPerBatch = (typeof BAGS_PER_BATCH)[number];

export interface Batch {
  /** Cement per batch in bags (½ to 2), or null for a single batch below half a bag. */
  bags: BagsPerBatch | null;
  cementKg: number;
  /** Moist aggregate as it comes from the heap. */
  aggregateKg: number;
  buckets: number;
  shovels: number;
  waterL: number;
  flyAshKg: number;
  silicaFumeKg: number;
  waterproofingKg: number;
  plasticizerL: number;
  airEntrainerL: number;
}

/**
 * Shovels of cement to shovels of sand and gravel, in small whole numbers: on site the two
 * go into the drum in turns. A shovel holds about the same volume of either, so the ratio
 * is by loose volume, not by mass.
 */
export interface ShovelRatio {
  cement: 1 | 2;
  aggregate: number;
}

export function shovelRatio(cementKg: number, aggregateKg: number): ShovelRatio {
  const ratio = aggregateKg / (BUCKET_KG / BUCKET_L) / (cementKg / CEMENT_LOOSE_KG_L);
  const halves = Math.max(1, Math.round(ratio * 2));
  return halves % 2 === 0 ? { cement: 1, aggregate: halves / 2 } : { cement: 2, aggregate: halves };
}

export interface BatchPlan {
  mixer: Mixer;
  batches: number;
  /** Bags of cement to buy. */
  totalBags: number;
  /** Fresh concrete per batch, litres. */
  litresPerBatch: number;
  batch: Batch;
  ratio: ShovelRatio;
}

const half = (v: number) => Math.max(0.5, Math.round(v * 2) / 2);

/**
 * Split `volume` (m³) of `recipe` into batches for `mixer`. A batch takes as many half bags
 * of cement as the mixer holds (½ to 2), but not more than the job needs. Whole bags are
 * bought, so the batches can make a little more than `volume`.
 */
export function batchPlan(recipe: Recipe, volume: number, mixer: Mixer): BatchPlan {
  const m = recipe.materials;
  const capacity = MIXERS[mixer] / 1000;
  const cementTotal = m.cement * volume;
  // The most cement the mixer takes, but no more than the job needs.
  const fits = BAGS_PER_BATCH.filter((b) => (b * CEMENT_BAG_KG) / m.cement <= capacity);
  let bags: BagsPerBatch | null = fits.find((b) => b * CEMENT_BAG_KG <= cementTotal) ?? fits.at(-1) ?? 0.5;
  let batches = 1;
  let batchVolume = volume;
  if (cementTotal < CEMENT_BAG_KG / 2) {
    // Less than half a bag: one batch with exactly what it needs.
    bags = null;
  } else {
    batchVolume = (bags * CEMENT_BAG_KG) / m.cement;
    // 5 % of a batch short is within what a shovel varies; it saves a whole batch.
    batches = Math.max(1, Math.ceil(cementTotal / (bags * CEMENT_BAG_KG) - 0.05));
  }
  const per = (perM3: number) => perM3 * batchVolume;
  const moist = recipe.grainGroups.reduce((s, g) => s + g.massMoist, 0);
  const water = m.addedWater < m.water ? m.addedWater : m.water;
  const aggregateKg = per(moist);
  return {
    mixer,
    batches,
    totalBags: bags === null ? 1 : Math.ceil(batches * bags),
    litresPerBatch: Math.round(batchVolume * 1000),
    ratio: shovelRatio(m.cement, moist),
    batch: {
      bags,
      cementKg: per(m.cement),
      aggregateKg,
      buckets: half(aggregateKg / BUCKET_KG),
      shovels: Math.max(1, Math.round(aggregateKg / SHOVEL_KG)),
      waterL: per(water),
      flyAshKg: per(m.flyAsh),
      silicaFumeKg: per(m.silicaFume),
      waterproofingKg: per(m.waterproofing),
      plasticizerL: per(m.plasticizerL),
      airEntrainerL: per(m.airEntrainerL),
    },
  };
}

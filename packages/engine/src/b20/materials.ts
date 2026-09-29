// Densities of aggregates and binders (Zement-Merkblatt B 20, Tafel 4–6) and the effect of
// admixtures and additions (B 20 sections 6–7).

export interface Aggregate {
  /** Particle density, kg/dm³ (mid-range of B 20 Tafel 5, lower bound for recycled). */
  density: number;
  /** Crushed rock needs about 10 % more water. */
  crushed: boolean;
  group: 'normal' | 'light' | 'heavy' | 'recycled';
}

export const AGGREGATES = {
  'quartz-gravel': { density: 2.65, crushed: false, group: 'normal' },
  granite: { density: 2.7, crushed: false, group: 'normal' },
  limestone: { density: 2.75, crushed: true, group: 'normal' },
  basalt: { density: 3.0, crushed: true, group: 'normal' },
  'recycled-concrete': { density: 2.0, crushed: true, group: 'recycled' },
  'recycled-masonry': { density: 2.0, crushed: true, group: 'recycled' },
  'expanded-clay': { density: 1.15, crushed: false, group: 'light' },
  pumice: { density: 0.55, crushed: false, group: 'light' },
  'slag-pumice': { density: 1.0, crushed: false, group: 'light' },
  barite: { density: 4.15, crushed: false, group: 'heavy' },
  magnetite: { density: 4.7, crushed: false, group: 'heavy' },
  hematite: { density: 4.8, crushed: false, group: 'heavy' },
} as const satisfies Record<string, Aggregate>;

export type AggregateType = keyof typeof AGGREGATES;
export const AGGREGATE_TYPES = Object.keys(AGGREGATES) as AggregateType[];

export function isAggregateType(value: unknown): value is AggregateType {
  return typeof value === 'string' && value in AGGREGATES;
}

export const FLY_ASH_DENSITY = 2.3; // B 20 Tafel 6: 2,2–2,4
export const SILICA_FUME_DENSITY = 2.2; // B 20 Tafel 6
export const WATERPROOFING_DENSITY = 2.0; // powder admixture, typical

/** Credit of additions in the equivalent w/c ratio (B 20 section 7.2). */
export const K_FLY_ASH = 0.4;
export const K_SILICA_FUME = 1.0;
/** Silica fume may be credited up to 0,11 · z for every cement (B 20 section 7.2). */
export const SILICA_FUME_MAX_FACTOR = 0.11;

export type Plasticizer = 'none' | 'BV' | 'FM';
export const PLASTICIZERS: readonly Plasticizer[] = ['none', 'BV', 'FM'];

export function isPlasticizer(value: unknown): value is Plasticizer {
  return typeof value === 'string' && (PLASTICIZERS as readonly string[]).includes(value);
}

/**
 * Water saving (B 20: BV 5–10 %, FM 15–25 %; the typical value is used) and a typical
 * dosage in litres per m³ concrete.
 */
export const PLASTICIZER_EFFECT = {
  BV: { waterSavingPct: 7, dosageL: 0.5 },
  FM: { waterSavingPct: 20, dosageL: 0.2 },
} as const;

/** Water after the plasticiser's saving, rounded to whole litres as in the B 20 examples. */
export function waterWithPlasticizer(water: number, plasticizer: Plasticizer): number {
  if (plasticizer === 'none') return water;
  return Math.round(water * (1 - PLASTICIZER_EFFECT[plasticizer].waterSavingPct / 100));
}

/**
 * Air entrainment (LP): each added Vol.-% of air saves about 5 l water and costs about
 * 3,5 N/mm² strength (B 20 Tafel 7, Beispiel III). The dosage is 0,05 l/m³ per % air.
 */
export const AIR_WATER_SAVING_PER_PCT = 5;
export const AIR_STRENGTH_LOSS_PER_PCT = 3.5;
export const AIR_DOSAGE_L_PER_PCT = 0.05;

/** Fully compacted concrete holds about 2 Vol.-% air without an admixture (B 20 p. 5). */
export const NATURAL_AIR_PCT = 2;

export function waterWithAddedAir(water: number, addedAirPct: number): number {
  return Math.round((water - addedAirPct * AIR_WATER_SAVING_PER_PCT) * 10) / 10;
}

/** Equivalent w/c ratio (w/z)_eq = w / (z + k_f·f + k_s·s). */
export function equivalentWz(water: number, cement: number, flyAsh: number, silicaFume: number): number {
  return Math.round((water / (cement + K_FLY_ASH * flyAsh + K_SILICA_FUME * silicaFume)) * 100) / 100;
}

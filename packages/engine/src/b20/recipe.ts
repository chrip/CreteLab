// Mix design per m³ after Zement-Merkblatt B 20, Tafel 9 (steps 1–8).
import {
  CEMENT_TYPES, STRENGTH_CLASSES, targetStrength, wzFromStrength,
  type CementTypeName, type StrengthClass,
} from './strength';
import { FROST_OR_WEAR, minAirContent, strictestLimits, type ExposureClass, type StrictestLimits } from './exposure';
import {
  CRUSHED_WATER_FACTOR, FLOWABLE, GRADINGS, SIEVE_LINES, addedWater, distributeAggregate, waterDemand,
  type ConsistencyClass, type GrainGroup, type SieveLine,
} from './grading';
import {
  AGGREGATES, AIR_DOSAGE_L_PER_PCT, AIR_STRENGTH_LOSS_PER_PCT, FLY_ASH_DENSITY, K_FLY_ASH, K_SILICA_FUME,
  NATURAL_AIR_PCT, PLASTICIZER_EFFECT, SILICA_FUME_DENSITY, SILICA_FUME_MAX_FACTOR, WATERPROOFING_DENSITY,
  equivalentWz, waterWithAddedAir, waterWithPlasticizer,
  type AggregateType, type Plasticizer,
} from './materials';

export interface MixInput {
  strengthClass: StrengthClass;
  exposureClasses: ExposureClass[];
  sieveLine: SieveLine;
  consistency: ConsistencyClass;
  aggregate: AggregateType;
  cementType: CementTypeName;
  /** Vorhaltemaß v in N/mm², 3–12; 9 when the standard deviation is unknown (B 20 6.2). */
  margin: number;
  plasticizer: Plasticizer;
  /** Target total air content in Vol.-% with an air-entraining agent; 0 = none. */
  airPct: number;
  /** Fly ash in % of the cement; 0 = none. */
  flyAshPct: number;
  /** Silica fume in % of the cement; 0 = none. */
  silicaFumePct: number;
  /** Waterproofing admixture in % of the cement; 0 = none. */
  waterproofingPct: number;
  /** Surface moisture of the grain groups in %, or null to ignore it. */
  moisture: [number, number, number] | null;
}

export const DEFAULT_MIX: MixInput = {
  strengthClass: 'C25/30',
  exposureClasses: ['XC2'],
  sieveLine: 'B32',
  consistency: 'F3',
  aggregate: 'quartz-gravel',
  cementType: 'CEM I 42.5 N',
  margin: 9,
  plasticizer: 'none',
  airPct: 0,
  flyAshPct: 0,
  silicaFumePct: 0,
  waterproofingPct: 0,
  moisture: null,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Keep every number inside the range B 20 allows (the form may send anything). */
export function normalizeMix(input: MixInput): MixInput {
  const flyAshMaxPct = Math.round(CEMENT_TYPES[input.cementType].flyAshMaxFactor * 100);
  return {
    ...input,
    exposureClasses: [...new Set(input.exposureClasses)],
    margin: clamp(input.margin || 9, 3, 12),
    airPct: clamp(input.airPct || 0, 0, 12),
    flyAshPct: clamp(input.flyAshPct || 0, 0, flyAshMaxPct),
    silicaFumePct: clamp(input.silicaFumePct || 0, 0, SILICA_FUME_MAX_FACTOR * 100),
    waterproofingPct: clamp(input.waterproofingPct || 0, 0, 5),
  };
}

export type Warning =
  | { code: 'strength-below-exposure'; params: { strengthClass: StrengthClass; minFckCube: number } }
  | { code: 'wz-exceeded'; params: { wz: number; maxWz: number } }
  | { code: 'fines-too-high'; params: { fines: number; max: number } }
  | { code: 'fly-ash-with-silica-fume' }
  | { code: 'high-air'; params: { airPct: number } };

export interface Recipe {
  /** f_cm target, N/mm² (step 3) */
  targetStrength: number;
  /** w/c ratio used (step 4) */
  wz: number;
  /** w/c limit of the exposure classes (step 1) */
  wzExposure: number;
  /** w/c from the Walz curve for the target strength */
  wzWalz: number | null;
  /** What sets the w/c: the exposure limit (minus 0,02) or the strength */
  wzSource: 'exposure' | 'strength';
  limits: StrictestLimits;
  margin: number;
  /** Total air in Vol.-% (natural 2 % or the air-entraining target) */
  airPct: number;
  /** Air added by the air-entraining agent above the natural 2 % */
  addedAirPct: number;
  /** Strength the added air costs, already added to the target, N/mm² */
  airStrengthLoss: number;
  /** The air reaches the minimum content, so XF2/XF3 may use their air-entrained limits */
  airEntrained: boolean;
  cementDensity: number;
  /** kg/m³ (water l/m³, admixtures l/m³) */
  materials: {
    cement: number;
    flyAsh: number;
    silicaFume: number;
    waterproofing: number;
    water: number;
    /** Water to add once the aggregate moisture is counted */
    addedWater: number;
    aggregate: number;
    plasticizerL: number;
    airEntrainerL: number;
  };
  grainGroups: GrainGroup[];
  equivalentWz: number | null;
  /** Absolute volumes in dm³ per m³ (step 6) */
  volumes: { cement: number; water: number; flyAsh: number; silicaFume: number; waterproofing: number; air: number; aggregate: number };
  /** Cement + additions + aggregate < 0,125 mm, kg/m³ (step 8) */
  finesContent: number;
  warnings: Warning[];
}

export type RecipeError = { code: 'fm-required'; params: { consistency: ConsistencyClass } };

export type RecipeResult = { ok: true; recipe: Recipe } | { ok: false; error: RecipeError };

/** Mix design per m³. All exposure classes apply at once; the strictest limit wins. */
export function computeRecipe(raw: MixInput): RecipeResult {
  const input = normalizeMix(raw);
  const { maxGrain } = SIEVE_LINES[input.sieveLine];

  // Step 1: limits. XF2/XF3 get their air-entrained limits only when the air reaches the minimum.
  const airPct = input.airPct > 0 ? Math.max(NATURAL_AIR_PCT, input.airPct) : NATURAL_AIR_PCT;
  const addedAirPct = airPct - NATURAL_AIR_PCT;
  const airEntrained = input.airPct > 0 && airPct >= minAirContent(maxGrain, input.consistency);
  const limits = strictestLimits(input.exposureClasses, { airEntrained });
  const wzExposure = limits.maxWz < Infinity ? limits.maxWz : 0.75;

  // Step 2: water. F4–F6 are only reached with a superplasticiser.
  if (FLOWABLE.includes(input.consistency) && input.plasticizer !== 'FM') {
    return { ok: false, error: { code: 'fm-required', params: { consistency: input.consistency } } };
  }
  let water = waterDemand(input.sieveLine, input.consistency);
  if (AGGREGATES[input.aggregate].crushed) water *= CRUSHED_WATER_FACTOR;
  water = waterWithPlasticizer(water, input.plasticizer);
  // After the plasticiser, as in B 20 Beispiel III: "w = 184 − 3 · 5 = 169 l".
  if (addedAirPct > 0) water = waterWithAddedAir(water, addedAirPct);
  water = clamp(water, 120, 260);

  // Step 3: target strength. Added air costs 3,5 N/mm² per % (Beispiel III: "… + 3 · 3,5").
  const airStrengthLoss = addedAirPct * AIR_STRENGTH_LOSS_PER_PCT;
  const fckCube = STRENGTH_CLASSES[input.strengthClass].fckCube;
  const target = Math.round((targetStrength(fckCube, input.margin) + airStrengthLoss) * 10) / 10;

  // Step 4: w/c. The exposure limit gets the usual allowance of −0,02.
  const cement = CEMENT_TYPES[input.cementType];
  const wzWalz = wzFromStrength(target, cement.curve);
  let wz = wzExposure;
  let wzSource: Recipe['wzSource'] = 'exposure';
  if (wzWalz !== null && wzWalz < wzExposure) {
    wz = wzWalz;
    wzSource = 'strength';
  } else if (wzWalz !== null) {
    wz = wzExposure - 0.02;
  }
  wz = clamp(wz, 0.35, 0.95);

  // Step 5: cement. Additions count through the equivalent w/c (B 20 7.2):
  // z = w / (w/z · (1 + k_f·f/z + k_s·s/z)), never below the exposure minimum.
  const flyAshShare = input.flyAshPct / 100;
  const silicaShare = input.silicaFumePct / 100;
  const credit = 1 + K_FLY_ASH * flyAshShare + K_SILICA_FUME * silicaShare;
  const cementKg = Math.round(Math.max(water / (wz * credit), limits.minCement));
  const flyAsh = cementKg * flyAshShare;
  const silicaFume = cementKg * silicaShare;
  const waterproofing = (cementKg * input.waterproofingPct) / 100;

  // Step 6: absolute volumes: 1000 dm³ = z/ρz + w + f/ρf + s/ρs + WU/ρ + air + g/ρg.
  const volumes = {
    cement: cementKg / cement.density,
    water,
    flyAsh: flyAsh / FLY_ASH_DENSITY,
    silicaFume: silicaFume / SILICA_FUME_DENSITY,
    waterproofing: waterproofing / WATERPROOFING_DENSITY,
    air: airPct * 10,
  };
  const aggregateVolume = 1000 - Object.values(volumes).reduce((a, b) => a + b, 0);
  const aggregate = Math.round(aggregateVolume * AGGREGATES[input.aggregate].density);

  // Step 7: grain groups and the water still to add.
  const grainGroups = distributeAggregate(aggregate, input.sieveLine, input.moisture ?? [0, 0, 0]);

  // Step 8: fines content.
  const finesContent = Math.round(cementKg + flyAsh + silicaFume + aggregate * GRADINGS[input.sieveLine].fines0125);

  const recipe: Recipe = {
    targetStrength: target,
    wz,
    wzExposure,
    wzWalz: wzWalz === null ? null : Math.round(wzWalz * 100) / 100,
    wzSource,
    limits,
    margin: input.margin,
    airPct,
    addedAirPct,
    airStrengthLoss,
    airEntrained,
    cementDensity: cement.density,
    materials: {
      cement: cementKg,
      flyAsh,
      silicaFume,
      waterproofing,
      water,
      addedWater: addedWater(water, grainGroups),
      aggregate,
      plasticizerL: input.plasticizer === 'none' ? 0 : PLASTICIZER_EFFECT[input.plasticizer].dosageL,
      airEntrainerL: input.airPct > 0 ? input.airPct * AIR_DOSAGE_L_PER_PCT : 0,
    },
    grainGroups,
    equivalentWz: flyAsh > 0 || silicaFume > 0 ? equivalentWz(water, cementKg, flyAsh, silicaFume) : null,
    volumes: {
      ...Object.fromEntries(Object.entries(volumes).map(([k, v]) => [k, Math.round(v)])),
      aggregate: Math.round(aggregateVolume),
    } as Recipe['volumes'],
    finesContent,
    warnings: [],
  };
  recipe.warnings = checkRecipe(input, recipe);
  return { ok: true, recipe };
}

/**
 * Maximum fines content in kg/m³ up to C50/60 (DIN 1045-2, Tab. F.4; B 20 Tafel 23):
 * 400–450 for frost and wear classes, 450–550 otherwise, rising linearly between 300
 * and 350 kg cement. Above 350 kg the limit rises by the extra cement, by 50 kg at most.
 */
export function maxFinesContent(cement: number, frostOrWear: boolean): number {
  const [low, high] = frostOrWear ? [400, 450] : [450, 550];
  const share = clamp((cement - 300) / 50, 0, 1);
  return Math.round(low + share * (high - low) + clamp(cement - 350, 0, 50));
}

/** Checks a finished recipe against rules the design steps do not enforce themselves. */
export function checkRecipe(input: MixInput, recipe: Recipe): Warning[] {
  const warnings: Warning[] = [];
  const { limits, materials: m } = recipe;
  if (STRENGTH_CLASSES[input.strengthClass].fckCube < limits.minFckCube) {
    warnings.push({ code: 'strength-below-exposure', params: { strengthClass: input.strengthClass, minFckCube: limits.minFckCube } });
  }
  const wz = m.water / m.cement;
  if (limits.maxWz < Infinity && recipe.equivalentWz === null && wz > limits.maxWz + 0.005) {
    warnings.push({ code: 'wz-exceeded', params: { wz: Math.round(wz * 100) / 100, maxWz: limits.maxWz } });
  }
  const max = maxFinesContent(m.cement, input.exposureClasses.some((c) => FROST_OR_WEAR.includes(c)));
  if (recipe.finesContent > max) {
    warnings.push({ code: 'fines-too-high', params: { fines: recipe.finesContent, max } });
  }
  // CEM I with fly ash and silica fume: f/z ≤ 3 · (0,22 − s/z) (DIN 1045-2, 5.2.5.2.3).
  const cemI = input.cementType.startsWith('CEM I ');
  if (cemI && m.flyAsh > 0 && m.silicaFume > 0 && m.flyAsh / m.cement > 3 * (0.22 - m.silicaFume / m.cement)) {
    warnings.push({ code: 'fly-ash-with-silica-fume' });
  }
  if (input.airPct > 10) warnings.push({ code: 'high-air', params: { airPct: input.airPct } });
  return warnings;
}

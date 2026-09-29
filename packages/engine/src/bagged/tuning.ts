// What additions do to a bag of dry ready-mixed concrete (the bag tool).
//
// Manufacturers forbid adding anything but water (docs/research/bagged-concrete.md, R4):
// the declared strength and exposure classes no longer apply. The tool is for estimates on
// non-structural DIY pieces; the planner never suggests additions.
import { STRENGTH_CLASSES, classForCubeStrength, strengthFromWz, type StrengthClass } from '../b20/strength';
import {
  AIR_STRENGTH_LOSS_PER_PCT, K_FLY_ASH, K_SILICA_FUME, PLASTICIZER_EFFECT, waterWithPlasticizer,
  type Plasticizer,
} from '../b20/materials';

export interface BagMix {
  id: 'c20' | 'c25' | 'c30';
  strengthClass: StrengthClass;
  /** kg (water l) per m³ of fresh concrete. The dry bag holds cement + aggregate. */
  cement: number;
  water: number;
  aggregate: number;
}

/**
 * Assumed compositions for the strength classes bags are sold in (datasheets do not state
 * the cement content). Each reaches its class with f_ck ≈ f_cm − 8 on the CEM I 42,5 Walz
 * curve (test/bagged/tuning.test.ts checks this).
 */
export const BAG_MIXES: readonly BagMix[] = [
  { id: 'c20', strengthClass: 'C20/25', cement: 280, water: 195, aggregate: 1820 },
  { id: 'c25', strengthClass: 'C25/30', cement: 300, water: 190, aggregate: 1800 },
  { id: 'c30', strengthClass: 'C30/37', cement: 340, water: 185, aggregate: 1740 },
];

export type BagMixId = BagMix['id'];
export const BAG_KG = 40;

export function bagMix(id: string | undefined): BagMix | undefined {
  return BAG_MIXES.find((m) => m.id === id);
}

/** Lowest bag mix that reaches the strength class (the strongest one if none does). */
export function bagMixFor(strengthClass: StrengthClass): BagMix {
  const need = STRENGTH_CLASSES[strengthClass].fckCube;
  return BAG_MIXES.find((m) => STRENGTH_CLASSES[m.strengthClass].fckCube >= need) ?? BAG_MIXES.at(-1)!;
}

/** Additions, as the share of the bag's cement they amount to. */
export const ADDITION_SHARE = {
  extraCement: 0.1,
  flyAsh: 0.15,
  silicaFume: 0.08,
  waterproofing: 0.02,
} as const;
/** Air-entraining agent in l/m³ (typical dosage for about 4 % air). */
export const AIR_ENTRAINER_L = 0.2;
/** Strength an air-entrained mix loses at about 4 % air. */
const AIR_PCT = 4;

export interface BagOptions {
  extraCement: boolean;
  flyAsh: boolean;
  silicaFume: boolean;
  plasticizer: Plasticizer;
  air: boolean;
  waterproofing: boolean;
}

export const NO_OPTIONS: BagOptions = {
  extraCement: false, flyAsh: false, silicaFume: false, plasticizer: 'none', air: false, waterproofing: false,
};

export type BagStep =
  | { kind: 'mix'; kg: number; bags: number; strengthClass: StrengthClass }
  | { kind: 'extraCement' | 'flyAsh' | 'silicaFume' | 'waterproofing'; kg: number }
  | { kind: 'plasticizer'; type: 'BV' | 'FM'; litres: number }
  | { kind: 'air'; litres: number }
  | { kind: 'water'; litres: number; withAdmixtures: boolean };

export interface TunedBag {
  mix: BagMix;
  volume: number;
  /** In mixing order: bag mix, dry additions, admixtures into the water, water last. */
  steps: BagStep[];
  /** Estimated characteristic cube strength of the bag mix without additions, N/mm². */
  baseFckCube: number;
  /** Estimated characteristic cube strength after the additions, N/mm² (same estimate, so comparable). */
  fckCube: number;
  strengthClass: StrengthClass;
  /** Air entrainment and silica fume work against each other (stiff mix, poor air voids). */
  airWithSilicaFume: boolean;
}

/** Estimated f_ck,cube of a bag mix with additions: f_ck ≈ f_cm − 8 (DIN EN 1992-1-1, Tab. 3.1). */
export function estimateFck(mix: BagMix, o: BagOptions): number {
  let binder = mix.cement;
  if (o.extraCement) binder += mix.cement * ADDITION_SHARE.extraCement;
  if (o.flyAsh) binder += mix.cement * ADDITION_SHARE.flyAsh * K_FLY_ASH;
  if (o.silicaFume) binder += mix.cement * ADDITION_SHARE.silicaFume * K_SILICA_FUME;
  const water = waterWithPlasticizer(mix.water, o.plasticizer);
  let fcm = strengthFromWz(water / binder, '42.5') ?? 0;
  if (o.air) fcm = Math.max(0, fcm - AIR_PCT * AIR_STRENGTH_LOSS_PER_PCT);
  return Math.max(8, Math.round(fcm - 8));
}

/** Everything to buy and mix for `volume` m³ of a bag mix with the chosen additions. */
export function tuneBag(mix: BagMix, volume: number, o: BagOptions): TunedBag {
  const kg = (mix.cement + mix.aggregate) * volume;
  const steps: BagStep[] = [{ kind: 'mix', kg, bags: kg / BAG_KG, strengthClass: mix.strengthClass }];
  const dry = [
    ['extraCement', o.extraCement],
    ['flyAsh', o.flyAsh],
    ['waterproofing', o.waterproofing],
    ['silicaFume', o.silicaFume],
  ] as const;
  for (const [kind, on] of dry) {
    if (on) steps.push({ kind, kg: mix.cement * ADDITION_SHARE[kind] * volume });
  }
  if (o.plasticizer !== 'none') {
    steps.push({ kind: 'plasticizer', type: o.plasticizer, litres: PLASTICIZER_EFFECT[o.plasticizer].dosageL * volume });
  }
  if (o.air) steps.push({ kind: 'air', litres: AIR_ENTRAINER_L * volume });
  steps.push({
    kind: 'water',
    litres: waterWithPlasticizer(mix.water, o.plasticizer) * volume,
    withAdmixtures: o.plasticizer !== 'none' || o.air,
  });
  const anyAddition = o.extraCement || o.flyAsh || o.silicaFume || o.air || o.waterproofing || o.plasticizer !== 'none';
  const baseFckCube = estimateFck(mix, NO_OPTIONS);
  const fckCube = anyAddition ? estimateFck(mix, o) : baseFckCube;
  return {
    mix,
    volume,
    steps,
    baseFckCube,
    fckCube,
    strengthClass: anyAddition ? classForCubeStrength(fckCube) : mix.strengthClass,
    airWithSilicaFume: o.air && o.silicaFume,
  };
}

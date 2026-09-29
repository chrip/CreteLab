// Ordering ready-mixed concrete from a plant (Transportbeton): what the order has to say.
// A concrete with prescribed properties is specified by DIN EN 206 / DIN 1045-2, 6.2.
import { SIEVE_LINES } from '../b20/grading';
import type { ExposureClass } from '../b20/exposure';
import type { MixInput } from '../b20/recipe';

/**
 * Moisture class against alkali-silica reaction (Alkali-Richtlinie des DAfStb, DIN 1045-2):
 * WO dry inside, WF often wet, WA wet with salt from outside (de-icing salt, seawater),
 * WS like WA with heavy dynamic load (traffic areas).
 */
export type MoistureClass = 'WO' | 'WF' | 'WA' | 'WS';

export interface OrderSpec {
  strengthClass: MixInput['strengthClass'];
  exposureClasses: ExposureClass[];
  moistureClass: MoistureClass;
  consistency: MixInput['consistency'];
  maxGrain: number;
  /** Chloride content class: Cl 0,40 for reinforced concrete, Cl 1,00 for plain concrete. */
  chlorideClass: 'Cl 0,40' | 'Cl 1,00';
  /** Target air content in %, when air-entrained. */
  airPct: number | null;
  watertight: boolean;
  /** Ordered volume: rounded up to half cubic metres, as plants deliver. */
  orderVolume: number;
  /** Truck mixers are uneconomic below this; plants charge a small-quantity surcharge. */
  belowTypicalMinimum: boolean;
}

/** Below about 1 m³ a plant order rarely pays off (small-quantity surcharge, empty runs). */
export const ORDER_SENSIBLE_FROM_M3 = 1;

const SALT: readonly ExposureClass[] = ['XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3', 'XF2', 'XF4'];
const WET: readonly ExposureClass[] = ['XC2', 'XC4', 'XF1', 'XF3', 'XA1', 'XA2', 'XA3'];

export function moistureClass(classes: readonly ExposureClass[], heavyTraffic: boolean): MoistureClass {
  if (classes.some((c) => SALT.includes(c))) return heavyTraffic ? 'WS' : 'WA';
  if (classes.some((c) => WET.includes(c))) return 'WF';
  return classes.includes('XC3') ? 'WF' : 'WO';
}

export function orderSpec(
  mix: MixInput,
  volume: number,
  { reinforced, heavyTraffic = false, watertight = false }: { reinforced: boolean; heavyTraffic?: boolean; watertight?: boolean },
): OrderSpec {
  return {
    strengthClass: mix.strengthClass,
    exposureClasses: mix.exposureClasses,
    moistureClass: moistureClass(mix.exposureClasses, heavyTraffic),
    consistency: mix.consistency,
    maxGrain: SIEVE_LINES[mix.sieveLine].maxGrain,
    chlorideClass: reinforced ? 'Cl 0,40' : 'Cl 1,00',
    airPct: mix.airPct > 0 ? mix.airPct : null,
    watertight: watertight || mix.waterproofingPct > 0,
    orderVolume: Math.max(0.5, Math.ceil(volume * 2) / 2),
    belowTypicalMinimum: volume < ORDER_SENSIBLE_FROM_M3,
  };
}

/**
 * The concrete in one line, in the order the standard lists it, e.g.
 * "C25/30 · XC4, XF1 · WF · F3 · Dmax 16 mm · Cl 0,40".
 */
export function orderLine(spec: OrderSpec): string {
  return [
    spec.strengthClass,
    spec.exposureClasses.join(', '),
    spec.moistureClass,
    spec.consistency,
    `Dmax ${spec.maxGrain} mm`,
    spec.chlorideClass,
  ].join(' · ');
}

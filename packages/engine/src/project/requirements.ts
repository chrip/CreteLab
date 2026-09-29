// From facts about a component to exposure classes and a mix (DIN 1045-2, Tabelle 1).
// Laya answers plain questions; the standard's logic lives here, where it can be reviewed.
import { NEEDS_AIR, strictestLimits, type ExposureClass } from '../b20/exposure';
import { STRENGTH_CLASSES, lowestClassWith, type StrengthClass } from '../b20/strength';
import { DEFAULT_MIX, type MixInput } from '../b20/recipe';
import { yes, type Answers, type Element } from './answers';

export interface Facts {
  indoor: boolean;
  rain: boolean;
  ground: boolean;
  frost: boolean;
  salt: boolean;
  horizontal: boolean;
  reinforced: boolean;
  /** Watertight structure after the WU-Richtlinie (basement, tank, pond). */
  watertight: boolean;
  /** The piece holds water (a sink, a bird bath), whether or not it is a WU structure. */
  holdsWater: boolean;
  /** 0 none, 1 foot traffic, 2 cars, 3 heavy vehicles / forklifts */
  traffic: number;
  element: Element;
}

export function factsFromAnswers(answers: Answers): Facts {
  const rain = yes(answers, 'rain');
  const element = (answers.element?.choice as Element | undefined) ?? 'slab';
  return {
    indoor: yes(answers, 'indoor_dry') && !rain,
    rain,
    ground: yes(answers, 'ground'),
    frost: yes(answers, 'frost'),
    salt: yes(answers, 'deicing_salt'),
    horizontal: yes(answers, 'horizontal'),
    reinforced: yes(answers, 'reinforced'),
    // Watertight concrete (WU-Richtlinie) is about structures: basements, tanks, ponds.
    // A sink or a planter holds water too, but a small piece is not a WU structure: it needs
    // a dense mix and a sealed surface instead.
    watertight: yes(answers, 'watertight') && element !== 'small',
    holdsWater: yes(answers, 'watertight'),
    traffic: Math.round(answers.traffic?.score ?? 0),
    element,
  };
}

/** Why a requirement was chosen, as a key for the UI ("xc4", "lp", "wu"). */
export type Reason = Lowercase<ExposureClass> | 'lp' | 'wu';

export interface Requirements {
  exposureClasses: ExposureClass[];
  reasons: Reason[];
  /** Mix design input, everything but the volume. */
  mix: MixInput;
  /** Air entrainment is planned (XF2–XF4). */
  airEntrained: boolean;
  watertight: boolean;
}

export function requirementsFromFacts(f: Facts): Requirements {
  const classes: ExposureClass[] = [];

  // Carbonation only matters for reinforced concrete.
  if (f.reinforced) {
    if (f.rain) classes.push('XC4');
    else if (f.ground || f.watertight) classes.push('XC2');
    else if (f.indoor) classes.push('XC1');
    else classes.push('XC3');
    if (f.salt) classes.push(f.horizontal ? 'XD3' : 'XD1');
  }
  if (f.frost && !f.indoor) {
    classes.push(f.salt ? (f.horizontal ? 'XF4' : 'XF2') : f.horizontal ? 'XF3' : 'XF1');
  }
  if (f.traffic >= 3) classes.push('XM2');
  else if (f.traffic === 2 && f.horizontal) classes.push('XM1');
  // Unreinforced, no frost, no wear: no attack (X0 is only allowed for plain concrete).
  if (classes.length === 0) classes.push('X0');

  const airEntrained = classes.some((c) => NEEDS_AIR.includes(c));
  const fineGrain = f.element === 'wall' || f.element === 'small';
  const reasons: Reason[] = classes.map((c) => c.toLowerCase() as Reason);
  if (airEntrained) reasons.push('lp');
  if (f.watertight) reasons.push('wu');

  return {
    exposureClasses: classes,
    reasons,
    airEntrained,
    watertight: f.watertight,
    mix: {
      ...DEFAULT_MIX,
      exposureClasses: classes,
      strengthClass: minimumStrengthClass(classes, strengthFloor(f), airEntrained),
      sieveLine: fineGrain ? 'B16' : 'B32',
      consistency: f.element === 'paving' ? 'F2' : 'F3',
      airPct: airEntrained ? (fineGrain ? 4.5 : 4.0) : 0,
      waterproofingPct: f.watertight ? 2 : 0,
    },
  };
}

/**
 * The weakest class the component may have regardless of exposure: C25/30 for watertight
 * concrete (DAfStb WU-Richtlinie), C20/25 for reinforced concrete (DIN EN 1992-1-1).
 */
export function strengthFloor(f: Pick<Facts, 'watertight' | 'reinforced'>): StrengthClass {
  if (f.watertight) return 'C25/30';
  return f.reinforced ? 'C20/25' : 'C16/20';
}

/**
 * Lowest strength class that meets every exposure class and the floor (C20/25 for
 * reinforced concrete). XF2/XF3 use their air-entrained limits when air is planned.
 */
export function minimumStrengthClass(
  classes: readonly ExposureClass[],
  floor: StrengthClass,
  airEntrained: boolean,
): StrengthClass {
  const need = Math.max(STRENGTH_CLASSES[floor].fckCube, strictestLimits(classes, { airEntrained }).minFckCube);
  return lowestClassWith(need);
}

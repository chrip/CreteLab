// Compressive strength classes and the Walz curves of Zement-Merkblatt B 20 (2.2017).

export type CementStrengthKey = '32.5' | '42.5' | '42.5R' | '52.5' | '52.5R';

/**
 * Walz curves of B 20, Bild 1: mean strength f_c,dry,cube over w/c for the cement
 * strength classes 32,5 / 42,5 / 52,5, in Abrams form
 *
 *   f = A · e^(−b · w/c)
 *
 * Fitted to Bild 1 digitised at 300 dpi (test/fixtures/b20-bild1-points.json): within
 * 1 N/mm² of the chart for w/c 0,35–1,0 and within 0,014 of every w/c the B 20 worked
 * examples read from it. B 20 has one curve per strength class, so N and R share it.
 */
const WALZ_B = 2.2;
export const WALZ_CURVES: Record<CementStrengthKey, { A: number; b: number }> = {
  '32.5': { A: 127, b: WALZ_B },
  '42.5': { A: 156, b: WALZ_B },
  '42.5R': { A: 156, b: WALZ_B },
  '52.5': { A: 187, b: WALZ_B },
  '52.5R': { A: 187, b: WALZ_B },
};

export interface CementType {
  curve: CementStrengthKey;
  /** kg/dm³, B 20 Tafel 4 */
  density: number;
  /**
   * Maximum fly ash that may be credited, as a fraction of the cement (B 20 p. 5):
   * 0,33 for cements without P, V and D. None of the listed cements contains them;
   * B 20 Beispiel IV applies 0,33 to CEM III/A.
   */
  flyAshMaxFactor: number;
}

export const CEMENT_TYPES = {
  'CEM I 32.5 N': { curve: '32.5', density: 3.1, flyAshMaxFactor: 0.33 },
  'CEM I 42.5 N': { curve: '42.5', density: 3.1, flyAshMaxFactor: 0.33 },
  'CEM I 42.5 R': { curve: '42.5R', density: 3.1, flyAshMaxFactor: 0.33 },
  'CEM I 52.5 N': { curve: '52.5', density: 3.1, flyAshMaxFactor: 0.33 },
  'CEM I 52.5 R': { curve: '52.5R', density: 3.1, flyAshMaxFactor: 0.33 },
  'CEM II/A-S 42.5 N': { curve: '42.5', density: 3.0, flyAshMaxFactor: 0.33 },
  'CEM II/B-S 42.5 N': { curve: '42.5', density: 3.0, flyAshMaxFactor: 0.33 },
  'CEM II/A-LL 42.5 N': { curve: '42.5', density: 3.0, flyAshMaxFactor: 0.33 },
  'CEM III/A 42.5 N': { curve: '42.5', density: 3.0, flyAshMaxFactor: 0.33 },
  'CEM III/B 42.5 N': { curve: '42.5', density: 2.9, flyAshMaxFactor: 0.33 },
} as const satisfies Record<string, CementType>;

export type CementTypeName = keyof typeof CEMENT_TYPES;
export const CEMENT_TYPE_NAMES = Object.keys(CEMENT_TYPES) as CementTypeName[];

/** Characteristic strengths at 28 days: cylinder 150×300 mm and cube 150 mm, N/mm². */
export const STRENGTH_CLASSES = {
  'C8/10': { fckCyl: 8, fckCube: 10 },
  'C12/15': { fckCyl: 12, fckCube: 15 },
  'C16/20': { fckCyl: 16, fckCube: 20 },
  'C20/25': { fckCyl: 20, fckCube: 25 },
  'C25/30': { fckCyl: 25, fckCube: 30 },
  'C30/37': { fckCyl: 30, fckCube: 37 },
  'C35/45': { fckCyl: 35, fckCube: 45 },
  'C40/50': { fckCyl: 40, fckCube: 50 },
  'C45/55': { fckCyl: 45, fckCube: 55 },
  'C50/60': { fckCyl: 50, fckCube: 60 },
  'C55/67': { fckCyl: 55, fckCube: 67 },
  'C60/75': { fckCyl: 60, fckCube: 75 },
  'C70/85': { fckCyl: 70, fckCube: 85 },
  'C80/95': { fckCyl: 80, fckCube: 95 },
  'C90/105': { fckCyl: 90, fckCube: 105 },
  'C100/115': { fckCyl: 100, fckCube: 115 },
} as const;

export type StrengthClass = keyof typeof STRENGTH_CLASSES;
/** Weakest first. */
export const STRENGTH_CLASS_NAMES = Object.keys(STRENGTH_CLASSES) as StrengthClass[];

export function isStrengthClass(value: unknown): value is StrengthClass {
  return typeof value === 'string' && value in STRENGTH_CLASSES;
}

export function isCementType(value: unknown): value is CementTypeName {
  return typeof value === 'string' && value in CEMENT_TYPES;
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Target mean strength per B 20 Tafel 9, step 3: f_cm,dry,cube = f_ck,cube / 0,92 + v.
 * The margin v (Vorhaltemaß, 3–12 N/mm²) is the only safety allowance.
 */
export function targetStrength(fckCube: number, margin: number): number {
  return round(fckCube / 0.92 + margin, 1);
}

/** Mean strength from the Walz curve for a w/c ratio, or null for an invalid w/c. */
export function strengthFromWz(wz: number, curve: CementStrengthKey): number | null {
  if (!(wz > 0)) return null;
  const { A, b } = WALZ_CURVES[curve];
  return round(A * Math.exp(-b * wz), 1);
}

/** The inverse: the w/c ratio that reaches a target mean strength. */
export function wzFromStrength(target: number, curve: CementStrengthKey): number | null {
  if (!(target > 0)) return null;
  const { A, b } = WALZ_CURVES[curve];
  return round(Math.log(A / target) / b, 3);
}

/** Strongest class whose characteristic cube strength is reached, weakest class otherwise. */
export function classForCubeStrength(fckCube: number): StrengthClass {
  const reached = STRENGTH_CLASS_NAMES.filter((c) => STRENGTH_CLASSES[c].fckCube <= fckCube);
  return reached.at(-1) ?? 'C8/10';
}

/** Weakest class with at least this characteristic cube strength, strongest class otherwise. */
export function lowestClassWith(fckCube: number): StrengthClass {
  return STRENGTH_CLASS_NAMES.find((c) => STRENGTH_CLASSES[c].fckCube >= fckCube) ?? 'C100/115';
}

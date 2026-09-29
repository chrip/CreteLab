// Exposure classes after DIN EN 206 / DIN 1045-2 and their limits (Zement-Merkblatt B 20,
// Tafel 2; minimum strength classes after Zement-Merkblatt B 9, Tafel 3/4).

export interface ExposureLimits {
  /** Maximum w/c ratio, null = no limit (X0). */
  maxWz: number | null;
  /** Minimum cement content, kg/m³. */
  minCement: number;
  /** Characteristic cube strength of the minimum strength class, N/mm². */
  minFckCube: number;
}

export interface ExposureClassData extends ExposureLimits {
  /**
   * Limits that apply instead when the concrete is air-entrained to at least the minimum
   * air content (XF2/XF3; B 9 Tafel 8, B 20 Beispiel III). Without air they need C35/45.
   */
  airEntrained?: ExposureLimits;
}

export const EXPOSURE_CLASSES = {
  X0: { maxWz: null, minCement: 240, minFckCube: 10 },
  XC1: { maxWz: 0.75, minCement: 240, minFckCube: 20 },
  XC2: { maxWz: 0.75, minCement: 240, minFckCube: 20 },
  XC3: { maxWz: 0.65, minCement: 260, minFckCube: 25 },
  XC4: { maxWz: 0.6, minCement: 280, minFckCube: 30 },
  XD1: { maxWz: 0.55, minCement: 300, minFckCube: 37 },
  XD2: { maxWz: 0.5, minCement: 320, minFckCube: 45 },
  XD3: { maxWz: 0.45, minCement: 320, minFckCube: 45 },
  XS1: { maxWz: 0.6, minCement: 280, minFckCube: 37 },
  XS2: { maxWz: 0.5, minCement: 320, minFckCube: 45 },
  XS3: { maxWz: 0.45, minCement: 320, minFckCube: 45 },
  XF1: { maxWz: 0.6, minCement: 280, minFckCube: 30 },
  XF2: {
    maxWz: 0.5, minCement: 320, minFckCube: 45,
    airEntrained: { maxWz: 0.55, minCement: 300, minFckCube: 30 },
  },
  XF3: {
    maxWz: 0.5, minCement: 320, minFckCube: 45,
    airEntrained: { maxWz: 0.55, minCement: 300, minFckCube: 30 },
  },
  XF4: { maxWz: 0.5, minCement: 320, minFckCube: 37 },
  XA1: { maxWz: 0.6, minCement: 280, minFckCube: 30 },
  XA2: { maxWz: 0.5, minCement: 320, minFckCube: 45 },
  XA3: { maxWz: 0.45, minCement: 320, minFckCube: 45 },
  XM1: { maxWz: 0.55, minCement: 300, minFckCube: 37 },
  XM2: { maxWz: 0.45, minCement: 320, minFckCube: 45 },
  XM3: { maxWz: 0.45, minCement: 320, minFckCube: 45 },
} as const satisfies Record<string, ExposureClassData>;

export type ExposureClass = keyof typeof EXPOSURE_CLASSES;
/** In order of the standard; later entries are more severe within their group. */
export const EXPOSURE_CLASS_NAMES = Object.keys(EXPOSURE_CLASSES) as ExposureClass[];

export function isExposureClass(value: unknown): value is ExposureClass {
  return typeof value === 'string' && value in EXPOSURE_CLASSES;
}

/** Classes that damage the surface: frost and wear (stricter fines limits, B 20 Tafel 23). */
export const FROST_OR_WEAR: readonly ExposureClass[] = ['XF1', 'XF2', 'XF3', 'XF4', 'XM1', 'XM2', 'XM3'];

/** Frost with de-icing salt or on horizontal surfaces: air entrainment is the usual answer. */
export const NEEDS_AIR: readonly ExposureClass[] = ['XF2', 'XF3', 'XF4'];

export interface StrictestLimits {
  maxWz: number;
  minCement: number;
  minFckCube: number;
}

/**
 * All exposure classes apply at once (DIN 1045-2): the lowest w/c, the highest cement
 * content and the highest minimum strength. `airEntrained` switches XF2/XF3 to their
 * air-entrained limits.
 */
export function strictestLimits(
  classes: readonly ExposureClass[],
  { airEntrained = false } = {},
): StrictestLimits {
  const data: ExposureLimits[] = classes.map((c) => {
    const d: ExposureClassData = EXPOSURE_CLASSES[c];
    return airEntrained && d.airEntrained ? d.airEntrained : d;
  });
  if (data.length === 0) return { maxWz: Infinity, minCement: 0, minFckCube: 0 };
  return {
    maxWz: Math.min(...data.map((d) => d.maxWz ?? Infinity)),
    minCement: Math.max(...data.map((d) => d.minCement)),
    minFckCube: Math.max(...data.map((d) => d.minFckCube)),
  };
}

/**
 * Mean minimum air content of air-entrained concrete in Vol.-% by maximum grain, one point
 * more for flowable concrete ≥ F4 (Heidelberg Materials, Betontechnische Daten 2022,
 * Tabelle 6.3.5.a).
 */
export function minAirContent(maxGrain: number, consistency: string): number {
  const base = maxGrain <= 8 ? 5.5 : maxGrain <= 16 ? 4.5 : maxGrain <= 32 ? 4.0 : 3.5;
  return ['F4', 'F5', 'F6'].includes(consistency) ? base + 1 : base;
}

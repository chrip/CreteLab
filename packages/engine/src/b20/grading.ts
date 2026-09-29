// Sieve lines, water demand and grain groups (Zement-Merkblatt B 20, Tafel 3; DIN 1045-2,
// Anhang L).

/** k-value (B 20 Tafel 3) and maximum grain. A/B lines are the mean of the A and B line. */
export const SIEVE_LINES = {
  A8: { k: 3.63, maxGrain: 8 },
  B8: { k: 2.9, maxGrain: 8 },
  C8: { k: 2.27, maxGrain: 8 },
  A16: { k: 4.6, maxGrain: 16 },
  'A/B16': { k: 4.13, maxGrain: 16 },
  B16: { k: 3.66, maxGrain: 16 },
  C16: { k: 2.75, maxGrain: 16 },
  A32: { k: 5.48, maxGrain: 32 },
  'A/B32': { k: 4.84, maxGrain: 32 },
  B32: { k: 4.2, maxGrain: 32 },
  C32: { k: 3.3, maxGrain: 32 },
} as const;

export type SieveLine = keyof typeof SIEVE_LINES;
export const SIEVE_LINE_NAMES = Object.keys(SIEVE_LINES) as SieveLine[];

export function isSieveLine(value: unknown): value is SieveLine {
  return typeof value === 'string' && value in SIEVE_LINES;
}

/** Consistency classes the calculator offers. F4–F6 need a superplasticiser (FM). */
export const CONSISTENCY_CLASSES = ['C0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'] as const;
export type ConsistencyClass = (typeof CONSISTENCY_CLASSES)[number];

export function isConsistencyClass(value: unknown): value is ConsistencyClass {
  return typeof value === 'string' && (CONSISTENCY_CLASSES as readonly string[]).includes(value);
}

export const FLOWABLE: readonly ConsistencyClass[] = ['F4', 'F5', 'F6'];

// Numerator of w = N / (k + 3), B 20 Tafel 3. F4–F6 start from the F3 water; the
// superplasticiser then makes them flowable.
const WATER_NUMERATOR: Record<ConsistencyClass, number> = {
  C0: 1000, F1: 1100, F2: 1200, F3: 1300, F4: 1300, F5: 1300, F6: 1300,
};

/** Water demand in l/m³ for rounded aggregate. */
export function waterDemand(sieveLine: SieveLine, consistency: ConsistencyClass): number {
  return Math.round((WATER_NUMERATOR[consistency] / (SIEVE_LINES[sieveLine].k + 3)) * 10) / 10;
}

/** Crushed aggregate needs about 10 % more water than rounded gravel (B 20 Tafel 3). */
export const CRUSHED_WATER_FACTOR = 1.1;

/**
 * Passing in % at the sieves 0,25 / 0,5 / 1 / 2 / 4 / 8 / 16 / 31,5 mm. The residues of
 * each line add up to its k-value (e.g. B16: 92+80+68+58+44+24 = 366 → k = 3,66).
 */
export const SIEVE_LINE_PASSING = {
  A8: [5, 14, 21, 36, 61, 100],
  B8: [11, 26, 42, 57, 74, 100],
  C8: [21, 39, 57, 71, 85, 100],
  A16: [3, 8, 12, 21, 36, 60, 100],
  B16: [8, 20, 32, 42, 56, 76, 100],
  C16: [18, 34, 49, 62, 74, 88, 100],
  A32: [2, 5, 8, 14, 23, 38, 62, 100],
  B32: [8, 18, 28, 37, 47, 62, 80, 100],
  C32: [15, 29, 42, 53, 65, 77, 89, 100],
} as const;
export const SIEVES_MM = [0.25, 0.5, 1, 2, 4, 8, 16, 31.5] as const;

export interface GrainGroupShare {
  range: string;
  /** Mass-% of the aggregate. */
  pct: number;
}

function groupsFromPassing(passing: readonly number[], maxGrain: number): GrainGroupShare[] {
  const at = (mm: number) => passing[SIEVES_MM.indexOf(mm as (typeof SIEVES_MM)[number])] ?? 0;
  if (maxGrain === 8) return [{ range: '0/2', pct: at(2) }, { range: '2/8', pct: 100 - at(2) }];
  return [
    { range: '0/2', pct: at(2) },
    { range: '2/8', pct: at(8) - at(2) },
    { range: `8/${maxGrain}`, pct: 100 - at(8) },
  ];
}

const midpoint = (a: readonly number[], b: readonly number[]) => a.map((v, i) => (v + (b[i] ?? 0)) / 2);

interface Grading {
  groups: GrainGroupShare[];
  /** Share of the aggregate that passes 0,125 mm (counts as fines). */
  fines0125: number;
}

/**
 * Grain groups per sieve line. A/B32 uses the midpoint of A32 and B32; A/B16 the real mix of
 * B 20 Beispiel IV (p. 19). Fines: B32 from Beispiel I (0,04), A/B16 from Beispiel II/IV (0,03).
 */
export const GRADINGS: Record<SieveLine, Grading> = {
  A8: { groups: groupsFromPassing(SIEVE_LINE_PASSING.A8, 8), fines0125: 0.03 },
  B8: { groups: groupsFromPassing(SIEVE_LINE_PASSING.B8, 8), fines0125: 0.04 },
  C8: { groups: groupsFromPassing(SIEVE_LINE_PASSING.C8, 8), fines0125: 0.05 },
  A16: { groups: groupsFromPassing(SIEVE_LINE_PASSING.A16, 16), fines0125: 0.03 },
  'A/B16': {
    groups: [{ range: '0/2', pct: 38 }, { range: '2/8', pct: 22 }, { range: '8/16', pct: 40 }],
    fines0125: 0.03,
  },
  B16: { groups: groupsFromPassing(SIEVE_LINE_PASSING.B16, 16), fines0125: 0.035 },
  C16: { groups: groupsFromPassing(SIEVE_LINE_PASSING.C16, 16), fines0125: 0.04 },
  A32: { groups: groupsFromPassing(SIEVE_LINE_PASSING.A32, 32), fines0125: 0.03 },
  'A/B32': {
    groups: groupsFromPassing(midpoint(SIEVE_LINE_PASSING.A32, SIEVE_LINE_PASSING.B32), 32),
    fines0125: 0.035,
  },
  B32: { groups: groupsFromPassing(SIEVE_LINE_PASSING.B32, 32), fines0125: 0.04 },
  C32: { groups: groupsFromPassing(SIEVE_LINE_PASSING.C32, 32), fines0125: 0.05 },
};

export interface GrainGroup extends GrainGroupShare {
  /** kg/m³ dry */
  massDry: number;
  /** Surface moisture, mass-% */
  moisturePct: number;
  /** kg/m³ as weighed, with its moisture */
  massMoist: number;
}

/** Typical surface moisture of sand, fine and coarse gravel in % (B 20). */
export const DEFAULT_MOISTURE = [5, 3, 2] as const;

/** Split the dry aggregate into its grain groups, with the moisture each one carries. */
export function distributeAggregate(
  massKg: number,
  sieveLine: SieveLine,
  moistures: readonly number[] = [0, 0, 0],
): GrainGroup[] {
  return GRADINGS[sieveLine].groups.map((g, i) => {
    const massDry = Math.round((massKg * g.pct) / 100);
    const moisturePct = moistures[i] ?? 0;
    return { ...g, massDry, moisturePct, massMoist: Math.round(massDry * (1 + moisturePct / 100)) };
  });
}

/** Water still to add once the moisture in the aggregate is counted. */
export function addedWater(totalWater: number, groups: readonly GrainGroup[]): number {
  const inAggregate = groups.reduce((sum, g) => sum + (g.massDry * g.moisturePct) / 100, 0);
  return Math.round(totalWater - inAggregate);
}

// Can the component be made from bagged concrete, and from which product?
// Every rule cites docs/research/bagged-concrete.md (R1–R11).
import { STRENGTH_CLASSES, type StrengthClass } from '../b20/strength';
import type { ExposureClass } from '../b20/exposure';
import { BAG_PRODUCTS, type BagProduct } from './products';

export interface BagRequirement {
  strengthClass: StrengthClass;
  exposureClasses: ExposureClass[];
  /** Reinforced or load-bearing. */
  structural: boolean;
  watertight: boolean;
  /** m³ */
  volume: number;
  /** Smallest dimension (wall thickness), m, if known. */
  minThickness?: number | null;
}

export type BagIssue =
  /** R5: no bag is declared watertight; sealing admixtures are no substitute. */
  | { code: 'watertight'; severity: 'blocker' }
  /** R1/R2: the classes are not declared by any bag. */
  | { code: 'not-declared'; severity: 'blocker'; params: { classes: ExposureClass[]; strengthClass: StrengthClass | null } }
  /** R1/R2: only a trade product from builders' merchants declares the classes. */
  | { code: 'trade-only'; severity: 'warning'; params: { product: string } }
  /** R8: maximum grain above a third of the thinnest dimension. */
  | { code: 'too-thin'; severity: 'blocker'; params: { thicknessMm: number; minMm: number } }
  /** R7: from about 0,5 m³ many bags; from 1 m³ ready-mixed concrete is the usual choice. */
  | { code: 'many-bags'; severity: 'info'; params: { bags: number } }
  | { code: 'order-instead'; severity: 'warning'; params: { bags: number } };

export interface BagPlan {
  /** Best product, or null when bagged concrete is not possible. */
  product: BagProduct | null;
  bags: number;
  /** Mixing water for all bags, litres. */
  waterL: number;
  issues: BagIssue[];
  feasible: boolean;
}

/** Litres of fresh concrete from a typical 40 kg bag. */
const TYPICAL_YIELD_L = 20;

const fck = (c: StrengthClass) => STRENGTH_CLASSES[c].fckCube;

export function meets(product: BagProduct, req: BagRequirement): boolean {
  if (!product.strengthClass || fck(product.strengthClass) < fck(req.strengthClass)) return false;
  if (req.structural && !product.structural) return false;
  return req.exposureClasses.every((c) => c === 'X0' || product.exposureClasses.includes(c));
}

/** Bags for the volume, rounded up. */
export function bagCount(product: BagProduct, volume: number): number {
  return Math.ceil((volume * 1000) / product.yieldL - 1e-9);
}

/**
 * Picks the product that meets the requirement, DIY stores before trade products, the
 * weakest sufficient class first and the largest bag among equals (fewer bags to carry).
 */
export function planBag(req: BagRequirement): BagPlan {
  const issues: BagIssue[] = [];
  if (req.watertight) issues.push({ code: 'watertight', severity: 'blocker' });

  const candidates = BAG_PRODUCTS.filter((p) => meets(p, req)).sort(
    (a, b) =>
      Number(a.channel === 'trade') - Number(b.channel === 'trade') ||
      fck(a.strengthClass!) - fck(b.strengthClass!) ||
      b.bagKg - a.bagKg,
  );
  const product = candidates[0] ?? null;
  if (!product) {
    const declared = new Set(BAG_PRODUCTS.flatMap((p) => p.exposureClasses));
    const strongest = Math.max(...BAG_PRODUCTS.map((p) => fck(p.strengthClass!)));
    issues.push({
      code: 'not-declared',
      severity: 'blocker',
      params: {
        classes: req.exposureClasses.filter((c) => c !== 'X0' && !declared.has(c)),
        strengthClass: fck(req.strengthClass) > strongest ? req.strengthClass : null,
      },
    });
  } else if (product.channel === 'trade') {
    issues.push({ code: 'trade-only', severity: 'warning', params: { product: `${product.manufacturer} ${product.product}` } });
  }

  const grain = product?.maxGrain ?? 8;
  if (req.minThickness && req.minThickness * 1000 < 3 * grain) {
    issues.push({ code: 'too-thin', severity: 'blocker', params: { thicknessMm: Math.round(req.minThickness * 1000), minMm: 3 * grain } });
  }

  const bags = product ? bagCount(product, req.volume) : 0;
  // About 50 bags of 40 kg per m³ when no product fits (R7).
  const roughBags = bags || Math.ceil((req.volume * 1000) / TYPICAL_YIELD_L);
  if (req.volume >= 1) issues.push({ code: 'order-instead', severity: 'warning', params: { bags: roughBags } });
  else if (req.volume >= 0.5) issues.push({ code: 'many-bags', severity: 'info', params: { bags: roughBags } });

  const feasible = product !== null && !issues.some((i) => i.severity === 'blocker');
  return { product, bags, waterL: product ? bags * product.waterL : 0, issues, feasible };
}

/** What every bag datasheet says, shown with each bag plan (R3, R4, R11). */
export const BAG_RULES = ['water-as-stated', 'no-additions', 'temperature'] as const;

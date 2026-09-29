// Bagged concrete feasibility. Rules R1–R11: docs/research/bagged-concrete.md.
import { describe, expect, it } from 'vitest';
import { EXPOSURE_CLASS_NAMES, type ExposureClass } from '../../src/b20/exposure';
import { isStrengthClass } from '../../src/b20/strength';
import {
  BAG_RULES, bagCount, meets, planBag, type BagIssue, type BagRequirement,
} from '../../src/bagged/feasibility';
import { BAG_PRODUCTS, POST_MIX, bagProduct } from '../../src/bagged/products';
import { factsFromAnswers, requirementsFromFacts } from '../../src/project/requirements';

const base: BagRequirement = {
  strengthClass: 'C20/25', exposureClasses: ['XC1'], structural: false, watertight: false, volume: 0.1,
};
const need = (r: Partial<BagRequirement>): BagRequirement => ({ ...base, ...r });
const product = (id: string) => bagProduct(id)!;
const codes = (issues: BagIssue[]) => issues.map((i) => i.code);
const issue = <C extends BagIssue['code']>(issues: BagIssue[], code: C) =>
  issues.find((i): i is Extract<BagIssue, { code: C }> => i.code === code);

describe('planBag: simple DIY jobs', () => {
  it('garden foundation C20/25, XC1, 0,1 m³ → feasible from a DIY bag', () => {
    const plan = planBag(need({ exposureClasses: ['X0', 'XC1'] }));
    expect(plan.feasible).toBe(true);
    expect(plan.issues).toEqual([]);
    expect(plan.product?.channel).toBe('diy');
    // The weakest sufficient class first: KOBA is the only C20/25 bag.
    expect(plan.product?.id).toBe('koba-beton-estrich');
    // ceil(0,1 · 1000 / 15 l) = ceil(6,67) = 7 bags, 7 × 3,3 l water.
    expect(plan.bags).toBe(Math.ceil((0.1 * 1000) / 15));
    expect(plan.bags).toBe(7);
    expect(plan.waterL).toBeCloseTo(7 * 3.3, 10);
  });

  it('X0 alone is met by every declared bag', () => {
    const plan = planBag(need({ strengthClass: 'C16/20', exposureClasses: ['X0'] }));
    expect(plan.feasible).toBe(true);
    expect(plan.product?.channel).toBe('diy');
  });

  it('a structural foundation needs a bag that allows reinforced use (R10): weber.mix 692, 40 kg before 30 kg', () => {
    const plan = planBag(need({ structural: true }));
    // KOBA and quick-mix are excluded; weber (40 kg) and SAKRET BE (30 kg) are both C25/30,
    // the larger bag wins.
    expect(plan.product?.id).toBe('weber-mix-692');
    expect(plan.bags).toBe(Math.ceil(100 / 22)); // 5
  });

  it('outdoor XC4 + XF1 (R9): the XC2-only KOBA drops out', () => {
    const plan = planBag(need({ strengthClass: 'C25/30', exposureClasses: ['XC4', 'XF1'] }));
    expect(plan.feasible).toBe(true);
    expect(plan.product?.id).toBe('weber-mix-692');
  });
});

describe('planBag: de-icing salt and classes above DIY bags (R1, R2)', () => {
  it('XF4 is only declared by the trade product SAKRET TB C35/45 F6 → trade-only warning', () => {
    // R1: typical DIY bags declare XF1 at most; SAKRET TB C35/45 F6 declares XF4 by CDF test
    // and is sold through builders' merchants.
    const plan = planBag(need({ strengthClass: 'C30/37', exposureClasses: ['XF4'] }));
    expect(plan.product?.id).toBe('sakret-tb-c35-f6');
    expect(plan.product?.channel).toBe('trade');
    expect(issue(plan.issues, 'trade-only')).toEqual({
      code: 'trade-only', severity: 'warning', params: { product: 'SAKRET Trockenbeton TB C35/45 F6' },
    });
    // A warning, not a blocker.
    expect(plan.feasible).toBe(true);
    // 0,1 m³ / 12,9 l = 7,75 → 8 bags of 3 l water.
    expect(plan.bags).toBe(8);
    expect(plan.waterL).toBe(24);
  });

  it('XF2/XF3 or XD2/XD3 go to the plain TB C35/45 (a lower water content than F6)', () => {
    for (const c of ['XF2', 'XF3', 'XD2', 'XD3'] as ExposureClass[]) {
      const plan = planBag(need({ strengthClass: 'C35/45', exposureClasses: ['XC4', c] }));
      expect(plan.product?.id, c).toBe('sakret-tb-c35');
      expect(codes(plan.issues), c).toContain('trade-only');
    }
  });

  it('XD1 at C30/37 → TB C30/37, the weakest trade bag that declares it', () => {
    expect(planBag(need({ strengthClass: 'C30/37', exposureClasses: ['XC4', 'XD1'] })).product?.id).toBe('sakret-tb-c30');
  });

  it('XM1 and XM2 are declared by no bag → not-declared blocker listing them', () => {
    const plan = planBag(need({ strengthClass: 'C30/37', exposureClasses: ['XF4', 'XM1'] }));
    expect(plan.product).toBeNull();
    expect(plan.feasible).toBe(false);
    expect(plan.bags).toBe(0);
    expect(plan.waterL).toBe(0);
    expect(issue(plan.issues, 'not-declared')).toEqual({
      code: 'not-declared', severity: 'blocker', params: { classes: ['XM1'], strengthClass: null },
    });
    const xm2 = planBag(need({ strengthClass: 'C35/45', exposureClasses: ['X0', 'XC1', 'XM2'] }));
    // Declared classes and X0 are not listed.
    expect(issue(xm2.issues, 'not-declared')?.params.classes).toEqual(['XM2']);
  });

  it('XD3 is declared (TB C35/45), so it is never listed as not declared', () => {
    const plan = planBag(need({ strengthClass: 'C35/45', exposureClasses: ['XD3', 'XM1'] }));
    expect(issue(plan.issues, 'not-declared')?.params.classes).toEqual(['XM1']);
  });

  it('a class above the strongest bag is named in the blocker', () => {
    const plan = planBag(need({ strengthClass: 'C40/50', exposureClasses: ['XC1'] }));
    expect(issue(plan.issues, 'not-declared')?.params).toEqual({ classes: [], strengthClass: 'C40/50' });
  });

  it('structural XF4 with XA3 and XS3: the TB F6 declares all of them', () => {
    const plan = planBag(need({ strengthClass: 'C35/45', exposureClasses: ['XF4', 'XA3', 'XS3'], structural: true }));
    expect(plan.product?.id).toBe('sakret-tb-c35-f6');
  });

  it('unreinforced driveway from the planner (XF4 + XM1) is not possible from bags', () => {
    const r = requirementsFromFacts(factsFromAnswers({
      rain: { noul: 1 }, frost: { noul: 1 }, deicing_salt: { noul: 1 }, horizontal: { noul: 1 },
      traffic: { score: 2 }, element: { choice: 'paving' },
    }));
    const plan = planBag({
      strengthClass: r.mix.strengthClass, exposureClasses: r.exposureClasses, structural: false,
      watertight: r.watertight, volume: 3.75,
    });
    expect(plan.feasible).toBe(false);
    expect(codes(plan.issues)).toEqual(['not-declared', 'order-instead']);
    // No product: about 50 bags per m³ (20 l each, R7) → ceil(3750 / 20).
    expect(issue(plan.issues, 'order-instead')?.params.bags).toBe(188);
  });
});

describe('planBag: blockers', () => {
  it('watertight → blocker even when a bag meets the classes (R5)', () => {
    const plan = planBag(need({ strengthClass: 'C25/30', exposureClasses: ['XC2'], watertight: true, structural: true }));
    expect(plan.product).not.toBeNull();
    expect(issue(plan.issues, 'watertight')).toEqual({ code: 'watertight', severity: 'blocker' });
    expect(plan.feasible).toBe(false);
  });

  it('a 2 cm wall is too thin for 8 mm grain: at least 3 × 8 = 24 mm (R8)', () => {
    const plan = planBag(need({ strengthClass: 'C25/30', exposureClasses: ['XC4'], minThickness: 0.02 }));
    expect(plan.product?.maxGrain).toBe(8);
    expect(issue(plan.issues, 'too-thin')).toEqual({ code: 'too-thin', severity: 'blocker', params: { thicknessMm: 20, minMm: 24 } });
    expect(plan.feasible).toBe(false);
  });

  it('24 mm is thick enough for 8 mm grain', () => {
    expect(codes(planBag(need({ strengthClass: 'C25/30', minThickness: 0.024 })).issues)).not.toContain('too-thin');
    expect(codes(planBag(need({ strengthClass: 'C25/30', minThickness: 0.0239 })).issues)).toContain('too-thin');
  });

  it("uses the chosen bag's grain: KOBA 0–6 mm needs only 18 mm", () => {
    const plan = planBag(need({ minThickness: 0.02 }));
    expect(plan.product?.id).toBe('koba-beton-estrich');
    expect(codes(plan.issues)).not.toContain('too-thin');
    expect(issue(planBag(need({ minThickness: 0.015 })).issues, 'too-thin')?.params).toEqual({ thicknessMm: 15, minMm: 18 });
  });

  it('without a product the thickness is checked against 8 mm grain', () => {
    const plan = planBag(need({ exposureClasses: ['XM1'], minThickness: 0.02 }));
    expect(issue(plan.issues, 'too-thin')?.params.minMm).toBe(24);
  });

  it('an unknown thickness is not checked', () => {
    expect(codes(planBag(need({ minThickness: null })).issues)).toEqual([]);
  });
});

describe('planBag: volume (R7)', () => {
  const c25 = need({ strengthClass: 'C25/30', exposureClasses: ['XC4'] });

  it('below 0,5 m³ nothing to say', () => {
    expect(planBag({ ...c25, volume: 0.49 }).issues).toEqual([]);
  });

  it('0,5 to 1 m³ → many-bags info, still feasible', () => {
    const plan = planBag({ ...c25, volume: 0.5 });
    // weber.mix 692: ceil(500 / 22) = 23 bags.
    expect(plan.issues).toEqual([{ code: 'many-bags', severity: 'info', params: { bags: 23 } }]);
    expect(plan.feasible).toBe(true);
    expect(codes(planBag({ ...c25, volume: 0.99 }).issues)).toEqual(['many-bags']);
  });

  it('from 1 m³ → order-instead warning, still feasible', () => {
    const plan = planBag({ ...c25, volume: 1 });
    // ceil(1000 / 22) = 46 bags.
    expect(plan.bags).toBe(46);
    expect(plan.issues).toEqual([{ code: 'order-instead', severity: 'warning', params: { bags: 46 } }]);
    expect(plan.feasible).toBe(true);
  });
});

describe('meets', () => {
  it('needs the strength class', () => {
    expect(meets(product('koba-beton-estrich'), need({ strengthClass: 'C20/25' }))).toBe(true);
    expect(meets(product('koba-beton-estrich'), need({ strengthClass: 'C25/30' }))).toBe(false);
    expect(meets(product('weber-mix-692'), need({ strengthClass: 'C25/30' }))).toBe(true);
  });

  it('needs every exposure class but X0', () => {
    expect(meets(product('weber-mix-692'), need({ exposureClasses: ['X0', 'XC4', 'XF1'] }))).toBe(true);
    expect(meets(product('weber-mix-692'), need({ exposureClasses: ['XC4', 'XF2'] }))).toBe(false);
  });

  it.each(['quick-mix-b03', 'koba-beton-estrich'])('structural use excludes %s (R10)', (id) => {
    expect(meets(product(id), need({ structural: false }))).toBe(true);
    expect(meets(product(id), need({ structural: true }))).toBe(false);
  });

  it('the post mix declares no class and meets nothing (R6)', () => {
    expect(meets(POST_MIX, need({ strengthClass: 'C8/10', exposureClasses: ['X0'] }))).toBe(false);
  });
});

describe('bagCount', () => {
  it.each([
    ['weber-mix-692', 0.1, 5], // 100 / 22 = 4,55
    ['weber-mix-692', 0.22, 10], // exactly 10: floating-point noise must not add a bag
    ['weber-mix-692', 0.2201, 11],
    ['sakret-be', 0.1, 8], // 100 / 13,6 = 7,35
    ['quick-mix-b03', 1, 50], // 1000 / 20
    ['sakret-tb-c35-f6', 0.129, 10],
  ])('%s for %s m³ → %s bags', (id, volume, bags) => {
    expect(bagCount(product(id), volume)).toBe(bags);
  });
});

describe('product data', () => {
  it.each([...BAG_PRODUCTS, POST_MIX].map((p) => [p.id, p] as const))('%s', (_id, p) => {
    expect(p.datasheet).toMatch(/^https:\/\//);
    expect(p.yieldL).toBeGreaterThan(0);
    expect(p.waterL).toBeGreaterThan(0);
    expect(p.bagKg).toBeGreaterThan(0);
    expect(p.maxGrain).toBeGreaterThan(0);
    expect(new Set(p.exposureClasses).size).toBe(p.exposureClasses.length);
    for (const c of p.exposureClasses) expect(EXPOSURE_CLASS_NAMES).toContain(c);
    if (p.strengthClass !== null) expect(isStrengthClass(p.strengthClass)).toBe(true);
    // A declared XC4 includes the milder XC classes (see BagProduct.exposureClasses).
    if (p.exposureClasses.includes('XC4')) expect(p.exposureClasses).toEqual(expect.arrayContaining(['XC1', 'XC2', 'XC3']));
    // About 20 l per 40 kg bag, 0,5 l/kg (R7), within a margin.
    expect(p.yieldL / p.bagKg).toBeGreaterThan(0.4);
    expect(p.yieldL / p.bagKg).toBeLessThan(0.6);
  });

  it('ids are unique and bagProduct finds each, including the post mix', () => {
    const all = [...BAG_PRODUCTS, POST_MIX];
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const p of all) expect(bagProduct(p.id)).toBe(p);
    expect(bagProduct('nope')).toBeUndefined();
    expect(bagProduct(undefined)).toBeUndefined();
  });

  it('every bag in the list declares a strength class; only the post mix has none', () => {
    for (const p of BAG_PRODUCTS) expect(p.strengthClass).not.toBeNull();
    expect(POST_MIX.strengthClass).toBeNull();
    expect(POST_MIX.structural).toBe(false);
  });

  it('no DIY bag declares a de-icing salt, XF2–XF4 or XM class (R1, R2)', () => {
    const salt: ExposureClass[] = ['XD1', 'XD2', 'XD3', 'XF2', 'XF3', 'XF4', 'XM1', 'XM2', 'XM3'];
    for (const p of BAG_PRODUCTS.filter((b) => b.channel === 'diy')) {
      expect(p.exposureClasses.filter((c) => salt.includes(c)), p.id).toEqual([]);
    }
  });

  it('the rules shown with every bag plan', () => {
    expect(BAG_RULES).toEqual(['water-as-stated', 'no-additions', 'temperature']);
  });
});

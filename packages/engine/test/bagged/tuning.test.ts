// The bag tool: additions to dry ready-mixed concrete (ported from tests/fine-tune.test.js,
// which drove the old page through JSDOM). The DOM, the BV ⊕ FM checkboxes and the app.js
// hand-off are UI concerns and not ported; the plasticiser is now one option, BV or FM.
//
// Change: the old page rounded additions per m³ (Math.round(z · share) · volume); tuneBag
// does not round, so c20 silica fume is 22,4 kg/m³ instead of 22, c30 27,2 instead of 27.
import { describe, expect, it } from 'vitest';
import { EXPOSURE_CLASSES } from '../../src/b20/exposure';
import { K_FLY_ASH, SILICA_FUME_MAX_FACTOR, waterWithPlasticizer } from '../../src/b20/materials';
import { STRENGTH_CLASSES, strengthFromWz } from '../../src/b20/strength';
import {
  ADDITION_SHARE, AIR_ENTRAINER_L, BAG_KG, BAG_MIXES, NO_OPTIONS, bagMix, bagMixFor, estimateFck, tuneBag,
  type BagOptions, type BagStep,
} from '../../src/bagged/tuning';

const c25 = bagMix('c25')!;
const opts = (o: Partial<BagOptions>): BagOptions => ({ ...NO_OPTIONS, ...o });
/** The step type for a kind; the dry additions share one member with a union of kinds. */
type StepOf<K extends BagStep['kind']> = BagStep extends infer S ? (S extends { kind: infer SK } ? (K extends SK ? S : never) : never) : never;
const step = <K extends BagStep['kind']>(steps: BagStep[], kind: K) =>
  steps.find((s): s is StepOf<K> => s.kind === kind);
/** f_ck ≈ f_cm − 8 of the plain bag mix, as the old page computed its base. */
const baseFck = (m = c25) => Math.round(strengthFromWz(m.water / m.cement, '42.5')! - 8);

describe('BAG_MIXES', () => {
  it('c20, c25, c30 (no DIY bag is C40/50, so c40 is gone)', () => {
    expect(BAG_MIXES.map((m) => [m.id, m.strengthClass])).toEqual([
      ['c20', 'C20/25'], ['c25', 'C25/30'], ['c30', 'C30/37'],
    ]);
    expect(bagMix('c40')).toBeUndefined();
  });

  it.each(BAG_MIXES.map((m) => [m.id, m] as const))('%s reaches its own class on the Walz curve', (_id, m) => {
    // c20: 26 ≥ 25, c25: 31 ≥ 30, c30: 39 ≥ 37 N/mm².
    expect(estimateFck(m, NO_OPTIONS)).toBeGreaterThanOrEqual(STRENGTH_CLASSES[m.strengthClass].fckCube);
  });

  it.each([
    // Old limits: c20 at XC1 (0,75), c25 below 0,70, c30 at XC4/XF1 (0,60).
    ['c20', 0.75],
    ['c25', 0.7],
    ['c30', EXPOSURE_CLASSES.XC4.maxWz],
  ] as const)('%s w/c stays within %s', (id, limit) => {
    const m = bagMix(id)!;
    expect(m.water / m.cement).toBeLessThanOrEqual(limit);
  });

  it('fly ash 15 % and silica fume 8 % stay within the B 20 ceilings (33 %, 11 % of the cement)', () => {
    expect(ADDITION_SHARE.flyAsh).toBeLessThanOrEqual(0.33);
    expect(ADDITION_SHARE.silicaFume).toBeLessThanOrEqual(SILICA_FUME_MAX_FACTOR);
  });

  it.each([
    ['C16/20', 'c20'], ['C20/25', 'c20'], ['C25/30', 'c25'], ['C30/37', 'c30'],
    // Above the strongest bag: the strongest one.
    ['C35/45', 'c30'],
  ] as const)('bagMixFor(%s) → %s', (cls, id) => {
    expect(bagMixFor(cls).id).toBe(id);
  });
});

describe('estimateFck', () => {
  it('base c25: w/c 0,633 → f_cm 38,7 → f_ck 31', () => {
    expect(estimateFck(c25, NO_OPTIONS)).toBe(31);
    expect(estimateFck(c25, NO_OPTIONS)).toBe(baseFck());
  });

  it.each<[string, Partial<BagOptions>]>([
    ['extra cement (lower effective w/c)', { extraCement: true }],
    ['fly ash (k = 0,4)', { flyAsh: true }],
    ['silica fume (k = 1,0)', { silicaFume: true }],
    ['BV (7 % less water)', { plasticizer: 'BV' }],
    ['FM (20 % less water)', { plasticizer: 'FM' }],
  ])('%s raises the estimate', (_name, o) => {
    expect(estimateFck(c25, opts(o))).toBeGreaterThan(baseFck());
  });

  it('exact values for c25', () => {
    expect(estimateFck(c25, opts({ extraCement: true }))).toBe(36);
    expect(estimateFck(c25, opts({ flyAsh: true }))).toBe(34);
    expect(estimateFck(c25, opts({ silicaFume: true }))).toBe(35);
    expect(estimateFck(c25, opts({ plasticizer: 'BV' }))).toBe(35);
    expect(estimateFck(c25, opts({ plasticizer: 'FM' }))).toBe(43);
  });

  it('8 % silica fume (k = 1,0) credits more binder than 15 % fly ash (k = 0,4)', () => {
    expect(ADDITION_SHARE.silicaFume * 1.0).toBeGreaterThan(ADDITION_SHARE.flyAsh * K_FLY_ASH);
    expect(estimateFck(c25, opts({ silicaFume: true }))).toBeGreaterThan(estimateFck(c25, opts({ flyAsh: true })));
  });

  it('FM raises more than BV', () => {
    expect(estimateFck(c25, opts({ plasticizer: 'FM' }))).toBeGreaterThan(estimateFck(c25, opts({ plasticizer: 'BV' })));
  });

  it('air costs about 14 N/mm² (4 % × 3,5)', () => {
    const fck = estimateFck(c25, opts({ air: true }));
    expect(fck).toBeLessThan(baseFck());
    expect(Math.abs(baseFck() - fck - 14)).toBeLessThanOrEqual(2);
  });

  it('extra cement + fly ash + silica + BV together: well above the base', () => {
    expect(estimateFck(c25, opts({ extraCement: true, flyAsh: true, silicaFume: true, plasticizer: 'BV' }))).toBeGreaterThan(baseFck() + 5);
  });

  it('air still lowers the estimate combined with strength additions', () => {
    const without = estimateFck(c25, opts({ extraCement: true, flyAsh: true, plasticizer: 'BV' }));
    expect(estimateFck(c25, opts({ extraCement: true, flyAsh: true, plasticizer: 'BV', air: true }))).toBeLessThan(without);
  });

  it('waterproofing does not change the estimate', () => {
    expect(estimateFck(c25, opts({ waterproofing: true }))).toBe(baseFck());
  });

  it('never below 8 N/mm²', () => {
    const weak = { id: 'c20' as const, strengthClass: 'C20/25' as const, cement: 150, water: 250, aggregate: 1900 };
    expect(estimateFck(weak, opts({ air: true }))).toBe(8);
  });
});

describe('tuneBag: amounts', () => {
  it('no addition: the bag mix, then water; the declared class and the base estimate stay', () => {
    const t = tuneBag(c25, 1, NO_OPTIONS);
    expect(t.steps.map((s) => s.kind)).toEqual(['mix', 'water']);
    expect(t.strengthClass).toBe('C25/30');
    // Base and result use the same Walz estimate, so the difference shows only the additions.
    expect(t.baseFckCube).toBe(31);
    expect(t.fckCube).toBe(31);
  });

  it('the base estimate does not change with the additions', () => {
    const plain = tuneBag(c25, 1, NO_OPTIONS);
    const tuned = tuneBag(c25, 1, { ...NO_OPTIONS, extraCement: true });
    expect(tuned.baseFckCube).toBe(plain.baseFckCube);
    expect(tuned.fckCube).toBeGreaterThan(tuned.baseFckCube);
  });

  it('bag mix step: cement + aggregate in 40 kg bags', () => {
    expect(BAG_KG).toBe(40);
    // (300 + 1800) × 1 m³ = 2100 kg = 52,5 bags. Old bagMixKg(preset, v) = tuneBag(...).steps[0].kg.
    expect(tuneBag(c25, 1, NO_OPTIONS).steps[0]).toEqual({ kind: 'mix', kg: 2100, bags: 52.5, strengthClass: 'C25/30' });
    expect(tuneBag(c25, 0.05, NO_OPTIONS).steps[0]).toMatchObject({ kg: 105, bags: 2.625 });
  });

  it.each([
    // share × cement per m³; the old page showed Math.round(...) of the same.
    ['c25', 'extraCement', 30],
    ['c25', 'flyAsh', 45],
    ['c25', 'silicaFume', 24],
    ['c25', 'waterproofing', 6],
    ['c30', 'extraCement', 34],
    ['c30', 'flyAsh', 51],
    // Not rounded any more: the old page gave 22 and 27 kg.
    ['c20', 'silicaFume', 22.4],
    ['c30', 'silicaFume', 27.2],
  ] as const)('%s %s: %s kg/m³', (id, kind, kg) => {
    const t = tuneBag(bagMix(id)!, 1, opts({ [kind]: true }));
    expect(step(t.steps, kind)?.kg).toBeCloseTo(kg, 10);
  });

  it('amounts scale with the volume', () => {
    const one = step(tuneBag(c25, 1, opts({ extraCement: true })).steps, 'extraCement')!.kg;
    const two = step(tuneBag(c25, 2, opts({ extraCement: true })).steps, 'extraCement')!.kg;
    expect(two).toBeCloseTo(2 * one, 10);
  });

  it('switching to a richer mix adds more cement (c30: 340 kg cement)', () => {
    const kg25 = step(tuneBag(c25, 1, opts({ extraCement: true })).steps, 'extraCement')!.kg;
    const kg30 = step(tuneBag(bagMix('c30')!, 1, opts({ extraCement: true })).steps, 'extraCement')!.kg;
    expect(kg30).toBeGreaterThan(kg25);
  });

  it('BV 0,5 l/m³, FM 0,2 l/m³, air-entraining agent 0,2 l/m³', () => {
    expect(step(tuneBag(c25, 1, opts({ plasticizer: 'BV' })).steps, 'plasticizer')).toEqual({ kind: 'plasticizer', type: 'BV', litres: 0.5 });
    expect(step(tuneBag(c25, 1, opts({ plasticizer: 'FM' })).steps, 'plasticizer')).toEqual({ kind: 'plasticizer', type: 'FM', litres: 0.2 });
    expect(AIR_ENTRAINER_L).toBe(0.2);
    expect(step(tuneBag(c25, 1, opts({ air: true })).steps, 'air')).toEqual({ kind: 'air', litres: 0.2 });
  });

  it('BV saves 7 % water (190 → 177 l), FM 20 % (190 → 152 l), air none', () => {
    expect(step(tuneBag(c25, 1, opts({ plasticizer: 'BV' })).steps, 'water')?.litres).toBe(177);
    expect(step(tuneBag(c25, 1, opts({ plasticizer: 'FM' })).steps, 'water')?.litres).toBe(152);
    expect(step(tuneBag(c25, 1, opts({ air: true })).steps, 'water')?.litres).toBe(190);
    expect(waterWithPlasticizer(190, 'FM')).toBeLessThan(190 * 0.85);
  });

  it('small volume 0,001 m³: 190 ml water, 177 ml with BV, never rounded to zero', () => {
    expect(step(tuneBag(c25, 0.001, opts({ extraCement: true })).steps, 'water')?.litres).toBeCloseTo(0.19, 10);
    expect(step(tuneBag(c25, 0.001, opts({ plasticizer: 'BV' })).steps, 'water')?.litres).toBeCloseTo(0.177, 10);
    expect(step(tuneBag(c25, 0.001, opts({ silicaFume: true })).steps, 'silicaFume')?.kg).toBeCloseTo(0.024, 10);
  });

  it('water step notes dissolved admixtures with a plasticiser or air, not with dry additions', () => {
    const water = (o: Partial<BagOptions>) => step(tuneBag(c25, 1, opts(o)).steps, 'water')?.withAdmixtures;
    expect(water({ plasticizer: 'BV' })).toBe(true);
    expect(water({ plasticizer: 'FM' })).toBe(true);
    expect(water({ air: true })).toBe(true);
    expect(water({ extraCement: true, flyAsh: true })).toBe(false);
    expect(water({})).toBe(false);
  });
});

describe('tuneBag: mixing order', () => {
  it('bag mix first, dry additions, admixtures, water last', () => {
    // As the old page with every box ticked (FM clears BV): mix + 5 additions + water = 7.
    const t = tuneBag(c25, 1, opts({ extraCement: true, flyAsh: true, silicaFume: true, plasticizer: 'FM', air: true }));
    expect(t.steps.map((s) => s.kind)).toEqual(['mix', 'extraCement', 'flyAsh', 'silicaFume', 'plasticizer', 'air', 'water']);
  });

  it('waterproofing is a dry addition, before silica fume', () => {
    const t = tuneBag(c25, 1, opts({ extraCement: true, flyAsh: true, silicaFume: true, waterproofing: true, plasticizer: 'BV', air: true }));
    expect(t.steps.map((s) => s.kind)).toEqual(['mix', 'extraCement', 'flyAsh', 'waterproofing', 'silicaFume', 'plasticizer', 'air', 'water']);
  });

  it('water is always last', () => {
    for (const o of [{}, { extraCement: true }, { plasticizer: 'BV' as const }, { air: true, silicaFume: true }]) {
      expect(tuneBag(c25, 1, opts(o)).steps.at(-1)?.kind).toBe('water');
      expect(tuneBag(c25, 1, opts(o)).steps[0]?.kind).toBe('mix');
    }
  });
});

describe('tuneBag: strength and warnings', () => {
  it('reports the estimate and its class: c25 + FM → 43 N/mm² → C30/37', () => {
    const t = tuneBag(c25, 1, opts({ plasticizer: 'FM' }));
    expect(t.fckCube).toBe(43);
    expect(t.strengthClass).toBe('C30/37');
  });

  it('air alone drops c25 to C12/15 (17 N/mm²)', () => {
    const t = tuneBag(c25, 1, opts({ air: true }));
    expect(t.fckCube).toBe(17);
    expect(t.strengthClass).toBe('C12/15');
  });

  it('air + silica fume warns (stiff mix, poor air voids)', () => {
    expect(tuneBag(c25, 1, opts({ air: true, silicaFume: true })).airWithSilicaFume).toBe(true);
    expect(tuneBag(c25, 1, opts({ air: true })).airWithSilicaFume).toBe(false);
    expect(tuneBag(c25, 1, opts({ silicaFume: true })).airWithSilicaFume).toBe(false);
  });
});

// Facts → exposure classes → mix (ported from the factsToValues tests of tests/describe.test.js).
// Expected classes follow DIN 1045-2 Tabelle 1 as implemented in requirementsFromFacts; minimum
// strength classes follow Zement-Merkblatt B 9 (EXPOSURE_CLASSES.minFckCube).
import { describe, expect, it } from 'vitest';
import type { ExposureClass } from '../../src/b20/exposure';
import { computeRecipe } from '../../src/b20/recipe';
import type { StrengthClass } from '../../src/b20/strength';
import type { Answers, Element } from '../../src/project/answers';
import {
  factsFromAnswers, minimumStrengthClass, requirementsFromFacts, type Facts, type Reason,
} from '../../src/project/requirements';

const noul = (p: number) => ({ noul: p });

/** Laya's answers for the eight facts, traffic and element. */
function answers({
  indoor = 0, rain = 0, ground = 0, frost = 0, salt = 0, horizontal = 0,
  reinforced = 0, watertight = 0, traffic = 0, element = 'slab' as Element,
} = {}): Answers {
  return {
    indoor_dry: noul(indoor), rain: noul(rain), ground: noul(ground), frost: noul(frost),
    deicing_salt: noul(salt), horizontal: noul(horizontal), reinforced: noul(reinforced),
    watertight: noul(watertight), traffic: { score: traffic }, element: { choice: element },
  };
}

const req = (a: Parameters<typeof answers>[0]) => requirementsFromFacts(factsFromAnswers(answers(a)));

describe('factsFromAnswers', () => {
  it('reads yes/no at 0,5', () => {
    const f = factsFromAnswers(answers({ frost: 0.5, salt: 0.49 }));
    expect(f.frost).toBe(true);
    expect(f.salt).toBe(false);
  });

  it('rain outdoes "indoor and dry"', () => {
    expect(factsFromAnswers(answers({ indoor: 0.9, rain: 0.9 })).indoor).toBe(false);
    expect(factsFromAnswers(answers({ indoor: 0.9 })).indoor).toBe(true);
  });

  it('rounds the traffic score and defaults the element to slab', () => {
    expect(factsFromAnswers({ traffic: { score: 2.4 } }).traffic).toBe(2);
    expect(factsFromAnswers({ traffic: { score: 2.6 } }).traffic).toBe(3);
    expect(factsFromAnswers({})).toEqual<Facts>({
      indoor: false, rain: false, ground: false, frost: false, salt: false, horizontal: false,
      reinforced: false, watertight: false, traffic: 0, element: 'slab',
    });
  });
});

describe('requirementsFromFacts (ported)', () => {
  it('driveway with frost and de-icing salt → XC4, XD3, XF4, XM1, LP, F2, C35/45', () => {
    const r = req({ rain: 1, frost: 1, salt: 1, horizontal: 1, reinforced: 1, traffic: 2, element: 'paving' });
    expect(r.exposureClasses).toEqual(['XC4', 'XD3', 'XF4', 'XM1']);
    expect(r.airEntrained).toBe(true);
    expect(r.mix.airPct).toBe(4); // B32: 4,0 % mean minimum air
    expect(r.mix.consistency).toBe('F2');
    expect(r.mix.strengthClass).toBe('C35/45'); // XD3 needs C35/45
    expect(r.reasons).toEqual(['xc4', 'xd3', 'xf4', 'xm1', 'lp']);
  });

  it('dry indoor wall, reinforced → XC1, B16, C20/25', () => {
    const r = req({ indoor: 1, reinforced: 1, element: 'wall' });
    expect(r.exposureClasses).toEqual(['XC1']);
    expect(r.mix.sieveLine).toBe('B16');
    expect(r.mix.strengthClass).toBe('C20/25');
  });

  it('unreinforced shed foundation in the ground → no XC class, frost → XF1', () => {
    const r = req({ ground: 1, frost: 1, element: 'foundation' });
    expect(r.exposureClasses).toEqual(['XF1']);
    expect(r.airEntrained).toBe(false);
    expect(r.mix.airPct).toBe(0);
    expect(r.mix.strengthClass).toBe('C25/30');
  });

  it('unreinforced dry indoor → X0', () => {
    const r = req({ indoor: 1 });
    expect(r.exposureClasses).toEqual(['X0']);
    // X0 needs only C8/10; the floor for plain concrete is C16/20.
    expect(r.mix.strengthClass).toBe('C16/20');
  });

  it('basement in groundwater → XC2 plus waterproofing admixture', () => {
    const r = req({ ground: 1, reinforced: 1, watertight: 1, element: 'wall' });
    expect(r.exposureClasses).toEqual(['XC2']);
    expect(r.watertight).toBe(true);
    expect(r.mix.waterproofingPct).toBe(2);
    expect(r.reasons).toEqual(['xc2', 'wu']);
  });
});

interface Case {
  name: string;
  facts: Parameters<typeof answers>[0];
  classes: ExposureClass[];
  strength: StrengthClass;
  air: boolean;
  reasons: Reason[];
}

describe('typical projects', () => {
  it.each<Case>([
    {
      // Plain concrete: no carbonation class (only reinforcement corrodes). Frost + salt on a
      // horizontal surface is XF4, cars on it XM1. XF4 and XM1 both need C30/37.
      name: 'unreinforced driveway with de-icing salt',
      facts: { rain: 1, frost: 1, salt: 1, horizontal: 1, traffic: 2, element: 'paving' },
      classes: ['XF4', 'XM1'], strength: 'C30/37', air: true, reasons: ['xf4', 'xm1', 'lp'],
    },
    {
      // In the ground → XC2 (wet, rarely dry); below the frost line, no XF. XC2 needs C16/20,
      // the reinforced floor C20/25 governs.
      name: 'reinforced basement wall in groundwater (WU: at least C25/30)',
      facts: { ground: 1, reinforced: 1, watertight: 1, element: 'wall' },
      classes: ['XC2'], strength: 'C25/30', air: false, reasons: ['xc2', 'wu'],
    },
    {
      // Dry inside → XC1 (C16/20), reinforced floor C20/25.
      name: 'reinforced indoor slab',
      facts: { indoor: 1, reinforced: 1, horizontal: 1 },
      classes: ['XC1'], strength: 'C20/25', air: false, reasons: ['xc1'],
    },
    {
      // Plain concrete indoors with foot traffic only: X0, the plain-concrete floor C16/20.
      name: 'unreinforced indoor floor',
      facts: { indoor: 1, horizontal: 1, traffic: 1 },
      classes: ['X0'], strength: 'C16/20', air: false, reasons: ['x0'],
    },
    {
      // Vertical, frost without salt → XF1 (C25/30, no air needed).
      name: 'unreinforced garden wall with frost',
      facts: { rain: 1, frost: 1, element: 'wall' },
      classes: ['XF1'], strength: 'C25/30', air: false, reasons: ['xf1'],
    },
    {
      // Rain → XC4 (C25/30), frost vertical → XF1 (C25/30).
      name: 'reinforced garden wall with rain and frost',
      facts: { rain: 1, frost: 1, reinforced: 1, element: 'wall' },
      classes: ['XC4', 'XF1'], strength: 'C25/30', air: false, reasons: ['xc4', 'xf1'],
    },
    {
      // Unreinforced outside without frost is X0: nothing attacks plain concrete.
      name: 'unreinforced outdoor slab without frost',
      facts: { rain: 1, horizontal: 1 },
      classes: ['X0'], strength: 'C16/20', air: false, reasons: ['x0'],
    },
    {
      // Outside, sheltered from rain (carport, open hall) → XC3 (C20/25).
      name: 'reinforced sheltered column',
      facts: { reinforced: 1 },
      classes: ['XC3'], strength: 'C20/25', air: false, reasons: ['xc3'],
    },
    {
      // Rain → XC4; horizontal frost without salt → XF3, air-entrained (C25/30 with LP instead
      // of C35/45 without).
      name: 'reinforced balcony',
      facts: { rain: 1, frost: 1, horizontal: 1, reinforced: 1 },
      classes: ['XC4', 'XF3'], strength: 'C25/30', air: true, reasons: ['xc4', 'xf3', 'lp'],
    },
    {
      // Salt spray on a vertical face: XD1 (C30/37) and XF2 (C25/30 with LP); XD1 governs.
      name: 'reinforced wall next to a salted road',
      facts: { rain: 1, frost: 1, salt: 1, reinforced: 1, element: 'wall' },
      classes: ['XC4', 'XD1', 'XF2'], strength: 'C30/37', air: true, reasons: ['xc4', 'xd1', 'xf2', 'lp'],
    },
    {
      // Heated garage: dry (XC1) but salt water dripping from cars on the floor → XD3 (C35/45),
      // cars → XM1. No frost inside.
      name: 'reinforced heated garage floor',
      facts: { indoor: 1, salt: 1, horizontal: 1, reinforced: 1, traffic: 2 },
      classes: ['XC1', 'XD3', 'XM1'], strength: 'C35/45', air: false, reasons: ['xc1', 'xd3', 'xm1'],
    },
    {
      // Forklifts → XM2 (C35/45), whatever the direction.
      name: 'reinforced warehouse floor with forklifts',
      facts: { indoor: 1, horizontal: 1, reinforced: 1, traffic: 3 },
      classes: ['XC1', 'XM2'], strength: 'C35/45', air: false, reasons: ['xc1', 'xm2'],
    },
    {
      // Cars on a vertical surface are no wear class: XM1 needs a horizontal surface.
      name: 'unreinforced ramp side wall',
      facts: { rain: 1, traffic: 2, element: 'wall' },
      classes: ['X0'], strength: 'C16/20', air: false, reasons: ['x0'],
    },
    {
      // Frost inside a dry building cannot happen: no XF.
      name: 'indoor piece answered with frost',
      facts: { indoor: 1, frost: 1, reinforced: 1 },
      classes: ['XC1'], strength: 'C20/25', air: false, reasons: ['xc1'],
    },
    {
      // Small horizontal outdoor piece: XF3 with LP → C25/30; B16 needs 4,5 % air.
      name: 'unreinforced bird bath',
      facts: { rain: 1, frost: 1, horizontal: 1, element: 'small' },
      classes: ['XF3'], strength: 'C25/30', air: true, reasons: ['xf3', 'lp'],
    },
  ])('$name → $classes, $strength', ({ facts, classes, strength, air, reasons }) => {
    const r = req(facts);
    expect(r.exposureClasses).toEqual(classes);
    expect(r.mix.exposureClasses).toEqual(classes);
    expect(r.mix.strengthClass).toBe(strength);
    expect(r.airEntrained).toBe(air);
    expect(r.reasons).toEqual(reasons);
  });

  it.each<[Element, 'B16' | 'B32', number]>([
    // Walls and small pieces get 16 mm grain and 4,5 % air (B 20 minimum air for 16 mm),
    // everything else 32 mm and 4,0 %.
    ['wall', 'B16', 4.5],
    ['small', 'B16', 4.5],
    ['slab', 'B32', 4.0],
    ['foundation', 'B32', 4.0],
    ['paving', 'B32', 4.0],
  ])('%s → %s, %s %% air when air-entrained', (element, sieveLine, airPct) => {
    const r = req({ rain: 1, frost: 1, horizontal: 1, element });
    expect(r.mix.sieveLine).toBe(sieveLine);
    expect(r.mix.airPct).toBe(airPct);
  });

  it('paving is stiffer (F2), everything else F3', () => {
    expect(req({ element: 'paving' }).mix.consistency).toBe('F2');
    expect(req({ element: 'slab' }).mix.consistency).toBe('F3');
  });

  // The WU-Richtlinie asks for at least C25/30 (docs/research/bagged-concrete.md, R5).
  it('watertight concrete is at least C25/30 (WU-Richtlinie)', () => {
    expect(req({ ground: 1, reinforced: 1, watertight: 1, element: 'wall' }).mix.strengthClass).toBe('C25/30');
    expect(req({ ground: 1, watertight: 1 }).mix.strengthClass).toBe('C25/30');
  });

  it('every mapped result goes through the B 20 mix design without error', () => {
    const combos = [
      { rain: 1, frost: 1, salt: 1, horizontal: 1, reinforced: 1, traffic: 2, element: 'paving' as Element },
      { indoor: 1, reinforced: 1, element: 'wall' as Element },
      { ground: 1, frost: 1, element: 'foundation' as Element },
      { ground: 1, reinforced: 1, watertight: 1, element: 'wall' as Element },
      { indoor: 1, reinforced: 1, horizontal: 1, traffic: 3 },
      { rain: 1, frost: 1, horizontal: 1, element: 'small' as Element },
      { rain: 1, frost: 1, salt: 1, horizontal: 1, traffic: 2, element: 'paving' as Element },
      { rain: 1, frost: 1, salt: 1, reinforced: 1, element: 'wall' as Element },
    ];
    for (const a of combos) {
      const r = req(a);
      const result = computeRecipe(r.mix);
      expect(result.ok, `recipe for ${r.exposureClasses.join(', ')}`).toBe(true);
      if (!result.ok) continue;
      const { recipe } = result;
      expect(recipe.materials.cement).toBeGreaterThanOrEqual(recipe.limits.minCement);
      // The planned air reaches the minimum, so XF2/XF3 may use their air-entrained limits.
      expect(recipe.airEntrained).toBe(r.airEntrained);
      expect(recipe.warnings.map((w) => w.code)).not.toContain('strength-below-exposure');
    }
  });
});

describe('minimumStrengthClass', () => {
  it.each<[ExposureClass[], StrengthClass, boolean, StrengthClass]>([
    [['X0'], 'C16/20', false, 'C16/20'],
    [['XC1'], 'C20/25', false, 'C20/25'],
    [['XC4'], 'C20/25', false, 'C25/30'],
    // XF2/XF3 need C35/45 without air, C25/30 with it (B 9 Tafel 8).
    [['XF3'], 'C16/20', false, 'C35/45'],
    [['XF3'], 'C16/20', true, 'C25/30'],
    [['XF2'], 'C16/20', true, 'C25/30'],
    // XF4 has no air-free alternative in the table: C30/37 either way.
    [['XF4'], 'C16/20', true, 'C30/37'],
    [['XC4', 'XD3'], 'C20/25', false, 'C35/45'],
    [[], 'C20/25', false, 'C20/25'],
  ])('%j, floor %s, air %s → %s', (classes, floor, air, expected) => {
    expect(minimumStrengthClass(classes, floor, air)).toBe(expected);
  });
});

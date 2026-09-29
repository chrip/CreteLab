// Ordering ready-mixed concrete: the specification a plant needs (DIN EN 206 / DIN 1045-2, 6.2).
import { describe, expect, it } from 'vitest';
import type { ExposureClass } from '../../src/b20/exposure';
import { DEFAULT_MIX, type MixInput } from '../../src/b20/recipe';
import { ORDER_SENSIBLE_FROM_M3, moistureClass, orderLine, orderSpec, type MoistureClass } from '../../src/order/order';
import { factsFromAnswers, requirementsFromFacts } from '../../src/project/requirements';

const mix = (m: Partial<MixInput>): MixInput => ({ ...DEFAULT_MIX, ...m });

describe('moistureClass (Alkali-Richtlinie)', () => {
  it.each<[ExposureClass[], boolean, MoistureClass]>([
    // Dry inside: WO.
    [['XC1'], false, 'WO'],
    [['X0'], false, 'WO'],
    // Often wet outside or in the ground: WF.
    [['XC4', 'XF1'], false, 'WF'],
    [['XC2'], false, 'WF'],
    [['XF3'], false, 'WF'],
    [['XA1'], false, 'WF'],
    // Sheltered outside or damp rooms: WF (conservative, XC3 includes high humidity indoors).
    [['XC3'], false, 'WF'],
    // Salt from outside: WA; with heavy traffic WS.
    [['XF4', 'XM1'], false, 'WA'],
    [['XC4', 'XD1'], false, 'WA'],
    [['XF2'], false, 'WA'],
    [['XS1'], false, 'WA'],
    [['XC4', 'XD3', 'XF4', 'XM2'], true, 'WS'],
    // Heavy traffic without salt stays WF or WO.
    [['XC1', 'XM2'], true, 'WO'],
    [['XC4', 'XM2'], true, 'WF'],
  ])('%j, heavy traffic %s → %s', (classes, heavy, expected) => {
    expect(moistureClass(classes, heavy)).toBe(expected);
  });
});

describe('orderSpec', () => {
  it('reinforced → Cl 0,40, plain → Cl 1,00', () => {
    expect(orderSpec(DEFAULT_MIX, 3, { reinforced: true }).chlorideClass).toBe('Cl 0,40');
    expect(orderSpec(DEFAULT_MIX, 3, { reinforced: false }).chlorideClass).toBe('Cl 1,00');
  });

  it('copies strength, exposure and consistency, and reads Dmax from the sieve line', () => {
    const spec = orderSpec(mix({ strengthClass: 'C30/37', exposureClasses: ['XF4', 'XM1'], consistency: 'F2', sieveLine: 'B16' }), 4, { reinforced: false });
    expect(spec).toMatchObject({ strengthClass: 'C30/37', exposureClasses: ['XF4', 'XM1'], consistency: 'F2', maxGrain: 16, moistureClass: 'WA' });
    expect(orderSpec(mix({ sieveLine: 'B32' }), 4, { reinforced: false }).maxGrain).toBe(32);
    expect(orderSpec(mix({ sieveLine: 'A8' }), 4, { reinforced: false }).maxGrain).toBe(8);
  });

  it('heavy traffic with salt → WS', () => {
    expect(orderSpec(mix({ exposureClasses: ['XF4', 'XM2'] }), 4, { reinforced: false, heavyTraffic: true }).moistureClass).toBe('WS');
  });

  it('air content only when air-entrained', () => {
    expect(orderSpec(mix({ airPct: 4 }), 2, { reinforced: false }).airPct).toBe(4);
    expect(orderSpec(mix({ airPct: 0 }), 2, { reinforced: false }).airPct).toBeNull();
  });

  it('watertight from the option or from a waterproofing admixture', () => {
    expect(orderSpec(DEFAULT_MIX, 2, { reinforced: true }).watertight).toBe(false);
    expect(orderSpec(DEFAULT_MIX, 2, { reinforced: true, watertight: true }).watertight).toBe(true);
    expect(orderSpec(mix({ waterproofingPct: 2 }), 2, { reinforced: true }).watertight).toBe(true);
  });

  it.each([
    // Rounded up to half cubic metres, at least 0,5 m³.
    [0.01, 0.5],
    [0.1, 0.5],
    [0.5, 0.5],
    [0.51, 1],
    [1, 1],
    [1.2, 1.5],
    [2, 2],
    [2.01, 2.5],
    [3.75, 4],
  ])('%s m³ → order %s m³', (volume, ordered) => {
    expect(orderSpec(DEFAULT_MIX, volume, { reinforced: false }).orderVolume).toBe(ordered);
  });

  it('below 1 m³ is below the typical minimum', () => {
    expect(ORDER_SENSIBLE_FROM_M3).toBe(1);
    expect(orderSpec(DEFAULT_MIX, 0.99, { reinforced: false }).belowTypicalMinimum).toBe(true);
    expect(orderSpec(DEFAULT_MIX, 1, { reinforced: false }).belowTypicalMinimum).toBe(false);
  });
});

describe('orderLine', () => {
  it('reinforced garden wall foundation with rain and frost: "C25/30 · XC4, XF1 · WF · F3 · Dmax 32 mm · Cl 0,40"', () => {
    const r = requirementsFromFacts(factsFromAnswers({
      rain: { noul: 1 }, frost: { noul: 1 }, reinforced: { noul: 1 }, element: { choice: 'foundation' },
    }));
    expect(orderLine(orderSpec(r.mix, 1.2, { reinforced: true }))).toBe('C25/30 · XC4, XF1 · WF · F3 · Dmax 32 mm · Cl 0,40');
  });

  it('unreinforced driveway with salt: "C30/37 · XF4, XM1 · WA · F2 · Dmax 32 mm · Cl 1,00"', () => {
    const r = requirementsFromFacts(factsFromAnswers({
      rain: { noul: 1 }, frost: { noul: 1 }, deicing_salt: { noul: 1 }, horizontal: { noul: 1 },
      traffic: { score: 2 }, element: { choice: 'paving' },
    }));
    expect(orderLine(orderSpec(r.mix, 3.75, { reinforced: false }))).toBe('C30/37 · XF4, XM1 · WA · F2 · Dmax 32 mm · Cl 1,00');
  });

  it('indoor wall: "C20/25 · XC1 · WO · F3 · Dmax 16 mm · Cl 0,40"', () => {
    const r = requirementsFromFacts(factsFromAnswers({ indoor_dry: { noul: 1 }, reinforced: { noul: 1 }, element: { choice: 'wall' } }));
    expect(orderLine(orderSpec(r.mix, 2, { reinforced: true }))).toBe('C20/25 · XC1 · WO · F3 · Dmax 16 mm · Cl 0,40');
  });
});

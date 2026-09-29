/**
 * Ground truth: the worked examples of Zement-Merkblatt B 20 "Zusammensetzung von
 * Normalbeton – Mischungsberechnung", Ausgabe 2.2017 (InformationsZentrum Beton,
 * Biscoping/Kampen), and Heidelberg Materials "Betontechnische Daten", Ausgabe 2022.
 *
 *   B 20: https://www.beton.org/fileadmin/beton-org/media/Dokumente/PDF/Service/Zementmerkbl%C3%A4tter/B20.pdf
 *   BTD:  https://www.heidelbergmaterials.de/sites/default/files/2023-03/Betontechnische%20Daten%20von%20Heidelberg%20Materials%20Ausgabe%202022_1.pdf
 *
 * Every expected value is copied from the printed example (page numbers of the PDF).
 * Each step is fed the source's own intermediate values, so a failure points at one step.
 * Tolerances only absorb the source's rounding (it prints integers or one decimal).
 */
import { describe, it, expect } from 'vitest';
import {
  AGGREGATES, AIR_STRENGTH_LOSS_PER_PCT, CRUSHED_WATER_FACTOR, DEFAULT_MIX, GRADINGS, SIEVE_LINES,
  SIEVE_LINE_PASSING, addedWater, distributeAggregate, equivalentWz, targetStrength, waterDemand,
  waterWithAddedAir, waterWithPlasticizer, type SieveLine,
} from '../../src/index';
import { aggregateMass, near } from './helpers';

describe('B 20 Beispiel I (p. 13–14): XC1, C20/25, F3, B32, CEM II 42,5 N', () => {
  it('water demand by formula: w = 1 300/(4,20 + 3) = 181 l/m³', () => {
    near(waterDemand('B32', 'F3'), 181, 0.5, 'B32/F3');
  });

  it('target strength: 25/0,92 + 1,48·3 + 3 ≥ 34,6 N/mm² (σ = 3, Vorhaltemaß 3 → margin 7,44)', () => {
    near(targetStrength(25, 1.48 * 3 + 3), 34.6, 0.05, 'fcm,dry,cube');
  });

  it('Stoffraum: g = (1 000 − 279/3,0 − 190 − 18) · 2,65 = 1 852 kg/m³', () => {
    expect(aggregateMass({ z: 279, rhoZ: 3.0, w: 190, p: 18, rhoG: 2.65 })).toBe(1852);
  });

  it('grain groups B32 (37/25/38 %) with 4,5/3,0/2,0 % moisture: 685/463/704 kg dry', () => {
    const groups = distributeAggregate(1852, 'B32', [4.5, 3.0, 2.0]);
    expect(groups.map((g) => g.pct)).toEqual([37, 25, 38]);
    expect(groups.map((g) => g.massDry)).toEqual([685, 463, 704]);
    near(groups.reduce((s, g) => s + g.massMoist, 0), 1910.8, 1.5, 'wet aggregate');
  });

  it('added water (Zugabewasser): 190 l − 58,8 l = 131,2 l', () => {
    near(addedWater(190, distributeAggregate(1852, 'B32', [4.5, 3.0, 2.0])), 131.2, 0.5, 'added water');
  });

  it('fines content (Mehlkorngehalt): 279 + 0,04 · 1 852 = 353,1 kg/m³', () => {
    near(279 + GRADINGS.B32.fines0125 * 1852, 353.1, 0.05, 'fines');
  });
});

describe('B 20 Beispiel II (p. 14–15): A/B16, crushed aggregate (Splitt), BV 7 %', () => {
  it('k-value A/B16 = (4,60 + 3,66)/2 = 4,13', () => {
    near((SIEVE_LINES.A16.k + SIEVE_LINES.B16.k) / 2, 4.13, 0.005, 'k mean');
    expect(SIEVE_LINES['A/B16'].k).toBe(4.13);
  });

  it('water demand by formula ≈ 183 l/m³', () => {
    near(waterDemand('A/B16', 'F3'), 183, 1, 'A/B16/F3');
  });

  it('crushed aggregate: w = 1,1 · 190 = 209 l', () => {
    near(190 * CRUSHED_WATER_FACTOR, 209, 0.05, 'crushed');
  });

  it('BV 7 %: w = 0,93 · 209 = 195 l (source rounds 194,4 up)', () => {
    near(waterWithPlasticizer(209, 'BV'), 195, 1, 'BV');
  });

  it('Stoffraum with mixed densities: g = 1 816 kg/m³', () => {
    expect(aggregateMass({ z: 287, rhoZ: 3.0, w: 195, p: 18, rhoG: 0.45 * 2.63 + 0.08 * 2.7 + 0.47 * 2.61 })).toBe(1816);
  });
});

describe('B 20 Beispiel III (p. 15–18): B16, F2, CEM I 52,5 R, BV, with and without air entrainment', () => {
  it('water: 1 200/(3,66 + 3) = 180 → crushed 198 → BV 184 l', () => {
    near(waterDemand('B16', 'F2'), 180, 0.5, 'formula');
    expect(waterWithPlasticizer(waterDemand('B16', 'F2') * CRUSHED_WATER_FACTOR, 'BV')).toBe(184);
  });

  it('Variante 1 Stoffraum: g = (1 000 − 383/3,1 − 184 − 18) · ρg = 1 800 kg/m³', () => {
    near(aggregateMass({ z: 383, rhoZ: 3.1, w: 184, p: 18, rhoG: 0.18 * 2.75 + 0.82 * 2.65 }), 1800, 1, 'g');
  });

  it('Variante 2 air-entrained water: 184 − (4,5 − 1,5) · 5 = 169 l (only the added air saves water)', () => {
    near(waterWithAddedAir(184, 4.5 - 1.5), 169, 0.05, 'LP water');
  });

  it('Variante 2 Stoffraum with 45 dm³ air: g = 1 813 kg/m³', () => {
    expect(aggregateMass({ z: 327, rhoZ: 3.1, w: 170, p: 45, rhoG: 0.18 * 2.75 + 0.82 * 2.65 })).toBe(1813);
  });

  it('air strength loss: 1 Vol.-% → −3,5 N/mm² (Tafel 7)', () => {
    expect(60 - 1 * AIR_STRENGTH_LOSS_PER_PCT).toBe(56.5);
    expect(60 - 3 * AIR_STRENGTH_LOSS_PER_PCT).toBe(49.5);
  });
});

describe('B 20 Beispiel IV (p. 18–20): A/B16, CEM III/A 42,5 N, fly ash k = 0,4, BV 10 %', () => {
  it('Ansatz A: (w/z)eq = 158/(282 + 0,4 · 40) = 0,53', () => {
    near(equivalentWz(158, 282, 40, 0), 0.53, 0.005, '(w/z)eq');
  });

  it('Ansatz A Stoffraum: g = (1 000 − 282/3,0 − 158 − 40/2,32 − 20) · ρg = 1 853 kg/m³', () => {
    expect(aggregateMass({ z: 282, rhoZ: 3.0, w: 158, f: 40, p: 20, rhoG: 0.38 * 2.61 + 0.22 * 2.65 + 0.4 * 2.58 }))
      .toBe(1853);
  });

  it('Ansatz B Stoffraum: g = (1 000 − 307/3,0 − 171 − 40/2,32 − 20) · ρg = 1 797 kg/m³', () => {
    expect(aggregateMass({ z: 307, rhoZ: 3.0, w: 171, f: 40, p: 20, rhoG: 0.38 * 2.61 + 0.22 * 2.65 + 0.4 * 2.58 }))
      .toBe(1797);
  });

  it('grain groups A/B16 (38/22/40 %) with 5/3/1 % moisture: 704/408/741 kg, added water 103,2 l', () => {
    const groups = distributeAggregate(1853, 'A/B16', [5.0, 3.0, 1.0]);
    expect(groups.map((g) => g.massDry)).toEqual([704, 408, 741]);
    near(addedWater(158, groups), 103.2, 0.5, 'added water');
  });
});

describe('B 20 Beispiel 5 (p. 5): maximum fly ash', () => {
  it('z = 328/(1 + 0,4 · 0,33) = 290, f = 96, (w/z)eq = 190/(290 + 0,4 · 96) = 0,58', () => {
    const z = Math.round(328 / (1 + 0.4 * 0.33));
    expect(z).toBe(290);
    expect(Math.round(0.33 * z)).toBe(96);
    near(equivalentWz(190, 290, 96, 0), 0.58, 0.005, '(w/z)eq');
  });
});

describe('B 20 Beispiel 3 (p. 3) and BTD 2022 Beispiel 1 (p. 163): Stoffraum', () => {
  it('B 20: z = 300/3,0, w = 150, p = 20, ρg = 2,65 → Vg = 730 dm³, g = 1 935 kg', () => {
    // The example lists ρg = 2,60 under "Gegeben" but calculates with 2,65, the density of
    // quartz gravel in the engine.
    const rhoG = AGGREGATES['quartz-gravel'].density;
    expect(rhoG).toBe(2.65);
    expect(1000 - 300 / 3.0 - 150 - 20).toBe(730); // "Vg = 1 000 - 270 = 730 dm3"
    expect(aggregateMass({ z: 300, rhoZ: 3.0, w: 150, p: 20, rhoG })).toBe(1935); // "g = 730 ∙ 2,65 = 1 935 kg"
  });

  it('BTD: g = (1 000 − 300/3,0 − 60/2,4 − 170 − 15) · 2,6 = 1 794 kg/m³', () => {
    expect(aggregateMass({ z: 300, rhoZ: 3.0, w: 170, f: 60, rhoF: 2.4, p: 15, rhoG: 2.6 })).toBe(1794);
  });
});

describe('B 20 Tafel 3 (p. 2): k-values and D-sums of the sieve lines', () => {
  // D is the sum of the passing percentages; with the nine sieves of Tafel 3 it is 900 − 100·k.
  const TAFEL_3: Record<string, [number, number]> = {
    A32: [5.48, 352], B32: [4.2, 480], C32: [3.3, 570],
    A16: [4.6, 440], B16: [3.66, 534], C16: [2.75, 625],
    A8: [3.63, 537], B8: [2.9, 610], C8: [2.27, 673],
  };
  for (const [line, [k, dSum]] of Object.entries(TAFEL_3)) {
    it(`${line}: k = ${k}, D = ${dSum}`, () => {
      const data = SIEVE_LINES[line as SieveLine];
      expect(data.k).toBe(k);
      expect(Math.round(900 - 100 * data.k)).toBe(dSum);
    });
  }
});

describe('DIN sieve lines reproduce B 20 Tafel 3 and drive the grain groups', () => {
  for (const [line, passing] of Object.entries(SIEVE_LINE_PASSING)) {
    const { k } = SIEVE_LINES[line as SieveLine];
    it(`${line}: residues sum to k = ${k}`, () => {
      const sum = passing.filter((p) => p < 100).reduce((s, p) => s + (100 - p), 0) / 100;
      expect(Math.round(sum * 100) / 100).toBe(k);
    });
  }

  it('B16 splits 42/34/24 % (passing 42 % at 2 mm, 76 % at 8 mm), not the A/B16 mix', () => {
    expect(GRADINGS.B16.groups.map((g) => g.pct)).toEqual([42, 34, 24]);
    expect(GRADINGS.B16.groups).not.toEqual(GRADINGS['A/B16'].groups);
  });

  it('A32 is coarse: only 14 % sand 0/2', () => {
    expect(GRADINGS.A32.groups[0]?.pct).toBe(14);
  });
});

describe('B 20 section 6.2: Vorhaltemaß without known standard deviation', () => {
  // "Bei bekannter Standardabweichung ... kann ein Vorhaltemaß v an der unteren Grenze
  //  gewählt werden (3 bis 6 N/mm²), anderenfalls sollte es sich im oberen Bereich
  //  befinden (9 bis 12 N/mm²)." Hobby users never know σ, so the default is 9.
  it('the default mix uses v = 9 N/mm²', () => {
    expect(DEFAULT_MIX.margin).toBe(9);
  });
});

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
 *
 * Not covered here, because CreteLab currently deviates from the source (see PR notes):
 * the Walz curves (Bild 1), air entrainment as total vs. added air and its strength
 * loss in the target strength, grain splits of sieve lines other than B32, and the
 * fly-ash limit for slag cements.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { calculateWaterDemand, calculateAverageK, adjustForAggregateType, SIEBLINIES } from '../js/lib/consistency.js';
import { calculateTargetStrengthWithMargin } from '../js/lib/strength.js';
import { applyAdmixtureWaterReduction, adjustForAirEntraining, calculateStrengthReduction,
         calculateEquivalentWzWithBoth } from '../js/lib/additives.js';
import { distributeAggregateBySiebline, calculateZugabewasser, getFinesFraction } from '../js/lib/aggregate-gradation.js';
import { stofraumrechnung } from '../js/lib/densities.js';

const near = (actual, expected, tol, what) =>
    assert.ok(Math.abs(actual - expected) <= tol, `${what}: expected ${expected} ± ${tol}, got ${actual}`);

// Stoffraumrechnung as printed in B 20: g = (1000 − z/ρz − w/ρw − f/ρf − p) · ρg
const aggregateMass = ({ z, rhoZ, w, f = 0, rhoF = 2.32, p, rhoG }) =>
    Math.round((1000 - z / rhoZ - w / 1.0 - f / rhoF - p) * rhoG);

describe('B 20 Beispiel I (p. 13–14): XC1, C20/25, F3, B32, CEM II 42,5 N', () => {
    it('water demand by formula: w = 1 300/(4,20 + 3) = 181 l/m³', () => {
        near(calculateWaterDemand('B32', 'F3'), 181, 0.5, 'B32/F3');
    });

    it('target strength: 25/0,92 + 1,48·3 + 3 ≥ 34,6 N/mm² (σ = 3, Vorhaltemaß 3 → margin 7,44)', () => {
        near(calculateTargetStrengthWithMargin(25, 0, 1.48 * 3 + 3), 34.6, 0.05, 'fcm,dry,cube');
    });

    it('Stoffraum: g = (1 000 − 279/3,0 − 190 − 18) · 2,65 = 1 852 kg/m³', () => {
        assert.strictEqual(aggregateMass({ z: 279, rhoZ: 3.0, w: 190, p: 18, rhoG: 2.65 }), 1852);
    });

    it('grain groups B32 (37/25/38 %) with 4,5/3,0/2,0 % moisture: 685/463/704 kg dry', () => {
        const kg = distributeAggregateBySiebline(1852, 'B32', [4.5, 3.0, 2.0]);
        assert.deepStrictEqual(kg.map(g => g.massDry), [685, 463, 704]);
        near(kg.reduce((s, g) => s + g.massMoist, 0), 1910.8, 1.5, 'wet aggregate');
    });

    it('Zugabewasser: 190 l − 58,8 l = 131,2 l', () => {
        near(calculateZugabewasser(190, distributeAggregateBySiebline(1852, 'B32', [4.5, 3.0, 2.0])), 131.2, 0.5, 'wzugabe');
    });

    it('Mehlkorngehalt: 279 + 0,04 · 1 852 = 353,1 kg/m³', () => {
        near(279 + getFinesFraction('B32') * 1852, 353.1, 0.05, 'Mehlkorn');
    });
});

describe('B 20 Beispiel II (p. 14–15): A/B16, Splitt, BV 7 %', () => {
    it('k-value A/B16 = (4,60 + 3,66)/2 = 4,13', () => {
        near(calculateAverageK('A16', 'B16'), 4.13, 0.005, 'k');
    });

    it('water demand by formula ≈ 183 l/m³', () => {
        near(calculateWaterDemand('A/B16', 'F3'), 183, 1, 'A/B16/F3');
    });

    it('Splitt: w = 1,1 · 190 = 209 l', () => {
        near(adjustForAggregateType(190, true), 209, 0.05, 'Splitt');
    });

    it('BV 7 %: w = 0,93 · 209 = 195 l (source rounds 194,4 up)', () => {
        near(applyAdmixtureWaterReduction(209, 'BV'), 195, 1, 'BV');
    });

    it('Stoffraum with mixed densities: g = 1 816 kg/m³', () => {
        assert.strictEqual(aggregateMass({ z: 287, rhoZ: 3.0, w: 195, p: 18,
            rhoG: 0.45 * 2.63 + 0.08 * 2.70 + 0.47 * 2.61 }), 1816);
    });
});

describe('B 20 Beispiel III (p. 15–18): B16, F2, CEM I 52,5 R, BV, with and without LP', () => {
    it('water: 1 200/(3,66 + 3) = 180 → Splitt 198 → BV 184 l', () => {
        near(calculateWaterDemand('B16', 'F2'), 180, 0.5, 'formula');
        assert.strictEqual(applyAdmixtureWaterReduction(adjustForAggregateType(calculateWaterDemand('B16', 'F2'), true), 'BV'), 184);
    });

    it('Variante 1 Stoffraum: g = (1 000 − 383/3,1 − 184 − 18) · ρg = 1 800 kg/m³', () => {
        near(aggregateMass({ z: 383, rhoZ: 3.1, w: 184, p: 18, rhoG: 0.18 * 2.75 + 0.82 * 2.65 }), 1800, 1, 'g');
    });

    it('Variante 2 LP water: 184 − (4,5 − 1,5) · 5 = 169 l (saving counts the added air only)', () => {
        near(adjustForAirEntraining(184, 4.5 - 1.5), 169, 0.05, 'LP water');
    });

    it('Variante 2 Stoffraum with 45 dm³ air: g = 1 813 kg/m³', () => {
        assert.strictEqual(aggregateMass({ z: 327, rhoZ: 3.1, w: 170, p: 45, rhoG: 0.18 * 2.75 + 0.82 * 2.65 }), 1813);
    });

    it('LP strength loss: 1 Vol.-% → −3,5 N/mm² (Tafel 7)', () => {
        assert.strictEqual(calculateStrengthReduction(60, 1), 56.5);
        assert.strictEqual(calculateStrengthReduction(60, 3), 49.5);
    });
});

describe('B 20 Beispiel IV (p. 18–20): A/B16, CEM III/A 42,5 N, fly ash k = 0,4, BV 10 %', () => {
    it('Ansatz A: (w/z)eq = 158/(282 + 0,4 · 40) = 0,53', () => {
        near(calculateEquivalentWzWithBoth(158, 282, 40, 0), 0.53, 0.005, '(w/z)eq');
    });

    it('Ansatz A Stoffraum: g = (1 000 − 282/3,0 − 158 − 40/2,32 − 20) · ρg = 1 853 kg/m³', () => {
        assert.strictEqual(aggregateMass({ z: 282, rhoZ: 3.0, w: 158, f: 40, p: 20,
            rhoG: 0.38 * 2.61 + 0.22 * 2.65 + 0.40 * 2.58 }), 1853);
    });

    it('Ansatz B Stoffraum: g = (1 000 − 307/3,0 − 171 − 40/2,32 − 20) · ρg = 1 797 kg/m³', () => {
        assert.strictEqual(aggregateMass({ z: 307, rhoZ: 3.0, w: 171, f: 40, p: 20,
            rhoG: 0.38 * 2.61 + 0.22 * 2.65 + 0.40 * 2.58 }), 1797);
    });

    it('grain groups A/B16 (38/22/40 %) with 5/3/1 % moisture: 704/408/741 kg, Zugabewasser 103,2 l', () => {
        const kg = distributeAggregateBySiebline(1853, 'A/B16', [5.0, 3.0, 1.0]);
        assert.deepStrictEqual(kg.map(g => g.massDry), [704, 408, 741]);
        near(calculateZugabewasser(158, kg), 103.2, 0.5, 'wzugabe');
    });
});

describe('B 20 Beispiel 5 (p. 5): maximum fly ash', () => {
    it('z = 328/(1 + 0,4 · 0,33) = 290, f = 96, (w/z)eq = 190/(290 + 0,4 · 96) = 0,58', () => {
        const z = Math.round(328 / (1 + 0.4 * 0.33));
        assert.strictEqual(z, 290);
        assert.strictEqual(Math.round(0.33 * z), 96);
        near(calculateEquivalentWzWithBoth(190, 290, 96, 0), 0.58, 0.005, '(w/z)eq');
    });
});

describe('B 20 Beispiel 3 (p. 3) and BTD 2022 Beispiel 1 (p. 163): Stoffraum', () => {
    it('B 20: z = 300/3,0, w = 150, p = 20, ρg = 2,65 → g = 1 935 kg (lib default aggregate)', () => {
        // The example lists ρg = 2,60 under "Gegeben" but calculates with 2,65 — so does the lib.
        const r = stofraumrechnung(300, 150, 20, 'Kiessand (Quarz)');
        assert.strictEqual(r.aggregate_volume, 730);   // "Vg = 1 000 - 270 = 730 dm3"
        assert.strictEqual(r.aggregate_mass, 1935);    // "g = 730 ∙ 2,65 = 1 935 kg"
    });

    it('BTD: g = (1 000 − 300/3,0 − 60/2,4 − 170 − 15) · 2,6 = 1 794 kg/m³', () => {
        assert.strictEqual(aggregateMass({ z: 300, rhoZ: 3.0, w: 170, f: 60, rhoF: 2.4, p: 15, rhoG: 2.6 }), 1794);
    });
});

describe('B 20 Tafel 3 (p. 2): k-values and D-sums of the sieve lines', () => {
    const TAFEL_3 = {
        A32: [5.48, 352], B32: [4.20, 480], C32: [3.30, 570],
        A16: [4.60, 440], B16: [3.66, 534], C16: [2.75, 625],
        A8:  [3.63, 537], B8:  [2.90, 610], C8:  [2.27, 673]
    };
    for (const [line, [k, dSum]] of Object.entries(TAFEL_3)) {
        it(`${line}: k = ${k}, D = ${dSum}`, () => {
            assert.strictEqual(SIEBLINIES[line].k, k);
            assert.strictEqual(SIEBLINIES[line].dSum, dSum);
        });
    }
});

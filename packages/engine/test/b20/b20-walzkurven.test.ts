/**
 * Walz curves (Zement-Merkblatt B 20, Bild 1): mean compressive strength over w/c for the
 * cement strength classes, f = A · e^(−b · w/z).
 *
 * A is fitted to the MEAN curve of Bild 1. The Vorhaltemaß v is the only statistical
 * safety margin per B 20; σ is not added separately.
 */
import { describe, it, expect } from 'vitest';
import bild1 from '../fixtures/b20-bild1-points.json';
import {
  WALZ_CURVES, targetStrength, strengthFromWz, waterDemand, wzFromStrength, type CementStrengthKey,
} from '../../src/index';
import { recipeFor } from './helpers';

const BILD_1 = bild1 as unknown as { curves: Record<string, [number, number][]> };

describe('Cement strength classes (Walz curves f = A · e^(−b · w/z))', () => {
  it('32,5 / 42,5 / 52,5 use A = 127 / 156 / 187 and a common b = 2,2', () => {
    expect([WALZ_CURVES['32.5'].A, WALZ_CURVES['42.5'].A, WALZ_CURVES['52.5'].A]).toEqual([127, 156, 187]);
    for (const curve of Object.values(WALZ_CURVES)) expect(curve.b).toBe(2.2);
  });

  it('B 20 Bild 1 has one curve per strength class, so R cements share it', () => {
    expect(WALZ_CURVES['42.5R']).toEqual(WALZ_CURVES['42.5']);
    expect(WALZ_CURVES['52.5R']).toEqual(WALZ_CURVES['52.5']);
  });
});

describe('Walz curves match B 20 Bild 1', () => {
  for (const [cls, points] of Object.entries(BILD_1.curves)) {
    it(`${cls}: within 1,2 N/mm² of the ${points.length} digitised chart points`, () => {
      for (const [wz, fc] of points) {
        const f = strengthFromWz(wz, cls as CementStrengthKey);
        expect(Math.abs((f ?? NaN) - fc), `w/z ${wz}: chart ${fc}, model ${f}`).toBeLessThanOrEqual(1.2);
      }
    });
  }

  // w/c values the B 20 / BTD examples read from the chart (independent of the fit)
  const READINGS: [CementStrengthKey, number, number, string][] = [
    ['42.5', 35, 0.68, 'B 20 Beispiel I/II'],
    ['42.5', 37, 0.65, 'B 20 Beispiel 4 (arrow in Bild 1)'],
    ['42.5', 50, 0.53, 'B 20 Beispiel IV / Tafel 8'],
    ['52.5R', 59, 0.53, 'B 20 Beispiel III Variante 1'],
    ['52.5R', 60, 0.52, 'B 20 Beispiel III Variante 2'],
    ['32.5', 35, 0.58, 'BTD 2022 9.2 (N28 = 42,5)'],
  ];
  for (const [cls, fc, wz, src] of READINGS) {
    it(`${src}: ${fc} N/mm² with ${cls} → w/z ${wz} (± 0,02 chart reading)`, () => {
      const got = wzFromStrength(fc, cls);
      expect(Math.abs((got ?? NaN) - wz), `expected ${wz}, got ${got}`).toBeLessThanOrEqual(0.02);
    });
  }

  it('returns null for an invalid w/c (zero, negative, missing)', () => {
    expect(strengthFromWz(0, '42.5')).toBeNull();
    expect(strengthFromWz(-0.5, '42.5')).toBeNull();
    expect(strengthFromWz(undefined as unknown as number, '42.5')).toBeNull();
  });
});

describe('Target strength (B 20 Tafel 9 step 3): f_cm = f_ck,cube/0,92 + v', () => {
  it('C30/37 with v = 3: 37/0,92 + 3 = 43,2 N/mm²', () => {
    expect(Math.abs(targetStrength(37, 3) - 43.2)).toBeLessThan(0.1);
  });

  it('scales with the Vorhaltemaß: v 3 → 5 adds 2 N/mm²', () => {
    const delta = targetStrength(25, 5) - targetStrength(25, 3);
    expect(delta).toBeGreaterThan(1.9);
    expect(delta).toBeLessThan(2.1);
  });

  it('the recipe clamps the Vorhaltemaß to 3–12 N/mm² and uses 9 when it is missing', () => {
    expect(recipeFor({ margin: 1 }).margin).toBe(3);
    expect(recipeFor({ margin: 20 }).margin).toBe(12);
    expect(recipeFor({ margin: 0 }).margin).toBe(9);
  });
});

describe('w/c from the target strength (inverse Walz curve)', () => {
  it('is the inverse of strengthFromWz', () => {
    const f = strengthFromWz(0.6, '42.5');
    // 0,002 absorbs the one-decimal rounding of the strength.
    expect(Math.abs((wzFromStrength(f ?? 0, '42.5') ?? NaN) - 0.6)).toBeLessThanOrEqual(0.002);
  });

  it('C30/37 with CEM I 42,5 N and v = 3 gives a plausible cement content (280–370 kg)', () => {
    const wz = wzFromStrength(targetStrength(37, 3), '42.5') ?? NaN;
    const cement = waterDemand('B32', 'F3') / wz;
    expect(cement).toBeGreaterThanOrEqual(280);
    expect(cement).toBeLessThanOrEqual(370);
  });

  it('returns null for an invalid target strength', () => {
    expect(wzFromStrength(0, '42.5')).toBeNull();
    expect(wzFromStrength(-5, '42.5')).toBeNull();
    expect(wzFromStrength(null as unknown as number, '42.5')).toBeNull();
  });
});

describe('Walz curves and strength classes', () => {
  it('C20/25 with CEM I 42,5 N at w/z 0,68 exceeds the target (v = 3: 30,2 N/mm²)', () => {
    expect(strengthFromWz(0.68, '42.5') ?? 0).toBeGreaterThanOrEqual(targetStrength(25, 3));
  });

  it('C35/45 with CEM I 52,5 R: the Walz w/c is plausible (0,5–1,0)', () => {
    const wz = wzFromStrength(targetStrength(45, 5), '52.5R') ?? NaN;
    expect(wz).toBeGreaterThan(0.5);
    expect(wz).toBeLessThan(1.0);
  });

  it('the recipe clamps the w/c to 0,35–0,95', () => {
    // C100/115 on a 32,5 cement needs a w/c far below 0,35.
    expect(recipeFor({ strengthClass: 'C100/115', cementType: 'CEM I 32.5 N' }).wz).toBe(0.35);
  });
});

// Fine-mortar / UHPC recipes for decor pieces (ported from tests/uhpc-engine.test.js,
// tests/uhpc-presets.test.js and tests/uhpc-presets-sources.test.js).
//
// Changes: computeUhpcRecipe(preset, v, overrides) had an overrides argument; scaleDecorRecipe
// has none, so the override tests build a modified preset instead. Messages of the
// plausibility checks are UI texts now; only {id, value, level} is tested. Mixing steps moved
// to the UI texts, so the placeholder tests are not ported (preset.steps is only a count).
import { describe, expect, it } from 'vitest';
import {
  DECOR_PRESETS, DEFAULT_DENSITIES, decorPreset, expectedFck, type DecorBatch, type DecorPreset,
} from '../../src/decor/presets';
import { batchVolumeL, checkDecorRecipe, scaleDecorRecipe, type DecorRecipe, type Level } from '../../src/decor/recipe';

const PRESET = DECOR_PRESETS[0]!;
const batchM3 = (p: DecorPreset) => batchVolumeL(p.batch, p.densities) / 1000;
const withBatch = (p: DecorPreset, b: Partial<DecorBatch>): DecorPreset => ({ ...p, batch: { ...p.batch, ...b } });
const level = (r: DecorRecipe, id: 'wb' | 'pce' | 'density') => checkDecorRecipe(r).find((c) => c.id === id)!.level;
const COMPONENTS = ['cementKg', 'sandKg', 'quartzPowderKg', 'finesKg', 'microsilicaKg', 'waterL', 'superplasticizerL', 'fibresG'] as const;

describe('batchVolumeL', () => {
  it('is Σ m/ρ of every component (Stoffraumrechnung, B 20 Tafel 9)', () => {
    // DIY 30-l preset: 25/3,10 + 39/2,65 + 2,5/2,65 + 8,5/1,0 + 0,4125/1,10 ≈ 32,6 dm³
    const v = batchVolumeL(PRESET.batch, PRESET.densities);
    expect(v).toBeCloseTo(25 / 3.1 + 39 / 2.65 + 2.5 / 2.65 + 8.5 + 0.375, 10);
    expect(v).toBeGreaterThan(31);
    expect(v).toBeLessThan(34);
  });

  it('is linear in the masses (doubling all masses doubles the volume)', () => {
    const doubled = Object.fromEntries(Object.entries(PRESET.batch).map(([k, v]) => [k, v * 2])) as unknown as DecorBatch;
    expect(batchVolumeL(doubled, PRESET.densities)).toBeCloseTo(2 * batchVolumeL(PRESET.batch, PRESET.densities), 9);
  });

  it.each(DECOR_PRESETS.map((p) => [p.key, p] as const))('%s: Σ component volumes, fibres included, no air', (_key, p) => {
    const b = p.batch;
    const rho = p.densities;
    const pceKg = (b.superplasticizerMl / 1000) * rho.superplasticizer;
    const sum =
      b.cementKg / rho.cement + b.sandKg / rho.sand + b.quartzPowderKg / rho.quartzPowder + b.finesKg / rho.fines +
      b.microsilicaKg / rho.microsilica + b.waterL / rho.water + pceKg / rho.superplasticizer + b.fibresG / 1000 / rho.fibres;
    expect(batchVolumeL(b, rho)).toBeCloseTo(sum, 9);
  });
});

describe('scaleDecorRecipe: scaling', () => {
  it.each(DECOR_PRESETS.map((p) => [p.key, p] as const))('%s: scaling to its own batch volume reproduces every amount', (_key, p) => {
    const r = scaleDecorRecipe(p, batchM3(p));
    expect(r.scale).toBeCloseTo(1, 12);
    expect(r.cementKg).toBeCloseTo(p.batch.cementKg, 9);
    expect(r.sandKg).toBeCloseTo(p.batch.sandKg, 9);
    expect(r.quartzPowderKg).toBeCloseTo(p.batch.quartzPowderKg, 9);
    expect(r.finesKg).toBeCloseTo(p.batch.finesKg, 9);
    expect(r.microsilicaKg).toBeCloseTo(p.batch.microsilicaKg, 9);
    expect(r.waterL).toBeCloseTo(p.batch.waterL, 9);
    expect(r.superplasticizerL).toBeCloseTo(p.batch.superplasticizerMl / 1000, 9);
    expect(r.fibresG).toBeCloseTo(p.batch.fibresG, 9);
  });

  it('halving the volume halves every component', () => {
    const r1 = scaleDecorRecipe(PRESET, batchM3(PRESET));
    const r2 = scaleDecorRecipe(PRESET, batchM3(PRESET) / 2);
    for (const k of [...COMPONENTS, 'totalKg', 'scale'] as const) expect(r2[k], k).toBeCloseTo(r1[k] / 2, 9);
    // Ratios do not change with the volume.
    expect(r2.wb).toBe(r1.wb);
    expect(r2.pcePct).toBe(r1.pcePct);
    expect(r2.freshDensity).toBeCloseTo(r1.freshDensity, 9);
  });

  it('totalKg is the fresh density times the volume', () => {
    const r = scaleDecorRecipe(PRESET, 0.02);
    expect(r.totalKg).toBeCloseTo(r.freshDensity * 0.02, 9);
  });

  it('regression: 0,001 m³ gives gram/ml amounts, not zero', () => {
    const r = scaleDecorRecipe(PRESET, 0.001);
    for (const k of ['cementKg', 'waterL', 'superplasticizerL'] as const) {
      expect(r[k], k).toBeGreaterThan(0);
      expect(r[k], k).toBeLessThan(1);
    }
  });

  it('more cement in the batch → a larger batch → a smaller scale for the same volume', () => {
    const heavier = withBatch(PRESET, { cementKg: PRESET.batch.cementKg * 2 });
    expect(scaleDecorRecipe(heavier, batchM3(PRESET)).scale).toBeLessThan(1);
  });

  it.each([0, -1, Number.NaN])('throws on volume %s', (v) => {
    expect(() => scaleDecorRecipe(PRESET, v)).toThrow(RangeError);
  });
});

describe('scaleDecorRecipe: derived values', () => {
  const r = scaleDecorRecipe(PRESET, batchM3(PRESET));

  it('fresh density in the UHPC range (2200–2600 kg/m³)', () => {
    expect(r.freshDensity).toBeGreaterThan(2200);
    expect(r.freshDensity).toBeLessThan(2600);
  });

  it('w/b in the tolerant DIY range (0,18–0,45)', () => {
    expect(r.wb).toBeGreaterThanOrEqual(0.18);
    expect(r.wb).toBeLessThanOrEqual(0.45);
  });

  it('PCE in the datasheet window (0,3–4 % of cement)', () => {
    // 375 ml × 1,1 kg/l / 25 kg = 1,65 %
    expect(r.pcePct).toBeCloseTo(1.65, 10);
  });
});

describe('w/b formula', () => {
  const fake: DecorPreset = {
    ...PRESET,
    key: '__test__',
    densities: DEFAULT_DENSITIES,
    batch: { cementKg: 100, sandKg: 100, quartzPowderKg: 0, finesKg: 0, microsilicaKg: 0, waterL: 30, superplasticizerMl: 0, fibresG: 0 },
  };

  it('without PCE and microsilica, w/b is w/c', () => {
    expect(scaleDecorRecipe(fake, 0.1).wb).toBeCloseTo(0.3, 12);
  });

  it('PCE water (60 %) raises w/b: 100 ml PCE adds 0,066 kg water → 0,30066', () => {
    expect(scaleDecorRecipe(withBatch(fake, { superplasticizerMl: 100 }), 0.1).wb).toBeCloseTo(0.30066, 10);
  });

  it('microsilica counts as binder (k = 1,0): +20 kg lowers w/b from 0,30 to 0,25', () => {
    expect(scaleDecorRecipe(withBatch(fake, { microsilicaKg: 20 }), 0.1).wb).toBeCloseTo(0.25, 12);
  });

  it.each<[string, Partial<DecorBatch>]>([
    ['quartz flour (k = 0)', { quartzPowderKg: 20 }],
    ['limestone flour', { finesKg: 20 }],
    ['fibres', { fibresG: 500 }],
  ])('%s does not change w/b', (_name, b) => {
    expect(scaleDecorRecipe(withBatch(fake, b), 0.1).wb).toBeCloseTo(0.3, 12);
  });

  it('PCE % is of the cement mass only', () => {
    // 100 ml × 1,1 kg/l = 0,11 kg on 100 kg cement = 0,11 %, microsilica does not count.
    expect(scaleDecorRecipe(withBatch(fake, { superplasticizerMl: 100, microsilicaKg: 20 }), 0.1).pcePct).toBeCloseTo(0.11, 12);
  });
});

describe('checkDecorRecipe', () => {
  it('three checks, w/b, PCE, density, with the unrounded value', () => {
    const r = scaleDecorRecipe(PRESET, 0.01);
    const checks = checkDecorRecipe(r);
    expect(checks.map((c) => c.id)).toEqual(['wb', 'pce', 'density']);
    expect(checks.map((c) => c.value)).toEqual([r.wb, r.pcePct, r.freshDensity]);
    for (const c of checks) expect(Object.keys(c).sort()).toEqual(['id', 'level', 'value']);
  });

  it.each<[string, Level, Level, Level]>([
    // w/b 0,35 is wetter than the UHPC window 0,20–0,32: warn.
    ['diy-pce-30l-batch', 'warn', 'ok', 'ok'],
    ['diy-mortar-20kg-batch', 'ok', 'ok', 'ok'],
    // w/b 0,1855 shows as 0,19 (warn below 0,20); PCE 4,011 % shows as 4,0 % (warn, not error).
    ['kassel-m1q-cem42-5r', 'warn', 'warn', 'ok'],
    // Fresh density 2255 kg/m³ is below 2300: warn.
    ['kassel-m1q-cem42-5r-soft', 'ok', 'ok', 'warn'],
    // The white DIY mixes are wet (w/b ≈ 0,42): inside the tolerant DIY band up to 0,45.
    ['diy-white-15kg-laminate', 'warn', 'warn', 'warn'],
    ['diy-white-bowl-4kg', 'warn', 'ok', 'warn'],
  ])('%s: w/b %s, PCE %s, density %s', (key, wb, pce, density) => {
    const r = scaleDecorRecipe(decorPreset(key)!, 0.01);
    expect(checkDecorRecipe(r).map((c) => c.level)).toEqual([wb, pce, density]);
  });

  it('a third of the water drives w/b far below the envelope: error', () => {
    const r = scaleDecorRecipe(withBatch(PRESET, { waterL: PRESET.batch.waterL / 3 }), batchM3(PRESET));
    expect(level(r, 'wb')).toBe('error');
  });

  it('5 l PCE on 25 kg cement (22 %) is far above the datasheet window: error', () => {
    const r = scaleDecorRecipe(withBatch(PRESET, { superplasticizerMl: 5000 }), batchM3(PRESET));
    expect(level(r, 'pce')).toBe('error');
  });

  // Values are classified as displayed (w/b 2 decimals, PCE 1 decimal, density 0 decimals),
  // so a value that shows as the edge of a window is inside it.
  const recipe = (o: Partial<DecorRecipe>): DecorRecipe => ({ ...scaleDecorRecipe(PRESET, 0.01), wb: 0.25, pcePct: 1.5, freshDensity: 2400, ...o });

  it.each<[number, Level]>([
    [0.1951, 'ok'], // shows 0,20
    [0.3249, 'ok'], // shows 0,32
    [0.3251, 'warn'], // shows 0,33
    [0.1849, 'warn'], // shows 0,18
    [0.4049, 'warn'], // shows 0,40
    [0.4249, 'warn'], // shows 0,42, the white DIY mixes
    [0.4549, 'warn'], // shows 0,45
    [0.4551, 'error'], // shows 0,46
    [0.174, 'error'], // shows 0,17
  ])('w/b %s → %s', (wb, expected) => {
    expect(level(recipe({ wb }), 'wb')).toBe(expected);
  });

  it.each<[number, Level]>([
    [0.76, 'ok'], // shows 0,8
    [3.04, 'ok'], // shows 3,0
    [3.06, 'warn'], // shows 3,1
    [4.04, 'warn'], // shows 4,0
    [4.06, 'error'], // shows 4,1
    [0.26, 'warn'], // shows 0,3
    [0.24, 'error'], // shows 0,2
  ])('PCE %s %% → %s', (pcePct, expected) => {
    expect(level(recipe({ pcePct }), 'pce')).toBe(expected);
  });

  it.each<[number, Level]>([
    [2299.6, 'ok'], // shows 2300
    [2500.4, 'ok'], // shows 2500
    [2299.4, 'warn'],
    [2600.4, 'warn'], // shows 2600
    [2600.6, 'error'],
    [2199.4, 'error'],
  ])('density %s → %s', (freshDensity, expected) => {
    expect(level(recipe({ freshDensity }), 'density')).toBe(expected);
  });
});

describe('Kassel M1Q (CEM I 42,5 R, w/c 0,24): the engine reproduces the published figures', () => {
  const KASSEL = decorPreset('kassel-m1q-cem42-5r')!;

  it('cites the Kassel report, 123 N/mm² water-cured', () => {
    expect(KASSEL.measuredFck).toBe(123);
    expect(KASSEL.source.url).toMatch(/uni-kassel\.de/);
  });

  it('w/b = 0,19 within ± 0,01 (Tabelle 3.7-2, PCE counted with 60 % water)', () => {
    expect(Math.abs(scaleDecorRecipe(KASSEL, 1).wb - 0.19)).toBeLessThanOrEqual(0.01);
  });

  it('fresh density within 2300–2500 kg/m³', () => {
    const { freshDensity } = scaleDecorRecipe(KASSEL, 1);
    expect(freshDensity).toBeGreaterThan(2300);
    expect(freshDensity).toBeLessThan(2500);
  });

  it('PCE 29,4 / 733 = 4,011 % shows as 4,0 % and is warn, not error', () => {
    const r = scaleDecorRecipe(KASSEL, 1);
    expect(r.pcePct).toBeCloseTo((29.4 / 733) * 100, 2);
    expect(level(r, 'pce')).toBe('warn');
  });

  it('Σ m/ρ is within 30 dm³ of 1 m³ (a per-m³ recipe; the gap is air)', () => {
    expect(Math.abs(batchVolumeL(KASSEL.batch, KASSEL.densities) - 1000)).toBeLessThanOrEqual(30);
  });

  it('0,001 m³ gives sub-kilogram cement and microsilica', () => {
    const r = scaleDecorRecipe(KASSEL, 0.001);
    for (const k of ['cementKg', 'microsilicaKg'] as const) {
      expect(r[k]).toBeGreaterThan(0);
      expect(r[k]).toBeLessThan(1);
    }
  });
});

describe('Kassel M1Q soft (w/c 0,40)', () => {
  const SOFT = decorPreset('kassel-m1q-cem42-5r-soft')!;

  it('103 N/mm² water-cured', () => {
    expect(SOFT.measuredFck).toBe(103);
  });

  it('PCE ≈ 1,1 % of cement: ok', () => {
    expect(level(scaleDecorRecipe(SOFT, 1), 'pce')).toBe('ok');
  });

  it('w/b ≈ 0,31 in the ok window (the paper states 0,26; both are ok)', () => {
    const r = scaleDecorRecipe(SOFT, 1);
    expect(r.wb).toBeCloseTo(0.305, 2);
    expect(level(r, 'wb')).toBe('ok');
  });
});

describe('preset strengths', () => {
  it('every preset states or estimates a 28-day strength', () => {
    for (const p of DECOR_PRESETS) {
      expect(p.airCuredFck ?? p.measuredFck ?? p.estimatedFck, p.key).not.toBeNull();
    }
  });

  it('every expected strength lies within 40–250 N/mm²', () => {
    for (const p of DECOR_PRESETS) {
      expect(expectedFck(p), p.key).toBeGreaterThanOrEqual(40);
      expect(expectedFck(p), p.key).toBeLessThanOrEqual(250);
    }
  });

  it('air-cured is 70–95 % of the water-cured value where both are given', () => {
    const both = DECOR_PRESETS.filter((p) => p.measuredFck !== null && p.airCuredFck !== null);
    expect(both.length).toBeGreaterThanOrEqual(1);
    for (const p of both) {
      const ratio = p.airCuredFck! / p.measuredFck!;
      expect(ratio, p.key).toBeGreaterThanOrEqual(0.7);
      expect(ratio, p.key).toBeLessThanOrEqual(0.95);
    }
  });

  it('expectedFck prefers air-cured, then measured, then estimated', () => {
    expect(expectedFck(decorPreset('kassel-m1q-cem42-5r')!)).toBe(100);
    expect(expectedFck({ ...PRESET, airCuredFck: null, measuredFck: 80, estimatedFck: 50 })).toBe(80);
    expect(expectedFck({ ...PRESET, airCuredFck: null, measuredFck: null, estimatedFck: 50 })).toBe(50);
    expect(expectedFck({ ...PRESET, airCuredFck: null, measuredFck: null, estimatedFck: null })).toBe(0);
  });
});

describe('preset catalog', () => {
  it('keys are slugs and unique; decorPreset finds each, undefined otherwise', () => {
    const keys = DECOR_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of DECOR_PRESETS) {
      expect(p.key).toMatch(/^[a-z0-9-]+$/);
      expect(decorPreset(p.key)).toBe(p);
    }
    expect(decorPreset('does-not-exist')).toBeUndefined();
    expect(decorPreset(undefined)).toBeUndefined();
  });

  it.each(DECOR_PRESETS.map((p) => [p.key, p] as const))('%s: a checkable source and sane data', (_key, p) => {
    expect(p.source.url).toMatch(/^https:\/\//);
    expect(['article', 'paper']).toContain(p.source.type);
    expect(p.source.title.length).toBeGreaterThan(0);
    expect(p.source.author.length).toBeGreaterThan(0);
    expect(p.source.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.batch.cementKg).toBeGreaterThan(0);
    expect(p.batch.sandKg).toBeGreaterThan(0);
    expect(p.batch.waterL).toBeGreaterThan(0);
    for (const v of Object.values(p.batch)) expect(v).toBeGreaterThanOrEqual(0);
    for (const [name, rho] of Object.entries(p.densities)) {
      expect(rho, name).toBeGreaterThanOrEqual(0.5);
      expect(rho, name).toBeLessThanOrEqual(5);
    }
    expect(p.steps).toBeGreaterThanOrEqual(3);
    if (p.wallMm) expect(p.wallMm[0]).toBeLessThanOrEqual(p.wallMm[1]);
    // The header of presets.ts: w/b 0,18–0,42 (as displayed, two decimals).
    const wb = Math.round(scaleDecorRecipe(p, 0.01).wb * 100) / 100;
    expect(wb).toBeGreaterThanOrEqual(0.18);
    expect(wb).toBeLessThanOrEqual(0.42);
  });

  it('only the laminate says it can stay outdoors; only the bowl is hand-mixed', () => {
    expect(DECOR_PRESETS.filter((p) => p.outdoor).map((p) => p.key)).toEqual(['diy-white-15kg-laminate']);
    expect(DECOR_PRESETS.filter((p) => p.handMixed).map((p) => p.key)).toEqual(['diy-white-bowl-4kg']);
  });
});

describe('presets match their sources (amounts quoted in presets.ts)', () => {
  const NONE = { quartzPowderKg: 0, finesKg: 0, microsilicaKg: 0, fibresG: 0 };

  it.each<[string, string, DecorBatch]>([
    [
      // "30 kg Sand (bis 2 mm), 25 kg Zement, 9 kg Quarzsand (0,063–0,3 mm), 2,5 kg Quarzmehl,
      //  8,5 Liter Wasser, 350–400 ml Hochleistungs-Fließmittel": sand 30 + 9, PCE the middle.
      // Quarzmehl is inert quartz flour, not microsilica.
      'diy-pce-30l-batch',
      'https://www.grey-element.de/beton-basics/beton-zur-herstellung-von-betonm%C3%B6beln/',
      { ...NONE, cementKg: 25, sandKg: 30 + 9, quartzPowderKg: 2.5, waterL: 8.5, superplasticizerMl: (350 + 400) / 2 },
    ],
    [
      // "8 kg Zement (CEM I), 10 kg Sandkörnung 0–2 mm, 1600 g Kalksteinmehl, 400 g Microsilica,
      //  2,4 Liter Wasser, 150 ml Hochleistungsfließmittel"
      'diy-mortar-20kg-batch',
      'https://www.grey-element.de/beton-basics/hochfesten-beton-uhpc-selber-herstellen/',
      { ...NONE, cementKg: 8, sandKg: 10, finesKg: 1.6, microsilicaKg: 0.4, waterL: 2.4, superplasticizerMl: 150 },
    ],
    [
      // Tabelle 3.7-2 M1Q w/z 0,24: 733 kg cement, 1008 kg sand, 230 kg microsilica,
      // 183 kg Feinquarz, 29,4 kg FM (÷ 1,10 kg/l), 161 kg water.
      'kassel-m1q-cem42-5r',
      'https://www.uni-kassel.de/upress/online/frei/978-3-89958-108-9.volltext.frei.pdf',
      { ...NONE, cementKg: 733, sandKg: 1008, quartzPowderKg: 183, microsilicaKg: 230, waterL: 161, superplasticizerMl: Math.round((29.4 / 1.1) * 1000) },
    ],
    [
      // w/z 0,40 variant: 664 kg cement, 913 kg sand, 208 kg microsilica, 165,8 kg Feinquarz,
      // 7,3 kg FM (÷ 1,10 kg/l), 262 kg water.
      'kassel-m1q-cem42-5r-soft',
      'https://www.uni-kassel.de/upress/online/frei/978-3-89958-108-9.volltext.frei.pdf',
      { ...NONE, cementKg: 664, sandKg: 913, quartzPowderKg: 165.8, microsilicaKg: 208, waterL: 262, superplasticizerMl: Math.round((7.3 / 1.1) * 1000) },
    ],
    [
      // "3 kg Sand (max. 2 mm), 5 kg Quarzsand (0,063–0,3 mm), 1,5 kg Quarzmehl, 5,5 kg
      //  Weißzement, 2,2 l Wasser, ca. 200 ml Fließmittel"
      'diy-white-15kg-laminate',
      'https://www.grey-element.de/diy-betonm%C3%B6bel/diy-firetable-aus-beton/',
      { ...NONE, cementKg: 5.5, sandKg: 3 + 5, quartzPowderKg: 1.5, waterL: 2.2, superplasticizerMl: 200 },
    ],
    [
      // "1,25 kg Weißzement, 0,75 kg Sand (max. 2 mm), 1,5 kg Quarzsand (0,063–0,3 mm),
      //  5 g Armierungsfasern, 500 ml Wasser, 30 ml Hochleistungsfließmittel"
      'diy-white-bowl-4kg',
      'https://www.grey-element.de/diy-betonm%C3%B6bel/diy-obstschale-aus-beton/',
      { ...NONE, cementKg: 1.25, sandKg: 0.75 + 1.5, waterL: 0.5, superplasticizerMl: 30, fibresG: 5 },
    ],
  ])('%s', (key, url, batch) => {
    const p = decorPreset(key)!;
    expect(p.source.url).toBe(url);
    expect(p.batch).toEqual(batch);
  });

  it('every preset is covered by the source table above', () => {
    expect(DECOR_PRESETS.map((p) => p.key).sort()).toEqual([
      'diy-mortar-20kg-batch', 'diy-pce-30l-batch', 'diy-white-15kg-laminate', 'diy-white-bowl-4kg',
      'kassel-m1q-cem42-5r', 'kassel-m1q-cem42-5r-soft',
    ]);
  });

  it('diy-pce-30l-batch cites the Betonmöbel article, not a video without amounts', () => {
    expect(decorPreset('diy-pce-30l-batch')!.source.url).not.toContain('youtube.com');
  });

  it('diy-pce-30l-batch: inert quartz flour is no binder, so w/b ≈ 0,35', () => {
    expect(Math.abs(scaleDecorRecipe(decorPreset('diy-pce-30l-batch')!, 0.01).wb - 0.35)).toBeLessThan(0.005);
  });

  it('diy-mortar-20kg-batch: microsilica counts as binder, so w/b ≈ 0,30', () => {
    expect(Math.abs(scaleDecorRecipe(decorPreset('diy-mortar-20kg-batch')!, 0.01).wb - 0.297)).toBeLessThan(0.005);
  });

  it.each<[string, number]>([
    // The estimate comments in presets.ts: "w/b ≈ 0,35 / 0,30 / 0,42 / 0,42".
    ['diy-pce-30l-batch', 0.35],
    ['diy-mortar-20kg-batch', 0.3],
    ['diy-white-15kg-laminate', 0.42],
    ['diy-white-bowl-4kg', 0.42],
  ])('%s: w/b as in the estimate comment (%s)', (key, wb) => {
    expect(Math.abs(scaleDecorRecipe(decorPreset(key)!, 0.01).wb - wb)).toBeLessThan(0.006);
  });
});

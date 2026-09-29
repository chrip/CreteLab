// Fines content (Mehlkorngehalt) and its limits (Zement-Merkblatt B 20 Tafel 9 step 8,
// Tafel 23; DIN 1045-2 Tab. F.4), and the CEM I rule for fly ash with silica fume.
import { describe, it, expect } from 'vitest';
import { GRADINGS, checkRecipe, maxFinesContent, type CementTypeName, type ExposureClass, type Recipe } from '../../src/index';
import { mix, recipeFor } from './helpers';

describe('Fines content of a recipe (B 20 Tafel 9 step 8)', () => {
  it('cement + fly ash + silica fume + aggregate < 0,125 mm', () => {
    const r = recipeFor({ cementType: 'CEM I 42.5 N', flyAshPct: 20, silicaFumePct: 5 });
    const m = r.materials;
    const expected = Math.round(m.cement + m.flyAsh + m.silicaFume + m.aggregate * GRADINGS.B32.fines0125);
    expect(r.finesContent).toBe(expected);
  });

  it('without additions it is the cement plus the fines of the aggregate', () => {
    const r = recipeFor({ sieveLine: 'A/B16' });
    expect(r.finesContent).toBe(Math.round(r.materials.cement + r.materials.aggregate * 0.03));
  });

  it('additions raise the fines content', () => {
    expect(recipeFor({ flyAshPct: 30 }).finesContent).toBeGreaterThan(recipeFor({ flyAshPct: 0 }).finesContent);
  });
});

describe('Maximum fines content (DIN 1045-2 Tab. F.4; B 20 Tafel 23)', () => {
  it('XC1 example of B 20 (279 kg cement, ≤ 300): 450 kg/m³', () => {
    expect(maxFinesContent(279, false)).toBe(450);
  });

  // Above 350 kg cement the limit rises by the extra cement, by 50 kg at most (DIN 1045-2, Tab. F.4, note).
  it('XC4 example of B 20 (383 kg cement): 550 + 33 = 583 kg/m³', () => {
    expect(maxFinesContent(383, false)).toBe(583);
  });

  it('frost/wear, XF1 with 287 kg cement (≤ 300): 400 kg/m³', () => {
    expect(maxFinesContent(287, true)).toBe(400);
  });

  it('frost/wear, XF2 with 383 kg cement: 450 + 33 = 483 kg/m³', () => {
    expect(maxFinesContent(383, true)).toBe(483);
  });

  // Changed on purpose: between 300 and 350 kg cement the limit now rises linearly
  // (DIN 1045-2 Tab. F.4) instead of jumping at one cement content.
  it('rises linearly between 300 and 350 kg cement', () => {
    expect(maxFinesContent(300, false)).toBe(450);
    expect(maxFinesContent(310, false)).toBe(470);
    expect(maxFinesContent(325, false)).toBe(500);
    expect(maxFinesContent(350, false)).toBe(550);
    expect(maxFinesContent(300, true)).toBe(400);
    expect(maxFinesContent(325, true)).toBe(425);
    expect(maxFinesContent(350, true)).toBe(450);
  });

  it('stays at the lower bound below 300 kg and rises by at most 50 kg above 350 kg', () => {
    expect(maxFinesContent(200, false)).toBe(450);
    expect(maxFinesContent(400, false)).toBe(600);
    expect(maxFinesContent(500, false)).toBe(600);
    expect(maxFinesContent(200, true)).toBe(400);
    expect(maxFinesContent(500, true)).toBe(500);
  });

  it('frost and wear classes use the lower limit: XF2 yes, XC4 no', () => {
    const cement = 300;
    const fines = 420; // between the two limits at 300 kg
    const run = (exposureClasses: ExposureClass[]) => {
      const input = mix({ exposureClasses });
      const r = recipeFor({ exposureClasses });
      const fake: Recipe = { ...r, finesContent: fines, materials: { ...r.materials, cement } };
      return checkRecipe(input, fake).map((w) => w.code);
    };
    expect(run(['XF2'])).toContain('fines-too-high');
    expect(run(['XC4'])).not.toContain('fines-too-high');
  });
});

describe('Warning: fines too high', () => {
  it('700 kg fines with 400 kg cement exceed the 600 kg limit', () => {
    const input = mix({ exposureClasses: ['XC4'] });
    const r = recipeFor({ exposureClasses: ['XC4'] });
    const fake: Recipe = { ...r, finesContent: 700, materials: { ...r.materials, cement: 400 } };
    expect(checkRecipe(input, fake)).toContainEqual({ code: 'fines-too-high', params: { fines: 700, max: 600 } });
  });

  it('a normal B 20 mix stays below the limit', () => {
    expect(recipeFor({ exposureClasses: ['XC1'] }).warnings.map((w) => w.code)).not.toContain('fines-too-high');
  });

  it('a fines-rich mix triggers it through computeRecipe', () => {
    // C8 sieve line (5 % fines), F3, XF1, full fly ash and silica fume: far above 400–450 kg.
    const r = recipeFor({
      strengthClass: 'C45/55', exposureClasses: ['XF1'], sieveLine: 'C8', cementType: 'CEM I 42.5 N',
      flyAshPct: 33, silicaFumePct: 11,
    });
    const warning = r.warnings.find((w) => w.code === 'fines-too-high');
    expect(warning).toBeDefined();
    expect(r.finesContent).toBeGreaterThan(maxFinesContent(r.materials.cement, true));
  });
});

describe('CEM I with fly ash and silica fume: f/z ≤ 3 · (0,22 − s/z) (DIN 1045-2, 5.2.5.2.3)', () => {
  // The rule is checked on a finished recipe. normalizeMix caps fly ash at 0,33 · z and
  // silica fume at 0,11 · z, where the limit is exactly 0,33, so computeRecipe alone
  // cannot exceed it; the recipe is edited to test the check itself.
  const withAdditions = (cementType: CementTypeName, cement: number, flyAsh: number, silicaFume: number) => {
    const input = mix({ cementType, flyAshPct: 20, silicaFumePct: 5 });
    const r = recipeFor({ cementType, flyAshPct: 20, silicaFumePct: 5 });
    return checkRecipe(input, { ...r, materials: { ...r.materials, cement, flyAsh, silicaFume } }).map((w) => w.code);
  };

  it('fly ash only (s = 0) is not checked: limit 0,66 would allow 0,33', () => {
    expect(withAdditions('CEM I 42.5 N', 285, 94.1, 0)).not.toContain('fly-ash-with-silica-fume');
  });

  it('285 kg cement, 94,1 kg fly ash, 31,5 kg silica fume: f/z 0,330 > 3 · (0,22 − 0,111) = 0,328, exceeded', () => {
    // 94,1/285 = 0,3302; 3 · (0,22 − 31,5/285) = 0,3284.
    expect(withAdditions('CEM I 42.5 N', 285, 94.1, 31.5)).toContain('fly-ash-with-silica-fume');
  });

  it('285 kg cement, 150 kg fly ash, 31,5 kg silica fume exceeds the limit', () => {
    expect(withAdditions('CEM I 42.5 N', 285, 150, 31.5)).toContain('fly-ash-with-silica-fume');
  });

  it('within the limit: 285 kg cement, 60 kg fly ash, 20 kg silica fume', () => {
    // 60/285 = 0,21 ≤ 3 · (0,22 − 0,070) = 0,45
    expect(withAdditions('CEM I 42.5 N', 285, 60, 20)).not.toContain('fly-ash-with-silica-fume');
  });

  it('applies to CEM I only, not to CEM II or CEM III', () => {
    expect(withAdditions('CEM II/A-S 42.5 N', 285, 150, 31.5)).not.toContain('fly-ash-with-silica-fume');
    expect(withAdditions('CEM III/A 42.5 N', 285, 150, 31.5)).not.toContain('fly-ash-with-silica-fume');
  });

  it('computeRecipe with the maximum additions does not warn', () => {
    const r = recipeFor({ cementType: 'CEM I 42.5 N', flyAshPct: 33, silicaFumePct: 11 });
    expect(r.warnings.map((w) => w.code)).not.toContain('fly-ash-with-silica-fume');
  });
});

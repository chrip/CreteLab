// From description + Laya's answers to a project plan (ported from the DIY-route tests of
// tests/describe.test.js; detectApproach, wantsBagTuning and planProject are new).
import { describe, expect, it } from 'vitest';
import type { Answers } from '../../src/project/answers';
import {
  DIY_DEFAULT_VOLUME_M3, MIN_SITE_CONCRETE_WALL_M, SITE_DEFAULT_VOLUME_M3,
  chooseDecorPreset, detectApproach, isDiyPiece, planProject, productionFor, wantsBagTuning,
  type Approach,
} from '../../src/project/plan';
import type { VolumeResult } from '../../src/project/volume';
import { parseVolume } from '../../src/project/volume';
import { scaleDecorRecipe } from '../../src/decor/recipe';
import { decorPreset } from '../../src/decor/presets';

const noul = (p: number) => ({ noul: p });
const DEFAULT_10L: VolumeResult = { volume: 0.01, source: 'default' };

describe('constants', () => {
  it('3 cm wall limit, 10 l DIY default, 1 m³ site default', () => {
    expect(MIN_SITE_CONCRETE_WALL_M).toBe(0.03);
    expect(DIY_DEFAULT_VOLUME_M3).toBe(0.01);
    expect(SITE_DEFAULT_VOLUME_M3).toBe(1);
  });
});

describe('isDiyPiece', () => {
  it('routes on fine_cast', () => {
    expect(isDiyPiece({ fine_cast: noul(0.9) })).toBe(true);
    expect(isDiyPiece({ fine_cast: noul(0.1) })).toBe(false);
    expect(isDiyPiece({})).toBe(false);
  });
});

describe('detectApproach', () => {
  it.each<Approach>(['scratch', 'bagged', 'fine_mortar'])("Laya's answer %s wins", (choice) => {
    // Even against keywords and the DIY question.
    expect(detectApproach({ approach: { choice }, fine_cast: noul(choice === 'scratch' ? 0.9 : 0) }, 'Sack Fertigbeton aus dem Baumarkt')).toBe(choice);
  });

  it('a wall under 3 cm overrides "scratch": site concrete with 8–32 mm grain cannot fill it', () => {
    expect(detectApproach({ approach: { choice: 'scratch' } }, '', 0.02)).toBe('fine_mortar');
    expect(detectApproach({ approach: { choice: 'scratch' } }, '', 0.0299)).toBe('fine_mortar');
  });

  it('3 cm and more, or no wall, stays "scratch"', () => {
    expect(detectApproach({ approach: { choice: 'scratch' } }, '', 0.03)).toBe('scratch');
    expect(detectApproach({ approach: { choice: 'scratch' } }, '', null)).toBe('scratch');
  });

  it('the wall override only applies to "scratch": a bag stays a bag (plan.thinWall flags it)', () => {
    expect(detectApproach({ approach: { choice: 'bagged' } }, '', 0.02)).toBe('bagged');
  });

  it.each([
    'Ich habe 3 Säcke Fertigbeton aus dem Baumarkt',
    'Trockenbeton für den Zaunpfosten',
    'Beton in Säcken von Hornbach',
    'two bags of concrete for a post',
    'Quikrete for the mailbox post',
    'Sackware vom OBI',
  ])('keywords without an answer: %s → bagged', (text) => {
    expect(detectApproach({}, text)).toBe('bagged');
  });

  it('without an answer or keywords the DIY question decides', () => {
    expect(detectApproach({ fine_cast: noul(0.8) }, 'Blumenkübel')).toBe('fine_mortar');
    expect(detectApproach({ fine_cast: noul(0.2) }, 'Fundament')).toBe('scratch');
    expect(detectApproach({}, '')).toBe('scratch');
  });

  it('an unknown approach answer falls back to keywords and the DIY question', () => {
    expect(detectApproach({ approach: { choice: 'unknown' } }, 'Fertigmischung')).toBe('bagged');
    expect(detectApproach({ approach: { choice: 'unknown' }, fine_cast: noul(1) })).toBe('fine_mortar');
  });

  it('"obi" only as a word', () => {
    expect(detectApproach({}, 'Mobile Betonmischung')).toBe('scratch');
  });
});

describe('productionFor', () => {
  it('bags for "bagged", own mix otherwise', () => {
    expect(productionFor('bagged')).toBe('bag');
    expect(productionFor('scratch')).toBe('mix');
    expect(productionFor('fine_mortar')).toBe('mix');
  });
});

describe('wantsBagTuning', () => {
  it("Laya's add_cement or add_plasticizer answer", () => {
    expect(wantsBagTuning({ add_cement: noul(0.9) })).toBe(true);
    expect(wantsBagTuning({ add_plasticizer: noul(0.7) })).toBe(true);
    expect(wantsBagTuning({ add_cement: noul(0.2), add_plasticizer: noul(0.1) })).toBe(false);
  });

  it.each([
    'Kann ich mehr Zement in den Fertigbeton geben?',
    'etwas Zement dazu für mehr Festigkeit',
    'Fließmittel in den Sack',
    'can I add some cement to the bag',
    'make the bagged mix more fluid',
    'superplasticizer in quikrete?',
  ])('keywords: %s', (text) => {
    expect(wantsBagTuning({}, text)).toBe(true);
  });

  it('no request to add anything', () => {
    expect(wantsBagTuning({}, 'Fundament aus Fertigbeton')).toBe(false);
  });
});

describe('chooseDecorPreset', () => {
  const facts = (f: Partial<{ rain: boolean; frost: boolean; indoor: boolean }>) => ({ rain: false, frost: false, indoor: false, ...f });

  it('outdoor DIY piece → the mix the source calls weather-resistant', () => {
    const pick = chooseDecorPreset(facts({ rain: true, frost: true }), DEFAULT_10L);
    expect(pick.preset.key).toBe('diy-white-15kg-laminate');
    expect(pick.preset.outdoor).toBe(true);
    expect(pick.reason).toBe('outdoor');
  });

  it('rain or frost alone is enough for outdoor', () => {
    expect(chooseDecorPreset(facts({ rain: true }), DEFAULT_10L).reason).toBe('outdoor');
    expect(chooseDecorPreset(facts({ frost: true }), DEFAULT_10L).reason).toBe('outdoor');
  });

  it('frost answered for an indoor piece is not outdoor', () => {
    expect(chooseDecorPreset(facts({ frost: true, indoor: true }), DEFAULT_10L).reason).toBe('furniture');
  });

  it('small indoor piece (≤ 5 l stated) → hand-mixed small batch', () => {
    const pick = chooseDecorPreset(facts({ indoor: true }), parseVolume('Obstschale, ca. 3 Liter'));
    expect(pick.preset.key).toBe('diy-white-bowl-4kg');
    expect(pick.preset.handMixed).toBe(true);
    expect(pick.reason).toBe('small');
    expect(chooseDecorPreset(facts({}), { volume: 0.005, source: 'laya' }).reason).toBe('small');
    expect(chooseDecorPreset(facts({}), { volume: 0.0051, source: 'laya' }).reason).toBe('furniture');
  });

  it('indoor furniture, or no size given → furniture fine mortar', () => {
    const pick = chooseDecorPreset(facts({ indoor: true }), DEFAULT_10L);
    expect(pick.preset.key).toBe('diy-pce-30l-batch');
    expect(pick.reason).toBe('furniture');
    // A default volume is no stated size, even when it is small.
    expect(chooseDecorPreset(facts({}), { volume: 0.001, source: 'default' }).reason).toBe('furniture');
  });

  it('every DIY preset scales to 10 l', () => {
    for (const key of ['diy-white-15kg-laminate', 'diy-white-bowl-4kg', 'diy-pce-30l-batch']) {
      const r = scaleDecorRecipe(decorPreset(key)!, DIY_DEFAULT_VOLUME_M3);
      expect(r.cementKg, key).toBeGreaterThan(3);
      expect(r.cementKg, key).toBeLessThan(10);
    }
  });
});

describe('planProject', () => {
  // A hollow planter from scratch: Laya reads shape and roles, the 2 cm wall forces fine mortar.
  const planter: Answers = {
    indoor_dry: noul(0.1), rain: noul(0.9), frost: noul(0.8), ground: noul(0.1), deicing_salt: noul(0),
    horizontal: noul(0.2), reinforced: noul(0), watertight: noul(0), fine_cast: noul(0.9),
    element: { choice: 'small' }, approach: { choice: 'scratch' }, shape: { choice: 'hollow' },
    'role:2 cm': { choice: 'wall' },
  };

  it('outdoor planter 40×40×40 cm, 2 cm wall → decor tool, fine mortar, outdoor preset', () => {
    const plan = planProject('Pflanzkübel 40x40x40 cm, Wandstärke 2 cm, für den Garten', {
      answers: planter, candidates: ['40x40x40 cm', '2 cm'],
    });
    expect(plan.tool).toBe('decor');
    expect(plan.approach).toBe('fine_mortar');
    expect(plan.production).toBe('mix');
    expect(plan.wall).toBe(0.02);
    expect(plan.thinWall).toBe(true);
    // 0,4³ − 0,36·0,36·0,38 = 14,752 l → 0,0148 m³
    expect(plan.volume).toMatchObject({ source: 'laya', volume: 0.0148, shape: 'hollow', open: 'one' });
    expect(plan.decor.reason).toBe('outdoor');
    expect(plan.decor.preset.key).toBe('diy-white-15kg-laminate');
    expect(plan.wantsBagTuning).toBe(false);
    expect(plan.requirements.exposureClasses).toEqual(['XF1']);
  });

  it('the same planter indoors gets the furniture mix', () => {
    const plan = planProject('Pflanzkübel 40x40x40 cm, Wandstärke 2 cm', {
      answers: { ...planter, indoor_dry: noul(0.9), rain: noul(0), frost: noul(0) },
      candidates: ['40x40x40 cm', '2 cm'],
    });
    expect(plan.decor.reason).toBe('furniture');
  });

  it('shed foundation from the text → planner, own mix, parsed volume', () => {
    const answers: Answers = {
      ground: noul(0.9), frost: noul(0.8), horizontal: noul(0.9), reinforced: noul(0.2),
      element: { choice: 'foundation' }, approach: { choice: 'scratch' }, shape: { choice: 'unknown' },
    };
    const plan = planProject('Fundament für Gartenhaus 3x2 m, 20 cm dick', { answers, candidates: ['3x2 m', '20 cm'] });
    expect(plan.tool).toBe('planner');
    expect(plan.approach).toBe('scratch');
    expect(plan.production).toBe('mix');
    expect(plan.volume).toMatchObject({ source: 'dimensions', volume: 1.2 });
    expect(plan.thinWall).toBe(false);
    expect(plan.wall).toBeNull();
    // Horizontal frost without salt: XF3, air-entrained.
    expect(plan.requirements.exposureClasses).toEqual(['XF3']);
  });

  it('a component without a size defaults to 1 m³', () => {
    const plan = planProject('Terrasse hinterm Haus', { answers: { approach: { choice: 'scratch' } }, candidates: [] });
    expect(plan.tool).toBe('planner');
    expect(plan.volume).toEqual({ volume: 1, source: 'default' });
  });

  it('a fine-mortar piece without a size defaults to 10 l', () => {
    const plan = planProject('Blumenkübel gießen', { answers: { fine_cast: noul(0.9) }, candidates: [] });
    expect(plan.tool).toBe('decor');
    expect(plan.volume).toEqual({ volume: 0.01, source: 'default' });
  });

  it('a small piece from a bag also defaults to 10 l, a bagged slab to 1 m³', () => {
    const small = planProject('Vogeltränke aus Fertigbeton', {
      answers: { approach: { choice: 'bagged' }, element: { choice: 'small' } }, candidates: [],
    });
    expect(small).toMatchObject({ tool: 'planner', approach: 'bagged', production: 'bag' });
    expect(small.volume.volume).toBe(0.01);
    const slab = planProject('Fundament aus Fertigbeton', {
      answers: { approach: { choice: 'bagged' }, element: { choice: 'foundation' } }, candidates: [],
    });
    expect(slab.volume.volume).toBe(1);
  });

  it('a bag for a 2 cm wall stays a bag but is flagged thin', () => {
    const plan = planProject('Kübel aus Fertigbeton', {
      answers: { approach: { choice: 'bagged' }, shape: { choice: 'hollow' }, 'role:2 cm': { choice: 'wall' } },
      candidates: ['40x40x40 cm', '2 cm'],
    });
    expect(plan.tool).toBe('planner');
    expect(plan.production).toBe('bag');
    expect(plan.thinWall).toBe(true);
  });

  it('a wall thickness only in the text also routes a thin piece to the decor workshop', () => {
    const plan = planProject('Blumenkübel 40x40x40 cm, Wandstärke 2 cm', { answers: { approach: { choice: 'scratch' } }, candidates: [] });
    // Laya gave no wall role, but the text parser found 2 cm: too thin for site concrete.
    expect(plan.approach).toBe('fine_mortar');
    expect(plan.tool).toBe('decor');
    expect(plan.volume.source).toBe('hollow');
    expect(plan.wall).toBe(0.02);
    expect(plan.thinWall).toBe(true);
  });

  it('asks for the bag tool when the text wants to add cement', () => {
    const plan = planProject('Kann ich mehr Zement in den Fertigbeton geben?', { answers: {}, candidates: [] });
    expect(plan.approach).toBe('bagged');
    expect(plan.wantsBagTuning).toBe(true);
  });
});

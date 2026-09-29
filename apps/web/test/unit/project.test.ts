import { planProject, type Answers } from '@cretelab/engine';
import { describe, expect, it } from 'vitest';
import { heavyTraffic, isReinforced } from '../../app/utils/mix';
import { fineConcreteStateFromPlan, plannerStateFromPlan } from '../../app/utils/project';
import { decodeFineConcrete, decodePlanner, encodeFineConcrete, encodePlanner } from '../../app/utils/query';

const yes = { noul: 0.95 };
const no = { noul: 0.05 };

describe('plannerStateFromPlan', () => {
  it('takes the volume, the recommended production and the mix from the plan', () => {
    const answers: Answers = { rain: yes, frost: yes, deicing_salt: yes, horizontal: yes, reinforced: no, approach: { choice: 'bagged' } };
    const plan = planProject('Einfahrt 6 x 3 m, 15 cm stark', { answers, candidates: [] });
    const state = plannerStateFromPlan(plan);
    expect(state).toMatchObject({ q: 'Einfahrt 6 x 3 m, 15 cm stark', volume: 2.7, tab: 'bag' });
    expect(state.mix.exposureClasses).toContain('XF4');
    // Survives the trip through the URL.
    expect(decodePlanner(encodePlanner(state))).toEqual(state);
  });
});

describe('fineConcreteStateFromPlan', () => {
  it('pre-fills shape and sizes in cm from Laya\'s roles', () => {
    const answers: Answers = { approach: { choice: 'fine_mortar' }, shape: { choice: 'hollow' }, 'role:2 cm': { choice: 'wall' } };
    const plan = planProject('Blumenkübel 40x40x40 cm, Wandstärke 2 cm', { answers, candidates: ['40x40x40 cm', '2 cm'] });
    const state = fineConcreteStateFromPlan(plan);
    expect(state).toMatchObject({ shape: 'hollow', length: 40, width: 40, height: 40, wall: 2, open: 'one', count: 1 });
    expect(decodeFineConcrete(encodeFineConcrete(state))).toEqual(state);
  });

  it('leaves the sizes empty when the text has none', () => {
    const plan = planProject('eine Obstschale', { answers: { approach: { choice: 'fine_mortar' } }, candidates: [] });
    expect(fineConcreteStateFromPlan(plan)).toMatchObject({ length: null, wall: null });
  });
});

describe('exposure helpers', () => {
  it('carbonation and chloride classes mean reinforcement', () => {
    expect(isReinforced(['XC2'])).toBe(true);
    expect(isReinforced(['XD3'])).toBe(true);
    expect(isReinforced(['XS1'])).toBe(true);
    expect(isReinforced(['X0', 'XF1', 'XM1'])).toBe(false);
  });

  it('XM2 and XM3 are heavy traffic', () => {
    expect(heavyTraffic(['XM2'])).toBe(true);
    expect(heavyTraffic(['XM1'])).toBe(false);
  });
});

describe('round pots', () => {
  it('a hollow body with a diameter opens on the fine concrete page as a cylinder with a wall', () => {
    const answers: Answers = {
      approach: { choice: 'fine_mortar' },
      shape: { choice: 'hollow' },
      'role:40 cm': { choice: 'diameter' },
      'role:35 cm': { choice: 'height' },
      'role:2,5 cm': { choice: 'wall' },
    };
    const plan = planProject('runder Pflanztopf Durchmesser 40 cm, 35 cm hoch, 2,5 cm Wand', { answers, candidates: ['40 cm', '35 cm', '2,5 cm'] });
    expect(fineConcreteStateFromPlan(plan)).toMatchObject({ shape: 'cylinder', diameter: 40, height: 35, wall: 2.5 });
  });
});

describe('assumed sizes travel to the fine concrete page', () => {
  it('"Blumenkübel 90 cm": height and wall are marked as assumed', () => {
    const answers: Answers = { element: { choice: 'small' }, approach: { choice: 'fine_mortar' }, shape: { choice: 'hollow' }, 'role:90 cm': { choice: 'diameter' } };
    const state = fineConcreteStateFromPlan(planProject('Blumenkübel 90 cm', { answers, candidates: ['90 cm'] }));
    expect(state).toMatchObject({ shape: 'cylinder', diameter: 90, height: 90, wall: 2, assumed: ['height', 'wall'] });
  });
});

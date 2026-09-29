import { DEFAULT_MIX } from '@cretelab/engine';
import { describe, expect, it } from 'vitest';
import {
  decodeBagTool, decodeDecor, decodePlanner, encodeBagTool, encodeDecor, encodePlanner,
  type PlannerState,
} from '../../app/utils/query';

const planner = (over: Partial<PlannerState> = {}): PlannerState => ({ q: '', volume: 1, tab: 'mix', mix: { ...DEFAULT_MIX }, ...over });

describe('planner URL state', () => {
  it('an empty query is the default state', () => {
    expect(decodePlanner({})).toEqual(planner());
  });

  it('defaults are left out of the URL', () => {
    expect(encodePlanner(planner())).toEqual({});
  });

  it('round-trips every field', () => {
    const state = planner({
      q: 'Einfahrt 6 x 3 m, 15 cm',
      volume: 2.7,
      tab: 'order',
      mix: {
        ...DEFAULT_MIX,
        strengthClass: 'C35/45',
        exposureClasses: ['XC4', 'XD3', 'XF4', 'XM1'],
        sieveLine: 'A/B16',
        consistency: 'F4',
        aggregate: 'basalt',
        cementType: 'CEM III/A 42.5 N',
        margin: 6,
        plasticizer: 'FM',
        airPct: 4.5,
        flyAshPct: 15,
        silicaFumePct: 8,
        waterproofingPct: 2,
        moisture: [5, 3, 2],
      },
    });
    const query = encodePlanner(state);
    expect(query).toMatchObject({ v: '2.7', tab: 'order', s: 'C35/45', x: 'XC4,XD3,XF4,XM1', mo: '5,3,2' });
    expect(decodePlanner(query)).toEqual(state);
  });

  it('keeps an explicitly empty exposure list', () => {
    const state = planner({ mix: { ...DEFAULT_MIX, exposureClasses: [] } });
    expect(decodePlanner(encodePlanner(state)).mix.exposureClasses).toEqual([]);
  });

  it('falls back to defaults for broken or out-of-range values', () => {
    const s = decodePlanner({ v: '-3', s: 'C99/99', x: 'XC4,NOPE', m: '50', air: 'lots', tab: 'truck', mo: '5,3' });
    expect(s.volume).toBe(1);
    expect(s.mix.strengthClass).toBe(DEFAULT_MIX.strengthClass);
    expect(s.mix.exposureClasses).toEqual(['XC4']);
    expect(s.mix.margin).toBe(9);
    expect(s.mix.airPct).toBe(0);
    expect(s.tab).toBe('mix');
    expect(s.mix.moisture).toBeNull();
  });

  it('takes the first value of repeated parameters', () => {
    expect(decodePlanner({ s: ['C30/37', 'C20/25'] }).mix.strengthClass).toBe('C30/37');
  });

  it('avoids float noise in the volume', () => {
    expect(encodePlanner(planner({ volume: 0.1 + 0.2 })).v).toBe('0.3');
  });
});

describe('decor URL state', () => {
  it('defaults to a hollow body with one open side and the furniture mix', () => {
    expect(decodeDecor({})).toMatchObject({ shape: 'hollow', open: 'one', count: 1, preset: 'diy-pce-30l-batch', length: null });
    expect(encodeDecor(decodeDecor({}))).toEqual({});
  });

  it('round-trips sizes in cm', () => {
    const q = { shape: 'cylinder', d: '40', h: '35', t: '2.5', n: '3', preset: 'diy-white-bowl-4kg', open: 'both' };
    expect(encodeDecor(decodeDecor(q))).toEqual(q);
  });

  it('ignores unknown shapes, presets and negative sizes', () => {
    const s = decodeDecor({ shape: 'pyramid', preset: 'secret', l: '-4', n: '0' });
    expect(s).toMatchObject({ shape: 'hollow', preset: 'diy-pce-30l-batch', length: null, count: 1 });
  });
});

describe('bag tool URL state', () => {
  it('round-trips the options as flags', () => {
    const q = { mix: 'c30', v: '0.25', zc: '1', lp: '1', p: 'BV' };
    const s = decodeBagTool(q);
    expect(s.options).toMatchObject({ extraCement: true, air: true, flyAsh: false, plasticizer: 'BV' });
    expect(encodeBagTool(s)).toEqual(q);
  });

  it('defaults to C25/30 and 100 litres', () => {
    expect(decodeBagTool({})).toMatchObject({ mix: 'c25', volume: 0.1 });
    expect(encodeBagTool(decodeBagTool({}))).toEqual({});
  });
});

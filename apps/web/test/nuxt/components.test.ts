import { DEFAULT_MIX, planProject, type MixInput } from '@cretelab/engine';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeAll, describe, expect, it } from 'vitest';
import { useNuxtApp } from '#imports';
import BagPanel from '~/components/BagPanel.vue';
import BagToolApp from '~/components/BagToolApp.vue';
import DescribeForm from '~/components/DescribeForm.vue';
import FineConcreteApp from '~/components/FineConcreteApp.vue';
import MixForm from '~/components/MixForm.vue';
import MixPanel from '~/components/MixPanel.vue';
import NumberInput from '~/components/NumberInput.vue';
import OrderPanel from '~/components/OrderPanel.vue';
import ProductionTabs from '~/components/ProductionTabs.vue';
import UnderstoodPanel from '~/components/UnderstoodPanel.vue';

// The texts below are German; the test browser would otherwise pick its own language.
beforeAll(async () => {
  await useNuxtApp().$i18n.setLocale('de');
});

const mix = (over: Partial<MixInput> = {}): MixInput => ({ ...DEFAULT_MIX, ...over });

describe('MixPanel', () => {
  it('shows the B 20 recipe per m³ and for the whole volume', async () => {
    const w = await mountSuspended(MixPanel, { props: { mix: mix(), volume: 0.5 } });
    const rows = w.findAll('tbody tr').map((r) => r.text());
    expect(rows[0]).toContain('Zement CEM I 42.5 N');
    expect(rows.some((r) => r.includes('Gesteinskörnung B32'))).toBe(true);
    expect(w.text()).toContain('für 0,50 m³');
    expect(w.findAll('ol.steps li').length).toBeGreaterThanOrEqual(4);
  });

  it('explains why F4 needs a superplasticiser instead of showing a recipe', async () => {
    const w = await mountSuspended(MixPanel, { props: { mix: mix({ consistency: 'F4' }), volume: 1 } });
    expect(w.find('[role="alert"]').text()).toContain('F4');
    expect(w.find('table').exists()).toBe(false);
  });

  it('suggests ordering from 1 m³', async () => {
    const small = await mountSuspended(MixPanel, { props: { mix: mix(), volume: 0.3 } });
    const large = await mountSuspended(MixPanel, { props: { mix: mix(), volume: 2 } });
    expect(small.text()).not.toContain('Transportbeton meist günstiger');
    expect(large.text()).toContain('Transportbeton meist günstiger');
  });

  it('lists air-entraining agent and plasticiser when used', async () => {
    const w = await mountSuspended(MixPanel, { props: { mix: mix({ airPct: 4.5, plasticizer: 'BV', exposureClasses: ['XF3'] }), volume: 1 } });
    expect(w.text()).toContain('Luftporenbildner (Ziel 4,5 % Luft)');
    expect(w.text()).toContain('Betonverflüssiger (BV)');
  });
});

describe('BagPanel', () => {
  it('recommends a DIY product with its bag count and datasheet', async () => {
    const w = await mountSuspended(BagPanel, { props: { mix: mix({ strengthClass: 'C20/25', exposureClasses: ['XC1'] }), volume: 0.2 } });
    expect(w.find('h3').text()).toMatch(/weber|SAKRET|quick-mix/);
    expect(w.text()).toContain('× 40 kg');
    expect(w.find('a[href$=".pdf"]').exists()).toBe(true);
    expect(w.text()).toContain('Außer Wasser nichts untermischen');
  });

  it('says no for watertight concrete and names the reason', async () => {
    const w = await mountSuspended(BagPanel, { props: { mix: mix({ waterproofingPct: 2 }), volume: 0.2 } });
    expect(w.text()).toContain('Mit Sackbeton geht es hier nicht.');
    expect(w.text()).toContain('Kein Sackbeton ist als WU-Beton deklariert');
  });

  it('says no for wear classes no bag declares', async () => {
    const w = await mountSuspended(BagPanel, { props: { mix: mix({ exposureClasses: ['XM2'], strengthClass: 'C35/45' }), volume: 0.2 } });
    expect(w.text()).toContain('für XM2 deklariert');
  });

  it('flags walls thinner than three times the largest grain', async () => {
    // The finest DIY product has 6 mm grain (KOBA), so 15 mm walls are too thin, 20 mm are fine.
    const thin = await mountSuspended(BagPanel, { props: { mix: mix({ exposureClasses: ['X0'], strengthClass: 'C16/20' }), volume: 0.02, wall: 0.015 } });
    const ok = await mountSuspended(BagPanel, { props: { mix: mix({ exposureClasses: ['X0'], strengthClass: 'C16/20' }), volume: 0.02, wall: 0.02 } });
    expect(thin.text()).toContain('Zu dünn: 15 mm');
    expect(ok.text()).not.toContain('Zu dünn');
  });
});

describe('OrderPanel', () => {
  it('writes the order line after DIN EN 206 / DIN 1045-2', async () => {
    const w = await mountSuspended(OrderPanel, {
      props: { mix: mix({ strengthClass: 'C25/30', exposureClasses: ['XC4', 'XF1'] }), volume: 2.3 },
    });
    const text = w.find('[data-testid="order-text"]').text();
    expect(text).toContain('C25/30 · XC4, XF1 · WF · F3 · Dmax 32 mm · Cl 0,40');
    expect(text).toContain('Menge: 2,5 m³');
  });

  it('warns about the small-quantity surcharge below 1 m³', async () => {
    const w = await mountSuspended(OrderPanel, { props: { mix: mix(), volume: 0.4 } });
    expect(w.find('.note').classes()).toContain('warn');
    expect(w.text()).toContain('Mindermengenzuschlag');
  });

  it('asks for air-entrained concrete when air is planned', async () => {
    const w = await mountSuspended(OrderPanel, { props: { mix: mix({ airPct: 5.5, exposureClasses: ['XF4'] }), volume: 3 } });
    expect(w.find('[data-testid="order-text"]').text()).toContain('Luftporenbeton, Luftgehalt mindestens 5,5 %');
  });
});

describe('DescribeForm', () => {
  it('submits on Enter and not on Shift+Enter', async () => {
    const w = await mountSuspended(DescribeForm, { props: { examples: true } });
    const box = w.find('textarea');
    await box.setValue('Kellerwand');
    await box.trigger('keydown', { key: 'Enter', shiftKey: true });
    expect(w.emitted('submit')).toBeUndefined();
    await box.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('submit')).toEqual([['Kellerwand']]);
  });

  it('hides the examples after a search and brings them back when the box is emptied', async () => {
    const w = await mountSuspended(DescribeForm, { props: { examples: true } });
    expect(w.find('.examples').exists()).toBe(true);
    await w.findAll('.example')[0]!.trigger('click');
    expect(w.emitted('submit')![0]![0]).toContain('Fundament');
    expect(w.find('.examples').exists()).toBe(false);
    await w.find('textarea').setValue('');
    expect(w.find('.examples').exists()).toBe(true);
  });

  it('does not submit blank text', async () => {
    const w = await mountSuspended(DescribeForm);
    await w.find('textarea').setValue('   ');
    await w.find('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
  });
});

describe('NumberInput', () => {
  it('accepts the German decimal comma', async () => {
    const w = await mountSuspended(NumberInput, { props: { modelValue: 1 } });
    await w.find('input').setValue('2,5');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([2.5]);
  });

  it('marks values out of range and does not pass them on', async () => {
    const w = await mountSuspended(NumberInput, { props: { modelValue: 5, max: 12 } });
    await w.find('input').setValue('40');
    expect(w.find('input').attributes('aria-invalid')).toBe('true');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('an optional field may be emptied', async () => {
    const w = await mountSuspended(NumberInput, { props: { modelValue: 5, optional: true } });
    await w.find('input').setValue('');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([null]);
  });
});

describe('ProductionTabs', () => {
  it('moves between the tabs with the arrow keys (WAI-ARIA tabs)', async () => {
    const w = await mountSuspended(ProductionTabs, {
      props: { modelValue: 'mix' as const, recommended: 'bag' as const },
      slots: { bag: () => 'BAG', mix: () => 'MIX', order: () => 'ORDER' },
    });
    expect(w.find('[role="tabpanel"]').text()).toBe('MIX');
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['order']);
    await w.setProps({ modelValue: 'order' });
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['bag']);
    await w.setProps({ modelValue: 'bag' });
    expect(w.find('#tab-bag').attributes('aria-selected')).toBe('true');
    expect(w.find('[role="tabpanel"]').text()).toBe('BAG');
    expect(w.find('#tab-bag .badge').exists()).toBe(true);
  });
});

describe('BagPanel and additions', () => {
  it('warns when the description asks to add cement to a bag', async () => {
    const w = await mountSuspended(BagPanel, { props: { mix: mix({ exposureClasses: ['XC1'], strengthClass: 'C20/25' }), volume: 0.1, asksForAdditions: true } });
    expect(w.text()).toContain('Die Hersteller verbieten das');
  });
});

describe('UnderstoodPanel', () => {
  const driveway = {
    answers: { rain: { noul: 0.93 }, frost: { noul: 0.93 }, shape: { choice: 'slab' }, 'role:15 cm': { choice: 'thickness' } },
    candidates: ['6x3 m', '15 cm'], model: 'laya-crete', ms: 50,
  };

  it('shows each measurement with its role and the calculation', async () => {
    const plan = planProject('Einfahrt 6 x 3 m, 15 cm stark', driveway);
    const w = await mountSuspended(UnderstoodPanel, { props: { analysis: driveway, plan, volume: plan.volume.volume } });
    expect(w.find('h2').text()).toBe('Das wurde automatisch verstanden');
    const tags = w.find('[data-testid="understood-volume"]').text();
    expect(tags).toContain('Form: Platte');
    expect(tags).toContain('6x3 m Länge × Breite');
    expect(tags).toContain('15 cm Dicke');
    expect(w.find('[data-testid="volume-formula"]').text()).toBe('6 m × 3 m × 0,15 m = 2,70 m³');
  });

  it('marks a missing size in colour', async () => {
    const analysis = { answers: {}, candidates: [], model: 'laya-crete', ms: 50 };
    const plan = planProject('Kellerwand', analysis);
    const w = await mountSuspended(UnderstoodPanel, { props: { analysis, plan, volume: 1 } });
    expect(w.find('.chip.missing').text()).toBe('Keine Maße erkannt, gerechnet mit 1,00 m³');
    expect(w.find('[data-testid="volume-formula"]').exists()).toBe(false);
  });

  it('greys out measurements that play no part and notes a hand-edited amount', async () => {
    const analysis = { answers: { shape: { choice: 'slab' }, 'role:40 kg': { choice: 'other' } }, candidates: ['40 kg'], model: 'x', ms: 1 };
    const plan = planProject('Sack 40 kg', analysis);
    const w = await mountSuspended(UnderstoodPanel, { props: { analysis, plan, volume: 2 } });
    expect(w.find('[data-testid="understood-volume"] .chip.no').text()).toContain('nicht verwendet');
    expect(w.text()).toContain('von Hand auf 2,00 m³ geändert');
  });
});

describe('MixForm moisture', () => {
  it('the moisture fields are always there, disabled until moisture is switched on', async () => {
    const w = await mountSuspended(MixForm, { props: { mix: mix(), volume: 1 } });
    const fieldset = w.findAll('fieldset').find((f) => f.text().includes('Eigenfeuchte der Gesteinskörnung'))!;
    const inputs = fieldset.findAll('input[type="text"]');
    expect(inputs).toHaveLength(3);
    expect(inputs.every((i) => i.attributes('disabled') !== undefined)).toBe(true);
    expect(inputs.map((i) => (i.element as HTMLInputElement).value)).toEqual(['5', '3', '2']);
    await fieldset.find('input[type="checkbox"]').setValue(true);
    expect(w.emitted('update:mix')).toBeUndefined(); // the model object is changed in place
    expect(fieldset.text()).toContain('vom Zugabewasser abgezogen');
  });

  it('sits between the exposure classes and the additions', async () => {
    const w = await mountSuspended(MixForm, { props: { mix: mix(), volume: 1 } });
    expect(w.findAll('legend').map((l) => l.text())).toEqual([
      'Expositionsklassen', 'Eigenfeuchte der Gesteinskörnung', 'Zusatzmittel und Zusatzstoffe',
    ]);
  });
});

describe('BagToolApp result', () => {
  it('shows the starting mix next to the estimate with the difference', async () => {
    const w = await mountSuspended(BagToolApp, { route: '/de/bag?zc=1' });
    const compare = w.find('[data-testid="strength-compare"]');
    expect(compare.text()).toContain('Ausgangsmischung');
    expect(compare.text()).toContain('ca. 31 N/mm² Festigkeit');
    expect(compare.text()).toContain('ca. 36 N/mm² Festigkeit');
    expect(compare.find('.delta.up').text()).toBe('+5 N/mm²');
  });

  it('air entrainment lowers the estimate', async () => {
    const w = await mountSuspended(BagToolApp, { route: '/de/bag?lp=1' });
    expect(w.find('.delta.down').text()).toBe('−14 N/mm²');
  });
});

describe('assumptions are visible', () => {
  it('the planner lists assumed sizes as tags', async () => {
    const analysis = { answers: { element: { choice: 'small' }, approach: { choice: 'scratch' }, shape: { choice: 'block' }, 'role:50 cm': { choice: 'height' } }, candidates: ['50 cm'], model: 'x', ms: 1 };
    const plan = planProject('Betonklotz 50 cm', analysis);
    const w = await mountSuspended(UnderstoodPanel, { props: { analysis, plan, volume: plan.volume.volume } });
    expect(w.findAll('.chip.assumed').map((c) => c.text())).toEqual(['angenommen: Länge 50 cm', 'angenommen: Breite 50 cm']);
    expect(w.find('[data-testid="volume-formula"]').text()).toBe('50 cm × 50 cm × 50 cm = 0,13 m³');
  });

  it('the fine concrete page notes assumed sizes until they are edited', async () => {
    const w = await mountSuspended(FineConcreteApp, { route: '/de/fine-concrete?shape=cylinder&d=90&h=90&t=2&as=height,wall' });
    expect(w.find('[data-testid="assumed-note"]').text()).toContain('Höhe 90 cm, Wandstärke 2 cm');
    await w.find('input[id$="-height"]').setValue('70');
    expect(w.find('[data-testid="assumed-note"]').text()).not.toContain('Höhe');
  });
});

describe('fine concrete for pieces that hold water', () => {
  it('shows the sealing advice when the piece holds water', async () => {
    const w = await mountSuspended(FineConcreteApp, { route: '/de/fine-concrete?l=60&b=40&h=15&t=2&hw=1&preset=diy-mortar-20kg-batch' });
    expect(w.find('[data-testid="holds-water"]').text()).toContain('versiegeln');
  });
});

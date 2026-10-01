import { DEFAULT_MIX, computeRecipe, planProject, type MixInput } from '@cretelab/engine';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import type { DOMWrapper } from '@vue/test-utils';
import { useNuxtApp, useRuntimeConfig } from '#imports';
import BagPanel from '~/components/BagPanel.vue';
import BagToolApp from '~/components/BagToolApp.vue';
import DescribeForm from '~/components/DescribeForm.vue';
import FineConcreteApp from '~/components/FineConcreteApp.vue';
import MixForm from '~/components/MixForm.vue';
import MixPanel from '~/components/MixPanel.vue';
import NeedsSummary from '~/components/NeedsSummary.vue';
import StrengthScale from '~/components/StrengthScale.vue';
import ThinkingStatus from '~/components/ThinkingStatus.vue';
import NumberInput from '~/components/NumberInput.vue';
import OrderPanel from '~/components/OrderPanel.vue';
import ProductionTabs from '~/components/ProductionTabs.vue';
import UnderstoodPanel from '~/components/UnderstoodPanel.vue';
import LegalPage from '~/pages/legal.vue';
import PrivacyPage from '~/pages/privacy.vue';

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

  it('splits the job into batches by the bag, gravel in buckets and shovels', async () => {
    const w = await mountSuspended(MixPanel, { props: { mix: mix(), volume: 3 } });
    const plan = w.find('[data-testid="batch-plan"]');
    expect(plan.find('[data-testid="batch-summary"]').text()).toMatch(/^\d+ Mischungen mit je 1 Sack \(25 kg\) Zement, zusammen \d+ Sack\.$/);
    expect(plan.text()).toMatch(/Sand und Kies B32, feucht vom Haufen\s*[\d½]+ Eimer, etwa \d+ Schaufeln/);
    await plan.findAll('input[type="radio"]')[2]!.setValue(true);
    expect(plan.find('[data-testid="batch-summary"]').text()).toContain('je ½ Sack Zement');
  });

  it('a 180 l drum takes 1½ bags per batch: Ringanker C25/30, 3 m³', async () => {
    const ring = mix({ strengthClass: 'C25/30', exposureClasses: ['XC4', 'XF1'], sieveLine: 'B16' });
    const w = await mountSuspended(MixPanel, { props: { mix: ring, volume: 3 } });
    const summary = () => w.find('[data-testid="batch-summary"]').text();
    expect(summary()).toBe('41 Mischungen mit je 1 Sack (25 kg) Zement, zusammen 41 Sack.');
    await w.find('[data-testid="batch-plan"]').findAll('input[type="radio"]')[1]!.setValue(true);
    expect(summary()).toBe('27 Mischungen mit je 1½ Sack (37,5 kg) Zement, zusammen 41 Sack.');
  });

  it('a bucket up to one is singular: "½ bucket", "1 shovel"', async () => {
    await useNuxtApp().$i18n.setLocale('en');
    const w = await mountSuspended(MixPanel, { props: { mix: mix(), volume: 0.005 } });
    const text = w.find('[data-testid="batch-plan"]').text();
    expect(text).toMatch(/½ bucket\b(?!s)/);
    expect(text).not.toContain('½ buckets');
    await useNuxtApp().$i18n.setLocale('de');
  });

  it('a few litres are one batch with the cement in kilograms', async () => {
    const w = await mountSuspended(MixPanel, { props: { mix: mix(), volume: 0.02 } });
    expect(w.find('[data-testid="batch-summary"]').text()).toBe('Das passt in eine Mischung.');
    // Nothing to choose: every mixer takes it in one go.
    expect(w.find('[data-testid="batch-plan"] [role="radiogroup"]').exists()).toBe(false);
    expect(w.find('[data-testid="batch-plan"] tbody tr').text()).toMatch(/Zement CEM I 42.5 N\s*[\d,]+ kg/);
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

  it('calls two sizes with a run length a cross-section: Ringanker 24x25 cm, 50 m', async () => {
    const analysis = {
      answers: { shape: { choice: 'block' }, open_sides: { choice: 'solid' }, 'role:50 m': { choice: 'length' } },
      candidates: ['24x25 cm', '50 m'], model: 'laya-crete', ms: 50,
    };
    const plan = planProject('Ringanker 24x25cm ca. 50 Meter', analysis);
    const w = await mountSuspended(UnderstoodPanel, { props: { analysis, plan, volume: plan.volume.volume } });
    expect(w.find('[data-testid="understood-volume"]').text()).toContain('24x25 cm Querschnitt');
    expect(w.find('[data-testid="volume-formula"]').text()).toBe('50 m × 0,24 m × 0,25 m = 3,00 m³');
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

  it('sits between the exposure classes and the admixtures', async () => {
    const w = await mountSuspended(MixForm, { props: { mix: mix(), volume: 1 } });
    expect(w.findAll('legend').map((l) => l.text())).toEqual([
      'Expositionsklassen', 'Eigenfeuchte der Gesteinskörnung', 'Zusatzmittel', 'Zusatzstoffe',
    ]);
  });
});

describe('NeedsSummary', () => {
  it('the concrete is the heading; a scale says how strong the class is and what it is for', async () => {
    const w = await mountSuspended(NeedsSummary, { props: { mix: mix({ strengthClass: 'C25/30' }), volume: 0.32 } });
    expect(w.find('h2').text()).toBe('0,32 m³ Beton C25/30');
    const scale = w.find('[data-testid="strength-scale"]');
    expect(scale.find('figcaption').text()).toBe('C25/30 solide · Wände, Decken, Treppen, außen');
    expect(scale.findAll('.step.marked').map((s) => s.text())).toEqual(['25']);
    expect(scale.find('[role="img"]').attributes('aria-label')).toBe('C25/30, solide (Skala von sehr schwach bis extrem fest)');
    await w.setProps({ mix: mix({ strengthClass: 'C70/85' }) });
    expect(scale.findAll('.step.marked').map((s) => s.text())).toEqual(['55+']);
  });

  it('the bag tool shows where the bag starts and where the additions take it', async () => {
    const w = await mountSuspended(StrengthScale, {
      props: { marks: [{ cls: 'C25/30', kind: 'from', label: 'Ausgangsmischung' }, { cls: 'C30/37', kind: 'main', label: 'Geschätzt mit Zusätzen' }] },
    });
    expect(w.findAll('.pointer')).toHaveLength(2);
    expect(w.find('figcaption').text()).toBe('Ausgangsmischung: C25/30 solide → Geschätzt mit Zusätzen: C30/37 fest · Außenbauteile, Stützen');
    await w.setProps({ marks: [{ cls: 'C25/30', kind: 'from', label: 'Ausgangsmischung' }, { cls: 'C25/30', kind: 'main', label: 'Noch ohne Zusätze' }] });
    expect(w.findAll('.pointer')).toHaveLength(1);
  });

  it('additions keep the class: the recipe needs less cement for it', async () => {
    const plain = computeRecipe(mix({ strengthClass: 'C25/30' }));
    const withAsh = computeRecipe(mix({ strengthClass: 'C25/30', flyAshPct: 10, silicaFumePct: 8 }));
    expect(plain.ok && withAsh.ok).toBe(true);
    if (!plain.ok || !withAsh.ok) return;
    expect(withAsh.recipe.materials.cement).toBeLessThan(plain.recipe.materials.cement);
  });
});

describe('MixForm admixtures and additions', () => {
  const row = (w: { findAll: (s: string) => DOMWrapper<Element>[] }, name: string) =>
    w.findAll('.addition').find((r) => r.find('strong').text() === name)!;

  it('one row per substance: off, the box shows a typical dose, a sentence explains it', async () => {
    const w = await mountSuspended(MixForm, { props: { mix: mix(), volume: 1 } });
    expect(w.findAll('.addition').map((r) => r.find('strong').text())).toEqual([
      'Verflüssiger', 'Luftporenbildner', 'Dichtungsmittel', 'Flugasche', 'Silikastaub',
    ]);
    const fly = row(w, 'Flugasche');
    expect((fly.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false);
    expect(fly.find('input[type="text"]').attributes('disabled')).toBeDefined();
    expect((fly.find('input[type="text"]').element as HTMLInputElement).value).toBe('10');
    expect(fly.text()).toContain('Ersetzt einen Teil des Zements');
  });

  // As in the app, the mix is reactive state that the form changes in place.
  it('the checkbox switches the dose on and off and remembers what was typed', async () => {
    const m = reactive(mix());
    const w = await mountSuspended(MixForm, { props: { mix: m, volume: 1 } });
    const fly = row(w, 'Flugasche');
    await fly.find('input[type="checkbox"]').setValue(true);
    expect(m.flyAshPct).toBe(10);
    await fly.find('input[type="text"]').setValue('20');
    expect(m.flyAshPct).toBe(20);
    await fly.find('input[type="checkbox"]').setValue(false);
    expect(m.flyAshPct).toBe(0);
    await fly.find('input[type="checkbox"]').setValue(true);
    expect(m.flyAshPct).toBe(20);
  });

  it('box and name are one label; a click on the dose field does not toggle', async () => {
    const m = reactive(mix({ flyAshPct: 20 }));
    const w = await mountSuspended(MixForm, { props: { mix: m, volume: 1 } });
    const fly = row(w, 'Flugasche');
    expect(fly.find('label.check').text()).toBe('Flugasche');
    expect(fly.find('label.check input[type="text"]').exists()).toBe(false);
    await fly.find('input[type="text"]').trigger('click');
    expect(m.flyAshPct).toBe(20);
  });

  it('the plasticiser row switches between none, BV and FM', async () => {
    const m = reactive(mix());
    const w = await mountSuspended(MixForm, { props: { mix: m, volume: 1 } });
    const p = row(w, 'Verflüssiger');
    await p.find('input[type="checkbox"]').setValue(true);
    expect(m.plasticizer).toBe('BV');
    await p.find('select').setValue('FM');
    expect(m.plasticizer).toBe('FM');
    await p.find('input[type="checkbox"]').setValue(false);
    expect(m.plasticizer).toBe('none');
  });

  it('switching air on starts at the minimum for the grain', async () => {
    const m = reactive(mix());
    const w = await mountSuspended(MixForm, { props: { mix: m, volume: 1 } });
    await row(w, 'Luftporenbildner').find('input[type="checkbox"]').setValue(true);
    expect(m.airPct).toBeGreaterThanOrEqual(3.5);
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

describe('fine concrete handling notes', () => {
  it('shows practical notes instead of technical figures', async () => {
    const w = await mountSuspended(FineConcreteApp, { route: '/de/fine-concrete?preset=diy-mortar-20kg-batch' });
    const text = w.find('.handling').text();
    expect(text).toContain('Wichtig beim Mischen');
    expect(text).toContain('FFP2-Maske');
    expect(text).toContain('Handschuhe');
    expect(w.text()).not.toContain('Wasser/Bindemittel');
    expect(w.text()).not.toContain('Rohdichte');
  });

  it('mentions only what is in the recipe', async () => {
    const w = await mountSuspended(FineConcreteApp, { route: '/de/fine-concrete?preset=diy-white-bowl-4kg' });
    const text = w.find('.handling').text();
    expect(text).toContain('Glasfasern');
    expect(text).not.toContain('Mikrosilica');
    expect(text).not.toContain('Quarzmehl');
  });
});

describe('DescribeForm errors', () => {
  it('a busy model gets a friendly message instead of a status code', async () => {
    const w = await mountSuspended(DescribeForm, { props: { error: 'busy' } });
    expect(w.find('[role="alert"]').text()).toContain('in ein paar Sekunden');
    expect(w.find('[role="alert"]').text()).not.toContain('HTTP');
  });

  it('a gateway timeout asks for a shorter description, and the box stops at 300 characters', async () => {
    const w = await mountSuspended(DescribeForm, { props: { error: 'timeout' } });
    expect(w.find('[role="alert"]').text()).toContain('zu lange');
    expect(w.find('textarea').attributes('maxlength')).toBe('300');
  });

  it('while waiting the button says it is working, not that the model is busy', async () => {
    const w = await mountSuspended(DescribeForm, { props: { initial: 'Kellerwand', busy: true } });
    expect(w.find('button[type="submit"]').text()).toContain('Wird ausgewertet');
  });

  it('an analysed description can be sent again once it changes, or after an error', async () => {
    const w = await mountSuspended(DescribeForm, { props: { initial: 'Kellerwand', submitLabel: 'describe.reanalyse' } });
    const button = w.find('button[type="submit"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.attributes('title')).toContain('Ändern');
    await w.find('textarea').setValue('Kellerwand, 30 cm');
    expect(button.attributes('disabled')).toBeUndefined();
    await w.find('textarea').setValue('Kellerwand');
    await w.setProps({ error: 'busy' });
    expect(button.attributes('disabled')).toBeUndefined();
    await w.find('form').trigger('submit');
    expect(w.emitted('submit')).toEqual([['Kellerwand']]);
  });
});

describe('legal notice and privacy policy', () => {
  const legal = () => useRuntimeConfig().public.legal as Record<string, string>;
  const set = (v: Record<string, string>) => Object.assign(legal(), v);
  const clear = () => set({ name: '', street: '', city: '', country: '', email: '', hosting: '' });

  it('without .env values the pages say what is missing instead of showing an address', async () => {
    clear();
    const w = await mountSuspended(LegalPage);
    expect(w.find('[data-testid="operator-missing"]').text()).toContain('.env');
    expect(w.find('address').exists()).toBe(false);
  });

  it('the legal notice is name and address only (§ 18 (1) MStV)', async () => {
    set({ name: 'Max Mustermann', street: 'Musterstraße 1', city: '12345 Musterstadt' });
    const w = await mountSuspended(LegalPage);
    expect(w.find('address').text()).toContain('Musterstraße 1');
    expect(w.text()).toContain('§ 18 Abs. 1');
    expect(w.find('a[href^="mailto:"]').exists()).toBe(false);
    clear();
  });

  it('an email address appears when LEGAL_EMAIL is set', async () => {
    set({ name: 'Max Mustermann', street: 'Musterstraße 1', city: '12345 Musterstadt', email: 'kontakt@example.org' });
    const w = await mountSuspended(LegalPage);
    expect(w.find('a[href="mailto:kontakt@example.org"]').exists()).toBe(true);
    clear();
  });

  it('the privacy policy names the controller, the browser storage and the hosting', async () => {
    set({ name: 'Max Mustermann', street: 'Musterstraße 1', city: '12345 Musterstadt', email: 'kontakt@example.org' });
    const w = await mountSuspended(PrivacyPage);
    expect(w.find('address').text()).toContain('Max Mustermann');
    expect(w.text()).toContain('cretelab_locale');
    expect(w.text()).toContain('sessionStorage');
    expect(w.find('[data-testid="hosting"]').text()).toContain('selbst betrieben');
    set({ hosting: 'Hoster GmbH, Beispielweg 2, 10115 Berlin' });
    const w2 = await mountSuspended(PrivacyPage);
    expect(w2.find('[data-testid="hosting"]').text()).toContain('Hoster GmbH');
    clear();
  });
});

describe('ThinkingStatus', () => {
  it('types a step, deletes it from the end and types the next one', async () => {
    vi.useFakeTimers();
    const w = await mountSuspended(ThinkingStatus);
    const typed = () => w.find('.typed').text();
    vi.advanceTimersByTime(60 * 5);
    await nextTick();
    expect('Beschreibung lesen …'.startsWith(typed())).toBe(true);
    expect(typed().length).toBeGreaterThan(2);
    vi.advanceTimersByTime(60 * 30 + 1400 + 30 * 30 + 60 * 4);
    await nextTick();
    expect('Maße und Form erkennen …'.startsWith(typed())).toBe(true);
    expect(w.find('[aria-live]').text()).toBe('Maße und Form erkennen …');
    w.unmount();
    vi.useRealTimers();
  });

  it('shows up below the text box while the model works', async () => {
    const w = await mountSuspended(DescribeForm, { props: { initial: 'Kellerwand', busy: true } });
    expect(w.find('[data-testid="thinking"]').exists()).toBe(true);
    await w.setProps({ busy: false });
    expect(w.find('[data-testid="thinking"]').exists()).toBe(false);
  });
});

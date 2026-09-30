<template>
  <div class="stack">
    <p v-if="routedFrom" class="note">{{ $t('fineConcrete.routed') }}</p>
    <DescribeForm :initial="state.q" :busy="busy" :error="error" submit-label="describe.reanalyse" @submit="onDescribe" />

    <section class="card" aria-labelledby="piece-title">
      <h2 id="piece-title">{{ $t('fineConcrete.piece') }}</h2>
      <div class="shapes" role="radiogroup" :aria-label="$t('fineConcrete.shape')">
        <label v-for="s in DECOR_SHAPES" :key="s" class="shape" :class="{ active: state.shape === s }">
          <input v-model="state.shape" type="radio" :value="s" class="visually-hidden" />
          {{ $t(`volume.shape.${s}`) }}
        </label>
      </div>
      <div class="grid dims">
        <div v-for="f in fields" :key="f" class="field">
          <label :for="`${id}-${f}`">{{ $t(`fineConcrete.dim.${f}`) }}</label>
          <span v-if="f === 'wall' && state.shape === 'cylinder'" class="hint">{{ $t('fineConcrete.dim.wallOptional') }}</span>
          <NumberInput :id="`${id}-${f}`" v-model="state[f]" optional :min="0.01" :max="10000" :digits="2" @input="confirm(f)" />
        </div>
        <div class="field">
          <label :for="`${id}-count`">{{ $t('fineConcrete.dim.count') }}</label>
          <NumberInput :id="`${id}-count`" v-model="countField" :min="1" :max="1000" :digits="0" />
        </div>
        <div v-if="hollow" class="field">
          <label :for="`${id}-open`">{{ $t('fineConcrete.dim.open') }}</label>
          <select :id="`${id}-open`" v-model="state.open">
            <option v-for="o in ['one', 'none', 'both']" :key="o" :value="o">{{ $t(`volume.open.${o}`) }}</option>
          </select>
        </div>
      </div>
      <p v-if="shownAssumed.length" class="note warn small" data-testid="assumed-note">
        {{ $t('fineConcrete.assumed', { sizes: shownAssumed.join(', ') }) }}
      </p>
      <p class="volume" aria-live="polite">
        <template v-if="volume">{{ $t('fineConcrete.volume', { volume: vol(volume) }) }}</template>
        <template v-else>{{ $t('fineConcrete.volumeMissing', { volume: vol(DIY_DEFAULT_VOLUME_M3) }) }}</template>
      </p>
      <p v-if="thickWall" class="note">{{ $t('fineConcrete.thickWall') }} <NuxtLinkLocale to="/plan">{{ $t('nav.planner') }}</NuxtLinkLocale></p>
    </section>

    <section class="card stack" aria-labelledby="recipe-title">
      <h2 id="recipe-title">{{ $t('fineConcrete.recipe') }}</h2>
      <div class="field">
        <label :for="`${id}-preset`">{{ $t('fineConcrete.preset') }}</label>
        <select :id="`${id}-preset`" v-model="state.preset">
          <option v-for="p in presets" :key="p.key" :value="p.key">
            {{ $t('fineConcrete.presetOption', { fck: expectedFck(p), label: $t(`fineConcrete.presets.${p.key}.label`) }) }}
          </option>
        </select>
        <span class="hint">{{ $t(`fineConcrete.presets.${preset.key}.use`) }}</span>
      </div>
      <p v-if="state.holdsWater" class="note" data-testid="holds-water">{{ $t('fineConcrete.holdsWater') }}</p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ $t('mix.material') }}</th>
              <th class="num">{{ $t('fineConcrete.perLitre') }}</th>
              <th class="num">{{ $t('mix.total', { volume: vol(batchVolume) }) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <td>{{ $t(`fineConcrete.row.${row.key}`) }}<div class="small muted">{{ $t(`fineConcrete.row.${row.key}Note`) }}</div></td>
              <td class="num">{{ amount(row.value / litres, row.unit) }}</td>
              <td class="num">{{ amount(row.value, row.unit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section class="handling" aria-labelledby="handling-title">
        <h3 id="handling-title">{{ $t('fineConcrete.handling.title') }}</h3>
        <ul>
          <li v-for="n in notes" :key="n">{{ $t(`fineConcrete.handling.${n}`) }}</li>
        </ul>
      </section>

      <div>
        <h3>{{ $t('fineConcrete.steps') }}</h3>
        <ol class="steps">
          <li v-for="(step, i) in steps" :key="i"><strong>{{ step.title }}</strong>{{ step.text }}</li>
        </ol>
      </div>

      <details>
        <summary>{{ $t('fineConcrete.source.title') }}</summary>
        <dl class="source small">
          <dt>{{ $t('fineConcrete.source.work') }}</dt>
          <dd>{{ preset.source.title }} – {{ preset.source.author }}</dd>
          <dt>{{ $t('fineConcrete.source.link') }}</dt>
          <dd><a :href="preset.source.url" target="_blank" rel="noopener noreferrer">{{ host(preset.source.url) }}</a></dd>
          <dt>{{ $t('fineConcrete.source.checked') }}</dt>
          <dd>{{ preset.source.retrieved }}</dd>
          <dt>{{ $t('fineConcrete.source.strength') }}</dt>
          <dd>{{ strengthText }}</dd>
        </dl>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
// Fine concrete page: thin pieces from fine mortar. Shape and size give the volume, a published
// recipe is scaled to it. No exposure classes: these mixes are outside B 20.
import {
  DECOR_PRESETS, DIY_DEFAULT_VOLUME_M3, MIN_SITE_CONCRETE_WALL_M, decorPreset, handlingNotes, expectedFck,
  planProject, scaleDecorRecipe, shapeVolume, type Shape,
} from '@cretelab/engine';
import { formatAmount, formatCompact, formatNumber, formatVolume, type Locale } from '~/utils/format';
import { fineConcreteStateFromPlan, plannerStateFromPlan } from '~/utils/project';
import { decodeFineConcrete, encodeFineConcrete, encodePlanner, type FineConcreteField, type FineConcreteState } from '~/utils/query';

const DECOR_SHAPES: Shape[] = ['hollow', 'cylinder', 'ring', 'bowl', 'block', 'cube', 'slab'];
const FIELDS: Record<Shape, (keyof FineConcreteState & ('length' | 'width' | 'height' | 'diameter' | 'wall'))[]> = {
  hollow: ['length', 'width', 'height', 'wall'],
  block: ['length', 'width', 'height'],
  slab: ['length', 'width', 'height'],
  cube: ['length'],
  cylinder: ['diameter', 'height', 'wall'],
  ring: ['diameter', 'height', 'wall'],
  bowl: ['diameter', 'wall'],
};

const { state, reset } = useUrlState(decodeFineConcrete, encodeFineConcrete);
const { analyse, busy, error } = useAnalysis();
const route = useRoute();
const localePath = useLocalePath();
const id = useId();
const { t, locale } = useI18n();
const loc = computed(() => locale.value as Locale);
const vol = (v: number) => formatVolume(loc.value, v);
const amount = (v: number, unit: 'kg' | 'l') => formatAmount(loc.value, v, unit);
const host = (url: string) => new URL(url).hostname;

const routedFrom = computed(() => route.query.from === 'planner' || route.query.from === 'home');
const fields = computed(() => FIELDS[state.value.shape]);
const countField = computed<number | null>({
  get: () => state.value.count,
  set: (v) => (state.value.count = Math.max(1, Math.round(v ?? 1))),
});

const m = (cm: number | null) => (cm === null ? undefined : cm / 100);
// A cylinder with a wall thickness is a round pot: a hollow body with a diameter.
const hollow = computed(() => state.value.shape === 'hollow' || (state.value.shape === 'cylinder' && state.value.wall !== null));
// Only the fields the shape shows count, so a diameter left over from another shape does not.
const volume = computed(() => {
  const dims = Object.fromEntries(fields.value.map((f) => [f, m(state.value[f])]));
  const shape = state.value.shape === 'cylinder' && hollow.value ? 'hollow' : state.value.shape;
  return shapeVolume(shape, { ...dims, open: state.value.open, count: state.value.count });
});
// An assumed size stops being an assumption as soon as the user types into its field.
function confirm(field: FineConcreteField) {
  state.value.assumed = state.value.assumed.filter((f) => f !== field);
}
const shownAssumed = computed(() =>
  state.value.assumed
    .filter((f) => fields.value.includes(f) && state.value[f] !== null)
    .map((f) => `${t(`facts.role.${f}`)} ${formatCompact(loc.value, state.value[f]!, 1)} cm`),
);

const batchVolume = computed(() => volume.value ?? DIY_DEFAULT_VOLUME_M3);
const litres = computed(() => batchVolume.value * 1000);
const thickWall = computed(() => (state.value.wall ?? 0) / 100 >= 2 * MIN_SITE_CONCRETE_WALL_M);

const presets = computed(() => [...DECOR_PRESETS].sort((a, b) => expectedFck(a) - expectedFck(b)));
const preset = computed(() => decorPreset(state.value.preset) ?? DECOR_PRESETS[0]!);
const recipe = computed(() => scaleDecorRecipe(preset.value, batchVolume.value));
const notes = computed(() => handlingNotes(recipe.value));

const rows = computed(() => {
  const r = recipe.value;
  const all = [
    { key: 'cement', value: r.cementKg, unit: 'kg' as const },
    { key: 'sand', value: r.sandKg, unit: 'kg' as const },
    { key: 'quartz', value: r.quartzPowderKg, unit: 'kg' as const },
    { key: 'fines', value: r.finesKg, unit: 'kg' as const },
    { key: 'microsilica', value: r.microsilicaKg, unit: 'kg' as const },
    { key: 'water', value: r.waterL, unit: 'l' as const },
    { key: 'pce', value: r.superplasticizerL, unit: 'l' as const },
    { key: 'fibres', value: r.fibresG / 1000, unit: 'kg' as const },
  ];
  return all.filter((row) => row.value > 0);
});

const stepValues = computed(() => {
  const r = recipe.value;
  return {
    cement: amount(r.cementKg, 'kg'),
    sand: amount(r.sandKg, 'kg'),
    quartz: amount(r.quartzPowderKg, 'kg'),
    fines: amount(r.finesKg, 'kg'),
    microsilica: amount(r.microsilicaKg, 'kg'),
    water: amount(r.waterL, 'l'),
    pce: amount(r.superplasticizerL, 'l'),
    fibres: amount(r.fibresG / 1000, 'kg'),
  };
});

// The text may continue the title with a comma or a colon, so the space is added only before words.
const steps = computed(() =>
  Array.from({ length: preset.value.steps }, (_, i) => {
    const text = t(`fineConcrete.presets.${preset.value.key}.steps.${i}.text`, stepValues.value);
    return { title: t(`fineConcrete.presets.${preset.value.key}.steps.${i}.title`), text: /^[,.;:]/.test(text) ? text : ` ${text}` };
  }),
);

const strengthText = computed(() => {
  const p = preset.value;
  if (p.measuredFck && p.airCuredFck) return t('fineConcrete.source.airCured', { air: p.airCuredFck, water: p.measuredFck });
  if (p.measuredFck) return t('fineConcrete.source.measured', { fck: p.measuredFck });
  return t('fineConcrete.source.estimated', { fck: p.estimatedFck ?? '–' });
});

async function onDescribe(text: string) {
  const result = await analyse(text);
  if (!result) return;
  const plan = planProject(text, result);
  if (plan.tool === 'planner') {
    await navigateTo({ path: localePath('/plan'), query: encodePlanner(plannerStateFromPlan(plan)) });
    return;
  }
  reset(fineConcreteStateFromPlan(plan));
}
</script>

<style scoped>
.shapes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.shape {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.3rem 0.9rem;
  cursor: pointer;
  font-weight: 500;
}

.shape.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.shape:focus-within {
  outline: 2px solid var(--accent);
}

.volume {
  font-size: 1.15rem;
  font-weight: 700;
  margin-top: 1rem;
}

.handling {
  border-left: 4px solid var(--warn);
  background: var(--warn-soft);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}

.handling h3 {
  margin-bottom: 0.4rem;
}

.handling ul {
  margin: 0;
  padding-left: 1.2rem;
}

.handling li + li {
  margin-top: 0.3rem;
}

.source {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.3rem 1rem;
}

.source dd {
  margin: 0;
}
</style>

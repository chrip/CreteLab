<template>
  <section class="batches" aria-labelledby="batch-title" data-testid="batch-plan">
    <h3 id="batch-title">{{ $t('mix.batch.title') }}</h3>

    <div v-if="choosable" class="mixers" role="radiogroup" :aria-label="$t('mix.batch.mixer')">
      <label v-for="m in MIXER_KEYS" :key="m" class="mixer" :class="{ active: mixer === m }">
        <input v-model="mixer" type="radio" :value="m" class="visually-hidden" />
        {{ $t(`mix.batch.mixers.${m}`) }}
      </label>
    </div>

    <p class="summary" data-testid="batch-summary">
      {{
        plan.batches === 1
          ? $t('mix.batch.one')
          : $t('mix.batch.many', { batches: plan.batches, bag: bagText, total: plan.totalBags })
      }}
    </p>

    <p class="ratio" data-testid="shovel-ratio">{{ ratioText }}</p>

    <div class="table-wrap">
      <table>
        <caption>{{ $t('mix.batch.per', { litres: plan.litresPerBatch }) }}</caption>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <th scope="row">{{ row.label }}</th>
            <td>{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!mix.moisture" class="small note" data-testid="batch-dry">{{ $t('mix.batch.dryHint') }}</p>
    <p class="small muted">{{ $t('mix.batch.ratioHint') }}</p>
    <p class="small muted">{{ $t('mix.batch.hint', { kg: BUCKET_KG, shovel: SHOVEL_KG, water: amount(plan.batch.waterL, 'l') }) }}</p>
  </section>
</template>

<script setup lang="ts">
// The recipe the way it is mixed on site: per batch, in bags, buckets and shovels.
import { BUCKET_KG, BUCKET_L, CEMENT_BAG_KG, MIXERS, SHOVEL_KG, batchPlan, type Mixer, type MixInput, type Recipe } from '@cretelab/engine';
import { formatAmount, formatCompact, formatHalves, type Locale } from '~/utils/format';

const props = defineProps<{ recipe: Recipe; volume: number; mix: MixInput }>();
const { t, locale } = useI18n();
const loc = computed(() => locale.value as Locale);
const amount = (v: number, unit: 'kg' | 'l') => formatAmount(loc.value, v, unit);

const MIXER_KEYS = Object.keys(MIXERS) as Mixer[];
const mixer = ref<Mixer>('drum140');
const plan = computed(() => batchPlan(props.recipe, props.volume, mixer.value));
// A job that fits into one batch in every mixer has nothing to choose.
const choosable = computed(() => MIXER_KEYS.some((m) => batchPlan(props.recipe, props.volume, m).batches > 1));

/** "½ Eimer", "1 bucket", "8½ buckets": singular up to one. */
const count = (key: 'bucket' | 'shovel', v: number) => t(`mix.batch.${key}${v <= 1 ? 'One' : 'Many'}`, { n: formatHalves(loc.value, v) });

const bagText = computed(() => {
  const b = plan.value.batch.bags;
  if (b === null) return '';
  if (b === 0.5) return t('mix.batch.bagHalf');
  return t(`mix.batch.bags${b === 1 ? 'One' : 'Many'}`, { n: formatHalves(loc.value, b), kg: formatCompact(loc.value, b * CEMENT_BAG_KG, 1) });
});

/** "1 Schaufel Zement auf 4 Schaufeln Sand und Kies", in the order they go into the drum. */
const ratioText = computed(() => {
  const r = plan.value.ratio;
  return t('mix.batch.ratio', { cement: count('shovel', r.cement), aggregate: count('shovel', r.aggregate) });
});

const rows = computed(() => {
  const b = plan.value.batch;
  const list = [
    { key: 'cement', label: t('mix.row.cement', { type: props.mix.cementType }), value: b.bags === null ? amount(b.cementKg, 'kg') : bagText.value },
    {
      key: 'aggregate',
      label: t(props.mix.moisture ? 'mix.batch.aggregate' : 'mix.batch.aggregateDry', { sieve: props.mix.sieveLine }),
      value: t('mix.batch.buckets', { buckets: count('bucket', b.buckets), shovels: count('shovel', b.shovels), kg: amount(b.aggregateKg, 'kg') }),
    },
    {
      key: 'water',
      label: t('mix.batch.water'),
      value: t('mix.batch.waterValue', { litres: amount(b.waterL, 'l'), buckets: count('bucket', Math.max(0.5, Math.round((b.waterL / BUCKET_L) * 2) / 2)) }),
    },
  ];
  const extra = (key: string, label: string, v: number, unit: 'kg' | 'l') => v > 0 && list.push({ key, label, value: amount(v, unit) });
  extra('flyAsh', t('mix.row.flyAsh'), b.flyAshKg, 'kg');
  extra('silicaFume', t('mix.row.silicaFume'), b.silicaFumeKg, 'kg');
  extra('waterproofing', t('mix.row.waterproofing'), b.waterproofingKg, 'kg');
  extra('plasticizer', t(`mix.row.${props.mix.plasticizer === 'FM' ? 'fm' : 'bv'}`), b.plasticizerL, 'l');
  extra('air', t('mix.batch.air'), b.airEntrainerL, 'l');
  return list;
});
</script>

<style scoped>
.mixers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.75rem 0;
}

.mixer {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.3rem 0.9rem;
  cursor: pointer;
  font-weight: 500;
}

.mixer.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.mixer:focus-within {
  outline: 2px solid var(--accent);
}

.summary {
  font-weight: 600;
}

.ratio {
  margin: 0.5rem 0 0.9rem;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
}

caption {
  text-align: left;
  font-weight: 600;
  padding-bottom: 0.4rem;
}

th[scope='row'] {
  text-transform: none;
  letter-spacing: 0;
  font-size: inherit;
  font-weight: 500;
  color: var(--text);
  width: 45%;
}
</style>

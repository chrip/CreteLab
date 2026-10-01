<template>
  <div class="stack">
    <p v-if="!result.ok" class="note blocker" role="alert">
      {{ $t('mix.error.fmRequired', { consistency: result.error.params.consistency }) }}
    </p>
    <template v-else>
      <p v-if="volume >= ORDER_SENSIBLE_FROM_M3" class="note">{{ $t('mix.largeVolume', { volume: vol(volume) }) }}</p>
      <IssueList :items="warnings">
        <template #default="{ item }">{{ $t(`mix.warning.${item.code}`, 'params' in item ? item.params : {}) }}</template>
      </IssueList>

      <div class="table-wrap">
        <table>
          <caption class="visually-hidden">{{ $t('mix.title') }}</caption>
          <thead>
            <tr>
              <th>{{ $t('mix.material') }}</th>
              <th class="num">{{ $t('mix.perM3') }}</th>
              <th class="num">{{ $t('mix.total', { volume: vol(volume) }) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <td>
                {{ $t(`mix.row.${row.key}`, row.params ?? {}) }}
                <div class="small muted">{{ $t(`mix.row.${row.key}Note`) }}</div>
              </td>
              <td class="num">{{ perM3(row.value, row.unit) }}</td>
              <td class="num">{{ amount(row.value * volume, row.unit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <BatchPlan :recipe="recipe" :volume="volume" :mix="mix" />

      <details>
        <summary>{{ $t('mix.grainGroups') }}</summary>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ $t('mix.group') }}</th>
                <th class="num">%</th>
                <th class="num">{{ $t('mix.dry') }}</th>
                <th class="num">{{ $t('mix.moisture') }}</th>
                <th class="num">{{ $t('mix.weighed') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in recipe.grainGroups" :key="g.range">
                <td>{{ g.range }} mm</td>
                <td class="num">{{ n(g.pct, 0) }}</td>
                <td class="num">{{ amount(g.massDry * volume, 'kg') }}</td>
                <td class="num">{{ n(g.moisturePct, 1) }} %</td>
                <td class="num">{{ amount(g.massMoist * volume, 'kg') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <div>
        <h3>{{ $t('mix.howTo') }}</h3>
        <ol class="steps">
          <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
        </ol>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
// Mixing it yourself: the B 20 mix design, per m³, for the whole volume and per batch on site.
import { ORDER_SENSIBLE_FROM_M3, computeRecipe, type MixInput } from '@cretelab/engine';
import { formatAmount, formatNumber, formatVolume, type Locale } from '~/utils/format';

const props = defineProps<{ mix: MixInput; volume: number }>();
const { t, locale } = useI18n();
const loc = computed(() => locale.value as Locale);
const n = (v: number, d: number) => formatNumber(loc.value, v, d);
const vol = (v: number) => formatVolume(loc.value, v);
const amount = (v: number, unit: 'kg' | 'l') => formatAmount(loc.value, v, unit);
const perM3 = (v: number, unit: 'kg' | 'l') => `${n(v, v < 10 ? 1 : 0)} ${unit}`;

const result = computed(() => computeRecipe(props.mix));
// Only read when result.ok; the template guards it.
const recipe = computed(() => (result.value.ok ? result.value.recipe : null)!);
const m = computed(() => recipe.value.materials);
const warnings = computed(() => recipe.value.warnings.map((w) => ({ ...w, severity: 'warning' as const })));

interface Row { key: string; value: number; unit: 'kg' | 'l'; params?: Record<string, string> }
const rows = computed<Row[]>(() => {
  const mm = m.value;
  const list: Row[] = [{ key: 'cement', value: mm.cement, unit: 'kg', params: { type: props.mix.cementType } }];
  if (mm.flyAsh > 0) list.push({ key: 'flyAsh', value: mm.flyAsh, unit: 'kg' });
  if (mm.silicaFume > 0) list.push({ key: 'silicaFume', value: mm.silicaFume, unit: 'kg' });
  if (mm.waterproofing > 0) list.push({ key: 'waterproofing', value: mm.waterproofing, unit: 'kg' });
  list.push({ key: 'aggregate', value: mm.aggregate, unit: 'kg', params: { sieve: props.mix.sieveLine } });
  if (mm.addedWater < mm.water) {
    list.push({ key: 'water', value: mm.water, unit: 'l' }, { key: 'addedWater', value: mm.addedWater, unit: 'l' });
  } else {
    list.push({ key: 'water', value: mm.water, unit: 'l' });
  }
  if (mm.plasticizerL > 0) list.push({ key: props.mix.plasticizer === 'FM' ? 'fm' : 'bv', value: mm.plasticizerL, unit: 'l' });
  if (mm.airEntrainerL > 0) list.push({ key: 'air', value: mm.airEntrainerL, unit: 'l', params: { pct: n(recipe.value.airPct, 1) } });
  return list;
});

const steps = computed(() => {
  const v = props.volume;
  const mm = m.value;
  const list = [t('mix.step.dry', { cement: amount(mm.cement * v, 'kg'), type: props.mix.cementType, aggregate: amount(mm.aggregate * v, 'kg') })];
  if (mm.flyAsh > 0) list.push(t('mix.step.flyAsh', { amount: amount(mm.flyAsh * v, 'kg') }));
  if (mm.silicaFume > 0) list.push(t('mix.step.silicaFume', { amount: amount(mm.silicaFume * v, 'kg') }));
  if (mm.waterproofing > 0) list.push(t('mix.step.waterproofing', { amount: amount(mm.waterproofing * v, 'kg') }));
  // Without aggregate moisture the added water is the total water (unrounded, as in the table).
  const water = mm.addedWater < mm.water ? mm.addedWater : mm.water;
  list.push(t('mix.step.water', { amount: amount(water * v, 'l') }));
  if (mm.plasticizerL > 0) list.push(t('mix.step.plasticizer', { amount: amount(mm.plasticizerL * v, 'l'), name: t(`option.plasticizer.${props.mix.plasticizer}`) }));
  if (mm.airEntrainerL > 0) list.push(t('mix.step.air', { amount: amount(mm.airEntrainerL * v, 'l'), pct: n(recipe.value.airPct, 1) }));
  list.push(t('mix.step.mix', { consistency: props.mix.consistency }), t('mix.step.place'));
  return list;
});
</script>

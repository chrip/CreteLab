<template>
  <div class="stack">
    <template v-if="plan.product">
      <div class="product" :class="{ muted: !plan.feasible }">
        <h3>{{ plan.product.manufacturer }} {{ plan.product.product }}</h3>
        <dl>
          <div>
            <dt>{{ $t('bag.declared') }}</dt>
            <dd>{{ plan.product.strengthClass }} · {{ plan.product.exposureClasses.join(', ') }}</dd>
          </div>
          <div>
            <dt>{{ $t('bag.grain') }}</dt>
            <dd>0–{{ plan.product.maxGrain }} mm</dd>
          </div>
          <div>
            <dt>{{ $t('bag.bags') }}</dt>
            <dd>
              <strong>{{ plan.bags }} × {{ plan.product.bagKg }} kg</strong>
              <span class="muted small">
                ({{ $t('bag.yield', { litres: n(plan.product.yieldL, 1) }) }})
              </span>
            </dd>
          </div>
          <div>
            <dt>{{ $t('bag.water') }}</dt>
            <dd>
              {{ $t('bag.waterPerBag', { litres: n(plan.product.waterL, 1) }) }} ·
              {{ $t('bag.waterTotal', { litres: n(plan.waterL, 0) }) }}
            </dd>
          </div>
        </dl>
        <p class="small">
          <a :href="plan.product.datasheet" target="_blank" rel="noopener noreferrer">{{ $t('bag.datasheet') }}</a>
          · {{ $t('bag.example') }}
        </p>
      </div>
    </template>

    <p v-if="asksForAdditions" class="note warn">
      {{ $t('bag.asksForAdditions') }} <NuxtLinkLocale to="/bag">{{ $t('bag.tuneLink') }}</NuxtLinkLocale>
    </p>
    <p v-if="!plan.feasible" class="note blocker">
      <strong>{{ $t('bag.notPossible') }}</strong>
    </p>
    <IssueList :items="plan.issues">
      <template #default="{ item }">
        <span v-if="item.code === 'not-declared'">
          {{ $t('bag.issue.notDeclared', { classes: item.params.classes.join(', ') || item.params.strengthClass }) }}
        </span>
        <span v-else-if="item.code === 'trade-only'">{{ $t('bag.issue.tradeOnly', item.params) }}</span>
        <span v-else-if="item.code === 'too-thin'">{{ $t('bag.issue.tooThin', item.params) }}</span>
        <span v-else-if="item.code === 'many-bags'">{{ $t('bag.issue.manyBags', item.params) }}</span>
        <span v-else-if="item.code === 'order-instead'">{{ $t('bag.issue.orderInstead', item.params) }}</span>
        <span v-else>{{ $t(`bag.issue.${item.code}`) }}</span>
      </template>
    </IssueList>

    <div v-if="plan.feasible">
      <h3>{{ $t('bag.howTo') }}</h3>
      <ol class="steps">
        <li v-for="rule in BAG_RULES" :key="rule">{{ $t(`bag.rule.${rule}`) }}</li>
      </ol>
    </div>

    <p class="small muted">
      {{ $t('bag.tuneHint') }}
      <NuxtLinkLocale to="/bag">{{ $t('bag.tuneLink') }}</NuxtLinkLocale>
    </p>
  </div>
</template>

<script setup lang="ts">
// Bagged concrete: the product that meets the requirements, or why none does.
import { BAG_RULES, planBag, type MixInput } from '@cretelab/engine';
import { formatNumber, type Locale } from '~/utils/format';
import { isReinforced } from '~/utils/mix';

const props = defineProps<{ mix: MixInput; volume: number; wall?: number | null; asksForAdditions?: boolean }>();
const { locale } = useI18n();
const n = (v: number, d: number) => formatNumber(locale.value as Locale, v, d);

const plan = computed(() =>
  planBag({
    strengthClass: props.mix.strengthClass,
    exposureClasses: props.mix.exposureClasses,
    structural: isReinforced(props.mix.exposureClasses),
    watertight: props.mix.waterproofingPct > 0,
    volume: props.volume,
    minThickness: props.wall ?? null,
  }),
);
</script>

<style scoped>
dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.75rem 1.5rem;
  margin: 0.75rem 0;
}

dt {
  font-size: 0.8rem;
  color: var(--text-muted);
}

dd {
  margin: 0;
}

.product.muted {
  opacity: 0.6;
}
</style>

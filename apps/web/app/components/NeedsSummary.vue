<template>
  <section class="card needs" aria-labelledby="needs-title">
    <h2 id="needs-title">{{ $t('needs.title') }}</h2>
    <p class="headline">
      <strong>{{ $t('needs.headline', { volume: vol(volume), strength: mix.strengthClass }) }}</strong>
    </p>
    <ul class="classes">
      <li v-for="c in shownClasses" :key="c">
        <span class="chip"><strong>{{ c }}</strong></span> {{ $t(`option.exposure.${c}.name`) }}
      </li>
    </ul>
    <p v-if="mix.airPct > 0" class="small">{{ $t('needs.air', { pct: n(mix.airPct, 1) }) }}</p>
    <p v-if="mix.waterproofingPct > 0" class="small">{{ $t('needs.watertight') }}</p>

    <template v-if="plan">
      <details>
        <summary class="small">{{ $t('needs.why') }}</summary>
        <ul class="small reasons">
          <li v-for="r in plan.requirements.reasons" :key="r">{{ $t(`reason.${r}`) }}</li>
        </ul>
      </details>
    </template>
    <p v-if="plan?.thinWall" class="note warn">
      {{ $t('needs.thinWall') }} <NuxtLinkLocale :to="{ path: '/fine-concrete', query: fineConcreteQuery }">{{ $t('needs.toFineConcrete') }}</NuxtLinkLocale>
    </p>
    <p class="small muted">{{ $t('needs.disclaimer') }}</p>
  </section>
</template>

<script setup lang="ts">
// "What you need" in plain words: amount, strength class and what the concrete must resist.
import type { MixInput, ProjectPlan } from '@cretelab/engine';
import { formatNumber, formatVolume, type Locale } from '~/utils/format';
import { fineConcreteStateFromPlan } from '~/utils/project';
import { encodeFineConcrete } from '~/utils/query';

const props = defineProps<{ mix: MixInput; volume: number; plan?: ProjectPlan | null }>();
const { locale } = useI18n();
const loc = computed(() => locale.value as Locale);
const n = (v: number, d: number) => formatNumber(loc.value, v, d);
const vol = (v: number) => formatVolume(loc.value, v);

const shownClasses = computed(() => (props.mix.exposureClasses.length ? props.mix.exposureClasses : ['X0' as const]));
const fineConcreteQuery = computed(() => (props.plan ? encodeFineConcrete(fineConcreteStateFromPlan(props.plan)) : {}));

</script>

<style scoped>
.headline {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.classes {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  display: grid;
  gap: 0.3rem;
}

.reasons {
  padding-left: 1.2rem;
  margin: 0.5rem 0;
}
</style>

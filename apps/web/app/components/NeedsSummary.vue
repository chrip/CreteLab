<template>
  <section class="card needs" aria-labelledby="needs-title">
    <!-- The concrete is the heading; the scale says how strong the class is. -->
    <h2 id="needs-title" class="headline">{{ $t('needs.headline', { volume: vol(volume), strength: mix.strengthClass }) }}</h2>
    <StrengthScale :marks="[{ cls: mix.strengthClass, kind: 'main' }]" />
    <p v-if="stated" class="small" :class="{ 'note warn': stated.tooLow }" data-testid="stated-strength">
      {{ $t(stated.tooLow ? 'needs.statedTooLow' : 'needs.statedStrength', { stated: stated.cls, minimum: stated.minimum }) }}
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
// The concrete in plain words: amount, strength class and what it must resist.
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
// Only while the class shown is the one the description led to; an edit in the details ends it.
const stated = computed(() => {
  const s = props.plan?.statedStrength;
  if (!s || s.cls === s.minimum) return null;
  return props.mix.strengthClass === (s.tooLow ? s.minimum : s.cls) ? s : null;
});
const fineConcreteQuery = computed(() => (props.plan ? encodeFineConcrete(fineConcreteStateFromPlan(props.plan)) : {}));

</script>

<style scoped>
.headline {
  font-size: 1.35rem;
  margin: 0 0 0.6rem;
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

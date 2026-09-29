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
      <p v-if="volumeFromText" class="small muted">{{ volumeNote }}</p>
      <details>
        <summary class="small">{{ $t('needs.why') }}</summary>
        <ul class="small reasons">
          <li v-for="r in plan.requirements.reasons" :key="r">{{ $t(`reason.${r}`) }}</li>
        </ul>
      </details>
    </template>
    <p v-if="plan?.thinWall" class="note warn">
      {{ $t('needs.thinWall') }} <NuxtLinkLocale :to="{ path: '/decor', query: decorQuery }">{{ $t('needs.toDecor') }}</NuxtLinkLocale>
    </p>
    <p class="small muted">{{ $t('needs.disclaimer') }}</p>
  </section>
</template>

<script setup lang="ts">
// "What you need" in plain words: amount, strength class and what the concrete must resist.
import type { MixInput, ProjectPlan } from '@cretelab/engine';
import { formatCompact, formatNumber, formatVolume, type Locale } from '~/utils/format';
import { decorStateFromPlan } from '~/utils/project';
import { encodeDecor } from '~/utils/query';

const props = defineProps<{ mix: MixInput; volume: number; plan?: ProjectPlan | null }>();
const { t, locale } = useI18n();
const loc = computed(() => locale.value as Locale);
const n = (v: number, d: number) => formatNumber(loc.value, v, d);
const vol = (v: number) => formatVolume(loc.value, v);

const shownClasses = computed(() => (props.mix.exposureClasses.length ? props.mix.exposureClasses : ['X0' as const]));
const decorQuery = computed(() => (props.plan ? encodeDecor(decorStateFromPlan(props.plan)) : {}));

// The note explains where the volume came from, until someone changes the volume by hand.
const volumeFromText = computed(() => props.plan && Math.abs(props.plan.volume.volume - props.volume) < 1e-9);

const volumeNote = computed(() => {
  const v = props.plan?.volume;
  if (!v) return '';
  if (v.source === 'default') return t('volume.default', { volume: vol(v.volume) });
  if (v.source === 'hollow') return t(`volume.hollow.${v.open ?? 'one'}`, { match: v.match ?? '' });
  if (v.source === 'laya') {
    const parts: string[] = [];
    if (v.shape) parts.push(t(`volume.shape.${v.shape}`));
    if (v.count && v.count > 1) parts.push(t('volume.count', { count: v.count }));
    if (v.wall) parts.push(t('volume.wall', { wall: formatCompact(loc.value, v.wall * 100, 1) }));
    return t('volume.laya', { detail: parts.join(', '), match: v.match ?? '' });
  }
  return t(`volume.${v.source}`, { match: v.match ?? '' });
});
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

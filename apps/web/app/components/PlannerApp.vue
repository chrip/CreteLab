<template>
  <div class="stack">
    <DescribeForm
      :initial="state.q"
      :busy="busy"
      :error="error"
      submit-label="describe.reanalyse"
      @submit="onDescribe"
    />
    <UnderstoodPanel v-if="analysis && plan" :analysis="analysis" :plan="plan" :volume="state.volume" />

    <div ref="results" class="results" :class="{ flash }">
    <NeedsSummary :mix="state.mix" :volume="state.volume" :plan="plan" />

    <section aria-labelledby="production-title">
      <h2 id="production-title">{{ $t('production.title') }}</h2>
      <p v-if="plan?.bagRejected" class="note warn" data-testid="bag-rejected">
        {{ $t('production.bagRejected', { production: $t(`production.${plan.production}.name`) }) }}
      </p>
      <ProductionTabs v-model="state.tab" :recommended="plan?.production">
        <template #bag><BagPanel :mix="state.mix" :volume="state.volume" :wall="plan?.wall" :asks-for-additions="plan?.wantsBagTuning" /></template>
        <template #mix><MixPanel :mix="state.mix" :volume="state.volume" /></template>
        <template #order><OrderPanel :mix="state.mix" :volume="state.volume" /></template>
      </ProductionTabs>
    </section>
    </div>

    <details class="card" :open="detailsOpen" @toggle="detailsOpen = ($event.target as HTMLDetailsElement).open">
      <summary>{{ $t('details.title') }}</summary>
      <p class="small muted">{{ $t('details.lead') }}</p>
      <MixForm v-model:mix="state.mix" v-model:volume="state.volume" />
    </details>

    <!-- A change down in the form recalculates everything above; say so where the eye is. -->
    <div v-if="notice" class="recalc" role="status" data-testid="recalc-notice">
      <span>✓ {{ $t('details.updated', { volume: formatVolume(locale as Locale, state.volume), strength: state.mix.strengthClass }) }}</span>
      <button type="button" class="btn" @click="toResults">{{ $t('details.toResults') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// The component planner: description, what it needs, three ways to make it and every detail.
// State lives in the URL; Laya's answers for the description are cached per tab.
import { planProject, type AnalysisResponse } from '@cretelab/engine';
import { fineConcreteStateFromPlan, plannerStateFromPlan } from '~/utils/project';
import { decodePlanner, encodeFineConcrete, encodePlanner } from '~/utils/query';
import { formatVolume, type Locale } from '~/utils/format';

const { state, reset } = useUrlState(decodePlanner, encodePlanner);
const { locale } = useI18n();
const { analyse, busy, error } = useAnalysis();
const localePath = useLocalePath();
const analysis = ref<AnalysisResponse | null>(state.value.q ? (cachedAnalysis(state.value.q) ?? null) : null);
const detailsOpen = ref(false);

// The plan explains the numbers (reasons, volume note) as long as the description is the same.
const plan = computed(() => (analysis.value ? planProject(state.value.q, analysis.value) : null));

// A description in the URL without cached answers (a shared link): ask Laya again, but keep
// the values from the URL, they may have been edited.
onMounted(async () => {
  if (state.value.q && !analysis.value) analysis.value = await analyse(state.value.q);
});

// Every recalculation lights up the results; when they are scrolled out of view a notice
// at the bottom says what changed and leads back up.
const results = ref<HTMLElement | null>(null);
const flash = ref(false);
const notice = ref(false);
let flashTimer: ReturnType<typeof setTimeout> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [state.value.mix, state.value.volume],
  async () => {
    if (!import.meta.client || !results.value) return;
    flash.value = false;
    await nextTick();
    requestAnimationFrame(() => (flash.value = true));
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flash.value = false), 1200);
    const box = results.value.getBoundingClientRect();
    const outOfView = box.bottom < 80 || box.top > window.innerHeight - 80 || box.top < 0;
    if (!outOfView) return;
    notice.value = true;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice.value = false), 5000);
  },
  { deep: true },
);
onBeforeUnmount(() => {
  clearTimeout(flashTimer);
  clearTimeout(noticeTimer);
});

function toResults() {
  notice.value = false;
  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  results.value?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

async function onDescribe(text: string) {
  const result = await analyse(text);
  if (!result) return;
  analysis.value = result;
  const next = planProject(text, result);
  if (next.tool === 'decor') {
    await navigateTo({ path: localePath('/fine-concrete'), query: { ...encodeFineConcrete(fineConcreteStateFromPlan(next)), from: 'planner' } });
    return;
  }
  reset(plannerStateFromPlan(next));
}
</script>

<style scoped>
.results > * + * {
  margin-top: 1.25rem;
}

.results.flash :deep(.needs),
.results.flash :deep([role='tabpanel']) {
  animation: recalc 1.2s ease-out;
}

@keyframes recalc {
  0% {
    box-shadow: 0 0 0 3px var(--accent);
    background-color: var(--accent-soft);
  }
  100% {
    box-shadow: 0 0 0 3px transparent;
  }
}

.recalc {
  position: fixed;
  left: 1rem;
  right: 1rem;
  bottom: 1rem;
  z-index: 20;
  max-width: 32rem;
  margin-inline: auto;
  justify-content: space-between;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.6rem 0.6rem 0.6rem 1rem;
  border-radius: var(--radius);
  background: var(--text);
  color: var(--bg);
  box-shadow: var(--shadow);
  font-weight: 600;
}

.recalc span {
  min-width: 0;
}

.recalc .btn {
  padding: 0.35rem 0.8rem;
  font-size: 0.9rem;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .results.flash :deep(.needs),
  .results.flash :deep([role='tabpanel']) {
    animation: none;
    outline: 3px solid var(--accent);
  }
}
</style>

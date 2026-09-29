<template>
  <div class="stack">
    <DescribeForm
      :initial="state.q"
      :busy="busy"
      :error="error"
      submit-label="describe.reanalyse"
      @submit="onDescribe"
    />
    <FactList v-if="analysis" :answers="analysis.answers" :model="analysis.model" />

    <NeedsSummary :mix="state.mix" :volume="state.volume" :plan="plan" />

    <section aria-labelledby="production-title">
      <h2 id="production-title">{{ $t('production.title') }}</h2>
      <ProductionTabs v-model="state.tab" :recommended="plan?.production">
        <template #bag><BagPanel :mix="state.mix" :volume="state.volume" :wall="plan?.wall" :asks-for-additions="plan?.wantsBagTuning" /></template>
        <template #mix><MixPanel :mix="state.mix" :volume="state.volume" /></template>
        <template #order><OrderPanel :mix="state.mix" :volume="state.volume" /></template>
      </ProductionTabs>
    </section>

    <details class="card" :open="detailsOpen" @toggle="detailsOpen = ($event.target as HTMLDetailsElement).open">
      <summary>{{ $t('details.title') }}</summary>
      <p class="small muted">{{ $t('details.lead') }}</p>
      <MixForm v-model:mix="state.mix" v-model:volume="state.volume" />
    </details>
  </div>
</template>

<script setup lang="ts">
// The component planner: description, what it needs, three ways to make it and every detail.
// State lives in the URL; Laya's answers for the description are cached per tab.
import { planProject, type AnalysisResponse } from '@cretelab/engine';
import { decorStateFromPlan, plannerStateFromPlan } from '~/utils/project';
import { decodePlanner, encodeDecor, encodePlanner } from '~/utils/query';

const { state, reset } = useUrlState(decodePlanner, encodePlanner);
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

async function onDescribe(text: string) {
  const result = await analyse(text);
  if (!result) return;
  analysis.value = result;
  const next = planProject(text, result);
  if (next.tool === 'decor') {
    await navigateTo({ path: localePath('/decor'), query: { ...encodeDecor(decorStateFromPlan(next)), from: 'planner' } });
    return;
  }
  reset(plannerStateFromPlan(next));
}
</script>

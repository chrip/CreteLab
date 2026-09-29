<template>
  <div class="page">
    <section class="hero">
      <h1>{{ $t('home.title') }}</h1>
      <p class="lead">{{ $t('home.lead') }}</p>
      <ClientOnly>
        <DescribeForm :busy="busy" :error="error" examples @submit="onDescribe" />
        <template #fallback>
          <div class="placeholder" aria-hidden="true" ></div>
        </template>
      </ClientOnly>
      <p class="small muted">{{ $t('home.privacy') }}</p>
    </section>

    <section aria-labelledby="tools-title">
      <h2 id="tools-title" class="visually-hidden">{{ $t('home.tools') }}</h2>
      <div class="grid tools">
        <NuxtLinkLocale v-for="tool in TOOLS" :key="tool.id" :to="tool.path" class="card tool">
          <h3>{{ $t(`home.tool.${tool.id}.title`) }}</h3>
          <p class="muted">{{ $t(`home.tool.${tool.id}.text`) }}</p>
          <span class="more">{{ $t(`home.tool.${tool.id}.cta`) }} →</span>
        </NuxtLinkLocale>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Start page: one description, Laya decides between the planner and the decor workshop.
import { planProject } from '@cretelab/engine';
import { decorStateFromPlan, plannerStateFromPlan } from '~/utils/project';
import { encodeDecor, encodePlanner } from '~/utils/query';

const TOOLS = [
  { id: 'planner', path: '/plan' },
  { id: 'decor', path: '/decor' },
  { id: 'bag', path: '/bag' },
] as const;

const { t } = useI18n();
useSeoMeta({ title: () => t('home.metaTitle'), description: () => t('home.lead') });

const { analyse, busy, error } = useAnalysis();
const localePath = useLocalePath();

async function onDescribe(text: string) {
  const result = await analyse(text);
  if (!result) return;
  const plan = planProject(text, result);
  if (plan.tool === 'decor') {
    await navigateTo({ path: localePath('/decor'), query: { ...encodeDecor(decorStateFromPlan(plan)), from: 'home' } });
  } else {
    await navigateTo({ path: localePath('/plan'), query: encodePlanner(plannerStateFromPlan(plan)) });
  }
}
</script>

<style scoped>
.hero {
  padding-block: 2rem 2.5rem;
}

.hero :deep(.describe) {
  margin: 1.5rem 0 0.5rem;
}

.placeholder {
  height: 7.5rem;
  margin: 1.5rem 0 0.5rem;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.tool {
  text-decoration: none;
  color: var(--text);
  display: flex;
  flex-direction: column;
  transition: border-color 0.15s;
}

.tool:hover {
  border-color: var(--accent);
  color: var(--text);
}

.tool p {
  flex: 1;
}

.more {
  color: var(--accent);
  font-weight: 600;
}
</style>

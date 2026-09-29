<template>
  <details class="facts">
    <summary>{{ $t('facts.title') }} <span class="muted small">({{ model }})</span></summary>
    <ul>
      <li v-for="f in facts" :key="f.id" class="chip" :class="f.level" :title="`${Math.round(f.p * 100)} %`">
        {{ $t(`facts.${f.id}`) }}<span v-if="f.level === 'unsure'" class="muted"> · {{ $t('facts.unsure') }}</span>
      </li>
      <li class="chip yes">{{ $t(`facts.element.${element}`) }}</li>
      <li class="chip yes">{{ $t(`facts.traffic.${traffic}`) }}</li>
    </ul>
  </details>
</template>

<script setup lang="ts">
// What Laya understood, with its certainty: struck through = no, amber = unsure.
import { FACT_IDS, certainty, probability, type Answers } from '@cretelab/engine';

const props = defineProps<{ answers: Answers; model: string }>();
const facts = computed(() =>
  ['fine_cast', ...FACT_IDS].map((id) => {
    const p = probability(props.answers, id);
    return { id, p, level: certainty(p) };
  }),
);
const element = computed(() => props.answers.element?.choice ?? 'slab');
const traffic = computed(() => Math.round(props.answers.traffic?.score ?? 0));
</script>

<style scoped>
ul {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>

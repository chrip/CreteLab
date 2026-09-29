<template>
  <div class="tabs">
    <div role="tablist" :aria-label="$t('production.title')" class="tablist" @keydown="onKey">
      <button
        v-for="tab in tabs"
        :id="`tab-${tab}`"
        :key="tab"
        ref="buttons"
        role="tab"
        type="button"
        :aria-selected="model === tab"
        :aria-controls="`panel-${tab}`"
        :tabindex="model === tab ? 0 : -1"
        @click="model = tab"
      >
        <span class="name">{{ $t(`production.${tab}.name`) }}</span>
        <span class="sub">{{ $t(`production.${tab}.sub`) }}</span>
        <span v-if="recommended === tab" class="badge">{{ $t('production.recommended') }}</span>
      </button>
    </div>
    <div :id="`panel-${model}`" role="tabpanel" :aria-labelledby="`tab-${model}`" class="panel">
      <slot :name="model" ></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
// Accessible tabs (WAI-ARIA pattern): arrow keys move between the three ways to make it.
import type { Production } from '@cretelab/engine';

defineProps<{ recommended?: Production }>();
const model = defineModel<Production>({ required: true });
const tabs: Production[] = ['bag', 'mix', 'order'];
const buttons = ref<HTMLButtonElement[]>([]);

function onKey(e: KeyboardEvent) {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  const next = tabs[(tabs.indexOf(model.value) + step + tabs.length) % tabs.length]!;
  model.value = next;
  nextTick(() => buttons.value[tabs.indexOf(next)]?.focus());
}
</script>

<style scoped>
.tablist {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

[role='tab'] {
  font: inherit;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: var(--radius) var(--radius) 0 0;
  padding: 0.75rem 1rem;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

[role='tab'][aria-selected='true'] {
  border-color: var(--accent);
  box-shadow: inset 0 -3px 0 var(--accent);
}

.name {
  font-weight: 700;
}

.sub {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.badge {
  position: absolute;
  top: -0.6rem;
  right: 0.75rem;
  font-size: 0.7rem;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0 0 var(--radius) var(--radius);
  padding: 1.25rem 1.5rem;
}

@media (max-width: 40rem) {
  .sub {
    display: none;
  }
}
</style>

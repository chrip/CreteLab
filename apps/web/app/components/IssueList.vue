<template>
  <ul v-if="items.length" class="issues">
    <li v-for="(item, i) in items" :key="i" class="note" :class="item.severity">
      <slot :item="item" ></slot>
    </li>
  </ul>
</template>

<script setup lang="ts" generic="T extends { severity: 'blocker' | 'warning' | 'info' }">
defineProps<{ items: readonly T[] }>();
</script>

<style scoped>
.issues {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
}

.note.warning {
  border-color: var(--warn);
  background: var(--warn-soft);
}
</style>
